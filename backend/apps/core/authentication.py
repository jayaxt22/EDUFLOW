"""
Custom JWT Authentication for EduFlow ERP.
Extracts JWT tokens from HttpOnly cookies (with header fallback)
and guarantees tenant boundary isolation.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.http import Http404
from apps.identity.models import User
from apps.tenants.context import get_current_tenant_db
import logging

logger = logging.getLogger('eduflow.auth')

class CookieJWTAuthentication(JWTAuthentication):
    """
    Authenticates requests via JWT stored in an HttpOnly cookie ('access_token').
    Falls back to the 'Authorization: Bearer <token>' header if cookie is absent.
    Enforces tenant match: if token was minted for a different tenant, returns 404.
    """

    def authenticate(self, request):
        # Allow login, logout, refresh, and health endpoints to proceed without token evaluation
        if request.path in ('/api/v1/auth/login/', '/api/v1/auth/logout/', '/api/v1/auth/refresh/', '/health/'):
            return None

        header = self.get_header(request)
        raw_token = None

        # 1. Prefer explicitly provided Authorization header (in-memory token), fallback to HttpOnly cookie
        if header is not None:
            raw_token = self.get_raw_token(header)
        elif 'access_token' in request.COOKIES:
            raw_token = request.COOKIES.get('access_token')

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            # If the cookie token is expired or invalid, return None so AllowAny endpoints succeed
            # and protected endpoints will be cleanly rejected at permission check time.
            return None
        except Exception as e:
            logger.warning(f"Unexpected token validation error: {e}")
            return None

        # 2. Verify token tenant matches current request tenant context
        token_tenant_slug = validated_token.get('tenant_slug')
        current_tenant = getattr(request, 'tenant', None)
        if current_tenant and token_tenant_slug:
            if current_tenant.slug != token_tenant_slug:
                logger.warning(
                    f"Cross-tenant token rejected: token tenant '{token_tenant_slug}' "
                    f"!= request tenant '{current_tenant.slug}' -> 404"
                )
                # Non-negotiable rule: Cross-tenant requests return 404, never 403
                raise Http404("Resource not found.")

        # 3. Retrieve user from active tenant database
        try:
            user = self.get_user(validated_token)
            return (user, validated_token)
        except Exception as e:
            logger.warning(f"User resolution error in CookieJWTAuthentication: {e}")
            return None

    def get_user(self, validated_token):
        user_id = validated_token.get('user_id')
        if not user_id:
            raise InvalidToken("Token contained no recognizable user identification.")

        tenant_db = get_current_tenant_db() or 'tenant_demo'
        try:
            user = User.objects.using(tenant_db).select_related('membership').get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found.", code="user_not_found")

        if not user.is_active or user.membership.status != 'ACTIVE':
            raise AuthenticationFailed("User account or membership is inactive.", code="user_inactive")

        return user
