"""
Tests for User endpoints (/api/v1/users/) per AGENTS.md and doc/testing.md.
Mandatory 4 variants: allow, deny (403), anonymous (401), cross-tenant (404).
Mandatory: directory field exclusion assertion.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.identity.services import create_user_with_membership
from apps.tenants.models import Institution, TenantRegistry

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestUserEndpoints:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.client = APIClient()

        # Control Plane: Setup Institution
        self.inst, _ = Institution.objects.using('default').update_or_create(
            slug='demo',
            defaults={'name': 'Demo School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_demo.sqlite3', 'status': 'ACTIVE'}
        )

        # Tenant: Setup Admin
        self.admin_mem = create_user_with_membership('tenant_demo', {
            'email': 'admin@demo.edu',
            'username': 'admin_principal',
            'password': 'AdminPass123!',
            'full_name': 'Principal Skinner',
            'role': 'ADMIN',
        })

        # Tenant: Setup Teacher
        self.teacher_mem = create_user_with_membership('tenant_demo', {
            'email': 'teacher@demo.edu',
            'username': 'teacher_edna',
            'password': 'TeacherPass123!',
            'full_name': 'Edna Krabappel',
            'role': 'TEACHER',
            'employee_id': 'T-101',
        })

        # Tenant: Setup Student with confidential guardian data
        self.student_mem = create_user_with_membership('tenant_demo', {
            'email': 'bart@demo.edu',
            'username': 'bart_simpson',
            'password': 'StudentPass123!',
            'full_name': 'Bart Simpson',
            'role': 'STUDENT',
            'admission_number': 'STU-BART-001',
            'guardian_name': 'Homer Simpson',
            'guardian_phone': '+1-555-7334',
            'current_address': '742 Evergreen Terrace',
        })

        self.users_url = reverse('user-list-create')

    def test_create_user_allow_admin(self):
        """Variant 1: Allow - Admin with users.create successfully creates a student."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            'email': 'lisa@demo.edu',
            'username': 'lisa_simpson',
            'password': 'SaxophonePass123!',
            'full_name': 'Lisa Simpson',
            'role': 'STUDENT',
            'admission_number': 'STU-LISA-002',
            'guardian_name': 'Homer Simpson',
            'guardian_phone': '+1-555-7334',
        }
        response = self.client.post(self.users_url, payload, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 201
        assert response.data['success'] is True
        assert response.data['data']['email'] == 'lisa@demo.edu'
        assert response.data['data']['role'] == 'STUDENT'

    def test_create_user_deny_teacher_403(self):
        """Variant 2: Deny (403) - Teacher lacks users.create permission."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        payload = {
            'email': 'milhouse@demo.edu',
            'username': 'milhouse_van',
            'password': 'GlassesPass123!',
            'full_name': 'Milhouse Van Houten',
            'role': 'STUDENT',
            'admission_number': 'STU-MIL-003',
        }
        response = self.client.post(self.users_url, payload, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_create_user_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request is rejected."""
        payload = {'email': 'anon@demo.edu', 'role': 'STUDENT'}
        response = self.client.post(self.users_url, payload, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_create_user_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Request for nonexistent/foreign tenant returns 404."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {'email': 'cross@demo.edu', 'role': 'STUDENT'}
        response = self.client.post(self.users_url, payload, HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

    def test_directory_field_exclusion_assertion(self):
        """
        Field restriction: Teacher reading directory MUST NOT see guardian info or address.
        doc/rbac.md exclusion assertion.
        """
        self.client.force_authenticate(user=self.teacher_mem.user)
        response = self.client.get(self.users_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True

        students = response.data['data']
        assert len(students) >= 1

        first_student = students[0]
        # Assert allowed keys are present
        assert 'full_name' in first_student
        assert 'admission_number' in first_student

        # MANDATORY ASSERTIONS per AGENTS.md & doc/rbac.md:
        # Excluded keys must be completely ABSENT from response dictionary keys!
        assert 'guardian_name' not in first_student
        assert 'guardian_phone' not in first_student
        assert 'date_of_birth' not in first_student
        assert 'dob' not in first_student
        assert 'address' not in first_student
        assert 'current_address' not in first_student
        assert 'fee_balance' not in first_student

    # ------------------------------------------------------------------
    # User Profile & Password Change Tests
    # ------------------------------------------------------------------

    def test_get_user_me_allow(self):
        """Authenticated user can fetch their full profile."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-me')
        response = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['email'] == self.teacher_mem.user.email
        assert response.data['data']['role'] == 'TEACHER'
        assert response.data['data']['profile']['employee_id'] == 'T-101'

    def test_get_user_me_anonymous_401(self):
        """Anonymous access to /users/me/ is rejected with 401."""
        url = reverse('user-me')
        response = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_get_user_me_cross_tenant_404(self):
        """Cross-tenant request to /users/me/ returns 404."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-me')
        response = self.client.get(url, HTTP_X_TENANT_SLUG='nonexistent-school')
        assert response.status_code == 404

    def test_patch_user_me_student_allowed_fields(self):
        """Student can update their phone and current_address."""
        self.client.force_authenticate(user=self.student_mem.user)
        url = reverse('user-me')
        payload = {
            'phone': '+1-555-4321',
            'current_address': '744 Evergreen Terrace, Springfield'
        }
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['phone'] == '+1-555-4321'
        assert response.data['data']['current_address'] == '744 Evergreen Terrace, Springfield'

    def test_patch_user_me_student_forbidden_full_name(self):
        """Student attempting to update full_name returns 400 Bad Request."""
        self.client.force_authenticate(user=self.student_mem.user)
        url = reverse('user-me')
        payload = {
            'full_name': 'Bartholomew Jo-Jo Simpson'
        }
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 400
        assert response.data['success'] is False
        assert 'Students cannot modify their official name.' in str(response.data)

    def test_patch_user_me_teacher_can_update_full_name_and_phone(self):
        """Teacher can update their full_name, phone, and current_address."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-me')
        payload = {
            'full_name': 'Edna Krabappel-Flanders',
            'phone': '+1-555-8888',
            'current_address': '82 Avenue, Springfield'
        }
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['full_name'] == 'Edna Krabappel-Flanders'
        assert response.data['data']['phone'] == '+1-555-8888'

    def test_change_password_happy_path(self):
        """Teacher successfully changes password and can authenticate with the new password."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-change-password')
        payload = {
            'current_password': 'TeacherPass123!',
            'new_password': 'NewTeacherPass2026!'
        }
        response = self.client.post(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert 'Password changed successfully.' in response.data['data']['message']

        # Verify new password works with authentication service
        from apps.identity.services import authenticate_tenant_user
        user = authenticate_tenant_user('tenant_demo', 'teacher_edna', 'NewTeacherPass2026!')
        assert user.id == self.teacher_mem.user.id

    def test_change_password_wrong_current_password_400(self):
        """Submitting wrong current password returns 400 Bad Request."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-change-password')
        payload = {
            'current_password': 'WrongPassword123!',
            'new_password': 'NewTeacherPass2026!'
        }
        response = self.client.post(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 400
        assert response.data['success'] is False
        assert 'Incorrect current password.' in str(response.data)

    def test_change_password_anonymous_401(self):
        """Anonymous password change request returns 401."""
        url = reverse('user-change-password')
        payload = {'current_password': 'Old', 'new_password': 'New'}
        response = self.client.post(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_change_password_cross_tenant_404(self):
        """Cross-tenant password change request returns 404."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-change-password')
        payload = {
            'current_password': 'TeacherPass123!',
            'new_password': 'NewTeacherPass2026!'
        }
        response = self.client.post(url, payload, format='json', HTTP_X_TENANT_SLUG='invalid-tenant')
        assert response.status_code == 404

    # ------------------------------------------------------------------
    # Admin User Edit & Deactivate Tests (PATCH / DELETE /users/{id}/)
    # ------------------------------------------------------------------

    def test_admin_update_user_allow(self):
        """Admin with users.update_others successfully updates another user."""
        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        payload = {
            'full_name': 'Bart Simpson Jr.',
            'phone': '+1-555-7777',
            'admission_number': 'STU-BART-NEW'
        }
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['full_name'] == 'Bart Simpson Jr.'
        assert response.data['data']['phone'] == '+1-555-7777'

    def test_admin_update_student_academic_details(self):
        """Admin can update student's academic section and roll number, reflected in profile."""
        from apps.academics.models import AcademicYear, AcademicUnit
        from datetime import date

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026-2027 Patch Year',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31)
        )
        cls_node = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Class 8',
            unit_type='CLASS'
        )
        sec_node = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section A',
            unit_type='SECTION',
            parent=cls_node
        )

        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        payload = {
            'academic_unit_id': str(sec_node.id),
            'roll_number': '42'
        }
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        prof = response.data['data']['profile']
        assert prof['academic_unit_id'] == str(sec_node.id)
        assert prof['academic_unit_name'] == 'Section A'
        assert prof['parent_unit_id'] == str(cls_node.id)
        assert prof['parent_unit_name'] == 'Class 8'
        assert prof['roll_number'] == '42'

    def test_admin_update_user_deny_teacher_403(self):
        """Teacher lacks users.update_others and cannot edit other users."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        payload = {'full_name': 'Attempted Name Change'}
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_admin_update_user_anonymous_401(self):
        """Unauthenticated update to user is rejected with 401."""
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        payload = {'full_name': 'Attempted Name Change'}
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_admin_update_user_cross_tenant_404(self):
        """Cross-tenant update returns 404."""
        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        payload = {'full_name': 'Attempted Name Change'}
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

    def test_admin_deactivate_user_allow(self):
        """Admin with users.deactivate successfully soft-deactivates user."""
        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['user']['is_active'] is False

        self.student_mem.user.refresh_from_db()
        assert self.student_mem.user.is_active is False

    def test_admin_deactivate_user_deny_teacher_403(self):
        """Teacher lacks users.deactivate and cannot deactivate other users."""
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_admin_deactivate_user_anonymous_401(self):
        """Anonymous deactivation request returns 401."""
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_admin_deactivate_user_cross_tenant_404(self):
        """Cross-tenant deactivation request returns 404."""
        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-detail', kwargs={'pk': self.student_mem.user.id})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

    # ------------------------------------------------------------------
    # Student Enrollment & Profile Refinement Tests
    # ------------------------------------------------------------------

    def test_admin_create_student_with_enrollment(self):
        """Admin creates a Student with class assignment; enrollment is created atomically."""
        from datetime import date
        from apps.academics.models import AcademicYear, AcademicUnit, StudentEnrollment

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026 Academic Year',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31)
        )
        cls = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 10',
            unit_type='CLASS'
        )
        sec = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section A',
            unit_type='SECTION',
            parent=cls
        )

        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-list-create')
        payload = {
            'email': 'new_enrolled_stu@demo.edu',
            'username': 'new_enrolled_stu',
            'password': 'SecureStudentPass123!',
            'full_name': 'New Enrolled Student',
            'role': 'STUDENT',
            'admission_number': 'ENR-API-001',
            'academic_unit_id': str(sec.id),
            'roll_number': '07',
            'dob': '2010-08-20',
            'nationality': 'American',
            'date_of_joining': '2026-02-01',
        }
        response = self.client.post(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 201
        assert response.data['success'] is True

        # Check DB enrollment
        enrollment = StudentEnrollment.objects.using('tenant_demo').get(
            academic_unit=sec,
            roll_number='07'
        )
        assert enrollment.membership.user.email == 'new_enrolled_stu@demo.edu'
        assert str(enrollment.membership.user.dob) == '2010-08-20'

    def test_admin_create_student_duplicate_roll_400_and_rollback(self):
        """Admin creating student with duplicate roll returns 400 and rolls back transaction."""
        from datetime import date
        from apps.academics.models import AcademicYear, AcademicUnit

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026 Duplicate Test Year',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31)
        )
        sec = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section B',
            unit_type='SECTION'
        )

        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-list-create')
        payload1 = {
            'email': 'student_one@demo.edu',
            'username': 'student_one',
            'password': 'SecureStudentPass123!',
            'full_name': 'Student One',
            'role': 'STUDENT',
            'admission_number': 'ROLL-DUP-01',
            'academic_unit_id': str(sec.id),
            'roll_number': '15',
        }
        res1 = self.client.post(url, payload1, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res1.status_code == 201

        # Second student with duplicate roll '15' in same unit
        payload2 = {
            'email': 'student_two@demo.edu',
            'username': 'student_two',
            'password': 'SecureStudentPass123!',
            'full_name': 'Student Two',
            'role': 'STUDENT',
            'admission_number': 'ROLL-DUP-02',
            'academic_unit_id': str(sec.id),
            'roll_number': '15',  # Duplicate!
        }
        res2 = self.client.post(url, payload2, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res2.status_code == 400
        assert res2.data['success'] is False
        assert 'roll_number' in str(res2.data)

        # Confirm rollback: student_two is not in database
        from apps.identity.models import User
        assert not User.objects.using('tenant_demo').filter(username='student_two').exists()

    def test_student_profile_me_returns_academic_info_and_new_fields(self):
        """GET /api/v1/users/me/ returns student class_name, section_name, roll_number, and new fields."""
        from datetime import date
        from apps.academics.models import AcademicYear, AcademicUnit, StudentEnrollment

        year = AcademicYear.objects.using('tenant_demo').create(
            name='2026 Profile Year',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31)
        )
        cls = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Grade 11',
            unit_type='CLASS'
        )
        sec = AcademicUnit.objects.using('tenant_demo').create(
            academic_year=year,
            name='Section C',
            unit_type='SECTION',
            parent=cls
        )
        StudentEnrollment.objects.using('tenant_demo').create(
            membership=self.student_mem,
            academic_unit=sec,
            roll_number='42',
            enrolled_from=date(2026, 1, 15)
        )
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        img_io = BytesIO()
        img = Image.new('RGB', (10, 10), color='green')
        img.save(img_io, format='PNG')
        img_io.seek(0)
        self.student_mem.user.avatar = SimpleUploadedFile('bart.png', img_io.getvalue(), content_type='image/png')
        self.student_mem.user.nationality = 'American'
        self.student_mem.user.save(using='tenant_demo')

        self.client.force_authenticate(user=self.student_mem.user)
        url = reverse('user-me')
        response = self.client.get(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        data = response.data['data']

        assert data['class_name'] == 'Grade 11'
        assert data['section_name'] == 'Section C'
        assert data['roll_number'] == '42'
        assert data['avatar'] is not None
        assert 'bart' in data['avatar']
        assert data['nationality'] == 'American'

    def test_student_cannot_update_dob_in_profile(self):
        """Student attempting to update dob via PATCH /api/v1/users/me/ is rejected with 400."""
        self.client.force_authenticate(user=self.student_mem.user)
        url = reverse('user-me')
        payload = {'dob': '1999-01-01'}
        response = self.client.patch(url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 400
        assert response.data['success'] is False
        assert 'dob' in str(response.data)

    # ------------------------------------------------------------------
    # Profile Picture / Avatar Image Upload Tests
    # ------------------------------------------------------------------

    def test_user_upload_avatar_happy_path(self):
        """User uploads a valid PNG image; image is stored and URL returned."""
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        img_io = BytesIO()
        img = Image.new('RGB', (50, 50), color='purple')
        img.save(img_io, format='PNG')
        img_io.seek(0)
        uploaded = SimpleUploadedFile('avatar_upload.png', img_io.getvalue(), content_type='image/png')

        self.client.force_authenticate(user=self.student_mem.user)
        url = reverse('user-me')
        response = self.client.patch(
            url,
            {'avatar': uploaded},
            format='multipart',
            HTTP_X_TENANT_SLUG='demo'
        )
        assert response.status_code == 200
        assert response.data['success'] is True
        data = response.data['data']
        assert data['avatar'] is not None
        assert 'avatars/' in data['avatar']

        self.student_mem.user.refresh_from_db()
        assert self.student_mem.user.avatar is not None
        assert 'avatars/' in self.student_mem.user.avatar.name

    def test_user_upload_invalid_file_type_400(self):
        """Uploading a non-image text file returns 400 Bad Request."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        fake_file = SimpleUploadedFile('malicious.txt', b'this is plain text not an image', content_type='text/plain')
        self.client.force_authenticate(user=self.teacher_mem.user)
        url = reverse('user-me')
        response = self.client.patch(
            url,
            {'avatar': fake_file},
            format='multipart',
            HTTP_X_TENANT_SLUG='demo'
        )
        assert response.status_code == 400
        assert response.data['success'] is False
        assert 'Only .jpg, .jpeg, and .png image files are allowed.' in str(response.data)

    def test_user_upload_oversized_file_400(self):
        """Uploading an image larger than 2MB returns 400 Bad Request."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        # 2MB + 1KB
        oversized = SimpleUploadedFile('huge.jpg', b'0' * (2 * 1024 * 1024 + 1024), content_type='image/jpeg')
        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('user-me')
        response = self.client.patch(
            url,
            {'avatar': oversized},
            format='multipart',
            HTTP_X_TENANT_SLUG='demo'
        )
        assert response.status_code == 400
        assert response.data['success'] is False
        assert 'Avatar file size cannot exceed 2MB.' in str(response.data)

    def test_next_identifier_endpoint_all_variants(self):
        """Tests for GET /api/v1/users/next-identifier/ (4 mandatory variants per doc/testing.md)."""
        url = reverse('user-next-identifier')

        # 1. Allow (Admin)
        self.client.force_authenticate(user=self.admin_mem.user)
        for role, prefix in [('STUDENT', 'STU-'), ('TEACHER', 'T-'), ('STAFF', 'EMP-'), ('ADMIN', 'ADM-')]:
            res = self.client.get(f"{url}?role={role}", HTTP_X_TENANT_SLUG='demo')
            assert res.status_code == 200
            assert res.data['success'] is True
            assert res.data['data']['identifier'].startswith(prefix)

        # 2. Deny (Teacher lacking users.create)
        self.client.force_authenticate(user=self.teacher_mem.user)
        res_deny = self.client.get(f"{url}?role=STUDENT", HTTP_X_TENANT_SLUG='demo')
        assert res_deny.status_code == 403

        # 3. Anonymous (401)
        self.client.logout()
        res_anon = self.client.get(f"{url}?role=STUDENT", HTTP_X_TENANT_SLUG='demo')
        assert res_anon.status_code == 401

        # 4. Cross-tenant (404)
        self.client.force_authenticate(user=self.admin_mem.user)
        res_cross = self.client.get(f"{url}?role=STUDENT", HTTP_X_TENANT_SLUG='unknown-school')
        assert res_cross.status_code == 404

    def test_create_user_auto_generates_identifier_via_api(self):
        """Admin creating a student without explicit admission_number auto-generates STU- identifier."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            'email': 'auto_api_stu@demo.edu',
            'username': 'auto_api_stu',
            'password': 'SecurePass123!',
            'full_name': 'Auto API Student',
            'role': 'STUDENT',
        }
        res = self.client.post(self.users_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res.status_code == 201
        assert res.data['success'] is True
        profile = res.data['data']['profile']
        assert profile['admission_number'].startswith('STU-')


