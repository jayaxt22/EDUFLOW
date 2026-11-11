"""
Tests for Attendance services per doc/testing.md:
- Happy path: Bulk mark class
- Concurrency / Upsert: Re-marking same day updates records without collision
- Guard failure: Invalid status or student not found
- Same-day correction rule: Today allows correction; past day or foreign teacher rejected
"""

import pytest
from datetime import date, timedelta
from rest_framework.exceptions import ValidationError, PermissionDenied

from apps.identity.services import create_user_with_membership
from apps.academics.services import create_academic_year, create_academic_unit, enroll_student, assign_teacher
from apps.attendance.services import (
    mark_class_attendance,
    mark_self_attendance,
    correct_attendance,
    get_class_attendance_summary,
    get_school_attendance_analytics,
    get_self_checkin_status
)
from apps.attendance.models import AttendanceRecord

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestAttendanceServices:
    @pytest.fixture(autouse=True)
    def setup_data(self):
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
            name='Class 8 Section B',
            unit_type='SECTION'
        )

        self.teacher1 = create_user_with_membership('tenant_demo', {
            'email': 't1_att@demo.edu',
            'username': 't1_att',
            'password': 'Pass12345!',
            'full_name': 'Teacher Prime',
            'role': 'TEACHER',
            'employee_id': 'T-001'
        })
        self.teacher2 = create_user_with_membership('tenant_demo', {
            'email': 't2_att@demo.edu',
            'username': 't2_att',
            'password': 'Pass12345!',
            'full_name': 'Teacher Two',
            'role': 'TEACHER',
            'employee_id': 'T-002'
        })

        self.student1 = create_user_with_membership('tenant_demo', {
            'email': 's1_att@demo.edu',
            'username': 's1_att',
            'password': 'Pass12345!',
            'full_name': 'Student One',
            'role': 'STUDENT',
            'admission_number': 'S-001'
        })
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student1.id),
            academic_unit_id=str(self.unit.id),
            roll_number='1',
            enrolled_from=date(2026, 4, 1)
        )

        self.student2 = create_user_with_membership('tenant_demo', {
            'email': 's2_att@demo.edu',
            'username': 's2_att',
            'password': 'Pass12345!',
            'full_name': 'Student Two',
            'role': 'STUDENT',
            'admission_number': 'S-002'
        })
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student2.id),
            academic_unit_id=str(self.unit.id),
            roll_number='2',
            enrolled_from=date(2026, 4, 1)
        )

        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher1.id),
            academic_unit_id=str(self.unit.id),
            is_class_teacher=True
        )

    def test_bulk_mark_class_attendance_happy_path(self):
        """Happy path: Bulk mark attendance for section."""
        today = date.today()
        payload = [
            {'student_membership_id': str(self.student1.id), 'status': 'PRESENT', 'remarks': 'On time'},
            {'student_membership_id': str(self.student2.id), 'status': 'ABSENT', 'remarks': 'Sick leave'},
        ]

        result = mark_class_attendance('tenant_demo', str(self.unit.id), today, payload, self.teacher1)
        assert result['total_marked'] == 2
        assert result['present_count'] == 1
        assert result['absent_count'] == 1

        # Check records created in DB
        records = AttendanceRecord.objects.using('tenant_demo').filter(academic_unit=self.unit, date=today)
        assert records.count() == 2

    def test_bulk_mark_class_idempotent_upsert(self):
        """Re-submitting attendance for the same day updates records without collision."""
        today = date.today()
        payload1 = [
            {'student_membership_id': str(self.student1.id), 'status': 'ABSENT'},
        ]
        mark_class_attendance('tenant_demo', str(self.unit.id), today, payload1, self.teacher1)

        # Later, teacher updates student1 to PRESENT
        payload2 = [
            {'student_membership_id': str(self.student1.id), 'status': 'PRESENT', 'remarks': 'Arrived late'},
        ]
        result2 = mark_class_attendance('tenant_demo', str(self.unit.id), today, payload2, self.teacher1)
        assert result2['present_count'] == 1

        rec = AttendanceRecord.objects.using('tenant_demo').get(
            subject_user=self.student1, date=today, context='CLASSROOM'
        )
        assert rec.status == 'PRESENT'
        assert rec.remarks == 'Arrived late'

    def test_bulk_mark_guard_failure_invalid_status(self):
        """Guard failure: Invalid status string is rejected."""
        today = date.today()
        payload = [
            {'student_membership_id': str(self.student1.id), 'status': 'INVALID_STATUS'},
        ]
        with pytest.raises(ValidationError):
            mark_class_attendance('tenant_demo', str(self.unit.id), today, payload, self.teacher1)

    def test_same_day_correction_rule_enforced(self):
        """
        doc/rbac.md conditional rule:
        attendance.correct requires the record was marked by this teacher today.
        """
        today = date.today()
        yesterday = today - timedelta(days=1)

        # 1. Record created today by teacher1 -> CAN correct
        rec_today = AttendanceRecord.objects.using('tenant_demo').create(
            subject_user=self.student1,
            academic_unit=self.unit,
            date=today,
            context='CLASSROOM',
            status='ABSENT',
            marked_by=self.teacher1
        )
        corrected = correct_attendance('tenant_demo', str(rec_today.id), 'PRESENT', 'Corrected mistake', self.teacher1)
        assert corrected.status == 'PRESENT'

        # 2. Record from yesterday -> CANNOT correct (raises PermissionDenied)
        rec_past = AttendanceRecord.objects.using('tenant_demo').create(
            subject_user=self.student2,
            academic_unit=self.unit,
            date=yesterday,
            context='CLASSROOM',
            status='ABSENT',
            marked_by=self.teacher1
        )
        with pytest.raises(PermissionDenied) as exc:
            correct_attendance('tenant_demo', str(rec_past.id), 'PRESENT', 'Too late', self.teacher1)
        assert "same day" in str(exc.value)

        # 3. Record today marked by teacher1 -> teacher2 CANNOT correct (raises PermissionDenied)
        with pytest.raises(PermissionDenied) as exc2:
            correct_attendance('tenant_demo', str(rec_today.id), 'ABSENT', 'Unauthorized change', self.teacher2)
        assert "that you marked" in str(exc2.value)

    def test_get_self_checkin_status(self):
        """Service test: get_self_checkin_status returns accurate state before and after check-in."""
        today = date.today()
        # Before check-in
        status_before = get_self_checkin_status('tenant_demo', self.teacher1, today)
        assert status_before['has_checked_in'] is False
        assert status_before['current_record'] is None

        # Record check-in
        mark_self_attendance('tenant_demo', self.teacher1, today, status='PRESENT', remarks='Morning duty')

        # After check-in
        status_after = get_self_checkin_status('tenant_demo', self.teacher1, today)
        assert status_after['has_checked_in'] is True
        assert status_after['current_record']['status'] == 'PRESENT'
        assert status_after['current_record']['remarks'] == 'Morning duty'
        assert len(status_after['history']) >= 1

    def test_get_school_attendance_analytics(self):
        """Service test: get_school_attendance_analytics aggregates KPIs, section metrics, and 7-day trend."""
        today = date.today()

        # Mark attendance for student 1 as PRESENT, student 2 as ABSENT
        payload = [
            {'student_membership_id': str(self.student1.id), 'status': 'PRESENT', 'remarks': 'P'},
            {'student_membership_id': str(self.student2.id), 'status': 'ABSENT', 'remarks': 'A'},
        ]
        mark_class_attendance('tenant_demo', str(self.unit.id), today, payload, self.teacher1)

        # Faculty self check-in
        mark_self_attendance('tenant_demo', self.teacher1, today, status='PRESENT')

        analytics = get_school_attendance_analytics('tenant_demo', today)

        assert analytics['date'] == today
        assert analytics['summary']['total_enrolled'] == 2
        assert analytics['summary']['present_count'] == 1
        assert analytics['summary']['absent_count'] == 1
        assert analytics['summary']['overall_attendance_rate'] == 50.0
        assert len(analytics['section_breakdown']) >= 1

        sec = next(s for s in analytics['section_breakdown'] if s['section_id'] == str(self.unit.id))
        assert sec['status'] == 'COMPLETED'
        assert sec['present_count'] == 1
        assert sec['absent_count'] == 1
        assert sec['attendance_rate'] == 50.0

        assert analytics['staff_summary']['checked_in_count'] >= 1
        assert len(analytics['trend']) == 7

    def test_bulk_mark_class_fails_for_non_class_teacher(self):
        """Teacher who is not the assigned Class Teacher cannot mark classroom attendance."""
        today = date.today()
        payload = [
            {'student_membership_id': str(self.student1.id), 'status': 'PRESENT'}
        ]
        # self.teacher2 is NOT assigned as class teacher for self.unit
        with pytest.raises(PermissionDenied) as exc:
            mark_class_attendance('tenant_demo', str(self.unit.id), today, payload, self.teacher2)
        assert "Only the assigned Class Teacher" in str(exc.value)
