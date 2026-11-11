"""
RBAC Permission classes for EduFlow ERP.
Non-negotiable rule:
Business code NEVER checks role == 'TEACHER' or staff_type == 'FINANCE'.
It checks has_perm('<perm>').
"""

from rest_framework.permissions import BasePermission
from apps.identity.services import get_user_permissions

class HasEduFlowPerm(BasePermission):
    """
    Permission class that checks if the requesting user has the required permission string.
    Usage:
        permission_classes = [HasEduFlowPerm('users.create')]
    """
    def __init__(self, required_perm: str):
        self.required_perm = required_perm

    def __call__(self):
        return self

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(request.user, 'membership', None)
        if not membership or membership.status != 'ACTIVE':
            return False

        # Resolve dynamic permissions for this membership
        user_perms = get_user_permissions(membership, request=request, view=view)
        return self.required_perm in user_perms


def has_perm(user, perm_string: str, request=None, view=None) -> bool:
    """
    Convenience function for checking permissions in services and views.
    """
    if not user or not user.is_authenticated:
        return False
    membership = getattr(user, 'membership', None)
    if not membership or membership.status != 'ACTIVE':
        return False
    user_perms = get_user_permissions(membership, request=request, view=view)
    return perm_string in user_perms
