"""
Services for Announcements and Communications module.
Enforces RBAC and tenant-scoped visibility filtering.
"""

import logging
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError, PermissionDenied

from apps.announcements.models import Announcement
from apps.identity.models import Membership
from apps.academics.models import AcademicUnit, StudentEnrollment, TeachingAssignment
from apps.core.permissions import has_perm

logger = logging.getLogger(__name__)

def create_announcement(
    tenant_db: str,
    title: str,
    content: str,
    created_by: Membership,
    target_role: str = 'ALL',
    target_academic_unit_id: str = None
) -> Announcement:
    """
    Creates a new announcement.
    Validates permissions:
    - Global / Role announcements require announcements.create_global.
    - Class-specific announcements require announcements.create_class.
    """
    if not title or not title.strip():
        raise ValidationError({"title": "Announcement title is required."})

    if not content or not content.strip():
        raise ValidationError({"content": "Announcement content is required."})

    target_unit = None
    if target_academic_unit_id:
        try:
            target_unit = AcademicUnit.objects.using(tenant_db).get(id=target_academic_unit_id)
        except AcademicUnit.DoesNotExist:
            raise ValidationError({"target_academic_unit_id": "Target academic unit not found."})

        # Class targeted announcement
        if not has_perm(created_by.user, 'announcements.create_class') and not has_perm(created_by.user, 'announcements.create_global'):
            raise PermissionDenied("You lack permission to create class-targeted announcements.")
    else:
        # Global announcement
        if not has_perm(created_by.user, 'announcements.create_global'):
            raise PermissionDenied("You lack permission to create global school announcements.")

    announcement = Announcement.objects.using(tenant_db).create(
        title=title.strip(),
        content=content.strip(),
        created_by=created_by,
        target_role=target_role,
        target_academic_unit=target_unit
    )

    logger.info(f"Created announcement {announcement.id} [{announcement.title}] by {created_by.user.email} in {tenant_db}")
    return announcement


def forward_announcement(
    tenant_db: str,
    announcement_id: str,
    forwarder_membership: Membership,
    target_academic_unit_id: str
) -> Announcement:
    """
    Forwards an existing announcement to a specific academic unit.
    Requires announcements.forward.
    """
    if not has_perm(forwarder_membership.user, 'announcements.forward'):
        raise PermissionDenied("You lack permission to forward announcements.")

    try:
        source_announcement = Announcement.objects.using(tenant_db).get(id=announcement_id)
    except Announcement.DoesNotExist:
        raise ValidationError({"announcement_id": "Original announcement not found."})

    try:
        target_unit = AcademicUnit.objects.using(tenant_db).get(id=target_academic_unit_id)
    except AcademicUnit.DoesNotExist:
        raise ValidationError({"target_academic_unit_id": "Target academic unit not found."})

    with transaction.atomic(using=tenant_db):
        forwarded = Announcement.objects.using(tenant_db).create(
            title=f"Fwd: {source_announcement.title}",
            content=source_announcement.content,
            created_by=forwarder_membership,
            target_role='STUDENT',
            target_academic_unit=target_unit,
            forwarded_from=source_announcement
        )

    logger.info(f"Forwarded announcement {source_announcement.id} as {forwarded.id} to unit {target_unit.name} by {forwarder_membership.user.email} in {tenant_db}")
    return forwarded


def get_visible_announcements(tenant_db: str, membership: Membership):
    """
    Returns query of announcements visible to the requesting membership based on role & enrollment.
    """
    base_qs = Announcement.objects.using(tenant_db).select_related(
        'created_by__user', 'target_academic_unit', 'forwarded_from'
    ).order_by('-published_at')

    # ADMIN sees everything
    if membership.role == 'ADMIN':
        return base_qs.all()

    # TEACHER sees:
    # 1. Any announcement with target_role in ('ALL', 'TEACHER') and target_academic_unit is None
    # 2. Any announcement targeted to an academic unit assigned to this teacher
    # 3. Any announcement created by this teacher
    if membership.role == 'TEACHER':
        unit_ids = TeachingAssignment.objects.using(tenant_db).filter(
            membership=membership
        ).values_list('academic_unit_id', flat=True)

        return base_qs.filter(
            Q(target_role__in=['ALL', 'TEACHER'], target_academic_unit__isnull=True) |
            Q(target_academic_unit_id__in=list(unit_ids)) |
            Q(created_by=membership)
        ).distinct()

    # STUDENT sees:
    # 1. Any announcement with target_role in ('ALL', 'STUDENT') and target_academic_unit is None
    # 2. Any announcement targeted to their active enrolled academic unit
    if membership.role == 'STUDENT':
        enrolled_unit_ids = StudentEnrollment.objects.using(tenant_db).filter(
            membership=membership,
            enrolled_to__isnull=True
        ).values_list('academic_unit_id', flat=True)

        return base_qs.filter(
            Q(target_role__in=['ALL', 'STUDENT'], target_academic_unit__isnull=True) |
            Q(target_academic_unit_id__in=list(enrolled_unit_ids))
        ).distinct()

    # STAFF sees announcements for ALL or STAFF
    if membership.role == 'STAFF':
        return base_qs.filter(
            Q(target_role__in=['ALL', 'STAFF'], target_academic_unit__isnull=True) |
            Q(created_by=membership)
        ).distinct()

    return base_qs.none()
