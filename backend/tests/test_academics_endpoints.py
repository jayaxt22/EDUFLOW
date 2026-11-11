"""
Tests for Academics API Endpoints per AGENTS.md, doc/rbac.md, and doc/testing.md.

Mandatory 4 variants for permissions:
1. Allow (Admin with appropriate permission)
2. Deny (Teacher without permission -> 403)
3. Anonymous (Unauthenticated -> 401)
4. Cross-tenant (Nonexistent tenant -> 404)

Conditional permissions:
- teacher.my_class.view -> 200 if is_class_teacher=True, 403 if is_class_teacher=False

Field restrictions:
- Roster / directory excludes confidential guardian and fee fields
"""

import pytest
from datetime import date
from django.urls import reverse
from rest_framework.test import APIClient

from apps.tenants.models import Institution, TenantRegistry
from apps.identity.services import create_user_with_membership
from apps.academics.services import (
    create_academic_year,
    create_academic_unit,
    enroll_student,
    assign_teacher
)

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestAcademicsEndpoints:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.client = APIClient()

        # Control Plane Institution & Tenant
        self.inst, _ = Institution.objects.using('default').update_or_create(
            slug='demo',
            defaults={'name': 'Demo School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_demo.sqlite3', 'status': 'ACTIVE'}
        )

        # Admin user (has enrollments.crud, academic_units.crud)
        self.admin_mem = create_user_with_membership('tenant_demo', {
            'email': 'admin_acad@demo.edu',
            'username': 'admin_acad',
            'password': 'AdminPass123!',
            'full_name': 'Principal Acad',
            'role': 'ADMIN',
        })

        # Teacher 1 (will be Class Teacher)
        self.class_teacher_mem = create_user_with_membership('tenant_demo', {
            'email': 'ct@demo.edu',
            'username': 'class_teacher_1',
            'password': 'TeacherPass123!',
            'full_name': 'Class Teacher One',
            'role': 'TEACHER',
            'employee_id': 'T-001',
        })

        # Teacher 2 (Subject Teacher only, not Class Teacher)
        self.subject_teacher_mem = create_user_with_membership('tenant_demo', {
            'email': 'st@demo.edu',
            'username': 'subject_teacher_2',
            'password': 'TeacherPass123!',
            'full_name': 'Subject Teacher Two',
            'role': 'TEACHER',
            'employee_id': 'T-002',
        })

        # Academic Year
        self.year = create_academic_year(
            tenant_db='tenant_demo',
            name='2026-2027',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True
        )

        # Classes and Sections
        self.class_9 = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class 9',
            unit_type='CLASS'
        )
        self.sec_9a = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section A',
            unit_type='SECTION',
            parent_id=str(self.class_9.id)
        )

        self.class_10 = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Class 10',
            unit_type='CLASS'
        )
        self.sec_10a = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Section A',
            unit_type='SECTION',
            parent_id=str(self.class_10.id)
        )

        # Student enrolled in 9A
        self.student_mem = create_user_with_membership('tenant_demo', {
            'email': 'stu_endp@demo.edu',
            'username': 'stu_endp',
            'password': 'StudentPass123!',
            'full_name': 'Hermione Granger',
            'role': 'STUDENT',
            'admission_number': 'AD-901',
            'guardian_name': 'Mr. Granger',
            'guardian_phone': '+44-7700-900077',
            'current_address': 'London, UK'
        })
        self.enr = enroll_student(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student_mem.id),
            academic_unit_id=str(self.sec_9a.id),
            roll_number='1',
            enrolled_from=date(2026, 4, 1)
        )

        # Assign Teacher 1 as Class Teacher for 9A
        assign_teacher(
            tenant_db='tenant_demo',
            teacher_membership_id=str(self.class_teacher_mem.id),
            academic_unit_id=str(self.sec_9a.id),
            subject_id=None,
            is_class_teacher=True
        )

        # URLs
        self.promote_url = reverse('academics-promote')
        self.my_class_url = reverse('academics-my-class')
        self.teacher_my_class_roster_url = reverse('teacher-my-class-roster')
        self.units_url = reverse('academics-units')
        self.transfer_url = reverse('academics-enrollments-transfer')
        self.assignments_url = reverse('academics-assignments')
        self.unassign_class_teacher_url = reverse('academics-unassign-class-teacher')

    # ------------------------------------------------------------------
    # POST /api/v1/academics/promote/ (Mandatory 4 Variants)
    # ------------------------------------------------------------------

    def test_promote_students_allow_admin(self):
        """Variant 1: Allow - Admin with enrollments.crud successfully promotes batch."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            "target_unit_id": str(self.sec_10a.id),
            "promotion_date": "2027-04-01",
            "promotions": [
                {
                    "student_membership_id": str(self.student_mem.id),
                    "roll_number": "1001"
                }
            ]
        }
        response = self.client.post(self.promote_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['promoted_count'] == 1

    def test_promote_students_deny_teacher_403(self):
        """Variant 2: Deny (403) - Teacher lacks enrollments.crud permission."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        payload = {
            "target_unit_id": str(self.sec_10a.id),
            "promotion_date": "2027-04-01",
            "promotions": [
                {
                    "student_membership_id": str(self.student_mem.id),
                    "roll_number": "1001"
                }
            ]
        }
        response = self.client.post(self.promote_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_promote_students_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request fails."""
        payload = {
            "target_unit_id": str(self.sec_10a.id),
            "promotion_date": "2027-04-01",
            "promotions": []
        }
        response = self.client.post(self.promote_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_promote_students_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            "target_unit_id": str(self.sec_10a.id),
            "promotion_date": "2027-04-01",
            "promotions": []
        }
        response = self.client.post(self.promote_url, payload, format='json', HTTP_X_TENANT_SLUG='nonexistent-school')
        assert response.status_code == 404

    # ------------------------------------------------------------------
    # GET /api/v1/academics/my-class/ (Conditional Permission & Exclusions)
    # ------------------------------------------------------------------

    def test_my_class_allowed_for_class_teacher(self):
        """Conditional permission TRUE: Teacher assigned as class teacher gets 200 with roster."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        response = self.client.get(self.my_class_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        roster_data = response.data['data']
        assert roster_data['unit']['name'] == 'Section A'
        assert roster_data['total_students'] == 1
        assert len(roster_data['students']) == 1

        # Exclusion assertions on roster per doc/rbac.md
        student_item = roster_data['students'][0]
        assert 'full_name' in student_item
        assert 'admission_number' in student_item
        assert 'roll_number' in student_item

        assert 'guardian_name' not in student_item
        assert 'guardian_phone' not in student_item
        assert 'date_of_birth' not in student_item
        assert 'dob' not in student_item
        assert 'address' not in student_item
        assert 'fee_balance' not in student_item

    def test_my_class_denied_for_non_class_teacher_403(self):
        """Conditional permission FALSE: Teacher without class teacher assignment gets 403."""
        self.client.force_authenticate(user=self.subject_teacher_mem.user)
        response = self.client.get(self.my_class_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_my_class_cross_tenant_404(self):
        """Cross-tenant (404) for my-class endpoint."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        response = self.client.get(self.my_class_url, HTTP_X_TENANT_SLUG='wrong-tenant')
        assert response.status_code == 404

    # ------------------------------------------------------------------
    # GET /api/v1/academics/units/ (Assigned Class Teacher Name)
    # ------------------------------------------------------------------

    def test_units_returns_class_teacher_name(self):
        """Admin fetches units and receives assigned class_teacher_name."""
        self.client.force_authenticate(user=self.admin_mem.user)
        response = self.client.get(self.units_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        units = response.data['data']

        sec_9a = next((u for u in units if str(u['id']) == str(self.sec_9a.id)), None)
        assert sec_9a is not None
        assert sec_9a['class_teacher_name'] == 'Class Teacher One'

        class_9 = next((u for u in units if str(u['id']) == str(self.class_9.id)), None)
        assert class_9 is not None
        # Verify children sections contain class_teacher_name
        child_9a = next((c for c in class_9['children'] if str(c['id']) == str(self.sec_9a.id)), None)
        assert child_9a is not None
        assert child_9a['class_teacher_name'] == 'Class Teacher One'

        class_10 = next((u for u in units if str(u['id']) == str(self.class_10.id)), None)
        assert class_10 is not None
        assert class_10['class_teacher_name'] is None
        assert 'student_count' in sec_9a
        assert sec_9a['student_count'] == 1

    def test_create_class_endpoint_automatically_creates_section(self):
        """Creating a class via endpoint atomically creates its initial section."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            "academic_year": str(self.year.id),
            "name": "Class 12",
            "unit_type": "CLASS",
            "initial_section_name": "Section A"
        }
        response = self.client.post(self.units_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 201
        data = response.data['data']
        assert data['name'] == 'Class 12'
        assert len(data['children']) == 1
        assert data['children'][0]['name'] == 'Section A'

    def test_create_section_without_parent_fails_400(self):
        """Creating a SECTION via endpoint without parent class fails with 400 Bad Request."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            "academic_year": str(self.year.id),
            "name": "Section Orphan",
            "unit_type": "SECTION"
        }
        response = self.client.post(self.units_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 400

    # ------------------------------------------------------------------
    # GET /api/v1/teacher/my-class-roster/ (Mandatory 4 Variants & Exclusion)
    # ------------------------------------------------------------------

    def test_teacher_my_class_roster_assigned_teacher_200(self):
        """Variant 1: Allow (200) - Assigned class teacher receives roster with full details."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        response = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        roster_data = response.data['data']
        assert roster_data['unit']['name'] == 'Section A'
        assert roster_data['total_students'] == 1
        assert len(roster_data['students']) == 1

        student = roster_data['students'][0]
        assert student['full_name'] == 'Hermione Granger'
        assert student['email'] == 'stu_endp@demo.edu'
        assert student['roll_number'] == '1'
        assert student['admission_number'] == 'AD-901'
        assert 'avatar_url' in student

        # Exclusion assertions per doc/rbac.md
        assert 'guardian_name' not in student
        assert 'guardian_phone' not in student
        assert 'date_of_birth' not in student
        assert 'dob' not in student
        assert 'address' not in student
        assert 'fee_balance' not in student

    def test_teacher_my_class_roster_non_class_teacher_403(self):
        """Variant 2: Deny (403) - Teacher not assigned as class teacher is rejected."""
        self.client.force_authenticate(user=self.subject_teacher_mem.user)
        response = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_teacher_my_class_roster_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request fails."""
        response = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_teacher_my_class_roster_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        response = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

    def test_reassign_and_unassign_class_teacher_endpoints(self):
        """Reassigning class teacher via API replaces old teacher, unassign clears role."""
        self.client.force_authenticate(user=self.admin_mem.user)

        # 1. Reassign Class Teacher of 9A to Teacher 2
        payload = {
            "membership": str(self.subject_teacher_mem.id),
            "academic_unit": str(self.sec_9a.id),
            "is_class_teacher": True,
            "reassign_class_teacher": True
        }
        res = self.client.post(self.assignments_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res.status_code == 201
        assert res.data['success'] is True

        # Now Teacher 2 can access roster
        self.client.force_authenticate(user=self.subject_teacher_mem.user)
        res_roster = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='demo')
        assert res_roster.status_code == 200

        # Teacher 1 can no longer access roster (403)
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        res_old_roster = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='demo')
        assert res_old_roster.status_code == 403

        # 2. Unassign Class Teacher via endpoint
        self.client.force_authenticate(user=self.admin_mem.user)
        unassign_payload = {
            "academic_unit": str(self.sec_9a.id)
        }
        res_unassign = self.client.post(self.unassign_class_teacher_url, unassign_payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert res_unassign.status_code == 200
        assert res_unassign.data['success'] is True

        # Teacher 2 now also loses access
        self.client.force_authenticate(user=self.subject_teacher_mem.user)
        res_roster_after = self.client.get(self.teacher_my_class_roster_url, HTTP_X_TENANT_SLUG='demo')
        assert res_roster_after.status_code == 403

    # ------------------------------------------------------------------
    # DELETE /api/v1/academics/units/{id}/ (Mandatory 4 Variants)
    # ------------------------------------------------------------------

    def test_delete_academic_unit_allow_admin(self):
        """Variant 1: Allow - Admin with academic_units.crud deletes an empty unit."""
        self.client.force_authenticate(user=self.admin_mem.user)
        empty_unit = create_academic_unit(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Temporary Class',
            unit_type='CLASS',
            initial_section_name='Temp Section'
        )
        url = reverse('academics-unit-detail', kwargs={'pk': str(empty_unit.id)})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True

    def test_delete_academic_unit_deny_teacher_403(self):
        """Variant 2: Deny (403) - Teacher lacks academic_units.crud."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        url = reverse('academics-unit-detail', kwargs={'pk': str(self.class_10.id)})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_delete_academic_unit_unauthenticated_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request fails."""
        url = reverse('academics-unit-detail', kwargs={'pk': str(self.class_10.id)})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_delete_academic_unit_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.admin_mem.user)
        url = reverse('academics-unit-detail', kwargs={'pk': str(self.class_10.id)})
        response = self.client.delete(url, HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

    # ------------------------------------------------------------------
    # POST /api/v1/academics/enrollments/transfer/ (Mandatory 4 Variants)
    # ------------------------------------------------------------------

    def test_transfer_student_allow_admin(self):
        """Variant 1: Allow - Admin with enrollments.crud transfers student."""
        self.client.force_authenticate(user=self.admin_mem.user)
        # student_mem is currently enrolled in sec_9a
        payload = {
            "student_membership_id": str(self.student_mem.id),
            "target_unit_id": str(self.sec_10a.id),
            "new_roll_number": "50"
        }
        response = self.client.post(self.transfer_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 200
        assert response.data['success'] is True
        assert response.data['data']['roll_number'] == '50'

    def test_transfer_student_deny_teacher_403(self):
        """Variant 2: Deny (403) - Teacher lacks enrollments.crud."""
        self.client.force_authenticate(user=self.class_teacher_mem.user)
        payload = {
            "student_membership_id": str(self.student_mem.id),
            "target_unit_id": str(self.sec_10a.id),
            "new_roll_number": "50"
        }
        response = self.client.post(self.transfer_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_transfer_student_unauthenticated_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request fails."""
        payload = {
            "student_membership_id": str(self.student_mem.id),
            "target_unit_id": str(self.sec_10a.id),
            "new_roll_number": "50"
        }
        response = self.client.post(self.transfer_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_transfer_student_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.admin_mem.user)
        payload = {
            "student_membership_id": str(self.student_mem.id),
            "target_unit_id": str(self.sec_10a.id),
            "new_roll_number": "50"
        }
        response = self.client.post(self.transfer_url, payload, format='json', HTTP_X_TENANT_SLUG='unknown-school')
        assert response.status_code == 404

