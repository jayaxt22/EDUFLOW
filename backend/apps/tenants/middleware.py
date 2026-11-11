"""
Tenant resolution and context middleware for EduFlow ERP.
Resolves tenant by X-Tenant-Slug header or subdomain, enforces database routing,
and guarantees 404 isolation for unknown or cross-tenant resources.
"""

from django.http import JsonResponse
from django.conf import settings
from apps.tenants.context import set_current_tenant_db, set_current_tenant_slug, reset_current_tenant
from apps.tenants.models import Institution, TenantRegistry
from apps.tenants.database import register_tenant_database
import logging

logger = logging.getLogger('apps.tenants.middleware')

EXEMPT_PATHS = {'/health/', '/api/v1/control/'}

class TenantMiddleware:
    """
    Middleware that establishes the active tenant context per request.
    Non-negotiable rule: Cross-tenant requests return 404, never 403.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Allow preflight, root health check, and exempt paths without tenant slug
        if request.method == 'OPTIONS' or request.path == '/' or any(request.path.startswith(prefix) for prefix in EXEMPT_PATHS):
            return self.get_response(request)

        # 1. Extract tenant slug from header or hostname
        tenant_slug = request.headers.get('X-Tenant-Slug')
        if not tenant_slug:
            # Fallback to subdomain (e.g. demo.eduflow.local)
            host = request.get_host().split(':')[0]
            parts = host.split('.')
            if len(parts) >= 3 and parts[0] not in ('www', 'api', 'app'):
                tenant_slug = parts[0]

        # Development convenience fallback
        if not tenant_slug and settings.DEBUG:
            tenant_slug = 'demo'

        if not tenant_slug:
            return JsonResponse({
                "success": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Resource not found (tenant identifier missing).",
                    "details": {}
                }
            }, status=404)

        # 2. Query Control DB for tenant existence and active status
        try:
            institution = Institution.objects.using('default').get(
                slug=tenant_slug,
                status='ACTIVE'
            )
            registry = TenantRegistry.objects.using('default').get(
                institution=institution,
                status='ACTIVE'
            )
        except (Institution.DoesNotExist, TenantRegistry.DoesNotExist):
            logger.warning(f"Tenant lookup failed for slug: '{tenant_slug}' -> returning 404")
            return JsonResponse({
                "success": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Resource not found.",
                    "details": {}
                }
            }, status=404)

        # 3. Register database connection dynamically if needed
        db_alias = f"tenant_{institution.slug}"
        register_tenant_database(db_alias, registry.db_url)

        # 4. Attach tenant info to request and activate context
        request.tenant = institution
        request.tenant_db = db_alias

        db_token = set_current_tenant_db(db_alias)
        slug_token = set_current_tenant_slug(institution.slug)

        try:
            response = self.get_response(request)
        finally:
            reset_current_tenant(db_token, slug_token)

        return response
