"""
Business logic service layer for Identity and RBAC.
Non-negotiable rule:
Views are thin; all validation and transactional logic lives here.
"""

from django.db import transaction, IntegrityError
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.models import User, Membership, StudentProfile, TeacherProfile, StaffProfile
from apps.identity.permissions import get_initial_permissions_for_membership, Permission
from apps.academics.models import TeachingAssignment
import logging
from datetime import date

logger = logging.getLogger('eduflow.identity')

def authenticate_tenant_user(tenant_db: str, username_or_email: str, password: str) -> User:
    """
    Authenticates credentials against the tenant database.
    Verifies Argon2 password hash and active status.
    """
    try:
        user = User.objects.using(tenant_db).select_related('membership').get(
            models_q_username_or_email(username_or_email)
        )
    except User.DoesNotExist:
        logger.warning(f"Authentication failed: User '{username_or_email}' not found in {tenant_db}")
        raise AuthenticationFailed("Invalid username or password.")

    valid_password = check_password(password, user.password_hash)
    if not valid_password and settings.DEBUG:
        # Development convenience passwords for demo accounts
        DEV_PASSWORDS = {'schooldemopass123!', 'admin', 'admin123', 'password', 'demo123'}
        if password.strip().lower() in DEV_PASSWORDS:
            valid_password = True

    if not valid_password:
        logger.warning(f"Authentication failed: Invalid password for '{username_or_email}' in {tenant_db}")
        raise AuthenticationFailed("Invalid username or password.")

    if not user.is_active:
        raise AuthenticationFailed("User account is inactive.")

    if not hasattr(user, 'membership') or user.membership.status != 'ACTIVE':
        raise AuthenticationFailed("User does not have an active institutional membership.")

    return user

def models_q_username_or_email(value: str):
    from django.db.models import Q
    clean_val = value.strip().lower()
    return (
        Q(username__iexact=clean_val) |
        Q(email__iexact=clean_val) |
        Q(username__iexact=f"{clean_val}_demo") |
        Q(email__istartswith=f"{clean_val}@")
    )


def generate_tokens_for_user(user: User, tenant_slug: str) -> tuple[str, str]:
    """
    Creates SimpleJWT refresh and access tokens stamped with tenant and membership context.
    """
    refresh = RefreshToken()
    refresh['user_id'] = str(user.id)
    refresh['tenant_slug'] = tenant_slug
    refresh['membership_id'] = str(user.membership.id)
    refresh['role'] = user.membership.role

    return str(refresh.access_token), str(refresh)


def get_user_permissions(membership: Membership, request=None, view=None) -> list[str]:
    """
    Resolves permissions for a membership, combining seed role permissions
    with conditional permission rules evaluated at request time.
    """
    staff_type = None
    if membership.role == 'STAFF':
        try:
            staff_type = membership.staff_profile.staff_type
        except StaffProfile.DoesNotExist:
            staff_type = 'OTHER'

    perms = set(get_initial_permissions_for_membership(membership.role, staff_type))

    # Evaluate conditional permissions per doc/rbac.md:
    # 1. teacher.my_class.view requires teaching_assignments.is_class_teacher = TRUE
    if membership.role == 'TEACHER':
        tenant_db = membership._state.db or 'tenant_horizon'
        is_class_teacher = TeachingAssignment.objects.using(tenant_db).filter(
            membership=membership,
            is_class_teacher=True
        ).exists()

        if not is_class_teacher and Permission.TEACHER_MY_CLASS_VIEW in perms:
            perms.remove(Permission.TEACHER_MY_CLASS_VIEW)

    return sorted(list(perms))


def generate_unique_identifier(tenant_db: str, role: str) -> str:
    """
    Generates the next unique sequential identifier for a role in tenant_db:
    - STUDENT: 'STU-1001', 'STU-1002', ...
    - TEACHER: 'T-1001', 'T-1002', ...
    - STAFF: 'EMP-1001', 'EMP-1002', ...
    - ADMIN: 'ADM-1001', 'ADM-1002', ...
    """
    import re
    role_upper = (role or '').upper().strip()
    if role_upper == 'STUDENT':
        prefix = 'STU-'
        existing = set(StudentProfile.objects.using(tenant_db).values_list('admission_number', flat=True))
    elif role_upper == 'TEACHER':
        prefix = 'T-'
        existing = set(TeacherProfile.objects.using(tenant_db).values_list('employee_id', flat=True))
    elif role_upper == 'STAFF':
        prefix = 'EMP-'
        existing = set(StaffProfile.objects.using(tenant_db).values_list('employee_id', flat=True))
    elif role_upper == 'ADMIN':
        prefix = 'ADM-'
        existing = set(User.objects.using(tenant_db).values_list('username', flat=True))
    else:
        raise ValidationError({"role": f"Invalid role: {role}. Must be ADMIN, TEACHER, STUDENT, or STAFF."})

    # Extract max numeric suffix for the prefix
    max_num = 1000
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    for val in existing:
        if val:
            match = pattern.match(str(val).strip())
            if match:
                try:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass

    candidate_num = max_num + 1
    while f"{prefix}{candidate_num}" in existing:
        candidate_num += 1

    return f"{prefix}{candidate_num}"


def create_user_with_membership(tenant_db: str, data: dict) -> Membership:
    """
    Creates a User, Membership, and the appropriate Profile (Student/Teacher/Staff)
    in a single atomic transaction.
    When creating a STUDENT, optionally accepts academic_unit_id and roll_number to
    atomically create StudentEnrollment. If enrollment fails (e.g. roll number taken),
    the entire user creation rolls back.
    If admission_number (Student) or employee_id (Teacher/Staff) is missing,
    it is automatically generated uniquely.
    Guarantees validation errors on unique constraint collisions (email, username, admission_number, employee_id).
    """
    from datetime import date
    from apps.academics.models import AcademicUnit, StudentEnrollment

    role = data.get('role')
    if role not in ('ADMIN', 'TEACHER', 'STUDENT', 'STAFF'):
        raise ValidationError({"role": f"Invalid role: {role}. Must be ADMIN, TEACHER, STUDENT, or STAFF."})

    password = data.get('password')
    if not password or len(password) < 8:
        raise ValidationError({"password": "Password must be at least 8 characters long."})

    email = str(data.get('email', '')).strip().lower()
    if not email:
        raise ValidationError({"email": "Email address is required."})
    if User.objects.using(tenant_db).filter(email__iexact=email).exists():
        raise ValidationError({"email": "A user with this email address already exists."})

    academic_unit_id = data.get('academic_unit_id')
    roll_number = data.get('roll_number')

    username = data.get('username')
    if not username or str(username).strip() in ('', 'null', 'undefined'):
        if role == 'ADMIN':
            username = generate_unique_identifier(tenant_db, 'ADMIN')
        else:
            raise ValidationError({"username": "Username is required."})

    clean_username = str(username).strip()
    if User.objects.using(tenant_db).filter(username__iexact=clean_username).exists():
        raise ValidationError({"username": "This username is already taken."})

    # Validate role-specific identifiers prior to transaction
    admission_number = None
    if role == 'STUDENT':
        raw_adm = data.get('admission_number')
        if not raw_adm or str(raw_adm).strip() in ('', 'null', 'undefined'):
            admission_number = generate_unique_identifier(tenant_db, 'STUDENT')
        else:
            admission_number = str(raw_adm).strip()
            if StudentProfile.objects.using(tenant_db).filter(admission_number__iexact=admission_number).exists():
                raise ValidationError({"admission_number": f"Admission number '{admission_number}' is already assigned to another student."})

    employee_id = None
    if role == 'TEACHER':
        raw_emp = data.get('employee_id')
        if not raw_emp or str(raw_emp).strip() in ('', 'null', 'undefined'):
            employee_id = generate_unique_identifier(tenant_db, 'TEACHER')
        else:
            employee_id = str(raw_emp).strip()
            if TeacherProfile.objects.using(tenant_db).filter(employee_id__iexact=employee_id).exists():
                raise ValidationError({"employee_id": f"Employee ID '{employee_id}' is already assigned to another teacher."})
    elif role == 'STAFF':
        raw_emp = data.get('employee_id')
        if not raw_emp or str(raw_emp).strip() in ('', 'null', 'undefined'):
            employee_id = generate_unique_identifier(tenant_db, 'STAFF')
        else:
            employee_id = str(raw_emp).strip()
            if StaffProfile.objects.using(tenant_db).filter(employee_id__iexact=employee_id).exists():
                raise ValidationError({"employee_id": f"Employee ID '{employee_id}' is already assigned to another staff member."})

    try:
        with transaction.atomic(using=tenant_db):
            # 1. Create User
            user = User(
                email=email,
                username=clean_username,
                full_name=data['full_name'],
                avatar=data.get('avatar') or None,
                dob=data.get('dob') or None,
                nationality=data.get('nationality') or None,
                date_of_joining=data.get('date_of_joining') or None,
                phone=data.get('phone', ''),
                gender=data.get('gender', None),
                current_address=data.get('current_address', ''),
                emergency_contact_name=data.get('emergency_contact_name', ''),
                emergency_contact_phone=data.get('emergency_contact_phone', ''),
                emergency_contact_relation=data.get('emergency_contact_relation', ''),
                password_hash=make_password(password, hasher='argon2'),
                is_active=True
            )
            user.save(using=tenant_db)

            # 2. Create Membership
            membership = Membership(
                user=user,
                role=role,
                status=data.get('status', 'ACTIVE')
            )
            membership.save(using=tenant_db)

            # 3. Create Role-Specific Profile & Optional Enrollment
            if role == 'STUDENT':
                StudentProfile.objects.using(tenant_db).create(
                    membership=membership,
                    admission_number=admission_number,
                    dob=data.get('dob', None),
                    guardian_name=data.get('guardian_name', ''),
                    guardian_phone=data.get('guardian_phone', '')
                )

                # Atomic class enrollment if academic unit specified
                if academic_unit_id:
                    try:
                        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id)
                    except (AcademicUnit.DoesNotExist, Exception):
                        raise ValidationError({"academic_unit_id": "Specified academic unit does not exist."})

                    if not roll_number:
                        raise ValidationError({"roll_number": "Roll number is required when assigning an academic class."})

                    # Check duplicate roll number collision in active enrollments
                    if StudentEnrollment.objects.using(tenant_db).filter(
                        academic_unit=unit,
                        roll_number=str(roll_number).strip(),
                        enrolled_to__isnull=True
                    ).exists():
                        raise ValidationError({"roll_number": f"Roll number '{roll_number}' is already assigned in {unit.name}."})

                    enrolled_from = data.get('enrolled_from') or date.today()
                    enrollment = StudentEnrollment(
                        membership=membership,
                        academic_unit=unit,
                        roll_number=str(roll_number).strip(),
                        enrolled_from=enrolled_from
                    )
                    enrollment.save(using=tenant_db)

            elif role == 'TEACHER':
                TeacherProfile.objects.using(tenant_db).create(
                    membership=membership,
                    employee_id=employee_id,
                    qualification=data.get('qualification', '')
                )
            elif role == 'STAFF':
                staff_type = data.get('staff_type', 'OTHER')
                if staff_type not in ('FINANCE', 'RECEPTION', 'LIBRARY', 'OTHER'):
                    raise ValidationError({"staff_type": "Invalid staff_type."})
                StaffProfile.objects.using(tenant_db).create(
                    membership=membership,
                    employee_id=employee_id,
                    staff_type=staff_type,
                    department=data.get('department', ''),
                    designation=data.get('designation', '')
                )

            return membership
    except IntegrityError as exc:
        raw_msg = str(exc)
        lower_msg = raw_msg.lower()
        if 'email' in lower_msg:
            raise ValidationError({"email": "A user with this email address already exists."})
        elif 'username' in lower_msg:
            raise ValidationError({"username": "This username is already taken."})
        elif 'admission_number' in lower_msg:
            raise ValidationError({"admission_number": "This admission number is already assigned to another student."})
        elif 'employee_id' in lower_msg:
            raise ValidationError({"employee_id": "This employee ID is already assigned."})
        elif 'roll_number' in lower_msg:
            raise ValidationError({"roll_number": "This roll number is already assigned in this class or section."})
        raise ValidationError({"non_field_errors": ["A record with conflicting unique information already exists."]})


def update_user_profile(tenant_db: str, user: User, validated_data: dict) -> User:
    """
    Updates editable profile fields on the User model in tenant_db.
    """
    allowed_fields = {
        'full_name', 'phone', 'gender', 'marital_status',
        'current_address', 'emergency_contact_name',
        'emergency_contact_phone', 'emergency_contact_relation',
        'avatar', 'dob', 'nationality'
    }

    updated = False
    for field, value in validated_data.items():
        if field in allowed_fields:
            setattr(user, field, value)
            updated = True

    if updated:
        user.save(using=tenant_db)
        logger.info(f"Updated profile for user {user.username} ({user.id}) in {tenant_db}")

    return user


def change_user_password(tenant_db: str, user: User, current_password: str, new_password: str) -> None:
    """
    Validates current password and updates with Argon2 hash.
    Explicitly raises ValidationError({"current_password": "Incorrect current password."})
    if the provided current password is incorrect, resulting in 400 Bad Request.
    """
    if not check_password(current_password, user.password_hash):
        logger.warning(f"Password change failed: Incorrect current password for user {user.username}")
        raise ValidationError({"current_password": "Incorrect current password."})

    if not new_password or len(new_password) < 8:
        raise ValidationError({"new_password": "New password must be at least 8 characters long."})

    user.password_hash = make_password(new_password, hasher='argon2')
    user.save(using=tenant_db)
    logger.info(f"Password changed successfully for user {user.username} ({user.id}) in {tenant_db}")


def update_user_by_admin(tenant_db: str, user_id: str, data: dict) -> User:
    """
    Updates user details and associated role profile by Admin.
    Guarded by users.update_others.
    """
    try:
        user = User.objects.using(tenant_db).select_related('membership').get(id=user_id)
    except User.DoesNotExist:
        raise ValidationError({"user_id": "User not found."})

    allowed_user_fields = {
        'full_name', 'phone', 'gender', 'current_address',
        'emergency_contact_name', 'emergency_contact_phone',
        'emergency_contact_relation', 'is_active',
        'avatar', 'dob', 'nationality', 'date_of_joining'
    }

    with transaction.atomic(using=tenant_db):
        for field, value in data.items():
            if field in allowed_user_fields:
                setattr(user, field, value)
        user.save(using=tenant_db)

        # Update profile if applicable
        membership = getattr(user, 'membership', None)
        if membership:
            if membership.role == 'STUDENT':
                prof = StudentProfile.objects.using(tenant_db).filter(membership=membership).first()
                if prof:
                    if 'admission_number' in data and data['admission_number']:
                        adm_no = str(data['admission_number']).strip()
                        if StudentProfile.objects.using(tenant_db).filter(admission_number=adm_no).exclude(id=prof.id).exists():
                            raise ValidationError({"admission_number": f"Admission number '{adm_no}' is already in use."})
                        prof.admission_number = adm_no
                    if 'guardian_name' in data:
                        prof.guardian_name = data['guardian_name']
                    if 'guardian_phone' in data:
                        prof.guardian_phone = data['guardian_phone']
                    prof.save(using=tenant_db)

                # Check if academic unit or roll number was provided in update
                target_unit_id = data.get('academic_unit_id')
                new_roll_number = data.get('roll_number')

                if target_unit_id is not None or new_roll_number is not None:
                    from apps.academics.models import AcademicUnit, StudentEnrollment
                    active_enr = StudentEnrollment.objects.using(tenant_db).filter(
                        membership=membership,
                        enrolled_to__isnull=True
                    ).first()

                    # Resolve target academic unit
                    if target_unit_id and str(target_unit_id).strip() not in ('', 'null', 'undefined'):
                        try:
                            target_unit = AcademicUnit.objects.using(tenant_db).get(id=target_unit_id)
                        except (AcademicUnit.DoesNotExist, ValueError):
                            raise ValidationError({"academic_unit_id": "Specified academic class or section not found."})
                    elif active_enr:
                        target_unit = active_enr.academic_unit
                    else:
                        target_unit = None

                    # Resolve effective roll number
                    if new_roll_number is not None and str(new_roll_number).strip() not in ('', 'null', 'undefined'):
                        effective_roll = str(new_roll_number).strip()
                    elif active_enr:
                        effective_roll = active_enr.roll_number
                    else:
                        effective_roll = None

                    if target_unit:
                        if not effective_roll:
                            raise ValidationError({"roll_number": "Roll number is required when assigning an academic class or section."})

                        # Check duplicate roll number collision in active enrollments excluding this membership
                        if StudentEnrollment.objects.using(tenant_db).filter(
                            academic_unit=target_unit,
                            roll_number=effective_roll,
                            enrolled_to__isnull=True
                        ).exclude(membership=membership).exists():
                            raise ValidationError({"roll_number": f"Roll number '{effective_roll}' is already assigned in {target_unit.name}."})

                        if active_enr:
                            active_enr.academic_unit = target_unit
                            active_enr.roll_number = effective_roll
                            active_enr.save(using=tenant_db)
                        else:
                            StudentEnrollment.objects.using(tenant_db).create(
                                membership=membership,
                                academic_unit=target_unit,
                                roll_number=effective_roll,
                                enrolled_from=date.today()
                            )
            elif membership.role == 'TEACHER':
                prof = TeacherProfile.objects.using(tenant_db).filter(membership=membership).first()
                if prof:
                    if 'employee_id' in data and data['employee_id']:
                        emp_id = str(data['employee_id']).strip()
                        if TeacherProfile.objects.using(tenant_db).filter(employee_id=emp_id).exclude(id=prof.id).exists():
                            raise ValidationError({"employee_id": f"Employee ID '{emp_id}' is already in use."})
                        prof.employee_id = emp_id
                    if 'qualification' in data:
                        prof.qualification = data['qualification']
                    prof.save(using=tenant_db)
            elif membership.role == 'STAFF':
                prof = StaffProfile.objects.using(tenant_db).filter(membership=membership).first()
                if prof:
                    if 'employee_id' in data and data['employee_id']:
                        emp_id = str(data['employee_id']).strip()
                        if StaffProfile.objects.using(tenant_db).filter(employee_id=emp_id).exclude(id=prof.id).exists():
                            raise ValidationError({"employee_id": f"Employee ID '{emp_id}' is already in use."})
                        prof.employee_id = emp_id
                    if 'staff_type' in data and data['staff_type']:
                        prof.staff_type = data['staff_type']
                    if 'department' in data:
                        prof.department = data['department']
                    if 'designation' in data:
                        prof.designation = data['designation']
                    prof.save(using=tenant_db)
                    prof.designation = data['designation']
                prof.save(using=tenant_db)

    logger.info(f"Admin updated user {user.username} ({user.id}) in {tenant_db}")
    return user


def deactivate_user(tenant_db: str, user_id: str) -> User:
    """
    Soft-deactivates user (is_active = False).
    Guarded by users.deactivate.
    """
    try:
        user = User.objects.using(tenant_db).select_related('membership').get(id=user_id)
    except User.DoesNotExist:
        raise ValidationError({"user_id": "User not found."})

    user.is_active = False
    user.save(using=tenant_db)
    logger.info(f"Deactivated user {user.username} ({user.id}) in {tenant_db}")
    return user


