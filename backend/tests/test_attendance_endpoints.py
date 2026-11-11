"""
Tests for Attendance API Endpoints per AGENTS.md, doc/rbac.md, and doc/testing.md:
Mandatory 4 variants:
1. Allow (Teacher with attendance.mark_class)
2. Deny (Student lacking permission -> 403)
3. Anonymous (401)
4. Cross-tenant (404)

Conditional permissions:
- attendance.correct enforces same-day check on PATCH.
"""

import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework.test import APIClient

from apps.tenants.models import Institution, TenantRegistry
from apps.identity.services import create_user_with_membership
from apps.academics.services import create_academic_year, create_academic_unit, enroll_student, assign_teacher
from apps.attendance.models import AttendanceRecord

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestAttendanceEndpoints:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.client = APIClient()

        # Control Plane Institution & Tenant
        self.inst, _ = Institution.objects.using('default').update_or_create(
            slug='demo',
            defaults={'name': 'Demo School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_demo.sqlite3', 'status': 'ACTIVE'}
        )

        # Teacher (has attendance.mark_class, attendance.correct)
        self.teacher_mem = create_user_with_membership('tenant_demo', {
            'email': 't_endp@demo.edu',
            'username': 't_endp',
            'password': 'TeacherPass123!',
            'full_name': 'Teacher Endp',
            'role': 'TEACHER',
            'employee_id': 'T-ENDP-01'
        })

        # Student (lacks attendance.mark_class)
        self.student_mem = create_user_with_membership('tenant_demo', {
            'email': 's_endp@demo.edu',
            'username': 's_endp',
            'password': 'StudentPass123!',
            'full_name': 'Student Endp',
            'role': 'STUDENT',
            'admission_number': 'STU-ENDP-01'
        })

        # Academic Unit
        self.year = create_academic_year(
            tenant_db='tenant_demo',
            name='2026-2027',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True
        )
        self.unit = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section 9B',
            unit_type='SECTION'
        )

        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student_mem.id),
            academic_unit_id=str(self.unit.id),
            roll_number='1',
            enrolled_from=date(2026, 4, 1)
        )

        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher_mem.id),
            academic_unit_id=str(self.unit.id),
            is_class_teacher=True
        )

        self.other_teacher_mem = create_user_with_membership('tenant_demo', {
            'email': 'other_t@demo.edu',
            'username': 'other_t',
            'password': 'TeacherPass123!',
            'full_name': 'Other Teacher',
            'role': 'TEACHER',
            'employee_id': 'T-OTHER-01'
        })

        self.mark_class_url = reverse('attendance-mark-class')
        self.summary_url = reverse('attendance-summary')

    def test_mark_class_allow_teacher(self):
        """Variant 1: Allow - Assigned Class Teacher can mark attendance."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        payload = {
            'academic_unit_id': str(self.unit.id),
            'date': str(date.today()),
            'records': [
                {'student_membership_id': str(self.student_mem.id), 'status': 'PRESENT'}
            ]
        }
        response = self.client.post(self.mark_class_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True

    def test_mark_class_deny_non_class_teacher_403(self):
        """Teacher who is not the assigned Class Teacher cannot mark attendance (403)."""
        self.client.force_authenticate(user=self.other_teacher_mem.user)
        payload = {
            'academic_unit_id': str(self.unit.id),
            'date': str(date.today()),
            'records': [
                {'student_membership_id': str(self.student_mem.id), 'status': 'PRESENT'}
            ]
        }
        response = self.client.post(self.mark_class_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_mark_class_deny_student_403(self):
        """Variant 2: Deny (403) - Student cannot mark class attendance."""
        self.client.force_authenticate(user=self.student_mem.user)
        payload = {
            'academic_unit_id': str(self.unit.id),
            'date': str(date.today()),
            'records': []
        }
        response = self.client.post(self.mark_class_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_mark_class_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request is rejected."""
        payload = {
            'academic_unit_id': str(self.unit.id),
            'date': str(date.today()),
            'records': []
        }
        response = self.client.post(self.mark_class_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_mark_class_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Foreign tenant slug returns 404."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        payload = {
            'academic_unit_id': str(self.unit.id),
            'date': str(date.today()),
            'records': []
        }
        response = self.client.post(self.mark_class_url, payload, format='json', HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

    def test_same_day_correction_endpoint(self):
        """Conditional permission: Teacher can correct today's record, but past day returns 403."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        today = date.today()

        # 1. Today's record
        rec_today = AttendanceRecord.objects.using('tenant_demo').create(
            subject_user=self.student_mem,
            academic_unit=self.unit,
            date=today,
            context='CLASSROOM',
            status='ABSENT',
            marked_by=self.teacher_mem
        )
        url_today = reverse('attendance-correct', kwargs={'pk': rec_today.id})
        resp_today = self.client.patch(url_today, {'status': 'PRESENT', 'remarks': 'Corrected'}, format='json', HTTP_X_TENANT_SLUG='demo')
        assert resp_today.status_code == 200
        assert resp_today.data['data']['status'] == 'PRESENT'

        # 2. Yesterday's record -> 403
        yesterday = today - timedelta(days=1)
        rec_past = AttendanceRecord.objects.using('tenant_demo').create(
            subject_user=self.student_mem,
            academic_unit=self.unit,
            date=yesterday,
            context='CLASSROOM',
            status='ABSENT',
            marked_by=self.teacher_mem
        )
        url_past = reverse('attendance-correct', kwargs={'pk': rec_past.id})
        resp_past = self.client.patch(url_past, {'status': 'PRESENT'}, format='json', HTTP_X_TENANT_SLUG='demo')
        assert resp_past.status_code == 403

    def test_school_analytics_endpoint_variants(self):
        """Mandatory 4 variants for GET /api/v1/attendance/analytics/: allow, deny (403), anonymous (401), cross-tenant (404)."""
        url = reverse('attendance-analytics')

        # 1. Allow: Teacher / Admin with attendance.read_class
        self.client.force_authenticate(user=self.teacher_mem.user)
        resp_allow = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert resp_allow.status_code == 200
        assert resp_allow.data['success'] is True
        assert 'summary' in resp_allow.data['data']
        assert 'section_breakdown' in resp_allow.data['data']
        assert 'trend' in resp_allow.data['data']

        # 2. Deny (403): Student lacks attendance.read_class
        self.client.force_authenticate(user=self.student_mem.user)
        resp_deny = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert resp_deny.status_code == 403

        # 3. Anonymous (401)
        self.client.logout()
        resp_anon = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert resp_anon.status_code == 401

        # 4. Cross-tenant (404)
        self.client.force_authenticate(user=self.teacher_mem.user)
        resp_cross = self.client.get(url, HTTP_X_TENANT_SLUG='other-tenant')
        assert resp_cross.status_code == 404

    def test_self_status_endpoint(self):
        """GET /api/v1/attendance/self-status/ returns personal check-in state for authenticated member."""
        url = reverse('attendance-self-status')
        self.client.force_authenticate(user=self.teacher_mem.user)

        resp = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert resp.data['data']['has_checked_in'] is False
