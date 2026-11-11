"""
Services for Examinations module.
Enforces Phase 5 DoD:
1. Grading policy is evaluated and snapshotted.
2. Published results are immutable.
"""

import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied

from apps.examinations.models import GradingScale, Exam, ExamSubject, MarkEntry
from apps.identity.models import Membership
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment

logger = logging.getLogger(__name__)

DEFAULT_GRADING_RULES = [
    {"grade": "A+", "min_percentage": 90.0, "max_percentage": 100.0},
    {"grade": "A", "min_percentage": 80.0, "max_percentage": 89.99},
    {"grade": "B", "min_percentage": 70.0, "max_percentage": 79.99},
    {"grade": "C", "min_percentage": 60.0, "max_percentage": 69.99},
    {"grade": "D", "min_percentage": 40.0, "max_percentage": 59.99},
    {"grade": "F", "min_percentage": 0.0, "max_percentage": 39.99},
]

def evaluate_grade(tenant_db: str, percentage: Decimal) -> str:
    """
    Evaluates grade tier based on active GradingScale rules or default fallback.
    """
    scale = GradingScale.objects.using(tenant_db).filter(is_default=True).first()
    rules = scale.rules if (scale and scale.rules) else DEFAULT_GRADING_RULES

    pct = float(percentage)
    for rule in rules:
        min_p = float(rule.get('min_percentage', 0))
        max_p = float(rule.get('max_percentage', 100))
        if min_p <= pct <= max_p:
            return rule.get('grade', 'F')

    return 'F' if pct < 40 else 'P'


def create_exam(
    tenant_db: str,
    academic_year_id: str,
    name: str,
    start_date,
    end_date
) -> Exam:
    """Creates a new exam session."""
    try:
        year = AcademicYear.objects.using(tenant_db).get(id=academic_year_id)
    except AcademicYear.DoesNotExist:
        raise ValidationError({"academic_year_id": "Academic year not found."})

    exam = Exam.objects.using(tenant_db).create(
        academic_year=year,
        name=name,
        start_date=start_date,
        end_date=end_date,
        status='SCHEDULED'
    )
    return exam


def add_exam_subject(
    tenant_db: str,
    exam_id: str,
    academic_unit_id: str,
    subject_id: str,
    max_marks: Decimal = Decimal('100.00'),
    passing_marks: Decimal = Decimal('40.00'),
    exam_date = None
) -> ExamSubject:
    """Associates a subject paper with an exam and class unit."""
    try:
        exam = Exam.objects.using(tenant_db).get(id=exam_id)
        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id)
        subject = Subject.objects.using(tenant_db).get(id=subject_id)
    except (Exam.DoesNotExist, AcademicUnit.DoesNotExist, Subject.DoesNotExist) as e:
        raise ValidationError({"error": str(e)})

    exam_subject, created = ExamSubject.objects.using(tenant_db).update_or_create(
        exam=exam,
        academic_unit=unit,
        subject=subject,
        defaults={
            'max_marks': max_marks,
            'passing_marks': passing_marks,
            'exam_date': exam_date
        }
    )
    return exam_subject


def enter_marks_bulk(
    tenant_db: str,
    exam_subject_id: str,
    entries: list,
    entered_by: Membership
) -> dict:
    """
    Records student marks sheet in bulk.
    DoD Requirements:
    1. Snapshots grade evaluation per grading policy.
    2. Rejects any modifications if the exam has been published (results immutable).
    """
    try:
        exam_subject = ExamSubject.objects.using(tenant_db).select_related('exam', 'subject', 'academic_unit').get(id=exam_subject_id)
    except ExamSubject.DoesNotExist:
        raise ValidationError({"exam_subject_id": "Exam subject paper not found."})

    # DoD: Published results are immutable
    if exam_subject.exam.is_published:
        raise ValidationError("Cannot modify marks: Exam results have already been published and are locked.")

    saved_entries = []

    with transaction.atomic(using=tenant_db):
        for idx, item in enumerate(entries):
            student_id = item.get('student_membership_id')
            is_absent = bool(item.get('is_absent', False))
            marks_raw = item.get('marks_obtained')
            remarks = item.get('remarks', '')

            try:
                membership = Membership.objects.using(tenant_db).get(id=student_id, role='STUDENT')
            except Membership.DoesNotExist:
                raise ValidationError({"entries": f"Student membership {student_id} not found."})

            # Check individual lock
            existing = MarkEntry.objects.using(tenant_db).filter(
                exam_subject=exam_subject,
                student_membership=membership
            ).first()
            if existing and existing.is_locked:
                raise ValidationError("Mark entry is locked and cannot be edited.")

            if is_absent:
                marks_obtained = Decimal('0.00')
                grade = 'AB'
            else:
                if marks_raw is None:
                    raise ValidationError({"entries": f"Missing marks for student at index {idx}."})
                marks_obtained = Decimal(str(marks_raw))

                if marks_obtained < Decimal('0.00') or marks_obtained > exam_subject.max_marks:
                    raise ValidationError({
                        "marks_obtained": f"Marks must be between 0 and {exam_subject.max_marks} (received {marks_obtained})."
                    })

                percentage = (marks_obtained / exam_subject.max_marks) * Decimal('100.00')
                # DoD: Grading policy snapshotted
                grade = evaluate_grade(tenant_db, percentage)

            entry, _ = MarkEntry.objects.using(tenant_db).update_or_create(
                exam_subject=exam_subject,
                student_membership=membership,
                defaults={
                    'marks_obtained': marks_obtained,
                    'is_absent': is_absent,
                    'grade_snapshot': grade,
                    'remarks': remarks,
                    'is_locked': False
                }
            )
            saved_entries.append(entry)

    logger.info(f"Recorded {len(saved_entries)} marks for {exam_subject} in {tenant_db}")

    return {
        "exam_subject_id": str(exam_subject.id),
        "total_recorded": len(saved_entries),
        "entries": saved_entries
    }


def publish_exam_results(
    tenant_db: str,
    exam_id: str,
    published_by: Membership
) -> Exam:
    """
    Publishes an exam's results and permanently locks all mark entries.
    DoD: Results become immutable.
    """
    try:
        exam = Exam.objects.using(tenant_db).get(id=exam_id)
    except Exam.DoesNotExist:
        raise ValidationError({"exam_id": "Exam not found."})

    with transaction.atomic(using=tenant_db):
        exam.status = 'PUBLISHED'
        exam.is_published = True
        exam.published_at = timezone.now()
        exam.save(using=tenant_db)

        # Immutability lock across all mark entries under this exam
        locked_count = MarkEntry.objects.using(tenant_db).filter(
            exam_subject__exam=exam
        ).update(is_locked=True)

    logger.info(f"Published exam '{exam.name}' and locked {locked_count} mark records in {tenant_db}")
    return exam


def get_exam_marks_grid(tenant_db: str, exam_subject_id: str) -> dict:
    """
    Retrieves the complete marks roster grid for a subject paper.
    """
    try:
        exam_subject = ExamSubject.objects.using(tenant_db).select_related(
            'exam', 'subject', 'academic_unit'
        ).get(id=exam_subject_id)
    except ExamSubject.DoesNotExist:
        raise ValidationError({"exam_subject_id": "Exam subject not found."})

    enrollments = StudentEnrollment.objects.using(tenant_db).select_related(
        'membership__user', 'membership__student_profile'
    ).filter(
        academic_unit=exam_subject.academic_unit,
        enrolled_to__isnull=True
    ).order_by('roll_number')

    existing_marks = {
        m.student_membership_id: m
        for m in MarkEntry.objects.using(tenant_db).filter(exam_subject=exam_subject)
    }

    grid = []
    for enr in enrollments:
        user = enr.membership.user
        profile = getattr(enr.membership, 'student_profile', None)
        mark = existing_marks.get(enr.membership.id)

        grid.append({
            "membership_id": str(enr.membership.id),
            "full_name": user.full_name,
            "roll_number": enr.roll_number,
            "admission_number": profile.admission_number if profile else None,
            "marks_obtained": str(mark.marks_obtained) if (mark and mark.marks_obtained is not None) else None,
            "is_absent": mark.is_absent if mark else False,
            "grade_snapshot": mark.grade_snapshot if mark else '',
            "is_passed": (mark.marks_obtained >= exam_subject.passing_marks) if (mark and mark.marks_obtained is not None) else False,
            "remarks": mark.remarks if mark else '',
            "is_locked": mark.is_locked if mark else False,
        })

    return {
        "exam": {
            "id": str(exam_subject.exam.id),
            "name": exam_subject.exam.name,
            "is_published": exam_subject.exam.is_published,
        },
        "subject": {
            "id": str(exam_subject.subject.id),
            "name": exam_subject.subject.name,
            "code": exam_subject.subject.code,
        },
        "unit": {
            "id": str(exam_subject.academic_unit.id),
            "name": exam_subject.academic_unit.name,
        },
        "max_marks": str(exam_subject.max_marks),
        "passing_marks": str(exam_subject.passing_marks),
        "total_students": len(grid),
        "students": grid
    }
