"""
Services for Attendance module.
All business logic, transactions, and permission guards reside here per AGENTS.md.
"""

import logging
from datetime import date, timedelta
from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from apps.attendance.models import AttendanceRecord
from apps.identity.models import Membership, StaffProfile, TeacherProfile
from apps.academics.models import AcademicUnit, StudentEnrollment, TeachingAssignment

logger = logging.getLogger(__name__)

def mark_class_attendance(
    tenant_db: str,
    academic_unit_id: str,
    attendance_date: date,
    records: list,
    marked_by: Membership
) -> dict:
    """
    Bulk marks attendance for a class or section within a concurrency-safe atomic transaction.
    """
    try:
        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id)
    except AcademicUnit.DoesNotExist:
        raise ValidationError({"academic_unit_id": "Academic unit does not exist."})

    # Restrict teacher attendance marking: only the assigned Class Teacher can mark roll call
    if marked_by and marked_by.role == 'TEACHER':
        is_ct = TeachingAssignment.objects.using(tenant_db).filter(
            membership=marked_by,
            academic_unit=unit,
            is_class_teacher=True
        ).exists()
        if not is_ct and unit.parent:
            is_ct = TeachingAssignment.objects.using(tenant_db).filter(
                membership=marked_by,
                academic_unit=unit.parent,
                is_class_teacher=True
            ).exists()
        if not is_ct:
            raise PermissionDenied(f"Only the assigned Class Teacher for {unit.name} (or an Administrator) can mark classroom attendance.")

    valid_statuses = {'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'}
    saved_records = []
    stats = {'PRESENT': 0, 'ABSENT': 0, 'LATE': 0, 'EXCUSED': 0}

    with transaction.atomic(using=tenant_db):
        for idx, item in enumerate(records):
            student_id = item.get('student_membership_id')
            status = item.get('status', 'PRESENT').upper()
            remarks = item.get('remarks', '')

            if status not in valid_statuses:
                raise ValidationError({"records": f"Invalid status '{status}' at index {idx}."})

            try:
                membership = Membership.objects.using(tenant_db).get(id=student_id, role='STUDENT')
            except Membership.DoesNotExist:
                raise ValidationError({"records": f"Student membership {student_id} not found."})

            record, _ = AttendanceRecord.objects.using(tenant_db).update_or_create(
                subject_user=membership,
                date=attendance_date,
                context='CLASSROOM',
                defaults={
                    'academic_unit': unit,
                    'status': status,
                    'marked_by': marked_by,
                    'remarks': remarks
                }
            )
            saved_records.append(record)
            stats[status] += 1

    logger.info(
        f"Marked attendance for {len(saved_records)} students in {unit.name} on {attendance_date} ({tenant_db})"
    )

    return {
        "unit_id": str(unit.id),
        "unit_name": unit.name,
        "date": attendance_date,
        "total_marked": len(saved_records),
        "present_count": stats['PRESENT'],
        "absent_count": stats['ABSENT'],
        "late_count": stats['LATE'],
        "excused_count": stats['EXCUSED'],
        "records": saved_records
    }


def mark_self_attendance(
    tenant_db: str,
    membership: Membership,
    attendance_date: date,
    status: str = 'PRESENT',
    remarks: str = ''
) -> AttendanceRecord:
    """
    Records self check-in attendance for faculty or staff members.
    """
    valid_statuses = {'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'}
    status = status.upper()
    if status not in valid_statuses:
        raise ValidationError({"status": f"Invalid status '{status}'."})

    record, _ = AttendanceRecord.objects.using(tenant_db).update_or_create(
        subject_user=membership,
        date=attendance_date,
        context='SELF',
        defaults={
            'academic_unit': None,
            'status': status,
            'marked_by': membership,
            'remarks': remarks
        }
    )
    return record


def correct_attendance(
    tenant_db: str,
    record_id: str,
    new_status: str,
    new_remarks: str,
    actor_membership: Membership,
    is_admin: bool = False
) -> AttendanceRecord:
    """
    Corrects a previously recorded attendance entry.
    Strict conditional rule per doc/rbac.md:
    - attendance.correct requires the record was marked by this teacher today.
    - Teachers CANNOT correct past days or records marked by other faculty.
    """
    try:
        record = AttendanceRecord.objects.using(tenant_db).select_related('marked_by').get(id=record_id)
    except AttendanceRecord.DoesNotExist:
        raise ValidationError({"record_id": "Attendance record not found."})

    today = date.today()

    if not is_admin:
        if record.date != today:
            raise PermissionDenied(
                f"Attendance can only be corrected on the same day it was recorded (Record date: {record.date}, Today: {today})."
            )
        if record.marked_by != actor_membership and record.subject_user != actor_membership:
            raise PermissionDenied("You can only correct attendance records that you marked.")

    valid_statuses = {'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'}
    new_status = new_status.upper()
    if new_status not in valid_statuses:
        raise ValidationError({"status": f"Invalid status '{new_status}'."})

    record.status = new_status
    if new_remarks is not None:
        record.remarks = new_remarks
    record.save(using=tenant_db)

    logger.info(f"Attendance {record.id} corrected to {new_status} by {actor_membership.user.username} in {tenant_db}")
    return record


def get_class_attendance_summary(
    tenant_db: str,
    academic_unit_id: str,
    attendance_date: date
) -> dict:
    """
    Retrieves full roster attendance state and totals for a given section and date.
    Excludes sensitive guardian and fee fields per doc/rbac.md.
    """
    try:
        unit = AcademicUnit.objects.using(tenant_db).select_related('academic_year', 'parent').get(id=academic_unit_id)
    except AcademicUnit.DoesNotExist:
        raise ValidationError({"academic_unit_id": "Academic unit not found."})

    enrollments = StudentEnrollment.objects.using(tenant_db).select_related(
        'membership__user', 'membership__student_profile'
    ).filter(
        academic_unit=unit,
        enrolled_to__isnull=True
    ).order_by('roll_number')

    existing_records = {
        r.subject_user_id: r
        for r in AttendanceRecord.objects.using(tenant_db).filter(
            academic_unit=unit,
            date=attendance_date,
            context='CLASSROOM'
        )
    }

    stats = {'PRESENT': 0, 'ABSENT': 0, 'LATE': 0, 'EXCUSED': 0, 'UNMARKED': 0}
    roster = []

    for enr in enrollments:
        user = enr.membership.user
        profile = getattr(enr.membership, 'student_profile', None)
        record = existing_records.get(enr.membership.id)

        rec_status = record.status if record else 'UNMARKED'
        stats[rec_status] += 1

        roster.append({
            "enrollment_id": str(enr.id),
            "membership_id": str(enr.membership.id),
            "full_name": user.full_name,
            "roll_number": enr.roll_number,
            "admission_number": profile.admission_number if profile else None,
            "status": rec_status,
            "attendance_record_id": str(record.id) if record else None,
            "remarks": record.remarks if record else '',
        })

    total = len(roster)
    attendance_rate = round((stats['PRESENT'] / total * 100), 1) if total > 0 else 0.0

    return {
        "unit": {
            "id": str(unit.id),
            "name": unit.name,
            "parent_name": unit.parent.name if unit.parent else None,
            "academic_year": unit.academic_year.name,
        },
        "date": attendance_date,
        "total_students": total,
        "present_count": stats['PRESENT'],
        "absent_count": stats['ABSENT'],
        "late_count": stats['LATE'],
        "excused_count": stats['EXCUSED'],
        "unmarked_count": stats['UNMARKED'],
        "attendance_rate": attendance_rate,
        "roster": roster
    }


def get_self_checkin_status(
    tenant_db: str,
    membership: Membership,
    target_date: date
) -> dict:
    """
    Returns today's self check-in state and recent self check-in history for this member.
    """
    record = AttendanceRecord.objects.using(tenant_db).filter(
        subject_user=membership,
        date=target_date,
        context='SELF'
    ).first()

    recent_records = AttendanceRecord.objects.using(tenant_db).filter(
        subject_user=membership,
        context='SELF'
    ).order_by('-date')[:30]

    return {
        "date": target_date,
        "has_checked_in": record is not None,
        "current_record": {
            "id": str(record.id),
            "status": record.status,
            "remarks": record.remarks,
        } if record else None,
        "history": [
            {
                "id": str(r.id),
                "date": str(r.date),
                "status": r.status,
                "remarks": r.remarks
            }
            for r in recent_records
        ]
    }


def get_school_attendance_analytics(
    tenant_db: str,
    target_date: date
) -> dict:
    """
    Computes high-level whole-school attendance analytics for Admin:
    - Overall student attendance percentage and counts
    - Per-section breakdown (enrolled, present, absent, rate, class teacher, status)
    - Faculty and staff self check-in stats & roster
    - 7-day attendance trend
    """
    # 1. Fetch active sections and enrollments
    sections = AcademicUnit.objects.using(tenant_db).filter(
        unit_type='SECTION'
    ).select_related('parent', 'academic_year').prefetch_related(
        'teaching_assignments__membership__user'
    ).all()

    enrollments = StudentEnrollment.objects.using(tenant_db).filter(
        enrolled_to__isnull=True
    ).select_related('membership')

    # Group active enrollments by section
    section_enrollments = {}
    for enr in enrollments:
        section_enrollments.setdefault(enr.academic_unit_id, []).append(enr)

    total_enrolled_students = len(enrollments)

    # 2. Fetch classroom attendance records for target_date
    classroom_records = AttendanceRecord.objects.using(tenant_db).filter(
        date=target_date,
        context='CLASSROOM'
    ).select_related('subject_user', 'academic_unit')

    records_by_section = {}
    total_present = 0
    total_absent = 0
    total_late = 0
    total_excused = 0

    for rec in classroom_records:
        records_by_section.setdefault(rec.academic_unit_id, []).append(rec)
        if rec.status == 'PRESENT':
            total_present += 1
        elif rec.status == 'ABSENT':
            total_absent += 1
        elif rec.status == 'LATE':
            total_late += 1
        elif rec.status == 'EXCUSED':
            total_excused += 1

    total_marked = total_present + total_absent + total_late + total_excused
    total_unmarked = max(0, total_enrolled_students - total_marked)
    overall_attendance_rate = (
        round((total_present / total_enrolled_students) * 100, 1)
        if total_enrolled_students > 0 else 0.0
    )

    # 3. Build section breakdown
    section_breakdown = []
    for sec in sections:
        sec_enrolled = len(section_enrollments.get(sec.id, []))
        sec_records = records_by_section.get(sec.id, [])
        sec_present = sum(1 for r in sec_records if r.status == 'PRESENT')
        sec_absent = sum(1 for r in sec_records if r.status == 'ABSENT')
        sec_late = sum(1 for r in sec_records if r.status == 'LATE')
        sec_excused = sum(1 for r in sec_records if r.status == 'EXCUSED')
        sec_marked = len(sec_records)

        rate = round((sec_present / sec_enrolled) * 100, 1) if sec_enrolled > 0 else 0.0

        # Resolve class teacher
        class_teacher_name = None
        for assignment in sec.teaching_assignments.all():
            if assignment.is_class_teacher and assignment.membership:
                class_teacher_name = assignment.membership.user.full_name
                break

        section_breakdown.append({
            "section_id": str(sec.id),
            "section_name": sec.name,
            "class_name": sec.parent.name if sec.parent else sec.name,
            "academic_year": sec.academic_year.name if sec.academic_year else '',
            "class_teacher_name": class_teacher_name or 'Unassigned',
            "total_enrolled": sec_enrolled,
            "present_count": sec_present,
            "absent_count": sec_absent,
            "late_count": sec_late,
            "excused_count": sec_excused,
            "unmarked_count": max(0, sec_enrolled - sec_marked),
            "attendance_rate": rate,
            "status": "COMPLETED" if sec_marked > 0 else "PENDING"
        })

    # Sort sections by class name and section name
    section_breakdown.sort(key=lambda s: (s['class_name'], s['section_name']))

    # 4. Fetch faculty and staff self check-in stats
    staff_members = Membership.objects.using(tenant_db).filter(
        role__in=['TEACHER', 'STAFF'],
        status='ACTIVE'
    ).select_related('user', 'staff_profile', 'teacher_profile')

    total_staff = len(staff_members)
    staff_records = AttendanceRecord.objects.using(tenant_db).filter(
        date=target_date,
        context='SELF'
    ).select_related('subject_user')

    staff_records_map = {r.subject_user_id: r for r in staff_records}
    staff_checked_in_count = len(staff_records)
    staff_pending_count = max(0, total_staff - staff_checked_in_count)
    staff_attendance_rate = (
        round((staff_checked_in_count / total_staff) * 100, 1)
        if total_staff > 0 else 0.0
    )

    staff_roster = []
    for sm in staff_members:
        rec = staff_records_map.get(sm.id)
        identifier = ''
        if sm.role == 'TEACHER' and hasattr(sm, 'teacher_profile'):
            identifier = sm.teacher_profile.employee_id
        elif sm.role == 'STAFF' and hasattr(sm, 'staff_profile'):
            identifier = sm.staff_profile.employee_id

        staff_roster.append({
            "membership_id": str(sm.id),
            "full_name": sm.user.full_name,
            "email": sm.user.email,
            "role": sm.role,
            "staff_type": getattr(getattr(sm, 'staff_profile', None), 'staff_type', None),
            "employee_id": identifier,
            "status": rec.status if rec else 'NOT_CHECKED_IN',
            "remarks": rec.remarks if rec else ''
        })

    # 5. 7-Day Trend
    trend = []
    for offset in range(6, -1, -1):
        d = target_date - timedelta(days=offset)
        day_records = AttendanceRecord.objects.using(tenant_db).filter(
            date=d,
            context='CLASSROOM'
        )
        p_count = sum(1 for r in day_records if r.status == 'PRESENT')
        a_count = sum(1 for r in day_records if r.status == 'ABSENT')
        d_rate = round((p_count / total_enrolled_students) * 100, 1) if total_enrolled_students > 0 else 0.0
        trend.append({
            "date": str(d),
            "day": d.strftime('%a'),
            "rate": d_rate,
            "present": p_count,
            "absent": a_count
        })

    return {
        "date": target_date,
        "summary": {
            "total_enrolled": total_enrolled_students,
            "overall_attendance_rate": overall_attendance_rate,
            "present_count": total_present,
            "absent_count": total_absent,
            "late_count": total_late,
            "excused_count": total_excused,
            "unmarked_count": total_unmarked,
            "sections_total": len(sections),
            "sections_marked": sum(1 for s in section_breakdown if s['status'] == 'COMPLETED'),
            "sections_pending": sum(1 for s in section_breakdown if s['status'] == 'PENDING'),
        },
        "staff_summary": {
            "total_staff": total_staff,
            "checked_in_count": staff_checked_in_count,
            "pending_count": staff_pending_count,
            "attendance_rate": staff_attendance_rate,
            "roster": staff_roster
        },
        "section_breakdown": section_breakdown,
        "trend": trend
    }
