"""
Business logic services for Academics module.
Handles academic years, units, allocations, and the atomic student promotion transaction.
"""

from datetime import date
from django.db import transaction, models
from django.db.models import Q
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment
from apps.identity.models import Membership, StudentProfile
import logging

logger = logging.getLogger('eduflow.academics')

def create_academic_year(
    tenant_db: str,
    name: str,
    start_date: date,
    end_date: date,
    is_current: bool = False
) -> AcademicYear:
    """
    Creates an academic year. If is_current is True, unsets any existing current year.
    """
    with transaction.atomic(using=tenant_db):
        if is_current:
            AcademicYear.objects.using(tenant_db).filter(is_current=True).update(is_current=False)

        year = AcademicYear(
            name=name,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current
        )
        year.save(using=tenant_db)
        return year


def create_academic_unit(
    tenant_db: str,
    academic_year_id: str,
    name: str,
    unit_type: str,
    parent_id: str = None,
    initial_section_name: str = None
) -> AcademicUnit:
    """
    Creates a Class or Section in the academic hierarchy.
    Enforces rules:
    1. A SECTION cannot exist without a parent CLASS.
    2. A CLASS cannot exist without a section; if initial_section_name is provided,
       an initial child section is created atomically.
    3. Duplicate section names under the same parent class are prevented.
    """
    if unit_type not in ('CLASS', 'SECTION'):
        raise ValidationError({"unit_type": "unit_type must be CLASS or SECTION."})

    name = name.strip() if name else ''
    if not name:
        raise ValidationError({"name": "Unit name is required."})

    try:
        academic_year = AcademicYear.objects.using(tenant_db).get(id=academic_year_id)
    except (AcademicYear.DoesNotExist, ValueError, Exception):
        raise ValidationError({"academic_year_id": "Academic year does not exist."})

    parent = None
    if unit_type == 'CLASS':
        # Check duplicate class name under same academic year
        if AcademicUnit.objects.using(tenant_db).filter(
            academic_year=academic_year,
            name__iexact=name,
            unit_type='CLASS',
            parent__isnull=True
        ).exists():
            raise ValidationError({"name": f"A class named '{name}' already exists in this academic year."})
    elif unit_type == 'SECTION' and parent_id:
        try:
            parent = AcademicUnit.objects.using(tenant_db).get(id=parent_id)
        except (AcademicUnit.DoesNotExist, ValueError, Exception):
            raise ValidationError({"parent_id": "Parent class does not exist."})
        if parent.unit_type != 'CLASS':
            raise ValidationError({"parent_id": "Parent academic unit must be a CLASS."})

        # Check duplicate section name under same parent
        if AcademicUnit.objects.using(tenant_db).filter(
            parent=parent,
            name__iexact=name,
            unit_type='SECTION'
        ).exists():
            raise ValidationError({"name": f"Section '{name}' already exists in '{parent.name}'."})
    elif parent_id:
        try:
            parent = AcademicUnit.objects.using(tenant_db).get(id=parent_id)
        except (AcademicUnit.DoesNotExist, ValueError, Exception):
            raise ValidationError({"parent_id": "Parent academic unit does not exist."})

    with transaction.atomic(using=tenant_db):
        unit = AcademicUnit(
            academic_year=academic_year,
            name=name,
            unit_type=unit_type,
            parent=parent
        )
        unit.save(using=tenant_db)

        # If a CLASS is created and an initial section is specified, create it atomically
        if unit_type == 'CLASS' and initial_section_name:
            sec_name = initial_section_name.strip() if str(initial_section_name).strip() else 'Section A'
            initial_sec = AcademicUnit(
                academic_year=academic_year,
                name=sec_name,
                unit_type='SECTION',
                parent=unit
            )
            initial_sec.save(using=tenant_db)

    return unit


def delete_academic_unit(tenant_db: str, unit_id: str) -> bool:
    """
    Safely deletes a Class or Section in the academic hierarchy.
    Enforces rules:
    1. A CLASS cannot be deleted if any of its sections contain active student enrollments.
    2. A SECTION cannot be deleted if it contains active student enrollments.
    3. The only section of a CLASS cannot be deleted directly (the whole class must be deleted instead).
    4. If safe, associated teaching assignments and empty child sections are cleaned up atomically.
    """
    try:
        unit = AcademicUnit.objects.using(tenant_db).get(id=unit_id)
    except (AcademicUnit.DoesNotExist, ValueError):
        raise ValidationError({"academic_unit": "Academic unit does not exist."})

    if unit.unit_type == 'CLASS':
        child_sections = list(AcademicUnit.objects.using(tenant_db).filter(parent=unit, unit_type='SECTION'))
        all_unit_ids = [unit.id] + [s.id for s in child_sections]
        active_enrollments_count = StudentEnrollment.objects.using(tenant_db).filter(
            academic_unit_id__in=all_unit_ids,
            enrolled_to__isnull=True
        ).count()

        if active_enrollments_count > 0:
            raise ValidationError({
                "detail": f"Cannot delete Class '{unit.name}' because it contains active student enrollments ({active_enrollments_count} student{'s' if active_enrollments_count > 1 else ''}). Please transfer or unenroll the students first."
            })

        with transaction.atomic(using=tenant_db):
            TeachingAssignment.objects.using(tenant_db).filter(academic_unit_id__in=all_unit_ids).delete()
            AcademicUnit.objects.using(tenant_db).filter(parent=unit).delete()
            unit.delete(using=tenant_db)
            logger.info(f"Deleted class {unit.name} ({unit.id}) and child sections in {tenant_db}")
            return True

    elif unit.unit_type == 'SECTION':
        active_enrollments_count = StudentEnrollment.objects.using(tenant_db).filter(
            academic_unit=unit,
            enrolled_to__isnull=True
        ).count()

        if active_enrollments_count > 0:
            raise ValidationError({
                "detail": f"Cannot delete Section '{unit.name}' because it contains {active_enrollments_count} active student enrollment{'s' if active_enrollments_count > 1 else ''}. Please move the students to another section first."
            })

        parent = unit.parent
        if parent:
            sibling_count = AcademicUnit.objects.using(tenant_db).filter(parent=parent, unit_type='SECTION').count()
            if sibling_count <= 1:
                raise ValidationError({
                    "detail": f"Cannot delete the only section of '{parent.name}'. To remove the entire class, delete the class instead."
                })

        with transaction.atomic(using=tenant_db):
            TeachingAssignment.objects.using(tenant_db).filter(academic_unit=unit).delete()
            unit.delete(using=tenant_db)
            logger.info(f"Deleted section {unit.name} ({unit.id}) in {tenant_db}")
            return True

    return False


def create_subject(tenant_db: str, name: str, code: str) -> Subject:
    """
    Creates a curriculum subject.
    """
    code_upper = code.strip().upper()
    if Subject.objects.using(tenant_db).filter(code=code_upper).exists():
        raise ValidationError({"code": f"Subject with code '{code_upper}' already exists."})

    subject = Subject(name=name, code=code_upper)
    subject.save(using=tenant_db)
    return subject


def assign_teacher(
    tenant_db: str,
    teacher_membership_id: str,
    academic_unit_id: str,
    subject_id: str = None,
    is_class_teacher: bool = False,
    reassign_class_teacher: bool = False
) -> TeachingAssignment:
    """
    Assigns a teacher to an academic unit and subject.
    Enforces the partial unique constraint of one class teacher per academic unit.
    Accepts teacher_membership_id as either Membership ID or User ID.
    If reassign_class_teacher is True, atomically reassigns class teacher status from any existing teacher.
    """
    if not teacher_membership_id or str(teacher_membership_id).strip() in ('', 'null', 'undefined'):
        raise ValidationError({"teacher_membership_id": "Please select a teacher."})

    if not academic_unit_id or str(academic_unit_id).strip() in ('', 'null', 'undefined'):
        raise ValidationError({"academic_unit_id": "Please select an academic unit / section."})

    try:
        membership = Membership.objects.using(tenant_db).select_related('user').filter(
            Q(id=teacher_membership_id) | Q(user_id=teacher_membership_id),
            role='TEACHER'
        ).first()
        if not membership:
            raise Membership.DoesNotExist()
    except (Membership.DoesNotExist, ValueError, Exception):
        raise ValidationError({"teacher_membership_id": "Valid teacher membership not found."})

    try:
        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id)
    except (AcademicUnit.DoesNotExist, ValueError, Exception):
        raise ValidationError({"academic_unit_id": "Academic unit not found."})

    # Enforce class-section rule: allocations operate on sections
    if unit.unit_type == 'CLASS':
        child_sections = AcademicUnit.objects.using(tenant_db).filter(parent=unit, unit_type='SECTION')
        child_count = child_sections.count()
        if child_count == 1:
            # Gracefully auto-resolve to the single child section
            unit = child_sections.first()
        elif child_count > 1:
            raise ValidationError({
                "academic_unit_id": f"Class '{unit.name}' has multiple sections. Please select a specific section (e.g., Section A, Section B)."
            })
        else:
            raise ValidationError({
                "academic_unit_id": f"Class '{unit.name}' has no sections. A class must have a section before allocating a teacher."
            })

    subject = None
    if subject_id and str(subject_id).strip() not in ('', 'null', 'undefined'):
        try:
            subject = Subject.objects.using(tenant_db).get(id=subject_id)
        except (Subject.DoesNotExist, ValueError, Exception):
            raise ValidationError({"subject_id": "Subject not found."})

    with transaction.atomic(using=tenant_db):
        if is_class_teacher:
            existing_class_teacher = TeachingAssignment.objects.using(tenant_db).select_related('membership__user').filter(
                academic_unit=unit,
                is_class_teacher=True
            ).first()
            if existing_class_teacher:
                if existing_class_teacher.membership_id == membership.id:
                    # Already class teacher for this unit
                    pass
                elif not reassign_class_teacher:
                    teacher_name = getattr(getattr(existing_class_teacher.membership, 'user', None), 'full_name', 'Another teacher')
                    raise ValidationError({"is_class_teacher": f"Academic unit '{unit.name}' already has an assigned Class Teacher ({teacher_name})."})
                else:
                    # Atomic reassignment: revoke class teacher status from existing teacher
                    if existing_class_teacher.subject is None:
                        existing_class_teacher.delete(using=tenant_db)
                    else:
                        existing_class_teacher.is_class_teacher = False
                        existing_class_teacher.save(using=tenant_db)

        # Check for existing assignment with same teacher, unit, and subject
        existing_assignment = TeachingAssignment.objects.using(tenant_db).filter(
            membership=membership,
            academic_unit=unit,
            subject=subject
        ).first()
        if existing_assignment:
            if is_class_teacher and not existing_assignment.is_class_teacher:
                existing_assignment.is_class_teacher = True
                existing_assignment.save(using=tenant_db)
            return existing_assignment

        assignment = TeachingAssignment(
            membership=membership,
            academic_unit=unit,
            subject=subject,
            is_class_teacher=is_class_teacher
        )
        assignment.save(using=tenant_db)
        return assignment


def unassign_class_teacher(tenant_db: str, academic_unit_id: str) -> bool:
    """
    Removes the class teacher assignment for a given academic unit / section.
    If the assignment has no associated subject, the assignment record is removed.
    If it has an associated subject, is_class_teacher is toggled to False.
    """
    if not academic_unit_id or str(academic_unit_id).strip() in ('', 'null', 'undefined'):
        raise ValidationError({"academic_unit_id": "Please select an academic unit / section."})

    try:
        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id)
    except (AcademicUnit.DoesNotExist, ValueError, Exception):
        raise ValidationError({"academic_unit_id": "Academic unit not found."})

    if unit.unit_type == 'CLASS':
        child_sections = AcademicUnit.objects.using(tenant_db).filter(parent=unit, unit_type='SECTION')
        if child_sections.count() == 1:
            unit = child_sections.first()
        elif child_sections.count() > 1:
            raise ValidationError({"academic_unit_id": f"Class '{unit.name}' has multiple sections. Please select a specific section."})
        else:
            raise ValidationError({"academic_unit_id": f"Class '{unit.name}' has no sections."})

    with transaction.atomic(using=tenant_db):
        assignments = TeachingAssignment.objects.using(tenant_db).filter(
            academic_unit=unit,
            is_class_teacher=True
        )
        for ta in assignments:
            if ta.subject is None:
                ta.delete(using=tenant_db)
            else:
                ta.is_class_teacher = False
                ta.save(using=tenant_db)

    return True


def enroll_student(
    tenant_db: str,
    student_membership_id: str,
    academic_unit_id: str,
    roll_number: str,
    enrolled_from: date,
    enrolled_to: date = None
) -> StudentEnrollment:
    """
    Enrolls a student membership into a specific academic unit.
    Accepts student_membership_id as either Membership ID or User ID.
    """
    try:
        membership = Membership.objects.using(tenant_db).filter(
            Q(id=student_membership_id) | Q(user_id=student_membership_id),
            role='STUDENT'
        ).first()
        if not membership:
            raise Membership.DoesNotExist()
    except (Membership.DoesNotExist, ValueError, Exception):
        raise ValidationError({"student_membership_id": "Valid student membership not found."})

    try:
        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id)
    except (AcademicUnit.DoesNotExist, ValueError, Exception):
        raise ValidationError({"academic_unit_id": "Academic unit not found."})

    # Enforce class-section rule: allocations operate on sections
    if unit.unit_type == 'CLASS':
        child_sections = AcademicUnit.objects.using(tenant_db).filter(parent=unit, unit_type='SECTION')
        child_count = child_sections.count()
        if child_count == 1:
            # Gracefully auto-resolve to the single child section
            unit = child_sections.first()
        elif child_count > 1:
            raise ValidationError({
                "academic_unit_id": f"Class '{unit.name}' has multiple sections. Please select a specific section (e.g., Section A, Section B)."
            })
        else:
            raise ValidationError({
                "academic_unit_id": f"Class '{unit.name}' has no sections. A class must have a section before allocating a teacher."
            })

    # Check roll number collision
    if StudentEnrollment.objects.using(tenant_db).filter(
        academic_unit=unit,
        roll_number=roll_number,
        enrolled_from=enrolled_from
    ).exists():
        raise ValidationError({"roll_number": f"Roll number '{roll_number}' is already assigned in {unit.name} on this date."})

    enrollment = StudentEnrollment(
        membership=membership,
        academic_unit=unit,
        roll_number=roll_number,
        enrolled_from=enrolled_from,
        enrolled_to=enrolled_to
    )
    enrollment.save(using=tenant_db)
    return enrollment


def promote_students(
    tenant_db: str,
    target_unit_id: str,
    promotion_date: date,
    promotions: list[dict]
) -> list[StudentEnrollment]:
    """
    Atomic student promotion transaction per doc/planning.md (Phase 3 DoD).
    - Closes previous active enrollment by setting enrolled_to = promotion_date.
    - Creates new StudentEnrollment in target academic unit.
    - Entire operation is atomic; any single validation or constraint failure
      reverts all promotions completely.
    """
    if not promotions:
        raise ValidationError({"promotions": "At least one student promotion record is required."})

    try:
        target_unit = AcademicUnit.objects.using(tenant_db).get(id=target_unit_id)
    except AcademicUnit.DoesNotExist:
        raise ValidationError({"target_unit_id": "Target academic unit not found."})

    new_enrollments = []

    with transaction.atomic(using=tenant_db):
        for idx, item in enumerate(promotions):
            student_id = item.get('student_membership_id')
            if not student_id:
                raise ValidationError({"promotions": f"Missing student_membership_id at index {idx}."})

            try:
                membership = Membership.objects.using(tenant_db).get(id=student_id, role='STUDENT')
            except Membership.DoesNotExist:
                raise ValidationError({"promotions": f"Student membership {student_id} not found."})

            # 1. Close current active enrollment
            active_enrollment = StudentEnrollment.objects.using(tenant_db).filter(
                membership=membership,
                enrolled_to__isnull=True
            ).first()

            roll_number = item.get('roll_number')
            if active_enrollment:
                active_enrollment.enrolled_to = promotion_date
                active_enrollment.save(using=tenant_db)
                if not roll_number:
                    roll_number = active_enrollment.roll_number

            if not roll_number:
                roll_number = str(idx + 1)

            # 2. Check for roll collision in target unit
            if StudentEnrollment.objects.using(tenant_db).filter(
                academic_unit=target_unit,
                roll_number=roll_number,
                enrolled_from=promotion_date
            ).exists():
                raise ValidationError({
                    "roll_number": f"Roll number '{roll_number}' already exists in target unit {target_unit.name} on {promotion_date}."
                })

            # 3. Create new enrollment
            new_enrollment = StudentEnrollment(
                membership=membership,
                academic_unit=target_unit,
                roll_number=roll_number,
                enrolled_from=promotion_date,
                enrolled_to=None
            )
            new_enrollment.save(using=tenant_db)
            new_enrollments.append(new_enrollment)

    logger.info(f"Promoted {len(new_enrollments)} students to {target_unit.name} atomically in {tenant_db}")
    return new_enrollments


def transfer_student_section(
    tenant_db: str,
    student_membership_id: str,
    target_section_id: str,
    new_roll_number: str = None,
    transfer_date: date = None
) -> StudentEnrollment:
    """
    Transfers a student from their current section to a target section atomically.
    - Closes previous active enrollment with enrolled_to = transfer_date.
    - Ensures target is a valid SECTION.
    - Validates roll number uniqueness in the target section.
    - Creates a new active StudentEnrollment in target section.
    """
    try:
        membership = Membership.objects.using(tenant_db).filter(
            Q(id=student_membership_id) | Q(user_id=student_membership_id),
            role='STUDENT'
        ).first()
        if not membership:
            raise Membership.DoesNotExist()
    except (Membership.DoesNotExist, ValueError):
        raise ValidationError({"student_membership_id": "Valid student membership not found."})

    try:
        target_section = AcademicUnit.objects.using(tenant_db).get(id=target_section_id)
    except (AcademicUnit.DoesNotExist, ValueError):
        raise ValidationError({"target_section_id": "Target academic unit not found."})

    if target_section.unit_type != 'SECTION':
        raise ValidationError({"target_section_id": "Target academic unit must be a SECTION."})

    active_enrollment = StudentEnrollment.objects.using(tenant_db).filter(
        membership=membership,
        enrolled_to__isnull=True
    ).first()

    if not active_enrollment:
        raise ValidationError({"student_membership_id": "Student does not have an active enrollment to transfer from."})

    if active_enrollment.academic_unit_id == target_section.id:
        raise ValidationError({"target_section_id": f"Student is already enrolled in {target_section.name}."})

    if not transfer_date:
        transfer_date = date.today()
    elif isinstance(transfer_date, str):
        transfer_date = date.fromisoformat(transfer_date)

    if active_enrollment.enrolled_from and transfer_date < active_enrollment.enrolled_from:
        raise ValidationError({"transfer_date": f"Transfer date cannot be earlier than current enrollment start date ({active_enrollment.enrolled_from})."})

    roll_to_use = new_roll_number.strip() if new_roll_number and str(new_roll_number).strip() else active_enrollment.roll_number
    if not roll_to_use:
        roll_to_use = '1'

    # Check roll collision among active students in target section
    if StudentEnrollment.objects.using(tenant_db).filter(
        academic_unit=target_section,
        roll_number=roll_to_use,
        enrolled_to__isnull=True
    ).exclude(membership=membership).exists():
        raise ValidationError({"roll_number": f"Roll number '{roll_to_use}' is already taken in {target_section.name}."})

    with transaction.atomic(using=tenant_db):
        active_enrollment.enrolled_to = transfer_date
        active_enrollment.save(using=tenant_db)

        new_enrollment = StudentEnrollment(
            membership=membership,
            academic_unit=target_section,
            roll_number=roll_to_use,
            enrolled_from=transfer_date,
            enrolled_to=None
        )
        new_enrollment.save(using=tenant_db)
        logger.info(f"Transferred student {membership.id} to section {target_section.name} ({target_section.id}) in {tenant_db}")
        return new_enrollment


def get_my_class_roster(tenant_db: str, teacher_membership: Membership) -> dict:
    """
    Retrieves the class roster for a teacher assigned as Class Teacher.
    Guarded conditionally per doc/rbac.md (teacher.my_class.view).
    """
    assignment = TeachingAssignment.objects.using(tenant_db).select_related(
        'academic_unit', 'academic_unit__parent', 'academic_unit__academic_year'
    ).filter(
        membership=teacher_membership,
        is_class_teacher=True
    ).first()

    if not assignment:
        raise PermissionDenied("You are not assigned as a Class Teacher for any academic unit.")

    unit = assignment.academic_unit

    # Active student enrollments in this unit
    active_enrollments = StudentEnrollment.objects.using(tenant_db).select_related(
        'membership__user', 'membership__student_profile'
    ).filter(
        academic_unit=unit,
        enrolled_to__isnull=True
    ).order_by('roll_number')

    roster = []
    for enr in active_enrollments:
        user = enr.membership.user
        profile = getattr(enr.membership, 'student_profile', None)
        roster.append({
            "enrollment_id": str(enr.id),
            "membership_id": str(enr.membership.id),
            "full_name": user.full_name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "roll_number": enr.roll_number,
            "admission_number": profile.admission_number if profile else None,
            "enrolled_from": enr.enrolled_from,
        })

    return {
        "unit": {
            "id": str(unit.id),
            "name": unit.name,
            "parent_name": unit.parent.name if unit.parent else None,
            "academic_year": unit.academic_year.name,
        },
        "total_students": len(roster),
        "students": roster
    }
