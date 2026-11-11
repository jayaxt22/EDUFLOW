"""
Model constraint tests per doc/testing.md.
Proves that database-level unique constraints and partial indexes are enforced.
"""

import pytest
from datetime import date
from django.db import IntegrityError
from apps.identity.models import User, Membership, StudentProfile, TeacherProfile, StaffProfile
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestModelConstraints:
    def test_academic_year_single_current_constraint(self):
        """Cannot have two academic years with is_current=True."""
        AcademicYear.objects.using('tenant_demo').create(
            name='Year 1',
            start_date=date(2025, 4, 1),
            end_date=date(2026, 3, 31),
            is_current=True
        )
        with pytest.raises(IntegrityError):
            AcademicYear.objects.using('tenant_demo').create(
                name='Year 2',
                start_date=date(2026, 4, 1),
                end_date=date(2027, 3, 31),
                is_current=True
            )

    def test_single_class_teacher_per_unit_constraint(self):
        """Only one teacher can be assigned as class teacher per academic unit."""
        year = AcademicYear.objects.using('tenant_demo').create(
            name='Year 2026',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=False
        )
        unit = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section Alpha',
            unit_type='SECTION'
        )

        user1 = User.objects.using('tenant_demo').create(
            email='t1@school.edu', username='t1', password_hash='hash1'
        )
        mem1 = Membership.objects.using('tenant_demo').create(user=user1, role='TEACHER')

        user2 = User.objects.using('tenant_demo').create(
            email='t2@school.edu', username='t2', password_hash='hash2'
        )
        mem2 = Membership.objects.using('tenant_demo').create(user=user2, role='TEACHER')

        # First class teacher assignment succeeds
        TeachingAssignment.objects.using('tenant_demo').create(
            membership=mem1,
            academic_unit=unit,
            is_class_teacher=True
        )

        # Second class teacher assignment for the SAME unit must raise IntegrityError
        with pytest.raises(IntegrityError):
            TeachingAssignment.objects.using('tenant_demo').create(
                membership=mem2,
                academic_unit=unit,
                is_class_teacher=True
            )

    def test_unique_roll_number_per_unit_and_date(self):
        """Cannot assign duplicate roll numbers in the same unit starting on the same date."""
        year = AcademicYear.objects.using('tenant_demo').create(
            name='Year 2026B',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=False
        )
        unit = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section Beta',
            unit_type='SECTION'
        )

        u1 = User.objects.using('tenant_demo').create(email='s1@school.edu', username='s1', password_hash='h')
        m1 = Membership.objects.using('tenant_demo').create(user=u1, role='STUDENT')

        u2 = User.objects.using('tenant_demo').create(email='s2@school.edu', username='s2', password_hash='h')
        m2 = Membership.objects.using('tenant_demo').create(user=u2, role='STUDENT')

        StudentEnrollment.objects.using('tenant_demo').create(
            membership=m1,
            academic_unit=unit,
            roll_number='10',
            enrolled_from=date(2026, 4, 1)
        )

        with pytest.raises(IntegrityError):
            StudentEnrollment.objects.using('tenant_demo').create(
                membership=m2,
                academic_unit=unit,
                roll_number='10',
                enrolled_from=date(2026, 4, 1)
            )

    def test_student_admission_number_unique(self):
        """Admission number must be unique across all students in the tenant."""
        u1 = User.objects.using('tenant_demo').create(email='a1@school.edu', username='a1', password_hash='h')
        m1 = Membership.objects.using('tenant_demo').create(user=u1, role='STUDENT')
        StudentProfile.objects.using('tenant_demo').create(
            membership=m1,
            admission_number='ADM-999'
        )

        u2 = User.objects.using('tenant_demo').create(email='a2@school.edu', username='a2', password_hash='h')
        m2 = Membership.objects.using('tenant_demo').create(user=u2, role='STUDENT')

        with pytest.raises(IntegrityError):
            StudentProfile.objects.using('tenant_demo').create(
                membership=m2,
                admission_number='ADM-999'
            )

    def test_unique_class_name_per_academic_year(self):
        """Cannot create two classes with the exact same name in the same academic year."""
        year = AcademicYear.objects.using('tenant_demo').create(
            name='Year 2026-UniqueClass',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=False
        )
        AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Class 3',
            unit_type='CLASS',
            parent=None
        )
        with pytest.raises(IntegrityError):
            AcademicUnit.objects.using('tenant_demo').create(
                academic_year=year,
                name='Class 3',
                unit_type='CLASS',
                parent=None
            )

    def test_unique_section_name_per_parent_class(self):
        """Cannot create two sections with the exact same name under the same parent class."""
        year = AcademicYear.objects.using('tenant_demo').create(
            name='Year 2026-UniqueSection',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=False
        )
        cls = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Class 4',
            unit_type='CLASS',
            parent=None
        )
        AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section A',
            unit_type='SECTION',
            parent=cls
        )
        with pytest.raises(IntegrityError):
            AcademicUnit.objects.using('tenant_demo').create(
                academic_year=year,
                name='Section A',
                unit_type='SECTION',
                parent=cls
            )

