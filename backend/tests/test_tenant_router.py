"""
Tests for TenantRouter and multi-database isolation.
Verifies project-per-tenant routing rules per doc/dbplanning.md and AGENTS.md.
"""

import pytest
from apps.tenants.router import TenantRouter, CONTROL_APPS, TENANT_APPS
from apps.tenants.models import Institution, PlatformUser
from apps.identity.models import User, Membership
from apps.tenants.context import tenant_context

@pytest.mark.django_db(databases=['default', 'tenant_horizon'])
class TestTenantRouter:
    def setup_method(self):
        self.router = TenantRouter()

    def test_control_models_route_to_control_db(self):
        """Platform and control models must always route to 'default' (eduflow_control)."""
        assert self.router.db_for_read(Institution) == 'default'
        assert self.router.db_for_write(Institution) == 'default'
        assert self.router.db_for_read(PlatformUser) == 'default'
        assert self.router.db_for_write(PlatformUser) == 'default'

    def test_tenant_models_route_to_active_context(self):
        """Tenant domain models must route to the active tenant database."""
        with tenant_context('tenant_horizon', slug='demo'):
            assert self.router.db_for_read(User) == 'tenant_horizon'
            assert self.router.db_for_write(User) == 'tenant_horizon'
            assert self.router.db_for_read(Membership) == 'tenant_horizon'
            assert self.router.db_for_write(Membership) == 'tenant_horizon'

    def test_cross_database_relations_blocked(self):
        """Cross-database relations between control and tenant objects must be rejected."""
        inst = Institution(name="Test Inst", slug="test-inst")
        user = User(email="test@user.com", username="testuser")

        assert self.router.allow_relation(inst, user) is False
        assert self.router.allow_relation(inst, inst) is True
        assert self.router.allow_relation(user, user) is True

    def test_allow_migrate_rules(self):
        """Control DB only receives control apps; Tenant DBs only receive domain apps."""
        # On control database ('default')
        assert self.router.allow_migrate('default', 'tenants') is True
        assert self.router.allow_migrate('default', 'identity') is False
        assert self.router.allow_migrate('default', 'academics') is False

        # On tenant database
        assert self.router.allow_migrate('tenant_horizon', 'identity') is True
        assert self.router.allow_migrate('tenant_horizon', 'academics') is True
        assert self.router.allow_migrate('tenant_horizon', 'tenants') is False
