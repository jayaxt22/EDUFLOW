"""
Tests for RBAC permission registry per doc/rbac.md.
"""

from apps.identity.permissions import (
    Permission,
    ALL_PERMISSIONS,
    ROLE_PERMISSION_SEED_MAP,
    get_initial_permissions_for_membership,
)

class TestPermissionRegistry:
    def test_canonical_permissions_present(self):
        """Verify key permission strings defined in doc/rbac.md."""
        expected_perms = [
            "users.create",
            "users.read_all",
            "users.read_own",
            "users.update_own",
            "users.update_others",
            "users.deactivate",
            "students.read_directory",
            "academic_units.crud",
            "subjects.crud",
            "allocations.crud",
            "enrollments.crud",
            "attendance.mark_class",
            "attendance.mark_self",
            "attendance.read_class",
            "attendance.read_own",
            "attendance.correct",
            "announcements.create_global",
            "announcements.create_class",
            "announcements.forward",
            "announcements.read",
            "fees.structures_crud",
            "fees.invoices_crud",
            "fees.payments_crud",
            "fees.refunds_crud",
            "fees.read_all",
            "fees.read_own",
            "teacher.my_class.view",
        ]
        for p in expected_perms:
            assert p in ALL_PERMISSIONS

    def test_role_seed_permissions(self):
        """Verify role initial permission sets."""
        admin_perms = get_initial_permissions_for_membership('ADMIN')
        assert len(admin_perms) == len(ALL_PERMISSIONS)

        teacher_perms = get_initial_permissions_for_membership('TEACHER')
        assert Permission.STUDENTS_READ_DIRECTORY in teacher_perms
        assert Permission.TEACHER_MY_CLASS_VIEW in teacher_perms
        assert Permission.ATTENDANCE_CORRECT in teacher_perms
        assert Permission.FEES_STRUCTURES_CRUD not in teacher_perms

        student_perms = get_initial_permissions_for_membership('STUDENT')
        assert Permission.ATTENDANCE_READ_OWN in student_perms
        assert Permission.FEES_READ_OWN in student_perms
        assert Permission.STUDENTS_READ_DIRECTORY not in student_perms

        finance_perms = get_initial_permissions_for_membership('STAFF', 'FINANCE')
        assert Permission.FEES_STRUCTURES_CRUD in finance_perms
        assert Permission.FEES_INVOICES_CRUD in finance_perms

        general_staff_perms = get_initial_permissions_for_membership('STAFF', 'RECEPTION')
        assert Permission.STUDENTS_READ_DIRECTORY in general_staff_perms
        assert Permission.FEES_STRUCTURES_CRUD not in general_staff_perms
