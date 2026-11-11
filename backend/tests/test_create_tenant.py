"""
Tests for create_tenant management command.
Verifies project-per-tenant provisioning and control plane registration per docs/dbplanning.md.
"""

import pytest
from django.core.management import call_command, CommandError
from apps.tenants.models import Institution, TenantRegistry
from apps.identity.models import User, Membership
from apps.academics.models import AcademicYear

@pytest.mark.django_db(databases='__all__')
class TestCreateTenantCommand:
    def test_create_tenant_duplicate_slug_rejected(self):
        """Creating a tenant with an existing slug must raise CommandError."""
        Institution.objects.using('default').create(
            slug='existing',
            name='Existing School'
        )
        with pytest.raises(CommandError, match="already exists"):
            call_command(
                'create_tenant',
                slug='existing',
                name='Duplicate School',
            )

    def test_create_tenant_success(self, tmp_path, django_db_blocker):
        """Successfully provisions institution in Control DB and admin in tenant DB."""
        slug = 'testacad'
        name = 'Test Academy'
        sqlite_db = str(tmp_path / 'testacad.sqlite3').replace('\\', '/')
        db_url = f"sqlite:///{sqlite_db}"

        with django_db_blocker.unblock():
            call_command(
                'create_tenant',
                slug=slug,
                name=name,
                db_url=db_url,
                admin_email='principal@testacad.edu',
                admin_username='admin_testacad',
                admin_password='TestSecurePass123!',
                admin_name='Headmaster Test'
            )

            # 1. Verify Control DB records
            inst = Institution.objects.using('default').get(slug=slug)
            assert inst.name == name
            assert inst.status == 'ACTIVE'

            reg = TenantRegistry.objects.using('default').get(institution=inst)
            assert reg.db_url == db_url
            assert reg.status == 'ACTIVE'

            # 2. Verify Tenant DB records
            db_alias = f"tenant_{slug}"
            admin_user = User.objects.using(db_alias).get(email='principal@testacad.edu')
            assert admin_user.username == 'admin_testacad'
            assert admin_user.full_name == 'Headmaster Test'

            membership = Membership.objects.using(db_alias).get(user=admin_user)
            assert membership.role == 'ADMIN'
            assert membership.status == 'ACTIVE'

            acad_year = AcademicYear.objects.using(db_alias).get(is_current=True)
            assert acad_year is not None
