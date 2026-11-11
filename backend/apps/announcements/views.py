"""
Views for Announcements module.
Enforces thin views with business logic in services.py.
"""

from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.announcements.models import Announcement
from apps.announcements.serializers import (
    AnnouncementSerializer,
    CreateAnnouncementInputSerializer,
    ForwardAnnouncementInputSerializer
)
from apps.announcements.services import (
    create_announcement,
    forward_announcement,
    get_visible_announcements
)
from apps.core.permissions import HasEduFlowPerm, has_perm

class AnnouncementViewSet(ViewSet):
    """
    ViewSet for managing and reading school announcements.
    """
    def get_permissions(self):
        if self.action == 'list':
            return [IsAuthenticated(), HasEduFlowPerm('announcements.read')()]
        elif self.action == 'create':
            # Evaluated dynamically in action body based on target scope
            return [IsAuthenticated()]
        elif self.action == 'forward':
            return [IsAuthenticated(), HasEduFlowPerm('announcements.forward')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        announcements = get_visible_announcements(tenant_db, request.user.membership)
        serializer = AnnouncementSerializer(announcements, many=True)
        return Response({"success": True, "data": serializer.data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        serializer = CreateAnnouncementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_unit_id = serializer.validated_data.get('target_academic_unit_id')
        if target_unit_id:
            # Requires announcements.create_class OR announcements.create_global
            if not has_perm(request.user, 'announcements.create_class') and not has_perm(request.user, 'announcements.create_global'):
                return Response({
                    "success": False,
                    "error": {"code": "PERMISSION_DENIED", "message": "Permission denied for class-targeted announcements."}
                }, status=status.HTTP_403_FORBIDDEN)
        else:
            # Requires announcements.create_global
            if not has_perm(request.user, 'announcements.create_global'):
                return Response({
                    "success": False,
                    "error": {"code": "PERMISSION_DENIED", "message": "Permission denied for global announcements."}
                }, status=status.HTTP_403_FORBIDDEN)

        announcement = create_announcement(
            tenant_db=tenant_db,
            title=serializer.validated_data['title'],
            content=serializer.validated_data['content'],
            created_by=request.user.membership,
            target_role=serializer.validated_data.get('target_role', 'ALL'),
            target_academic_unit_id=str(target_unit_id) if target_unit_id else None
        )

        return Response({
            "success": True,
            "data": AnnouncementSerializer(announcement).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def forward(self, request, pk=None):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        serializer = ForwardAnnouncementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        forwarded = forward_announcement(
            tenant_db=tenant_db,
            announcement_id=pk,
            forwarder_membership=request.user.membership,
            target_academic_unit_id=str(serializer.validated_data['target_academic_unit_id'])
        )

        return Response({
            "success": True,
            "data": AnnouncementSerializer(forwarded).data
        }, status=status.HTTP_201_CREATED)
