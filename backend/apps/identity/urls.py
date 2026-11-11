"""
URL configuration for Identity and Auth app.
"""

from django.urls import path
from apps.identity.views import (
    LoginView,
    LogoutView,
    TokenRefreshCookieView,
    AuthMeView,
    UserViewSet,
    UserMeView,
    ChangePasswordView
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/refresh/', TokenRefreshCookieView.as_view(), name='auth-refresh'),
    path('auth/me/', AuthMeView.as_view(), name='auth-me'),
    path('users/me/change-password/', ChangePasswordView.as_view(), name='user-change-password'),
    path('users/me/', UserMeView.as_view(), name='user-me'),
    path('users/next-identifier/', UserViewSet.as_view({'get': 'next_identifier'}), name='user-next-identifier'),
    path('users/<uuid:pk>/', UserViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}), name='user-detail'),
    path('users/', UserViewSet.as_view({'get': 'list', 'post': 'create'}), name='user-list-create'),
]
