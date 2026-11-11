"""
Views for Identity and Auth module.
Non-negotiable rule:
Views are thin. Business logic lives in services.py.
"""

from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from django.http import Http404
import os
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from apps.identity.serializers import (
    LoginSerializer,
    UnifiedUserCreateSerializer,
    AdminUserDetailSerializer,
    DirectoryStudentSerializer,
    AuthMeSerializer,
    UserProfileSerializer,
    UpdateUserProfileSerializer,
    ChangePasswordSerializer,
    AdminUserUpdateSerializer
)
from apps.identity.services import (
    authenticate_tenant_user,
    generate_tokens_for_user,
    create_user_with_membership,
    generate_unique_identifier,
    update_user_profile,
    change_user_password,
    update_user_by_admin,
    deactivate_user,
)
from apps.identity.models import User, StudentProfile
from apps.core.permissions import HasEduFlowPerm, has_perm

class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Issues JWT access and refresh tokens into HttpOnly cookies.
    Zero tokens in localStorage.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        tenant_slug = getattr(request.tenant, 'slug', 'demo') if hasattr(request, 'tenant') else 'demo'

        user = authenticate_tenant_user(
            tenant_db=tenant_db,
            username_or_email=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )

        access_token, refresh_token = generate_tokens_for_user(user, tenant_slug)

        user_data = AuthMeSerializer(user).data
        response = Response({
            "success": True,
            "data": user_data
        }, status=status.HTTP_200_OK)

        # Expose tokens via response headers for in-memory cross-origin session resilience
        response['X-Access-Token'] = access_token
        response['X-Refresh-Token'] = refresh_token

        # Set HttpOnly cookies
        is_https = request.is_secure() or request.headers.get('x-forwarded-proto') == 'https'
        is_secure = not settings.DEBUG or is_https or os.environ.get('VERCEL') == '1'
        cookie_samesite = 'None' if is_secure else 'Lax'
        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            samesite=cookie_samesite,
            secure=is_secure,
            path='/',
            max_age=3600  # 1 hour
        )
        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            httponly=True,
            samesite=cookie_samesite,
            secure=is_secure,
            path='/',
            max_age=86400 * 7  # 7 days
        )

        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Clears HttpOnly cookies.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({
            "success": True,
            "data": {"message": "Successfully logged out."}
        }, status=status.HTTP_200_OK)

        is_https = request.is_secure() or request.headers.get('x-forwarded-proto') == 'https'
        is_secure = not settings.DEBUG or is_https or os.environ.get('VERCEL') == '1'
        cookie_samesite = 'None' if is_secure else 'Lax'
        response.delete_cookie('access_token', path='/', samesite=cookie_samesite)
        response.delete_cookie('refresh_token', path='/', samesite=cookie_samesite)
        return response


class TokenRefreshCookieView(APIView):
    """
    POST /api/v1/auth/refresh/
    Reads HttpOnly refresh_token cookie (or payload refresh token),
    validates it, mints a new access_token, and writes it to an HttpOnly cookie.
    Enforces cross-tenant 404 boundary isolation. Zero tokens in localStorage.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if not raw_refresh:
            return Response({
                "success": False,
                "error": {
                    "code": "REFRESH_TOKEN_REQUIRED",
                    "message": "Authentication credentials were not provided (refresh token missing).",
                    "details": {}
                }
            }, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(raw_refresh)
            # Enforce cross-tenant isolation: token tenant must match current request tenant
            token_tenant_slug = refresh.payload.get('tenant_slug')
            current_tenant = getattr(request, 'tenant', None)
            if current_tenant and token_tenant_slug:
                if current_tenant.slug != token_tenant_slug:
                    # Non-negotiable rule: Cross-tenant requests return 404, never 403
                    raise Http404("Resource not found.")

            new_access_token = str(refresh.access_token)
        except Http404:
            raise
        except (TokenError, InvalidToken) as e:
            return Response({
                "success": False,
                "error": {
                    "code": "TOKEN_INVALID_OR_EXPIRED",
                    "message": "Session expired. Please log in again.",
                    "details": {"error": str(e)}
                }
            }, status=status.HTTP_401_UNAUTHORIZED)

        response = Response({
            "success": True,
            "data": {"message": "Access token refreshed successfully."}
        }, status=status.HTTP_200_OK)

        response['X-Access-Token'] = new_access_token

        is_https = request.is_secure() or request.headers.get('x-forwarded-proto') == 'https'
        is_secure = not settings.DEBUG or is_https or os.environ.get('VERCEL') == '1'
        cookie_samesite = 'None' if is_secure else 'Lax'
        response.set_cookie(
            key='access_token',
            value=new_access_token,
            httponly=True,
            samesite=cookie_samesite,
            secure=is_secure,
            path='/',
            max_age=3600  # 1 hour
        )
        return response


class AuthMeView(APIView):
    """
    GET /api/v1/auth/me/
    Returns current authenticated user details and active permission strings.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = AuthMeSerializer(request.user)
        return Response({
            "success": True,
            "data": serializer.data
        })


class UserViewSet(ViewSet):
    """
    User management endpoints:
    POST /api/v1/users/ -> create user with role (guarded by users.create)
    GET /api/v1/users/  -> list users (guarded by users.read_all or students.read_directory)
    PATCH /api/v1/users/{id}/ -> update user details by admin (guarded by users.update_others)
    DELETE /api/v1/users/{id}/ -> soft-deactivate user by admin (guarded by users.deactivate)
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    def get_permissions(self):
        if self.action in ('create', 'next_identifier'):
            return [IsAuthenticated(), HasEduFlowPerm('users.create')()]
        elif self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), HasEduFlowPerm('users.update_others')()]
        elif self.action == 'destroy':
            return [IsAuthenticated(), HasEduFlowPerm('users.deactivate')()]
        elif self.action == 'list':
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def next_identifier(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        role = request.query_params.get('role', 'STUDENT').upper()
        if role not in ('STUDENT', 'TEACHER', 'STAFF', 'ADMIN'):
            return Response({
                "success": False,
                "message": "Role must be STUDENT, TEACHER, STAFF, or ADMIN."
            }, status=status.HTTP_400_BAD_REQUEST)
        identifier = generate_unique_identifier(tenant_db, role)
        return Response({
            "success": True,
            "data": {
                "role": role,
                "identifier": identifier
            }
        })

    def create(self, request):
        serializer = UnifiedUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        membership = create_user_with_membership(tenant_db, serializer.validated_data)

        return Response({
            "success": True,
            "data": AdminUserDetailSerializer(membership.user).data
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        serializer = AdminUserUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        user = update_user_by_admin(tenant_db, str(pk), serializer.validated_data)

        return Response({
            "success": True,
            "data": AdminUserDetailSerializer(user).data
        })

    def destroy(self, request, pk=None):
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        user = deactivate_user(tenant_db, str(pk))

        return Response({
            "success": True,
            "data": {
                "message": f"User {user.username} successfully deactivated.",
                "user": AdminUserDetailSerializer(user).data
            }
        })

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')

        if has_perm(request.user, 'users.read_all', request=request, view=self):
            # Admin view: full user details
            users = User.objects.using(tenant_db).select_related(
                'membership',
                'membership__student_profile',
                'membership__teacher_profile',
                'membership__staff_profile'
            ).all().order_by('-created_at')
            return Response({
                "success": True,
                "data": AdminUserDetailSerializer(users, many=True).data
            })

        elif has_perm(request.user, 'students.read_directory', request=request, view=self):
            # Directory view: field-restricted serializer
            students = StudentProfile.objects.using(tenant_db).select_related(
                'membership__user'
            ).prefetch_related(
                'membership__enrollments__academic_unit__parent'
            ).all()
            return Response({
                "success": True,
                "data": DirectoryStudentSerializer(students, many=True).data
            })

        return Response({
            "success": False,
            "error": {
                "code": "PERMISSION_DENIED",
                "message": "You do not have permission to view users.",
                "details": {}
            }
        }, status=status.HTTP_403_FORBIDDEN)


class UserMeView(APIView):
    """
    GET /api/v1/users/me/ -> fetch authenticated user profile details.
    PATCH /api/v1/users/me/ -> update allowed personal details.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not has_perm(request.user, 'users.read_own', request=request, view=self):
            return Response({
                "success": False,
                "error": {"code": "PERMISSION_DENIED", "message": "Permission denied.", "details": {}}
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = UserProfileSerializer(request.user)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request):
        if not has_perm(request.user, 'users.update_own', request=request, view=self):
            return Response({
                "success": False,
                "error": {"code": "PERMISSION_DENIED", "message": "Permission denied.", "details": {}}
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = UpdateUserProfileSerializer(data=request.data, context={'request': request}, partial=True)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        updated_user = update_user_profile(tenant_db, request.user, serializer.validated_data)

        return Response({
            "success": True,
            "data": UserProfileSerializer(updated_user).data
        })


class ChangePasswordView(APIView):
    """
    POST /api/v1/users/me/change-password/ -> update password securely with Argon2.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not has_perm(request.user, 'users.update_own', request=request, view=self):
            return Response({
                "success": False,
                "error": {"code": "PERMISSION_DENIED", "message": "Permission denied.", "details": {}}
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        change_user_password(
            tenant_db=tenant_db,
            user=request.user,
            current_password=serializer.validated_data['current_password'],
            new_password=serializer.validated_data['new_password']
        )

        return Response({
            "success": True,
            "data": {"message": "Password changed successfully."}
        }, status=status.HTTP_200_OK)

