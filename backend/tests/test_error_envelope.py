"""
Tests for the EduFlow error envelope and tenant middleware isolation.
Proves that cross-tenant or missing tenant requests return 404, never 403.
"""

import pytest
from django.test import RequestFactory
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.core.exceptions import custom_exception_handler
from apps.tenants.middleware import TenantMiddleware
from apps.tenants.models import Institution, TenantRegistry

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestErrorEnvelopeAndIsolation:
    def setup_method(self):
        self.rf = RequestFactory()

    def test_custom_exception_handler_format(self):
        """Exceptions are formatted into the canonical error envelope."""
        exc = ValidationError({"field": ["This field is required."]})
        context = {"view": "TestView"}
        resp = custom_exception_handler(exc, context)

        assert resp.status_code == 400
        assert resp.data["success"] is False
        assert "error" in resp.data
        assert "code" in resp.data["error"]
        assert "message" in resp.data["error"]
        assert "details" in resp.data["error"]

    def test_missing_tenant_header_returns_404(self):
        """Requests without valid tenant identification return 404, not 403."""
        middleware = TenantMiddleware(lambda req: None)
        request = self.rf.get('/api/v1/students/')

        response = middleware(request)
        assert response.status_code == 404
        assert response.headers['content-type'] == 'application/json'

    def test_nonexistent_or_cross_tenant_returns_404(self):
        """Cross-tenant requests or unknown tenant slugs return 404."""
        middleware = TenantMiddleware(lambda req: None)
        request = self.rf.get('/api/v1/students/', HTTP_X_TENANT_SLUG='unknown-tenant')

        response = middleware(request)
        assert response.status_code == 404

    def test_active_tenant_resolves_and_calls_handler(self):
        """Valid active tenant slug attaches institution and executes response."""
        inst = Institution.objects.using('default').create(
            name="Alpha School",
            slug="alpha",
            status="ACTIVE"
        )
        TenantRegistry.objects.using('default').create(
            institution=inst,
            db_url="sqlite:///eduflow_tenant_demo.sqlite3",
            status="ACTIVE"
        )

        def mock_handler(req):
            assert req.tenant.slug == "alpha"
            assert req.tenant_db == "tenant_alpha"
            from django.http import HttpResponse
            return HttpResponse("OK")

        middleware = TenantMiddleware(mock_handler)
        request = self.rf.get('/api/v1/students/', HTTP_X_TENANT_SLUG='alpha')

        response = middleware(request)
        assert response.status_code == 200
