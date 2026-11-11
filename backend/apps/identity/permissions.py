"""
Central RBAC Permission Registry for EduFlow ERP.
Strictly maps permissions and seed role definitions per doc/rbac.md.

Non-negotiable rule:
Business code NEVER checks role == 'TEACHER' or staff_type == 'FINANCE'.
It checks has_perm('<perm>').
"""

class Permission:
    # Users
    USERS_CREATE = "users.create"
    USERS_READ_ALL = "users.read_all"
    USERS_READ_OWN = "users.read_own"
    USERS_UPDATE_OWN = "users.update_own"
    USERS_UPDATE_OTHERS = "users.update_others"
    USERS_DEACTIVATE = "users.deactivate"

    # Students
    STUDENTS_READ_DIRECTORY = "students.read_directory"

    # Academics
    ACADEMIC_UNITS_CRUD = "academic_units.crud"
    SUBJECTS_CRUD = "subjects.crud"
    ALLOCATIONS_CRUD = "allocations.crud"
    ALLOCATIONS_LIST_OWN = "allocations.list_own"
    ENROLLMENTS_CRUD = "enrollments.crud"
    ENROLLMENTS_LIST_OWN = "enrollments.list_own"

    # Attendance
    ATTENDANCE_MARK_CLASS = "attendance.mark_class"
    ATTENDANCE_MARK_SELF = "attendance.mark_self"
    ATTENDANCE_READ_CLASS = "attendance.read_class"
    ATTENDANCE_READ_OWN = "attendance.read_own"
    ATTENDANCE_CORRECT = "attendance.correct"  # Conditional: same-day only

    # Announcements
    ANNOUNCEMENTS_CREATE_GLOBAL = "announcements.create_global"
    ANNOUNCEMENTS_CREATE_CLASS = "announcements.create_class"
    ANNOUNCEMENTS_FORWARD = "announcements.forward"
    ANNOUNCEMENTS_READ = "announcements.read"

    # Fees
    FEES_STRUCTURES_CRUD = "fees.structures_crud"
    FEES_INVOICES_CRUD = "fees.invoices_crud"
    FEES_PAYMENTS_CRUD = "fees.payments_crud"
    FEES_REFUNDS_CRUD = "fees.refunds_crud"
    FEES_READ_ALL = "fees.read_all"
    FEES_READ_OWN = "fees.read_own"

    # Conditional permissions
    TEACHER_MY_CLASS_VIEW = "teacher.my_class.view"

    # Examinations (Phase 5)
    EXAMINATIONS_MANAGE = "examinations.manage"
    EXAMINATIONS_ENTER_MARKS = "examinations.enter_marks"
    EXAMINATIONS_READ = "examinations.read"

ALL_PERMISSIONS = {
    Permission.USERS_CREATE,
    Permission.USERS_READ_ALL,
    Permission.USERS_READ_OWN,
    Permission.USERS_UPDATE_OWN,
    Permission.USERS_UPDATE_OTHERS,
    Permission.USERS_DEACTIVATE,
    Permission.STUDENTS_READ_DIRECTORY,
    Permission.ACADEMIC_UNITS_CRUD,
    Permission.SUBJECTS_CRUD,
    Permission.ALLOCATIONS_CRUD,
    Permission.ALLOCATIONS_LIST_OWN,
    Permission.ENROLLMENTS_CRUD,
    Permission.ENROLLMENTS_LIST_OWN,
    Permission.ATTENDANCE_MARK_CLASS,
    Permission.ATTENDANCE_MARK_SELF,
    Permission.ATTENDANCE_READ_CLASS,
    Permission.ATTENDANCE_READ_OWN,
    Permission.ATTENDANCE_CORRECT,
    Permission.ANNOUNCEMENTS_CREATE_GLOBAL,
    Permission.ANNOUNCEMENTS_CREATE_CLASS,
    Permission.ANNOUNCEMENTS_FORWARD,
    Permission.ANNOUNCEMENTS_READ,
    Permission.FEES_STRUCTURES_CRUD,
    Permission.FEES_INVOICES_CRUD,
    Permission.FEES_PAYMENTS_CRUD,
    Permission.FEES_REFUNDS_CRUD,
    Permission.FEES_READ_ALL,
    Permission.FEES_READ_OWN,
    Permission.TEACHER_MY_CLASS_VIEW,
    Permission.EXAMINATIONS_MANAGE,
    Permission.EXAMINATIONS_ENTER_MARKS,
    Permission.EXAMINATIONS_READ,
}

# Seed role-to-permission mapping per doc/rbac.md
ROLE_PERMISSION_SEED_MAP = {
    "ADMIN": sorted(list(ALL_PERMISSIONS)),
    "TEACHER": [
        Permission.USERS_READ_OWN,
        Permission.USERS_UPDATE_OWN,
        Permission.STUDENTS_READ_DIRECTORY,
        Permission.ALLOCATIONS_LIST_OWN,
        Permission.ENROLLMENTS_LIST_OWN,
        Permission.TEACHER_MY_CLASS_VIEW,  # Resolved conditionally (is_class_teacher=True)
        Permission.ATTENDANCE_MARK_CLASS,
        Permission.ATTENDANCE_MARK_SELF,
        Permission.ATTENDANCE_READ_CLASS,
        Permission.ATTENDANCE_READ_OWN,
        Permission.ATTENDANCE_CORRECT,      # Resolved conditionally (same-day)
        Permission.ANNOUNCEMENTS_READ,
        Permission.EXAMINATIONS_ENTER_MARKS,
        Permission.EXAMINATIONS_READ,
    ],
    "STUDENT": [
        Permission.USERS_READ_OWN,
        Permission.USERS_UPDATE_OWN,
        Permission.ATTENDANCE_READ_OWN,
        Permission.FEES_READ_OWN,
        Permission.ANNOUNCEMENTS_READ,
        Permission.EXAMINATIONS_READ,
    ],
    "STAFF_FINANCE": [
        Permission.USERS_READ_OWN,
        Permission.USERS_UPDATE_OWN,
        Permission.STUDENTS_READ_DIRECTORY,
        Permission.ATTENDANCE_MARK_SELF,
        Permission.ATTENDANCE_READ_OWN,
        Permission.FEES_STRUCTURES_CRUD,
        Permission.FEES_INVOICES_CRUD,
        Permission.FEES_PAYMENTS_CRUD,
        Permission.FEES_REFUNDS_CRUD,
        Permission.FEES_READ_ALL,
        Permission.FEES_READ_OWN,
        Permission.ANNOUNCEMENTS_READ,
    ],
    "STAFF_GENERAL": [
        Permission.USERS_READ_OWN,
        Permission.USERS_UPDATE_OWN,
        Permission.STUDENTS_READ_DIRECTORY,
        Permission.ATTENDANCE_MARK_SELF,
        Permission.ATTENDANCE_READ_OWN,
        Permission.ANNOUNCEMENTS_READ,
    ],
}

def get_initial_permissions_for_membership(role: str, staff_type: str = None) -> list[str]:
    """
    Returns the initial permission set based on role and optional staff_type.
    staff_type only seeds the initial permission set; checks always evaluate has_perm.
    """
    if role == "ADMIN":
        return ROLE_PERMISSION_SEED_MAP["ADMIN"]
    elif role == "TEACHER":
        return ROLE_PERMISSION_SEED_MAP["TEACHER"]
    elif role == "STUDENT":
        return ROLE_PERMISSION_SEED_MAP["STUDENT"]
    elif role == "STAFF":
        if staff_type == "FINANCE":
            return ROLE_PERMISSION_SEED_MAP["STAFF_FINANCE"]
        return ROLE_PERMISSION_SEED_MAP["STAFF_GENERAL"]
    return []
