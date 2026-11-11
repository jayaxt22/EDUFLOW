"""
Tests for Examinations module per doc/planning.md Phase 5 DoD:
1. Model constraints: uniqueness on exam subjects & mark entries.
2. DoD: Grading policy is evaluated and snapshotted.
3. DoD: Published results are immutable (editing published marks is blocked).
4. Mandatory 4 variants on marks submission endpoint (Allow, Deny 403, Anonymous 401, Cross-tenant 404).
"""

import pytest
from datetime import date
from decimal import Decimal
from django.db import IntegrityError
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError

from apps.tenants.models import Institution, TenantRegistry
from apps.identity.services import create_user_with_membership
from apps.academics.services import create_academic_year, create_academic_unit, create_subject, enroll_student
from apps.examinations.models import Exam, ExamSubject, MarkEntry
from apps.examinations.services import (
    create_exam,
    add_exam_subject,
    enter_marks_bulk,
    publish_exam_results
)

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestExaminations:
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

        # Admin & Teacher
        self.admin = create_user_with_membership('tenant_demo', {
            'email': 'admin_exam@demo.edu',
            'username': 'admin_exam',
            'password': 'Pass12345!',
            'full_name': 'Admin Exam',
            'role': 'ADMIN',
        })
        self.teacher = create_user_with_membership('tenant_demo', {
            'email': 'teacher_exam@demo.edu',
            'username': 'teacher_exam',
            'password': 'Pass12345!',
            'full_name': 'Teacher Exam',
            'role': 'TEACHER',
            'employee_id': 'T-EX-01'
        })
        self.student = create_user_with_membership('tenant_demo', {
            'email': 'student_exam@demo.edu',
            'username': 'student_exam',
            'password': 'Pass12345!',
            'full_name': 'Student Exam',
            'role': 'STUDENT',
            'admission_number': 'EX-STU-01'
        })

        # Academic setup
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
            name='Class 10 Section A',
            unit_type='SECTION'
        )
        self.subject = create_subject(
            tenant_db='tenant_demo',
            name='Mathematics',
            code='MATH-101'
        )
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student.id),
            academic_unit_id=str(self.unit.id),
            roll_number='1',
            enrolled_from=date(2026, 4, 1)
        )

        # Create Exam & Subject paper
        self.exam = create_exam(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Mid-Term Examination 2026',
            start_date=date(2026, 9, 20),
            end_date=date(2026, 9, 30)
        )
        self.exam_subject = add_exam_subject(
            tenant_db='tenant_demo',
            exam_id=str(self.exam.id),
            academic_unit_id=str(self.unit.id),
            subject_id=str(self.subject.id),
            max_marks=Decimal('100.00'),
            passing_marks=Decimal('40.00'),
            exam_date=date(2026, 9, 21)
        )

        self.marks_url = reverse('examinations-marks')

    def test_duplicate_exam_subject_constraint(self):
        """Constraint: UniqueConstraint on (exam, academic_unit, subject) prevents duplicates."""
        with pytest.raises(IntegrityError):
            ExamSubject.objects.using('tenant_demo').create(
                exam=self.exam,
                academic_unit=self.unit,
                subject=self.subject,
                max_marks=Decimal('100.00'),
                passing_marks=Decimal('40.00')
            )

    def test_duplicate_mark_entry_constraint(self):
        """Constraint: UniqueConstraint on (exam_subject, student_membership) prevents duplicates."""
        MarkEntry.objects.using('tenant_demo').create(
            exam_subject=self.exam_subject,
            student_membership=self.student,
            marks_obtained=Decimal('80.00'),
            grade_snapshot='A'
        )
        with pytest.raises(IntegrityError):
            MarkEntry.objects.using('tenant_demo').create(
                exam_subject=self.exam_subject,
                student_membership=self.student,
                marks_obtained=Decimal('90.00'),
                grade_snapshot='A+'
            )

    def test_out_of_bounds_marks_rejected(self):
        """Guard failure: Entering marks higher than max_marks or negative is rejected."""
        with pytest.raises(ValidationError) as exc:
            enter_marks_bulk('tenant_demo', str(self.exam_subject.id), [
                {'student_membership_id': str(self.student.id), 'marks_obtained': '150.00'}  # max is 100
            ], self.teacher)
        assert "Marks must be between 0 and 100.00" in str(exc.value)

    def test_marks_entry_happy_path_with_grade_snapshot(self):
        """DoD: Grade evaluation is performed and snapshotted into mark_entries."""
        entries = [
            {'student_membership_id': str(self.student.id), 'marks_obtained': '85.50', 'remarks': 'Great effort'}
        ]
        result = enter_marks_bulk('tenant_demo', str(self.exam_subject.id), entries, self.teacher)
        assert result['total_recorded'] == 1

        entry = MarkEntry.objects.using('tenant_demo').get(
            exam_subject=self.exam_subject, student_membership=self.student
        )
        assert entry.marks_obtained == Decimal('85.50')
        assert entry.grade_snapshot == 'A'  # 85.50% is 'A' in default policy
        assert entry.is_locked is False

    def test_published_results_are_immutable(self):
        """DoD: Published results are immutable; modifications on published exams are blocked."""
        # 1. Enter initial marks
        entries = [{'student_membership_id': str(self.student.id), 'marks_obtained': '75.00'}]
        enter_marks_bulk('tenant_demo', str(self.exam_subject.id), entries, self.teacher)

        # 2. Publish the exam
        published_exam = publish_exam_results('tenant_demo', str(self.exam.id), self.admin)
        assert published_exam.is_published is True
        assert published_exam.status == 'PUBLISHED'

        # Verify entry is now locked
        entry = MarkEntry.objects.using('tenant_demo').get(
            exam_subject=self.exam_subject, student_membership=self.student
        )
        assert entry.is_locked is True

        # 3. Attempt to modify marks on published exam -> must raise ValidationError
        with pytest.raises(ValidationError) as exc:
            enter_marks_bulk('tenant_demo', str(self.exam_subject.id), [
                {'student_membership_id': str(self.student.id), 'marks_obtained': '95.00'}
            ], self.teacher)
        assert "published and are locked" in str(exc.value)

    # ------------------------------------------------------------------
    # POST /api/v1/examinations/marks/ (Mandatory 4 Variants)
    # ------------------------------------------------------------------

    def test_enter_marks_allow_teacher(self):
        """Variant 1: Allow - Teacher with examinations.enter_marks enters marks."""
        self.client.force_authenticate(user=self.teacher.user)
        payload = {
            'exam_subject_id': str(self.exam_subject.id),
            'entries': [
                {'student_membership_id': str(self.student.id), 'marks_obtained': '92.00'}
            ]
        }
        response = self.client.post(self.marks_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['total_recorded'] == 1
        assert response.data['data']['entries'][0]['grade_snapshot'] == 'A+'

    def test_enter_marks_deny_student_403(self):
        """Variant 2: Deny (403) - Student cannot enter marks."""
        self.client.force_authenticate(user=self.student.user)
        payload = {
            'exam_subject_id': str(self.exam_subject.id),
            'entries': []
        }
        response = self.client.post(self.marks_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_enter_marks_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request fails."""
        payload = {'exam_subject_id': str(self.exam_subject.id), 'entries': []}
        response = self.client.post(self.marks_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_enter_marks_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.teacher.user)
        payload = {'exam_subject_id': str(self.exam_subject.id), 'entries': []}
        response = self.client.post(self.marks_url, payload, format='json', HTTP_X_TENANT_SLUG='wrong-school')
        assert response.status_code == 404
