"""
Tests for JWT Authentication with HttpOnly cookies per Phase 2 requirements.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.identity.services import create_user_with_membership
from apps.tenants.models import Institution, TenantRegistry

@pytest.mark.django_db(databases='__all__')
class TestAuthJWT:
    @pytest.fixture(autouse=True)
    def setup_tenant_and_users(self):
        self.client = APIClient()

        # Ensure horizon institution exists in control DB ('default')
        self.inst, _ = Institution.objects.using('default').update_or_create(
            slug='horizon',
            defaults={'name': 'Horizon School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_horizon.sqlite3', 'status': 'ACTIVE'}
        )

        # Create Teacher user in tenant_horizon
        self.teacher_mem = create_user_with_membership('tenant_horizon', {
            'email': 'sarah@horizon.edu',
            'username': 'sarah_teacher',
            'password': 'SecureTeacherPass123!',
            'full_name': 'Sarah Jenkins',
            'role': 'TEACHER',
            'employee_id': 'T-001',
        })

        # Create Finance Staff in tenant_horizon
        self.finance_mem = create_user_with_membership('tenant_horizon', {
            'email': 'finance@horizon.edu',
            'username': 'finance_user',
            'password': 'SecureFinancePass123!',
            'full_name': 'Eleanor Rigby',
            'role': 'STAFF',
            'employee_id': 'STF-001',
            'staff_type': 'FINANCE',
        })

    def test_login_success_sets_httponly_cookie(self):
        """Login sets HttpOnly access_token and refresh_token cookies."""
        url = reverse('auth-login')
        payload = {
            'username': 'sarah_teacher',
            'password': 'SecureTeacherPass123!'
        }
        response = self.client.post(url, payload, HTTP_X_TENANT_SLUG='horizon')

        assert response.status_code == 200
        assert response.data['success'] is True
        assert 'access_token' in response.cookies
        assert response.cookies['access_token']['httponly'] is True
        assert 'refresh_token' in response.cookies
        assert response.cookies['refresh_token']['httponly'] is True

        # Assert no raw JWT token is returned in the response JSON body (no localStorage!)
        assert 'access_token' not in response.data['data']
        assert 'token' not in response.data['data']

    def test_login_failure_invalid_password(self):
        """Invalid password returns 401 with standard error envelope."""
        url = reverse('auth-login')
        payload = {
            'username': 'sarah_teacher',
            'password': 'WrongPassword123!'
        }
        response = self.client.post(url, payload, HTTP_X_TENANT_SLUG='horizon')

        assert response.status_code == 401
        assert response.data['success'] is False
        assert response.data['error']['code'] == 'AUTHENTICATION_FAILED'

    def test_logout_clears_cookies(self):
        """Logout clears access_token and refresh_token cookies."""
        url = reverse('auth-logout')
        response = self.client.post(url, HTTP_X_TENANT_SLUG='horizon')

        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.cookies['access_token'].value == ''
        assert response.cookies['refresh_token'].value == ''

    def test_auth_me_permissions_teacher_vs_finance(self):
        """GET /api/v1/auth/me/ returns distinct evaluated permissions for Teacher vs Finance."""
        # 1. Login as Teacher
        login_url = reverse('auth-login')
        login_resp = self.client.post(login_url, {
            'username': 'sarah_teacher',
            'password': 'SecureTeacherPass123!'
        }, HTTP_X_TENANT_SLUG='horizon')
        assert login_resp.status_code == 200

        # Request /api/v1/auth/me/
        me_url = reverse('auth-me')
        resp = self.client.get(me_url, HTTP_X_TENANT_SLUG='horizon')
        assert resp.status_code == 200
        teacher_perms = resp.data['data']['permissions']
        assert 'students.read_directory' in teacher_perms
        assert 'attendance.mark_class' in teacher_perms
        assert 'fees.structures_crud' not in teacher_perms

        # 2. Login as Finance Staff
        login_resp2 = self.client.post(login_url, {
            'username': 'finance_user',
            'password': 'SecureFinancePass123!'
        }, HTTP_X_TENANT_SLUG='horizon')
        assert login_resp2.status_code == 200

        resp2 = self.client.get(me_url, HTTP_X_TENANT_SLUG='horizon')
        assert resp2.status_code == 200
        finance_perms = resp2.data['data']['permissions']
        assert 'fees.structures_crud' in finance_perms
        assert 'fees.invoices_crud' in finance_perms
        assert 'fees.payments_crud' in finance_perms
        assert 'attendance.mark_class' not in finance_perms

    def test_refresh_token_success_issues_new_access_cookie(self):
        """POST /api/v1/auth/refresh/ validates refresh cookie and issues a fresh access_token cookie."""
        login_url = reverse('auth-login')
        login_resp = self.client.post(login_url, {
            'username': 'sarah_teacher',
            'password': 'SecureTeacherPass123!'
        }, HTTP_X_TENANT_SLUG='horizon')
        assert login_resp.status_code == 200
        assert 'refresh_token' in login_resp.cookies

        # Simulate expired access token by removing access_token from client cookies
        del self.client.cookies['access_token']

        # Ensure calling protected endpoint without access_token fails with 401
        me_url = reverse('auth-me')
        unauth_resp = self.client.get(me_url, HTTP_X_TENANT_SLUG='horizon')
        assert unauth_resp.status_code == 401

        # Now refresh the token
        refresh_url = reverse('auth-refresh')
        refresh_resp = self.client.post(refresh_url, HTTP_X_TENANT_SLUG='horizon')
        assert refresh_resp.status_code == 200
        assert refresh_resp.data['success'] is True
        assert 'access_token' in refresh_resp.cookies
        assert refresh_resp.cookies['access_token']['httponly'] is True

        # Now calling protected endpoint succeeds with the refreshed access_token cookie
        me_resp = self.client.get(me_url, HTTP_X_TENANT_SLUG='horizon')
        assert me_resp.status_code == 200
        assert me_resp.data['data']['email'] == 'sarah@horizon.edu'

    def test_refresh_token_missing_cookie_returns_401(self):
        """POST /api/v1/auth/refresh/ without refresh token cookie returns 401."""
        refresh_url = reverse('auth-refresh')
        resp = self.client.post(refresh_url, HTTP_X_TENANT_SLUG='horizon')
        assert resp.status_code == 401
        assert resp.data['success'] is False
        assert resp.data['error']['code'] == 'REFRESH_TOKEN_REQUIRED'

    def test_refresh_token_invalid_or_expired_returns_401(self):
        """POST /api/v1/auth/refresh/ with invalid refresh token returns 401."""
        refresh_url = reverse('auth-refresh')
        self.client.cookies['refresh_token'] = 'invalid.junk.token'
        resp = self.client.post(refresh_url, HTTP_X_TENANT_SLUG='horizon')
        assert resp.status_code == 401
        assert resp.data['success'] is False
        assert resp.data['error']['code'] == 'TOKEN_INVALID_OR_EXPIRED'

    def test_refresh_token_cross_tenant_returns_404(self):
        """POST /api/v1/auth/refresh/ from different tenant returns 404 per non-negotiable rule."""
        # Create second tenant in control DB
        other_inst, _ = Institution.objects.using('default').update_or_create(
            slug='other',
            defaults={'name': 'Other School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=other_inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_horizon.sqlite3', 'status': 'ACTIVE'}
        )

        login_url = reverse('auth-login')
        login_resp = self.client.post(login_url, {
            'username': 'sarah_teacher',
            'password': 'SecureTeacherPass123!'
        }, HTTP_X_TENANT_SLUG='horizon')
        assert login_resp.status_code == 200

        # Attempt to refresh token under tenant 'other'
        refresh_url = reverse('auth-refresh')
        resp = self.client.post(refresh_url, HTTP_X_TENANT_SLUG='other')
        assert resp.status_code == 404
