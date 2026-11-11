"""
Tests for Attendance model constraints per doc/dbplanning.md and doc/testing.md:
1. UNIQUE (subject_user_id, date, context)
2. CHECK (context = 'CLASSROOM' -> academic_unit_id IS NOT NULL)
"""

import pytest
from datetime import date
from django.db import IntegrityError
from apps.identity.services import create_user_with_membership
from apps.academics.services import create_academic_year, create_academic_unit
from apps.attendance.models import AttendanceRecord

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestAttendanceConstraints:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        # Create year and unit
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
            name='Class 10A',
            unit_type='SECTION'
        )

        # Create student and teacher
        self.student = create_user_with_membership('tenant_demo', {
            'email': 'att_stu@demo.edu',
            'username': 'att_stu',
            'password': 'Pass12345!',
            'full_name': 'Attending Student',
            'role': 'STUDENT',
            'admission_number': 'ATT-001'
        })
        self.teacher = create_user_with_membership('tenant_demo', {
            'email': 'att_tch@demo.edu',
            'username': 'att_tch',
            'password': 'Pass12345!',
            'full_name': 'Attending Teacher',
            'role': 'TEACHER',
            'employee_id': 'T-ATT-001'
        })

    def test_duplicate_attendance_same_day_context_rejected(self):
        """Constraint 1: UNIQUE(subject_user_id, date, context) prevents duplicate rows."""
        d = date(2026, 9, 15)

        AttendanceRecord.objects.using('tenant_demo').create(
            subject_user=self.student,
            academic_unit=self.unit,
            date=d,
            context='CLASSROOM',
            status='PRESENT',
            marked_by=self.teacher
        )

        with pytest.raises(IntegrityError):
            AttendanceRecord.objects.using('tenant_demo').create(
                subject_user=self.student,
                academic_unit=self.unit,
                date=d,
                context='CLASSROOM',
                status='ABSENT',
                marked_by=self.teacher
            )

    def test_classroom_context_without_academic_unit_rejected(self):
        """Constraint 2: CHECK (context = 'CLASSROOM' -> academic_unit_id IS NOT NULL)."""
        d = date(2026, 9, 16)

        with pytest.raises(IntegrityError):
            AttendanceRecord.objects.using('tenant_demo').create(
                subject_user=self.student,
                academic_unit=None,  # Violates check constraint for CLASSROOM
                date=d,
                context='CLASSROOM',
                status='PRESENT',
                marked_by=self.teacher
            )

    def test_self_context_without_academic_unit_allowed(self):
        """Self check-in does not require an academic unit."""
        d = date(2026, 9, 16)

        record = AttendanceRecord.objects.using('tenant_demo').create(
            subject_user=self.teacher,
            academic_unit=None,
            date=d,
            context='SELF',
            status='PRESENT',
            marked_by=self.teacher
        )
        assert record.id is not None
        assert record.context == 'SELF'
