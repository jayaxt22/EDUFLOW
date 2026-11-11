"""
Project-per-tenant database router for EduFlow ERP.
Guarantees physical database separation between the control plane and tenants.
"""

from apps.tenants.context import get_current_tenant_db
import logging

logger = logging.getLogger('apps.tenants.router')

CONTROL_APPS = {'tenants', 'auth', 'contenttypes', 'sessions', 'admin', 'messages'}
TENANT_APPS = {'identity', 'academics', 'attendance', 'announcements', 'fees'}

class TenantRouter:
    """
    Directs database operations according to the project-per-tenant architecture:
    - Control apps route strictly to 'default' (eduflow_control).
    - Tenant apps route strictly to the active tenant database (e.g. 'tenant_horizon').
    - Cross-database foreign keys/relations are prohibited.
    - Migrations are segregated by database target.
    """

    def db_for_read(self, model, **hints):
        app_label = model._meta.app_label
        if app_label in CONTROL_APPS:
            return 'default'
        if app_label in TENANT_APPS:
            tenant_db = get_current_tenant_db()
            return tenant_db or 'tenant_horizon'
        return 'default'

    def db_for_write(self, model, **hints):
        app_label = model._meta.app_label
        if app_label in CONTROL_APPS:
            return 'default'
        if app_label in TENANT_APPS:
            tenant_db = get_current_tenant_db()
            return tenant_db or 'tenant_horizon'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """
        Prevent foreign key relationships spanning across control and tenant databases.
        """
        app1 = obj1._meta.app_label
        app2 = obj2._meta.app_label

        is_obj1_control = app1 in CONTROL_APPS
        is_obj2_control = app2 in CONTROL_APPS

        if is_obj1_control != is_obj2_control:
            logger.warning(
                f"Blocked cross-database relation attempt between {app1}.{obj1.__class__.__name__} "
                f"and {app2}.{obj2.__class__.__name__}"
            )
            return False
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Ensure control tables are only migrated onto the control database ('default'),
        and tenant tables are only migrated onto tenant databases.
        """
        if db == 'default':
            # Control database: migrate only control and platform apps
            return app_label in CONTROL_APPS
        else:
            # Tenant databases: migrate domain apps, do not migrate control models
            return app_label not in CONTROL_APPS
