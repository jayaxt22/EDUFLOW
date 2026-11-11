"""
Service layer tests for user creation per doc/testing.md.
Mandatory: >= 3 tests (happy path, guard failure, rollback).
"""

import pytest
from rest_framework.exceptions import ValidationError
from django.db import IntegrityError
from apps.identity.services import create_user_with_membership
from apps.identity.models import User, Membership, StudentProfile, TeacherProfile, StaffProfile

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestUserService:
    def test_happy_path_teacher_creation(self):
        """Creating a Teacher creates User, Membership, and TeacherProfile."""
        data = {
            'email': 'mr.clark@demo.edu',
            'username': 'mr_clark',
            'password': 'SecureClarkPass123!',
            'full_name': 'Harold Clark',
            'role': 'TEACHER',
            'employee_id': 'EMP-T-900',
            'qualification': 'M.A. History',
        }
        membership = create_user_with_membership('tenant_demo', data)

        assert membership.role == 'TEACHER'
        assert membership.user.email == 'mr.clark@demo.edu'
        assert TeacherProfile.objects.using('tenant_demo').filter(membership=membership, employee_id='EMP-T-900').exists()

    def test_auto_generates_employee_id_when_missing(self):
        """When creating Teacher without employee_id, it is automatically generated with 'T-' prefix."""
        data = {
            'email': 'auto_teacher@demo.edu',
            'username': 'auto_teacher',
            'password': 'SecurePass123!',
            'full_name': 'Auto ID Teacher',
            'role': 'TEACHER',
        }
        membership = create_user_with_membership('tenant_demo', data)
        assert membership.role == 'TEACHER'
        profile = TeacherProfile.objects.using('tenant_demo').get(membership=membership)
        assert profile.employee_id.startswith('T-')

    def test_auto_generates_student_admission_and_staff_id(self):
        """When creating Student/Staff without explicit ID, IDs start with STU- and EMP-."""
        stu_mem = create_user_with_membership('tenant_demo', {
            'email': 'auto_stu@demo.edu',
            'username': 'auto_stu',
            'password': 'SecurePass123!',
            'full_name': 'Auto Student',
            'role': 'STUDENT',
        })
        stu_prof = StudentProfile.objects.using('tenant_demo').get(membership=stu_mem)
        assert stu_prof.admission_number.startswith('STU-')

        staff_mem = create_user_with_membership('tenant_demo', {
            'email': 'auto_staff@demo.edu',
            'username': 'auto_staff',
            'password': 'SecurePass123!',
            'full_name': 'Auto Staff',
            'role': 'STAFF',
            'staff_type': 'FINANCE',
        })
        staff_prof = StaffProfile.objects.using('tenant_demo').get(membership=staff_mem)
        assert staff_prof.employee_id.startswith('EMP-')

    def test_generate_unique_identifier_all_roles(self):
        """generate_unique_identifier produces proper prefixes for all 4 roles."""
        from apps.identity.services import generate_unique_identifier
        stu_id = generate_unique_identifier('tenant_demo', 'STUDENT')
        teacher_id = generate_unique_identifier('tenant_demo', 'TEACHER')
        staff_id = generate_unique_identifier('tenant_demo', 'STAFF')
        admin_id = generate_unique_identifier('tenant_demo', 'ADMIN')

        assert stu_id.startswith('STU-')
        assert teacher_id.startswith('T-')
        assert staff_id.startswith('EMP-')
        assert admin_id.startswith('ADM-')

    def test_guard_failure_invalid_role(self):
        """Guard failure: Invalid role raises ValidationError."""
        data = {
            'email': 'parent@demo.edu',
            'username': 'parent_user',
            'password': 'SecurePass123!',
            'full_name': 'Parent User',
            'role': 'PARENT',  # Exactly 4 roles; PARENT is strictly disallowed
        }
        with pytest.raises(ValidationError) as exc_info:
            create_user_with_membership('tenant_demo', data)

        assert 'role' in exc_info.value.detail

    def test_rollback_on_profile_failure(self):
        """Rollback: Failure creating profile rolls back User and Membership."""
        # Pre-create student profile with existing admission number to force IntegrityError
        pre_existing = create_user_with_membership('tenant_demo', {
            'email': 'stu1@demo.edu',
            'username': 'stu1',
            'password': 'Pass12345!',
            'full_name': 'Student One',
            'role': 'STUDENT',
            'admission_number': 'ADMIT-DUP-1',
        })

        initial_user_count = User.objects.using('tenant_demo').count()
        initial_mem_count = Membership.objects.using('tenant_demo').count()

        duplicate_data = {
            'email': 'stu2@demo.edu',
            'username': 'stu2',
            'password': 'Pass12345!',
            'full_name': 'Student Two',
            'role': 'STUDENT',
            'admission_number': 'ADMIT-DUP-1',  # Duplicate!
        }

        with pytest.raises(IntegrityError):
            create_user_with_membership('tenant_demo', duplicate_data)

        # Confirm rollback: No orphan user or membership created!
        assert User.objects.using('tenant_demo').count() == initial_user_count
        assert Membership.objects.using('tenant_demo').count() == initial_mem_count
        assert not User.objects.using('tenant_demo').filter(username='stu2').exists()

    def test_student_creation_with_enrollment_happy_path(self):
        """Creating Student with academic_unit_id, roll_number, and avatar creates StudentEnrollment atomically."""
        from datetime import date
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        from apps.academics.models import AcademicYear, AcademicUnit, StudentEnrollment

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026-2027 Service Test',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31)
        )
        unit = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 10 - Alpha',
            unit_type='SECTION'
        )

        img_io = BytesIO()
        img = Image.new('RGB', (20, 20), color='blue')
        img.save(img_io, format='PNG')
        img_io.seek(0)
        test_file = SimpleUploadedFile('avatar.png', img_io.getvalue(), content_type='image/png')

        data = {
            'email': 'enrolled_student@demo.edu',
            'username': 'enrolled_student',
            'password': 'SecurePass123!',
            'full_name': 'Enrolled Student',
            'role': 'STUDENT',
            'admission_number': 'ENROLL-001',
            'academic_unit_id': str(unit.id),
            'roll_number': '12',
            'avatar': test_file,
            'dob': '2010-05-15',
            'nationality': 'Canadian',
            'date_of_joining': '2026-06-01',
        }

        membership = create_user_with_membership('tenant_demo', data)
        assert membership.role == 'STUDENT'
        assert membership.user.avatar is not None
        assert 'avatars/' in str(membership.user.avatar.name)
        assert membership.user.avatar_url is not None
        assert str(membership.user.dob) == '2010-05-15'
        assert membership.user.nationality == 'Canadian'
        assert str(membership.user.date_of_joining) == '2026-06-01'

        enrollment = StudentEnrollment.objects.using('tenant_demo').get(membership=membership)
        assert enrollment.academic_unit_id == unit.id
        assert enrollment.roll_number == '12'

    def test_student_creation_duplicate_roll_rollback(self):
        """Creating Student with duplicate roll in same unit fails and completely rolls back."""
        from datetime import date
        from apps.academics.models import AcademicYear, AcademicUnit, StudentEnrollment

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026-2027 Rollback Year',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31)
        )
        unit = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 9 - Beta',
            unit_type='SECTION'
        )

        first_student = create_user_with_membership('tenant_demo', {
            'email': 'student_first@demo.edu',
            'username': 'student_first',
            'password': 'SecurePass123!',
            'full_name': 'First Student',
            'role': 'STUDENT',
            'admission_number': 'ROLL-001',
            'academic_unit_id': str(unit.id),
            'roll_number': '25',
        })
        assert StudentEnrollment.objects.using('tenant_demo').filter(academic_unit=unit, roll_number='25').exists()

        initial_user_count = User.objects.using('tenant_demo').count()
        initial_mem_count = Membership.objects.using('tenant_demo').count()

        # Attempt to create second student with duplicate roll_number in same unit
        duplicate_roll_data = {
            'email': 'student_dup_roll@demo.edu',
            'username': 'student_dup_roll',
            'password': 'SecurePass123!',
            'full_name': 'Duplicate Roll Student',
            'role': 'STUDENT',
            'admission_number': 'ROLL-002',
            'academic_unit_id': str(unit.id),
            'roll_number': '25',  # Duplicate!
        }

        with pytest.raises(ValidationError) as exc_info:
            create_user_with_membership('tenant_demo', duplicate_roll_data)

        assert 'roll_number' in exc_info.value.detail

        # Full rollback verification: user, membership, profile NOT created!
        assert User.objects.using('tenant_demo').count() == initial_user_count
        assert Membership.objects.using('tenant_demo').count() == initial_mem_count
        assert not User.objects.using('tenant_demo').filter(username='student_dup_roll').exists()

    def test_admin_update_student_academic_section_and_roll(self):
        """Admin updates a student's academic unit and roll number."""
        from datetime import date
        from apps.academics.models import AcademicYear, AcademicUnit, StudentEnrollment
        from apps.identity.services import update_user_by_admin

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026-2027 Section Move Year',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31)
        )
        sec_a = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 10 - Sec A',
            unit_type='SECTION'
        )
        sec_b = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 10 - Sec B',
            unit_type='SECTION'
        )

        mem = create_user_with_membership('tenant_demo', {
            'email': 'student_move@demo.edu',
            'username': 'student_move',
            'password': 'SecurePass123!',
            'full_name': 'Moving Student',
            'role': 'STUDENT',
            'admission_number': 'STU-MOVE-1',
            'academic_unit_id': str(sec_a.id),
            'roll_number': '10',
        })

        enr_a = StudentEnrollment.objects.using('tenant_demo').get(membership=mem)
        assert enr_a.academic_unit_id == sec_a.id
        assert enr_a.roll_number == '10'

        # Admin moves student to sec_b with roll 22
        update_user_by_admin('tenant_demo', str(mem.user.id), {
            'academic_unit_id': str(sec_b.id),
            'roll_number': '22',
        })

        enr_b = StudentEnrollment.objects.using('tenant_demo').get(membership=mem)
        assert enr_b.academic_unit_id == sec_b.id
        assert enr_b.roll_number == '22'

    def test_admin_update_student_duplicate_roll_fails(self):
        """Admin updating roll number to an already assigned roll number in the same unit fails."""
        from datetime import date
        from apps.academics.models import AcademicYear, AcademicUnit, StudentEnrollment
        from apps.identity.services import update_user_by_admin

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026-2027 Collision Year',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31)
        )
        sec = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 11 - Sec C',
            unit_type='SECTION'
        )

        mem1 = create_user_with_membership('tenant_demo', {
            'email': 'stu1_collision@demo.edu',
            'username': 'stu1_collision',
            'password': 'SecurePass123!',
            'full_name': 'Student One',
            'role': 'STUDENT',
            'admission_number': 'STU-C-1',
            'academic_unit_id': str(sec.id),
            'roll_number': '05',
        })

        mem2 = create_user_with_membership('tenant_demo', {
            'email': 'stu2_collision@demo.edu',
            'username': 'stu2_collision',
            'password': 'SecurePass123!',
            'full_name': 'Student Two',
            'role': 'STUDENT',
            'admission_number': 'STU-C-2',
            'academic_unit_id': str(sec.id),
            'roll_number': '06',
        })

        # Attempt to change mem2's roll number to '05' (already taken by mem1)
        with pytest.raises(ValidationError) as exc_info:
            update_user_by_admin('tenant_demo', str(mem2.user.id), {
                'academic_unit_id': str(sec.id),
                'roll_number': '05',
            })
        assert 'roll_number' in exc_info.value.detail
