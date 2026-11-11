"""
Comprehensive Security and Penetration Resistance Test Suite for EduFlow ERP.
Tests resilience against:
1. SQL Injection (SQLi) across auth, tenant headers, and query parameters.
2. Cross-Tenant boundary bypass & token spoofing (BOLA).
3. Path traversal & null-byte injection in tenant routing.
4. XSS script payload storage & serialization safety.
5. Sensitive data leakage / field exclusion assertions.
6. HTTP security hardening headers.
"""

import pytest
from django.urls import reverse
from django.test import override_settings
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient
from rest_framework import status

from apps.identity.services import create_user_with_membership, generate_tokens_for_user
from apps.tenants.models import Institution, TenantRegistry


@pytest.mark.django_db(databases='__all__')
class TestSecurityAudit:

    @pytest.fixture(autouse=True)
    def setup_security_fixtures(self):
        self.client = APIClient()

        # 1. Setup Tenant A ('horizon')
        self.inst_a, _ = Institution.objects.using('default').update_or_create(
            slug='horizon',
            defaults={'name': 'Horizon Academy', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst_a,
            defaults={'db_url': 'sqlite:///eduflow_tenant_horizon.sqlite3', 'status': 'ACTIVE'}
        )

        # Setup Tenant B ('summit')
        self.inst_b, _ = Institution.objects.using('default').update_or_create(
            slug='summit',
            defaults={'name': 'Summit School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst_b,
            defaults={'db_url': 'sqlite:///eduflow_tenant_horizon.sqlite3', 'status': 'ACTIVE'}
        )

        # 2. Seed Admin user for Horizon
        self.admin_mem = create_user_with_membership('tenant_horizon', {
            'email': 'admin@horizon.edu',
            'username': 'admin_horizon',
            'password': 'SecureAdminPass123!',
            'full_name': 'Dr. Alistair Vance',
            'role': 'ADMIN',
        })

        # 3. Seed Teacher user for Horizon (holds students.read_directory)
        self.teacher_mem = create_user_with_membership('tenant_horizon', {
            'email': 'sarah@horizon.edu',
            'username': 'sarah_teacher',
            'password': 'SecureTeacherPass123!',
            'full_name': 'Sarah Jenkins',
            'role': 'TEACHER',
            'employee_id': 'T-001',
        })

        # 4. Seed Student user for Horizon
        self.student_mem = create_user_with_membership('tenant_horizon', {
            'email': 'student@horizon.edu',
            'username': 'student_leo',
            'password': 'SecureStudentPass123!',
            'full_name': 'Leo Miller',
            'role': 'STUDENT',
            'admission_number': 'ADM-SEC-001',
            'guardian_name': 'Arthur Miller',
            'guardian_phone': '+19998887777',
            'dob': '2010-05-15',
        })

        # 5. Generate Auth Tokens
        self.admin_access, self.admin_refresh = generate_tokens_for_user(self.admin_mem.user, 'horizon')
        self.teacher_access, self.teacher_refresh = generate_tokens_for_user(self.teacher_mem.user, 'horizon')
        self.student_access, self.student_refresh = generate_tokens_for_user(self.student_mem.user, 'horizon')

    # =========================================================================
    # 1. SQL INJECTION (SQLi) TESTS
    # =========================================================================

    def test_sqli_in_login_username(self):
        """Classic SQL injection in username is safely parameterized and rejected."""
        url = reverse('auth-login')
        payloads = [
            "' OR '1'='1",
            "admin'--",
            "' UNION SELECT * FROM users--",
            "admin' OR 1=1 #",
            "'; DROP TABLE users; --",
        ]
        for injection in payloads:
            res = self.client.post(
                url,
                {'username': injection, 'password': 'password123'},
                format='json',
                HTTP_X_TENANT_SLUG='horizon'
            )
            # Must return 401 Unauthorized, never 200 or 500
            assert res.status_code == status.HTTP_401_UNAUTHORIZED
            assert res.data['success'] is False

    def test_sqli_in_login_password(self):
        """SQL injection in password field is safely handled by Argon2 hasher without DB evaluation."""
        url = reverse('auth-login')
        injection_pwd = "' OR '1'='1' --"
        res = self.client.post(
            url,
            {'username': 'admin_horizon', 'password': injection_pwd},
            format='json',
            HTTP_X_TENANT_SLUG='horizon'
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_sqli_in_tenant_slug_header(self):
        """SQL injection in X-Tenant-Slug header triggers clean 404 without SQL error."""
        url = reverse('auth-login')
        malicious_slugs = [
            "horizon' OR '1'='1",
            "horizon'; DROP TABLE institutions;--",
            "' UNION SELECT slug, name, status FROM institutions--",
            "horizon'--",
            "admin' #",
        ]
        for bad_slug in malicious_slugs:
            res = self.client.post(
                url,
                {'username': 'admin_horizon', 'password': 'SecureAdminPass123!'},
                format='json',
                HTTP_X_TENANT_SLUG=bad_slug
            )
            # Per non-negotiable rule: invalid tenant returns 404
            assert res.status_code == status.HTTP_404_NOT_FOUND
            data = res.json()
            assert data['error']['code'] == 'NOT_FOUND'

    def test_sqli_in_query_parameters(self):
        """SQL injection attempts in URL query params are safely escaped by ORM."""
        url = reverse('user-list-create')
        self.client.cookies['access_token'] = self.admin_access

        malicious_queries = [
            "?role=' OR '1'='1",
            "?q=' UNION SELECT 1, 2, 3, 4--",
            "?search=admin'; DELETE FROM users;--",
        ]
        for query in malicious_queries:
            res = self.client.get(f"{url}{query}", HTTP_X_TENANT_SLUG='horizon')
            assert res.status_code == status.HTTP_200_OK
            assert 'data' in res.data

    def test_sqli_in_provisioning_slug(self):
        """Management command rejects SQL injection characters in tenant slug."""
        with pytest.raises(CommandError) as exc_info:
            call_command(
                'create_tenant',
                slug="malicious'; DROP DATABASE test; --",
                name="Malicious School"
            )
        assert "Invalid slug" in str(exc_info.value)

    # =========================================================================
    # 2. CROSS-TENANT BOUNDARY ISOLATION (BOLA / 404 RULE)
    # =========================================================================

    def test_cross_tenant_token_tampering_returns_404(self):
        """A valid token for Tenant A presented to Tenant B returns 404 (never 403)."""
        url = reverse('user-list-create')
        self.client.cookies['access_token'] = self.admin_access  # minted for 'horizon'

        # Attempt to access 'summit'
        res = self.client.get(url, HTTP_X_TENANT_SLUG='summit')
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_missing_tenant_identifier_returns_404(self):
        """Requests without tenant identification in production mode return 404."""
        url = reverse('user-list-create')
        self.client.cookies['access_token'] = self.admin_access

        with override_settings(DEBUG=False):
            res = self.client.get(url)
            assert res.status_code == status.HTTP_404_NOT_FOUND

    # =========================================================================
    # 3. PATH TRAVERSAL & INPUT ESCAPING
    # =========================================================================

    def test_path_traversal_in_tenant_header(self):
        """Path traversal patterns in X-Tenant-Slug return 404."""
        url = reverse('auth-login')
        traversal_attempts = [
            "../../etc/passwd",
            "..\\..\\windows\\system32",
            "....//....//....//etc/shadow",
            "/var/run/secrets",
        ]
        for attempt in traversal_attempts:
            res = self.client.post(
                url,
                {'username': 'admin_horizon', 'password': 'SecureAdminPass123!'},
                format='json',
                HTTP_X_TENANT_SLUG=attempt
            )
            assert res.status_code == status.HTTP_404_NOT_FOUND

    # =========================================================================
    # 4. SENSITIVE DATA EXPOSURE & DIRECTORY EXCLUSION
    # =========================================================================

    def test_directory_endpoint_excludes_sensitive_pii(self):
        """Directory endpoint strictly excludes guardian phone, name, dob, and fee balance."""
        url = reverse('user-list-create')
        # Teacher has students.read_directory
        self.client.cookies['access_token'] = self.teacher_access
        res = self.client.get(url, HTTP_X_TENANT_SLUG='horizon')

        assert res.status_code == status.HTTP_200_OK
        data = res.data['data']
        assert len(data) >= 1

        for student in data:
            # Sensitive fields must NEVER be present
            assert 'guardian_name' not in student
            assert 'guardian_phone' not in student
            assert 'date_of_birth' not in student
            assert 'dob' not in student
            assert 'address' not in student
            assert 'current_address' not in student
            assert 'fee_balance' not in student
            assert 'password_hash' not in student
            assert 'password' not in student

    def test_user_list_never_leaks_password_hashes(self):
        """User management endpoints never expose password hashes."""
        url = reverse('user-list-create')
        self.client.cookies['access_token'] = self.admin_access
        res = self.client.get(url, HTTP_X_TENANT_SLUG='horizon')

        assert res.status_code == status.HTTP_200_OK
        for user_entry in res.data['data']:
            assert 'password_hash' not in user_entry
            assert 'password' not in user_entry

    # =========================================================================
    # 5. XSS SCRIPT INJECTION SAFETY
    # =========================================================================

    def test_xss_script_stored_as_literal_not_executed(self):
        """XSS script payloads submitted in text fields are stored literally without execution."""
        url = reverse('announcements-list-create')
        self.client.cookies['access_token'] = self.admin_access

        xss_payload = "<script>alert('XSS Attack!')</script><img src=x onerror=alert(1)>"
        res = self.client.post(
            url,
            {
                'title': 'Safety Notice',
                'content': xss_payload,
                'target_role': 'ALL'
            },
            format='json',
            HTTP_X_TENANT_SLUG='horizon'
        )

        assert res.status_code == status.HTTP_201_CREATED
        # Output must contain the exact literal characters, not executed or altered
        assert res.data['data']['content'] == xss_payload

    # =========================================================================
    # 6. HTTP SECURITY HARDENING HEADERS
    # =========================================================================

    def test_security_headers_present_in_responses(self):
        """Responses include essential security headers (nosniff, DENY)."""
        url = reverse('auth-login')
        res = self.client.post(
            url,
            {'username': 'admin_horizon', 'password': 'SecureAdminPass123!'},
            format='json',
            HTTP_X_TENANT_SLUG='horizon'
        )
        assert res.status_code == status.HTTP_200_OK
        # Verify X-Content-Type-Options
        assert res.headers.get('X-Content-Type-Options') == 'nosniff'
        # Verify X-Frame-Options clickjacking protection
        assert res.headers.get('X-Frame-Options') == 'DENY'
