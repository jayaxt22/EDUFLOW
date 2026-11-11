"""
Tests for Announcements & Communications module per doc/testing.md & doc/rbac.md:
1. Model creation and constraints.
2. Service happy path (global notice, class-targeted notice, forwarded notice).
3. Service guards and permission checks.
4. Visibility filtering per user role and academic unit enrollment.
5. Mandatory 4 endpoint variants (Allow, Deny 403, Anonymous 401, Cross-tenant 404).
"""

import uuid
import pytest
from datetime import date
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError, PermissionDenied

from apps.tenants.models import Institution, TenantRegistry
from apps.identity.services import create_user_with_membership
from apps.academics.services import create_academic_year, create_academic_unit, enroll_student
from apps.announcements.models import Announcement
from apps.announcements.services import (
    create_announcement,
    forward_announcement,
    get_visible_announcements
)

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestAnnouncementsModule:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.client = APIClient()

        # Control Plane setup
        self.inst, _ = Institution.objects.using('default').update_or_create(
            slug='demo',
            defaults={'name': 'Demo School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_demo.sqlite3', 'status': 'ACTIVE'}
        )

        # Users across 4 roles
        self.admin = create_user_with_membership('tenant_demo', {
            'email': 'admin_ann@demo.edu',
            'username': 'admin_ann',
            'password': 'Pass12345!',
            'full_name': 'Admin Announcer',
            'role': 'ADMIN'
        })
        self.teacher = create_user_with_membership('tenant_demo', {
            'email': 'teacher_ann@demo.edu',
            'username': 'teacher_ann',
            'password': 'Pass12345!',
            'full_name': 'Teacher Announcer',
            'role': 'TEACHER',
            'employee_id': 'T-ANN-01'
        })
        self.student_a = create_user_with_membership('tenant_demo', {
            'email': 'student_a@demo.edu',
            'username': 'student_a',
            'password': 'Pass12345!',
            'full_name': 'Student Section A',
            'role': 'STUDENT',
            'admission_number': 'ANN-STU-A'
        })
        self.student_b = create_user_with_membership('tenant_demo', {
            'email': 'student_b@demo.edu',
            'username': 'student_b',
            'password': 'Pass12345!',
            'full_name': 'Student Section B',
            'role': 'STUDENT',
            'admission_number': 'ANN-STU-B'
        })
        self.staff_general = create_user_with_membership('tenant_demo', {
            'email': 'staff_gen@demo.edu',
            'username': 'staff_gen',
            'password': 'Pass12345!',
            'full_name': 'Staff Reception',
            'role': 'STAFF',
            'staff_type': 'RECEPTION',
            'employee_id': 'STF-ANN-01'
        })

        # Academic Year and Sections
        self.year = create_academic_year(
            tenant_db='tenant_demo',
            name='2026-2027',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True
        )
        self.section_a = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section A',
            unit_type='SECTION'
        )
        self.section_b = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION'
        )

        # Enroll students
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student_a.id),
            academic_unit_id=str(self.section_a.id),
            roll_number='1',
            enrolled_from=date(2026, 4, 1)
        )
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student_b.id),
            academic_unit_id=str(self.section_b.id),
            roll_number='2',
            enrolled_from=date(2026, 4, 1)
        )

        self.list_create_url = reverse('announcements-list-create')

    def test_create_global_announcement_happy_path(self):
        """Admin creates a school-wide announcement."""
        ann = create_announcement(
            tenant_db='tenant_demo',
            title='Annual Sports Day 2026',
            content='Sports day scheduled for next Friday.',
            created_by=self.admin,
            target_role='ALL'
        )
        assert ann.title == 'Annual Sports Day 2026'
        assert ann.created_by == self.admin
        assert ann.target_academic_unit is None

    def test_create_class_announcement_by_admin(self):
        """Admin creates class-targeted announcement for Section A."""
        ann = create_announcement(
            tenant_db='tenant_demo',
            title='Math Homework Due Section A',
            content='Complete exercises 1 to 10.',
            created_by=self.admin,
            target_role='STUDENT',
            target_academic_unit_id=str(self.section_a.id)
        )
        assert ann.title == 'Math Homework Due Section A'
        assert ann.target_academic_unit == self.section_a

    def test_teacher_announcement_creation_blocked(self):
        """Teacher cannot create announcements (read-only per specification)."""
        with pytest.raises(PermissionDenied):
            create_announcement(
                tenant_db='tenant_demo',
                title='Unauthorized Teacher Announcement',
                content='Test content',
                created_by=self.teacher,
                target_role='ALL',
                target_academic_unit_id=None
            )

    def test_forward_announcement_happy_path(self):
        """Admin forwards an existing announcement to Section A with back-reference."""
        global_ann = create_announcement(
            tenant_db='tenant_demo',
            title='Library Book Return Notice',
            content='All overdue books must be returned by Friday.',
            created_by=self.admin,
            target_role='ALL'
        )

        forwarded = forward_announcement(
            tenant_db='tenant_demo',
            announcement_id=str(global_ann.id),
            forwarder_membership=self.admin,
            target_academic_unit_id=str(self.section_a.id)
        )
        assert forwarded.title == f"Fwd: {global_ann.title}"
        assert forwarded.forwarded_from == global_ann
        assert forwarded.target_academic_unit == self.section_a
        assert forwarded.created_by == self.admin

    def test_visibility_filtering_student_isolation(self):
        """Student in Section A sees global & Section A notices, but NOT Section B or Teacher-only."""
        # 1. Global Notice (visible to all)
        ann_global = create_announcement(
            tenant_db='tenant_demo',
            title='Global Holiday Notice',
            content='School closed Monday.',
            created_by=self.admin,
            target_role='ALL'
        )
        # 2. Section A Notice (visible to student A)
        ann_sec_a = create_announcement(
            tenant_db='tenant_demo',
            title='Section A Physics Quiz',
            content='Quiz tomorrow.',
            created_by=self.admin,
            target_role='STUDENT',
            target_academic_unit_id=str(self.section_a.id)
        )
        # 3. Section B Notice (invisible to student A)
        ann_sec_b = create_announcement(
            tenant_db='tenant_demo',
            title='Section B Biology Quiz',
            content='Quiz on Wednesday.',
            created_by=self.admin,
            target_role='STUDENT',
            target_academic_unit_id=str(self.section_b.id)
        )
        # 4. Teachers-only Notice (invisible to student A)
        ann_teachers = create_announcement(
            tenant_db='tenant_demo',
            title='Staff Meeting at 4 PM',
            content='Teachers staff room.',
            created_by=self.admin,
            target_role='TEACHER'
        )

        # Check visibility for student A
        student_a_visible = list(get_visible_announcements('tenant_demo', self.student_a))
        visible_ids = [str(item.id) for item in student_a_visible]

        assert str(ann_global.id) in visible_ids
        assert str(ann_sec_a.id) in visible_ids
        assert str(ann_sec_b.id) not in visible_ids
        assert str(ann_teachers.id) not in visible_ids

    # ------------------------------------------------------------------
    # POST /api/v1/announcements/ (Mandatory 4 Variants)
    # ------------------------------------------------------------------

    def test_create_announcement_allow_admin(self):
        """Variant 1: Allow - Admin with announcements.create_global creates notice."""
        self.client.force_authenticate(user=self.admin.user)
        payload = {
            'title': 'School Reopening Schedule',
            'content': 'Classes resume at 8:00 AM.',
            'target_role': 'ALL'
        }
        res = self.client.post(self.list_create_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res.status_code == 201
        assert res.data['success'] is True
        assert res.data['data']['title'] == 'School Reopening Schedule'

    def test_create_announcement_deny_student_403(self):
        """Variant 2a: Deny (403) - Student lacks announcements.create_* permissions."""
        self.client.force_authenticate(user=self.student_a.user)
        payload = {
            'title': 'Student Post',
            'content': 'Hello everyone.',
            'target_role': 'ALL'
        }
        res = self.client.post(self.list_create_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res.status_code == 403

    def test_create_announcement_deny_teacher_403(self):
        """Variant 2b: Deny (403) - Teacher lacks announcements.create_* permissions (Admin only)."""
        self.client.force_authenticate(user=self.teacher.user)
        payload = {
            'title': 'Teacher Post',
            'content': 'Unauthorized teacher announcement attempt.',
            'target_role': 'ALL'
        }
        res = self.client.post(self.list_create_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res.status_code == 403

    def test_create_announcement_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request rejected."""
        payload = {'title': 'Public Post', 'content': 'Sample'}
        res = self.client.post(self.list_create_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res.status_code == 401

    def test_create_announcement_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.admin.user)
        payload = {'title': 'Tenant Test', 'content': 'Sample', 'target_role': 'ALL'}
        res = self.client.post(self.list_create_url, payload, format='json', HTTP_X_TENANT_SLUG='nonexistent-school')
        assert res.status_code == 404
