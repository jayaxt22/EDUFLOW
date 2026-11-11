"""
Tests for Academics services and atomic student promotion transaction.
Proves Phase 3 DoD: Promotion is atomic.
"""

import pytest
from datetime import date
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.identity.services import create_user_with_membership
from apps.academics.services import (
    create_academic_year,
    create_academic_unit,
    delete_academic_unit,
    create_subject,
    assign_teacher,
    unassign_class_teacher,
    enroll_student,
    promote_students,
    transfer_student_section,
    get_my_class_roster
)
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestAcademicsServices:
    @pytest.fixture(autouse=True)
    def setup_academics_data(self):
        # Create Academic Year
        self.year = create_academic_year(
            tenant_db='tenant_demo',
            name='2026-2027',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True
        )

        # Create Class 10 -> Section A
        self.class_10 = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class 10',
            unit_type='CLASS'
        )
        self.section_10a = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section A',
            unit_type='SECTION',
            parent_id=str(self.class_10.id)
        )

        # Create Class 11 -> Section A (target for promotion)
        self.class_11 = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class 11',
            unit_type='CLASS'
        )
        self.section_11a = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section A',
            unit_type='SECTION',
            parent_id=str(self.class_11.id)
        )

        # Create 2 Students
        self.stu1 = create_user_with_membership('tenant_demo', {
            'email': 's1@demo.edu', 'username': 's1', 'password': 'Pass12345!',
            'full_name': 'Student One', 'role': 'STUDENT', 'admission_number': 'AD-101'
        })
        self.enr1 = enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.stu1.id),
            academic_unit_id=str(self.section_10a.id),
            roll_number='1',
            enrolled_from=date(2026, 4, 1)
        )

        self.stu2 = create_user_with_membership('tenant_demo', {
            'email': 's2@demo.edu', 'username': 's2', 'password': 'Pass12345!',
            'full_name': 'Student Two', 'role': 'STUDENT', 'admission_number': 'AD-102'
        })
        self.enr2 = enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.stu2.id),
            academic_unit_id=str(self.section_10a.id),
            roll_number='2',
            enrolled_from=date(2026, 4, 1)
        )

        # Create Teacher
        self.teacher = create_user_with_membership('tenant_demo', {
            'email': 't1@demo.edu', 'username': 't1', 'password': 'Pass12345!',
            'full_name': 'Teacher One', 'role': 'TEACHER', 'employee_id': 'T-501'
        })

    def test_promotion_happy_path(self):
        """Batch student promotion closes old enrollments and creates new active ones."""
        promotion_date = date(2027, 4, 1)
        batch = [
            {"student_membership_id": str(self.stu1.id), "roll_number": "1101"},
            {"student_membership_id": str(self.stu2.id), "roll_number": "1102"},
        ]

        new_enrollments = promote_students(
            tenant_db='tenant_demo',
            target_unit_id=str(self.section_11a.id),
            promotion_date=promotion_date,
            promotions=batch
        )

        assert len(new_enrollments) == 2

        # Verify old enrollments were closed with enrolled_to set
        self.enr1.refresh_from_db(using='tenant_demo')
        self.enr2.refresh_from_db(using='tenant_demo')
        assert self.enr1.enrolled_to == promotion_date
        assert self.enr2.enrolled_to == promotion_date

        # Verify new active enrollments in target section
        active_11a = StudentEnrollment.objects.using('tenant_demo').filter(
            academic_unit=self.section_11a,
            enrolled_to__isnull=True
        )
        assert active_11a.count() == 2

    def test_promotion_atomic_rollback(self):
        """
        Proof of DoD: If one promotion in a batch fails (e.g. duplicate roll number),
        the ENTIRE batch is rolled back; none of the previous enrollments are touched.
        """
        # Pre-seed roll 1102 in target section to cause a collision for student 2
        stu_pre = create_user_with_membership('tenant_demo', {
            'email': 'pre@demo.edu', 'username': 'pre', 'password': 'Pass12345!',
            'full_name': 'Existing Target Student', 'role': 'STUDENT', 'admission_number': 'AD-PRE'
        })
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(stu_pre.id),
            academic_unit_id=str(self.section_11a.id),
            roll_number='1102',
            enrolled_from=date(2027, 4, 1)
        )

        promotion_date = date(2027, 4, 1)
        # Student 1 is valid, but Student 2 has roll '1102' which collides!
        batch = [
            {"student_membership_id": str(self.stu1.id), "roll_number": "1101"},
            {"student_membership_id": str(self.stu2.id), "roll_number": "1102"},
        ]

        with pytest.raises(ValidationError):
            promote_students(
                tenant_db='tenant_demo',
                target_unit_id=str(self.section_11a.id),
                promotion_date=promotion_date,
                promotions=batch
            )

        # ATOMIC ROLLBACK ASSERTION:
        # Student 1's old enrollment must NOT have been closed!
        self.enr1.refresh_from_db(using='tenant_demo')
        self.enr2.refresh_from_db(using='tenant_demo')
        assert self.enr1.enrolled_to is None
        assert self.enr2.enrolled_to is None

        # Student 1 must NOT have any enrollment created in Class 11
        assert not StudentEnrollment.objects.using('tenant_demo').filter(
            membership=self.stu1,
            academic_unit=self.section_11a
        ).exists()

    def test_class_teacher_assignment_and_roster(self):
        """Class teacher can view roster; duplicate class teacher is rejected."""
        # 1. Assign Teacher One as class teacher for Section 10A
        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher.id),
            academic_unit_id=str(self.section_10a.id),
            is_class_teacher=True
        )

        # 2. Second teacher cannot be assigned as class teacher to the SAME section
        teacher_two = create_user_with_membership('tenant_demo', {
            'email': 't2@demo.edu', 'username': 't2', 'password': 'Pass12345!',
            'full_name': 'Teacher Two', 'role': 'TEACHER', 'employee_id': 'T-502'
        })
        with pytest.raises(ValidationError):
            assign_teacher(
                tenant_db='tenant_demo',
                teacher_membership_id=str(teacher_two.id),
                academic_unit_id=str(self.section_10a.id),
                is_class_teacher=True
            )

        # 3. Retrieve my class roster for Teacher One
        roster_data = get_my_class_roster('tenant_demo', self.teacher)
        assert roster_data['unit']['name'] == 'Section A'
        assert roster_data['total_students'] == 2
        assert roster_data['students'][0]['roll_number'] == '1'
        assert roster_data['students'][1]['roll_number'] == '2'

    def test_assign_teacher_accepts_user_id(self):
        """assign_teacher accepts User.id as well as Membership.id."""
        teacher_three = create_user_with_membership('tenant_demo', {
            'email': 't3@demo.edu', 'username': 't3', 'password': 'Pass12345!',
            'full_name': 'Teacher Three', 'role': 'TEACHER', 'employee_id': 'T-503'
        })
        # Pass User.id instead of Membership.id
        assignment = assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(teacher_three.user.id),
            academic_unit_id=str(self.section_11a.id),
            is_class_teacher=True
        )
        assert assignment is not None
        assert assignment.membership.id == teacher_three.id
        assert assignment.is_class_teacher is True

    def test_assign_teacher_invalid_ids_raise_validation_error(self):
        """Invalid teacher ID or unit ID raises ValidationError instead of 500 error."""
        with pytest.raises(ValidationError):
            assign_teacher(
                tenant_db='tenant_demo',
                teacher_membership_id='invalid-uuid-string',
                academic_unit_id=str(self.section_10a.id)
            )

        with pytest.raises(ValidationError):
            assign_teacher(
                tenant_db='tenant_demo',
                teacher_membership_id='',
                academic_unit_id=str(self.section_10a.id)
            )

    def test_class_created_with_initial_section_and_increased_sections(self):
        """Class is created once with initial section; sections can be increased."""
        class_12 = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class 12',
            unit_type='CLASS',
            initial_section_name='Section A'
        )
        assert class_12.children.count() == 1
        sec_a = class_12.children.first()
        assert sec_a.name == 'Section A'
        assert sec_a.unit_type == 'SECTION'

        # Increase section by adding Section B
        sec_b = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(class_12.id)
        )
        assert class_12.children.count() == 2
        assert sec_b.parent.id == class_12.id

        # Duplicate section in same class rejected
        with pytest.raises(ValidationError):
            create_academic_unit(
                tenant_db='tenant_demo',
                academic_year_id=str(self.year.id),
                name='Section A',
                unit_type='SECTION',
                parent_id=str(class_12.id)
            )

    def test_assign_teacher_auto_resolves_single_section_class(self):
        """Assigning to a CLASS with exactly 1 section auto-resolves to that section."""
        # self.class_10 has exactly 1 section: self.section_10a
        assignment = assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher.id),
            academic_unit_id=str(self.class_10.id),
            is_class_teacher=True
        )
        assert assignment.academic_unit.id == self.section_10a.id
        assert assignment.academic_unit.unit_type == 'SECTION'

    def test_assign_teacher_rejects_class_with_multiple_sections(self):
        """Assigning to a CLASS with multiple sections requires picking an explicit section."""
        # Add a second section to class_10
        create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(self.class_10.id)
        )
        with pytest.raises(ValidationError) as exc:
            assign_teacher(
                tenant_db='tenant_demo',
                teacher_membership_id=str(self.teacher.id),
                academic_unit_id=str(self.class_10.id),
                is_class_teacher=True
            )
        assert "multiple sections" in str(exc.value)

    def test_enroll_student_auto_resolves_single_section_and_rejects_multi_section_class(self):
        """enroll_student auto-resolves single-section classes and rejects multi-section classes."""
        new_stu = create_user_with_membership('tenant_demo', {
            'email': 's_new@demo.edu', 'username': 's_new', 'password': 'Pass12345!',
            'full_name': 'New Student', 'role': 'STUDENT', 'admission_number': 'AD-999'
        })
        # self.class_11 has only section_11a
        enr = enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(new_stu.id),
            academic_unit_id=str(self.class_11.id),
            roll_number='99',
            enrolled_from=date(2026, 4, 1)
        )
        assert enr.academic_unit.id == self.section_11a.id

        # Add section B to class_11
        create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(self.class_11.id)
        )
        another_stu = create_user_with_membership('tenant_demo', {
            'email': 's_new2@demo.edu', 'username': 's_new2', 'password': 'Pass12345!',
            'full_name': 'New Student 2', 'role': 'STUDENT', 'admission_number': 'AD-998'
        })
        with pytest.raises(ValidationError) as exc:
            enroll_student(
                tenant_db='tenant_demo',
                student_membership_id=str(another_stu.id),
                academic_unit_id=str(self.class_11.id),
                roll_number='100',
                enrolled_from=date(2026, 4, 1)
            )
        assert "multiple sections" in str(exc.value)

    def test_assign_teacher_reassign_class_teacher_replaces_existing(self):
        """When reassign_class_teacher=True, existing class teacher is replaced cleanly without DB collision."""
        # 1. Assign Teacher One as class teacher for section_10a
        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher.id),
            academic_unit_id=str(self.section_10a.id),
            is_class_teacher=True
        )
        assert TeachingAssignment.objects.using('tenant_demo').filter(
            academic_unit=self.section_10a,
            is_class_teacher=True
        ).first().membership.id == self.teacher.id

        # 2. Create Teacher Two
        teacher_two = create_user_with_membership('tenant_demo', {
            'email': 't2_reassign@demo.edu', 'username': 't2_reassign', 'password': 'Pass12345!',
            'full_name': 'Teacher Two', 'role': 'TEACHER', 'employee_id': 'T-502B'
        })

        # Calling without reassign_class_teacher=True must still raise ValidationError
        with pytest.raises(ValidationError) as exc:
            assign_teacher(
                tenant_db='tenant_demo',
                teacher_membership_id=str(teacher_two.id),
                academic_unit_id=str(self.section_10a.id),
                is_class_teacher=True,
                reassign_class_teacher=False
            )
        assert "already has an assigned Class Teacher" in str(exc.value)

        # Calling with reassign_class_teacher=True must succeed
        new_assignment = assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(teacher_two.id),
            academic_unit_id=str(self.section_10a.id),
            is_class_teacher=True,
            reassign_class_teacher=True
        )
        assert new_assignment.membership.id == teacher_two.id
        assert new_assignment.is_class_teacher is True

        # Exactly 1 active class teacher exists for section_10a
        active_cts = TeachingAssignment.objects.using('tenant_demo').filter(
            academic_unit=self.section_10a,
            is_class_teacher=True
        )
        assert active_cts.count() == 1
        assert active_cts.first().membership.id == teacher_two.id

        # Teacher Two can now retrieve the roster
        roster = get_my_class_roster('tenant_demo', teacher_two)
        assert roster['unit']['name'] == 'Section A'

    def test_unassign_class_teacher(self):
        """unassign_class_teacher removes the class teacher assignment cleanly."""
        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher.id),
            academic_unit_id=str(self.section_11a.id),
            is_class_teacher=True
        )
        assert TeachingAssignment.objects.using('tenant_demo').filter(
            academic_unit=self.section_11a,
            is_class_teacher=True
        ).exists()

        result = unassign_class_teacher('tenant_demo', str(self.section_11a.id))
        assert result is True
        assert not TeachingAssignment.objects.using('tenant_demo').filter(
            academic_unit=self.section_11a,
            is_class_teacher=True
        ).exists()

    def test_create_duplicate_class_name_fails(self):
        """Cannot create a second class with the same name in the same academic year."""
        with pytest.raises(ValidationError) as exc:
            create_academic_unit(
                tenant_db='tenant_demo',
                academic_year_id=str(self.year.id),
                name='Class 10',  # Already created in setup
                unit_type='CLASS'
            )
        assert 'name' in exc.value.detail

    def test_delete_empty_class_and_child_sections_success(self):
        """Deleting an empty class cascades to child sections and assignments."""
        cls = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class to Delete',
            unit_type='CLASS',
            initial_section_name='Section A'
        )
        sec = AcademicUnit.objects.using('tenant_demo').get(parent=cls)
        # Assign a teacher to the section
        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.teacher.id),
            academic_unit_id=str(sec.id),
            is_class_teacher=True
        )

        res = delete_academic_unit('tenant_demo', str(cls.id))
        assert res is True
        assert not AcademicUnit.objects.using('tenant_demo').filter(id=cls.id).exists()
        assert not AcademicUnit.objects.using('tenant_demo').filter(id=sec.id).exists()
        assert not TeachingAssignment.objects.using('tenant_demo').filter(academic_unit=sec).exists()

    def test_delete_class_with_active_students_fails(self):
        """Cannot delete a class if any section has active students."""
        cls = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class with Students',
            unit_type='CLASS',
            initial_section_name='Section A'
        )
        sec = AcademicUnit.objects.using('tenant_demo').get(parent=cls)
        stu3 = create_user_with_membership('tenant_demo', {
            'email': 's3@demo.edu', 'username': 's3', 'password': 'Pass12345!',
            'full_name': 'Student Three', 'role': 'STUDENT', 'admission_number': 'AD-103'
        })
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(stu3.id),
            academic_unit_id=str(sec.id),
            roll_number='55',
            enrolled_from=date(2026, 4, 1)
        )

        with pytest.raises(ValidationError) as exc:
            delete_academic_unit('tenant_demo', str(cls.id))
        assert 'active student enrollments' in str(exc.value.detail)

    def test_delete_section_with_active_students_fails(self):
        """Cannot delete a section if it has active students."""
        cls = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class Multi',
            unit_type='CLASS',
            initial_section_name='Section A'
        )
        sec_b = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(cls.id)
        )
        stu4 = create_user_with_membership('tenant_demo', {
            'email': 's4@demo.edu', 'username': 's4', 'password': 'Pass12345!',
            'full_name': 'Student Four', 'role': 'STUDENT', 'admission_number': 'AD-104'
        })
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(stu4.id),
            academic_unit_id=str(sec_b.id),
            roll_number='99',
            enrolled_from=date(2026, 4, 1)
        )

        with pytest.raises(ValidationError) as exc:
            delete_academic_unit('tenant_demo', str(sec_b.id))
        assert 'active student' in str(exc.value.detail)

    def test_delete_only_section_of_class_fails(self):
        """Cannot delete the only section of a class; must delete the class."""
        cls = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Single Section Class',
            unit_type='CLASS',
            initial_section_name='Section Only'
        )
        sec = AcademicUnit.objects.using('tenant_demo').get(parent=cls)

        with pytest.raises(ValidationError) as exc:
            delete_academic_unit('tenant_demo', str(sec.id))
        assert 'only section' in str(exc.value.detail)

    def test_delete_extra_section_success(self):
        """Deleting an extra empty section when multiple sections exist succeeds."""
        cls = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class Double',
            unit_type='CLASS',
            initial_section_name='Section A'
        )
        sec_b = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(cls.id)
        )

        res = delete_academic_unit('tenant_demo', str(sec_b.id))
        assert res is True
        assert not AcademicUnit.objects.using('tenant_demo').filter(id=sec_b.id).exists()
        # Section A and class still exist
        assert AcademicUnit.objects.using('tenant_demo').filter(parent=cls).count() == 1

    def test_transfer_student_section_happy_path(self):
        """Student is transferred between sections; previous enrollment closed atomically."""
        # self.stu1 is already enrolled in section_10a
        # Create Section 10B
        sec_10b = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(self.class_10.id)
        )

        transfer_date = date(2026, 5, 1)
        new_enr = transfer_student_section(
            tenant_db='tenant_demo',
            student_membership_id=str(self.stu1.id),
            target_section_id=str(sec_10b.id),
            new_roll_number='12',
            transfer_date=transfer_date
        )

        # Verify old enrollment closed
        self.enr1.refresh_from_db(using='tenant_demo')
        assert self.enr1.enrolled_to == transfer_date

        # Verify new enrollment active
        assert new_enr.academic_unit.id == sec_10b.id
        assert new_enr.roll_number == '12'
        assert new_enr.enrolled_from == transfer_date
        assert new_enr.enrolled_to is None

    def test_transfer_student_duplicate_roll_number_fails(self):
        """Transfer fails and rolls back if roll number is already taken in target section."""
        # Create Section B and enroll stu2 with roll '5'
        sec_b = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section B',
            unit_type='SECTION',
            parent_id=str(self.class_10.id)
        )
        enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.stu2.id),
            academic_unit_id=str(sec_b.id),
            roll_number='5',
            enrolled_from=date(2026, 4, 1)
        )

        # Attempt to transfer stu1 with duplicate roll number '5'
        with pytest.raises(ValidationError) as exc:
            transfer_student_section(
                tenant_db='tenant_demo',
                student_membership_id=str(self.stu1.id),
                target_section_id=str(sec_b.id),
                new_roll_number='5'
            )
        assert 'roll_number' in exc.value.detail

        # stu1's original enrollment must remain active (rollback proven)
        active_enr = StudentEnrollment.objects.using('tenant_demo').filter(
            membership=self.stu1,
            enrolled_to__isnull=True
        ).first()
        assert active_enr.academic_unit.id == self.section_10a.id

    def test_transfer_student_same_section_fails(self):
        """Transferring a student to their existing section is rejected."""
        with pytest.raises(ValidationError) as exc:
            transfer_student_section(
                tenant_db='tenant_demo',
                student_membership_id=str(self.stu1.id),
                target_section_id=str(self.section_10a.id)
            )
        assert 'target_section_id' in exc.value.detail

