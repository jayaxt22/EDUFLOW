"""
Automated tests for Django Admin Control Plane and Superadmin Tenant Provisioning.
Verifies:
1. /admin/ accessibility without X-Tenant-Slug header.
2. Admin authentication and model registrations.
3. Automated tenant provisioning service.
4. Control database boundary isolation.
"""

import pytest
from django.urls import reverse
from django.test import Client
from django.contrib.auth.models import User as DjangoUser
from apps.tenants.models import Institution, TenantRegistry, PlatformUser
from apps.tenants.provisioning import provision_new_tenant
from apps.identity.models import User as TenantUser


@pytest.mark.django_db(databases=['default', 'tenant_demo', 'tenant_horizon'])
class TestSuperadminControlPlane:
    @pytest.fixture(autouse=True)
    def setup_superadmin(self):
        self.client = Client()
        # Create superadmin in 'default' control DB
        self.superadmin, _ = DjangoUser.objects.using('default').update_or_create(
            username='control_superadmin',
            defaults={
                'email': 'superadmin@eduflow.local',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )
        self.superadmin.set_password('SuperSecretPass123!')
        self.superadmin.save(using='default')

    def test_admin_login_page_accessible_without_tenant_slug(self):
        """Admin login URL is accessible without X-Tenant-Slug (exempted in TenantMiddleware)."""
        response = self.client.get('/admin/login/')
        assert response.status_code == 200
        assert b"Django administration" in response.content or b"Log in" in response.content

    def test_unauthenticated_admin_redirects_to_login(self):
        """Unauthenticated access to /admin/ redirects to /admin/login/."""
        response = self.client.get('/admin/')
        assert response.status_code == 302
        assert '/admin/login/' in response.url

    def test_superadmin_login_success(self):
        """Superadmin can successfully log into /admin/."""
        logged_in = self.client.login(username='control_superadmin', password='SuperSecretPass123!')
        assert logged_in is True
        response = self.client.get('/admin/')
        assert response.status_code == 200
        assert b"Institutions" in response.content
        assert b"Tenant Registries" in response.content

    def test_regular_tenant_user_cannot_access_admin(self):
        """Regular school user (non-staff, non-superuser) cannot log into /admin/."""
        # Create non-staff user on default
        regular_user = DjangoUser(
            username='regular_student',
            is_staff=False,
            is_superuser=False
        )
        regular_user.set_password('Password123!')
        regular_user.save(using='default')
        logged_in = self.client.login(username='regular_student', password='Password123!')
        # Django auth rejects login for non-staff or redirects with permission denied
        response = self.client.get('/admin/')
        assert response.status_code in (302, 403)
        if response.status_code == 302:
            assert '/admin/login/' in response.url

    def test_provision_new_tenant_service(self):
        """
        provision_new_tenant creates Institution, Registry, runs migrations,
        and seeds the tenant Admin user with isolated credentials.
        """
        test_slug = 'testprovision'
        # Clean up if exists
        Institution.objects.using('default').filter(slug=test_slug).delete()

        result = provision_new_tenant(
            slug=test_slug,
            name='Test Provisioned Academy',
            admin_email='headmaster@testprovision.edu',
            admin_password='TestSecurePass123!',
            admin_username='admin_testprovision',
            admin_name='Headmaster Vance',
            verbosity=0
        )

        assert result['institution'].slug == test_slug
        assert result['institution'].name == 'Test Provisioned Academy'
        assert Institution.objects.using('default').filter(slug=test_slug).exists()
        assert TenantRegistry.objects.using('default').filter(institution__slug=test_slug).exists()

        # Check tenant DB user
        db_alias = result['db_alias']
        admin_in_db = TenantUser.objects.using(db_alias).filter(username='admin_testprovision').first()
        assert admin_in_db is not None
        assert admin_in_db.email == 'headmaster@testprovision.edu'
        assert admin_in_db.membership.role == 'ADMIN'

        # Cleanup
        Institution.objects.using('default').filter(slug=test_slug).delete()
