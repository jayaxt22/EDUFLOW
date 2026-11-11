"""
Tests for seed_dev management command.
Proves that seed_dev creates complete demo school data across all 4 roles
and satisfies database constraints and Argon2 hashing.
"""

import pytest
from io import StringIO
from django.core.management import call_command
from django.contrib.auth.hashers import identify_hasher

from apps.tenants.models import PlatformUser, Institution, TenantRegistry
from apps.identity.models import User, Membership, StudentProfile, TeacherProfile, StaffProfile
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestSeedDevCommand:
    def test_seed_dev_execution_and_idempotency(self):
        """seed_dev runs cleanly and creates all foundational records idempotently."""
        out = StringIO()

        # First run
        call_command('seed_dev', '--tenant-db=tenant_demo', stdout=out)
        output_str = out.getvalue()
        assert "[SUCCESS] Dev seeding complete!" in output_str

        # Verify Control Plane objects in 'default' (eduflow_control)
        assert PlatformUser.objects.using('default').filter(email='admin@eduflow.local').exists()
        inst = Institution.objects.using('default').get(slug='demo')
        assert inst.name == 'Greenwood High Demo School'
        assert TenantRegistry.objects.using('default').filter(institution=inst).exists()

        # Verify Tenant Academic Objects in 'tenant_demo'
        acad_year = AcademicYear.objects.using('tenant_demo').get(is_current=True)
        assert acad_year.name == '2026-2027'
        assert AcademicUnit.objects.using('tenant_demo').filter(academic_year=acad_year).count() == 3
        assert Subject.objects.using('tenant_demo').count() == 3

        # Verify Role 1: ADMIN
        admin_mem = Membership.objects.using('tenant_demo').get(role='ADMIN')
        assert admin_mem.user.email == 'admin@demo.edu'
        assert identify_hasher(admin_mem.user.password_hash).algorithm == 'argon2'

        # Verify Role 2: TEACHER
        teacher_mem = Membership.objects.using('tenant_demo').get(role='TEACHER')
        assert teacher_mem.user.email == 'teacher@demo.edu'
        assert TeacherProfile.objects.using('tenant_demo').filter(membership=teacher_mem, employee_id='T-1001').exists()
        assignment = TeachingAssignment.objects.using('tenant_demo').get(membership=teacher_mem)
        assert assignment.is_class_teacher is True

        # Verify Role 3: STUDENT
        student_mem = Membership.objects.using('tenant_demo').get(role='STUDENT')
        assert student_mem.user.email == 'student@demo.edu'
        assert StudentProfile.objects.using('tenant_demo').filter(membership=student_mem, admission_number='STU-2026-001').exists()
        enrollment = StudentEnrollment.objects.using('tenant_demo').get(membership=student_mem)
        assert enrollment.roll_number == '1'

        # Verify Role 4: STAFF (Finance & Reception)
        finance_staff = StaffProfile.objects.using('tenant_demo').get(staff_type='FINANCE')
        assert finance_staff.membership.role == 'STAFF'
        assert finance_staff.membership.user.email == 'finance@demo.edu'

        reception_staff = StaffProfile.objects.using('tenant_demo').get(staff_type='RECEPTION')
        assert reception_staff.membership.role == 'STAFF'
        assert reception_staff.membership.user.email == 'reception@demo.edu'

        # Second run: must be idempotent without integrity errors
        out_second = StringIO()
        call_command('seed_dev', '--tenant-db=tenant_demo', stdout=out_second)
        assert "[SUCCESS] Dev seeding complete!" in out_second.getvalue()
