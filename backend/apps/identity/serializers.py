"""
Serializers for Identity and Auth module.
Enforces field-level restrictions per doc/rbac.md and handles unified user creation.
"""

import os
from PIL import Image
from rest_framework import serializers
from apps.identity.models import User, Membership, StudentProfile, TeacherProfile, StaffProfile
from apps.identity.services import get_user_permissions

class AvatarImageField(serializers.ImageField):
    """
    Custom ImageField for avatar uploads:
    - Enforces 2MB maximum file size limit
    - Restricts uploads to .jpg, .jpeg, and .png only
    - Verifies image integrity using Pillow
    """
    default_error_messages = {
        'invalid_image': 'Only .jpg, .jpeg, and .png image files are allowed.',
    }

    def to_internal_value(self, data):
        # 1. Size check (2MB limit)
        max_size = 2 * 1024 * 1024
        file_size = getattr(data, 'size', None)
        if file_size is not None and file_size > max_size:
            raise serializers.ValidationError("Avatar file size cannot exceed 2MB.")

        # 2. Extension check
        name = getattr(data, 'name', '')
        ext = os.path.splitext(name)[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png'):
            raise serializers.ValidationError("Only .jpg, .jpeg, and .png image files are allowed.")

        # 3. Content type check if available
        content_type = getattr(data, 'content_type', '')
        if content_type and content_type not in ('image/jpeg', 'image/png', 'image/jpg'):
            raise serializers.ValidationError("Only .jpg, .jpeg, and .png image files are allowed.")

        # 4. Standard ImageField processing (Pillow verification)
        try:
            file = super().to_internal_value(data)
        except serializers.ValidationError:
            raise serializers.ValidationError("Only .jpg, .jpeg, and .png image files are allowed.")

        return file

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class StudentProfileSerializer(serializers.ModelSerializer):
    academic_unit_id = serializers.SerializerMethodField()
    academic_unit_name = serializers.SerializerMethodField()
    parent_unit_id = serializers.SerializerMethodField()
    parent_unit_name = serializers.SerializerMethodField()
    roll_number = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'admission_number', 'dob', 'guardian_name', 'guardian_phone',
            'academic_unit_id', 'academic_unit_name', 'parent_unit_id', 'parent_unit_name', 'roll_number'
        ]

    def _get_active_enrollment(self, obj):
        if not hasattr(obj, '_cached_active_enrollment'):
            membership = getattr(obj, 'membership', None)
            if not membership:
                obj._cached_active_enrollment = None
            else:
                db = getattr(obj._state, 'db', None) or 'tenant_demo'
                obj._cached_active_enrollment = (
                    membership.enrollments.using(db)
                    .filter(enrolled_to__isnull=True)
                    .select_related('academic_unit__parent')
                    .order_by('-enrolled_from')
                    .first()
                )
                if not obj._cached_active_enrollment:
                    obj._cached_active_enrollment = (
                        membership.enrollments.using(db)
                        .select_related('academic_unit__parent')
                        .order_by('-enrolled_from')
                        .first()
                    )
        return obj._cached_active_enrollment

    def get_academic_unit_id(self, obj):
        enr = self._get_active_enrollment(obj)
        return str(enr.academic_unit.id) if enr and enr.academic_unit else None

    def get_academic_unit_name(self, obj):
        enr = self._get_active_enrollment(obj)
        return enr.academic_unit.name if enr and enr.academic_unit else None

    def get_parent_unit_id(self, obj):
        enr = self._get_active_enrollment(obj)
        if enr and enr.academic_unit and enr.academic_unit.parent:
            return str(enr.academic_unit.parent.id)
        return None

    def get_parent_unit_name(self, obj):
        enr = self._get_active_enrollment(obj)
        if enr and enr.academic_unit and enr.academic_unit.parent:
            return enr.academic_unit.parent.name
        return None

    def get_roll_number(self, obj):
        enr = self._get_active_enrollment(obj)
        return enr.roll_number if enr else None


class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        fields = ['id', 'employee_id', 'qualification']


class StaffProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffProfile
        fields = ['id', 'employee_id', 'staff_type', 'department', 'designation']


class UnifiedUserCreateSerializer(serializers.Serializer):
    """
    Unified serializer for user creation across all 4 roles.
    Non-negotiable rule: One unified UserForm for all roles. No per-role creation forms.
    """
    email = serializers.EmailField(required=True)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True, required=True)
    full_name = serializers.CharField(max_length=255, required=True)
    avatar = AvatarImageField(required=False, allow_null=True)
    dob = serializers.DateField(required=False, allow_null=True)
    nationality = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    date_of_joining = serializers.DateField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    gender = serializers.ChoiceField(choices=['MALE', 'FEMALE', 'OTHER'], required=False, allow_null=True)
    current_address = serializers.CharField(required=False, allow_blank=True, default='')
    emergency_contact_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    emergency_contact_phone = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    emergency_contact_relation = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')

    role = serializers.ChoiceField(choices=['ADMIN', 'TEACHER', 'STUDENT', 'STAFF'], required=True)

    # Student specific
    admission_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    guardian_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    guardian_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    academic_unit_id = serializers.UUIDField(required=False, allow_null=True)
    roll_number = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)

    # Teacher / Staff specific
    employee_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    qualification = serializers.CharField(max_length=255, required=False, allow_blank=True)

    # Staff specific
    staff_type = serializers.ChoiceField(
        choices=['FINANCE', 'RECEPTION', 'LIBRARY', 'OTHER'],
        required=False,
        default='OTHER'
    )
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate(self, attrs):
        role = attrs.get('role')
        if not attrs.get('username') and role != 'ADMIN':
            raise serializers.ValidationError({"username": "Username is required."})

        if role == 'STUDENT':
            if attrs.get('academic_unit_id') and not attrs.get('roll_number'):
                raise serializers.ValidationError({"roll_number": "Roll number is required when assigning a class."})
            if attrs.get('roll_number') and not attrs.get('academic_unit_id'):
                raise serializers.ValidationError({"academic_unit_id": "Class/Section selection is required when specifying a roll number."})
        return attrs


class AdminUserDetailSerializer(serializers.ModelSerializer):
    """
    Detailed user serializer for Admins (guarded by users.read_all).
    """
    role = serializers.CharField(source='membership.role', read_only=True)
    status = serializers.CharField(source='membership.status', read_only=True)
    membership_id = serializers.CharField(source='membership.id', read_only=True, default=None)
    profile = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'membership_id', 'email', 'username', 'full_name', 'avatar', 'avatar_url', 'dob',
            'nationality', 'date_of_joining', 'phone', 'gender',
            'current_address', 'emergency_contact_name', 'emergency_contact_phone',
            'emergency_contact_relation', 'is_active', 'role', 'status', 'profile',
            'created_at', 'updated_at'
        ]

    def get_avatar_url(self, obj):
        return obj.avatar_url

    def get_profile(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership:
            return None
        if membership.role == 'STUDENT' and hasattr(membership, 'student_profile'):
            return StudentProfileSerializer(membership.student_profile).data
        elif membership.role == 'TEACHER' and hasattr(membership, 'teacher_profile'):
            return TeacherProfileSerializer(membership.teacher_profile).data
        elif membership.role == 'STAFF' and hasattr(membership, 'staff_profile'):
            return StaffProfileSerializer(membership.staff_profile).data
        elif membership.role == 'ADMIN':
            return {
                'admin_id': obj.username,
                'employee_id': obj.username,
            }
        return None


class DirectoryStudentSerializer(serializers.Serializer):
    """
    Field-restricted serializer for students.read_directory per doc/rbac.md.
    Contains ONLY: full_name, photo_url, admission_number, class_name, section_name, roll_number.
    Excluded: guardian_name, guardian_phone, date_of_birth, address, fee_balance.
    """
    full_name = serializers.CharField(source='membership.user.full_name')
    photo_url = serializers.SerializerMethodField()
    admission_number = serializers.CharField()
    class_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    roll_number = serializers.SerializerMethodField()

    def get_photo_url(self, obj):
        user = getattr(obj.membership, 'user', None)
        return user.avatar_url if user and user.avatar_url else None

    def get_class_name(self, obj):
        enrollment = obj.membership.enrollments.select_related('academic_unit__parent').first()
        if enrollment and enrollment.academic_unit.parent:
            return enrollment.academic_unit.parent.name
        return enrollment.academic_unit.name if enrollment else None

    def get_section_name(self, obj):
        enrollment = obj.membership.enrollments.select_related('academic_unit').first()
        if enrollment:
            return enrollment.academic_unit.name
        return None

    def get_roll_number(self, obj):
        enrollment = obj.membership.enrollments.first()
        return enrollment.roll_number if enrollment else None


class AuthMeSerializer(serializers.ModelSerializer):
    """
    Serializer for GET /api/v1/auth/me/.
    Returns personal profile and dynamic permissions.
    """
    role = serializers.CharField(source='membership.role', read_only=True)
    status = serializers.CharField(source='membership.status', read_only=True)
    membership_id = serializers.CharField(source='membership.id', read_only=True, default=None)
    permissions = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'membership_id', 'email', 'username', 'full_name', 'avatar', 'avatar_url', 'dob',
            'nationality', 'date_of_joining', 'phone', 'gender',
            'role', 'status', 'profile', 'permissions'
        ]

    def get_avatar_url(self, obj):
        return obj.avatar_url

    def get_permissions(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership:
            return []
        return get_user_permissions(membership)

    def get_profile(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership:
            return None
        if membership.role == 'STUDENT' and hasattr(membership, 'student_profile'):
            return StudentProfileSerializer(membership.student_profile).data
        elif membership.role == 'TEACHER' and hasattr(membership, 'teacher_profile'):
            return TeacherProfileSerializer(membership.teacher_profile).data
        elif membership.role == 'STAFF' and hasattr(membership, 'staff_profile'):
            return StaffProfileSerializer(membership.staff_profile).data
        elif membership.role == 'ADMIN':
            return {
                'admin_id': obj.username,
                'employee_id': obj.username,
            }
        return None


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Detailed profile serializer for GET /api/v1/users/me/.
    Returns student academic class, section, and roll number if role=STUDENT.
    """
    role = serializers.CharField(source='membership.role', read_only=True)
    status = serializers.CharField(source='membership.status', read_only=True)
    profile = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    roll_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'full_name', 'avatar', 'avatar_url', 'dob',
            'nationality', 'date_of_joining', 'phone', 'gender',
            'marital_status', 'current_address', 'emergency_contact_name',
            'emergency_contact_phone', 'emergency_contact_relation',
            'is_active', 'role', 'status', 'profile',
            'class_name', 'section_name', 'roll_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'email', 'username', 'is_active', 'created_at', 'updated_at']

    def get_avatar_url(self, obj):
        return obj.avatar_url

    def get_profile(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership:
            return None
        if membership.role == 'STUDENT' and hasattr(membership, 'student_profile'):
            return StudentProfileSerializer(membership.student_profile).data
        elif membership.role == 'TEACHER' and hasattr(membership, 'teacher_profile'):
            return TeacherProfileSerializer(membership.teacher_profile).data
        elif membership.role == 'STAFF' and hasattr(membership, 'staff_profile'):
            return StaffProfileSerializer(membership.staff_profile).data
        elif membership.role == 'ADMIN':
            return {
                'admin_id': obj.username,
                'employee_id': obj.username,
            }
        return None

    def get_class_name(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership or membership.role != 'STUDENT':
            return None
        enrollment = membership.enrollments.select_related('academic_unit__parent').first()
        if enrollment:
            if enrollment.academic_unit.parent:
                return enrollment.academic_unit.parent.name
            return enrollment.academic_unit.name
        return None

    def get_section_name(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership or membership.role != 'STUDENT':
            return None
        enrollment = membership.enrollments.select_related('academic_unit').first()
        if enrollment:
            return enrollment.academic_unit.name
        return None

    def get_roll_number(self, obj):
        membership = getattr(obj, 'membership', None)
        if not membership or membership.role != 'STUDENT':
            return None
        enrollment = membership.enrollments.first()
        return enrollment.roll_number if enrollment else None


class UpdateUserProfileSerializer(serializers.Serializer):
    """
    Serializer for PATCH /api/v1/users/me/.
    Enforces role-based profile restrictions:
    - Students can ONLY update phone, current_address, avatar, emergency contacts (cannot modify full_name, dob, nationality).
    - Teachers and Staff can update full_name, phone, current_address, avatar, dob, nationality, emergency contacts, gender.
    """
    full_name = serializers.CharField(max_length=255, required=False)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=['MALE', 'FEMALE', 'OTHER'], required=False, allow_null=True)
    marital_status = serializers.CharField(max_length=50, required=False, allow_blank=True)
    current_address = serializers.CharField(required=False, allow_blank=True)
    emergency_contact_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    emergency_contact_relation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    avatar = AvatarImageField(required=False, allow_null=True)
    dob = serializers.DateField(required=False, allow_null=True)
    nationality = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        membership = getattr(user, 'membership', None) if user else None
        role = getattr(membership, 'role', None)

        if role == 'STUDENT':
            if 'full_name' in attrs:
                raise serializers.ValidationError({
                    "full_name": "Students cannot modify their official name."
                })
            if 'dob' in attrs:
                raise serializers.ValidationError({
                    "dob": "Students cannot modify their official date of birth."
                })
            # Ensure student can only update phone, address, avatar, and emergency contact details
            disallowed = set(attrs.keys()) - {
                'phone', 'current_address', 'avatar',
                'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'
            }
            for field in disallowed:
                attrs.pop(field, None)

        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for POST /api/v1/users/me/change-password/.
    Requires valid current_password and new_password (min 8 chars).
    """
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, min_length=8, write_only=True)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value


class AdminUserUpdateSerializer(serializers.Serializer):
    """
    Serializer for admin editing of users (PATCH /api/v1/users/{id}/).
    Guarded by users.update_others.
    """
    full_name = serializers.CharField(max_length=255, required=False)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=['MALE', 'FEMALE', 'OTHER'], required=False, allow_null=True)
    current_address = serializers.CharField(required=False, allow_blank=True)
    emergency_contact_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    emergency_contact_relation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    avatar = AvatarImageField(required=False, allow_null=True)
    dob = serializers.DateField(required=False, allow_null=True)
    nationality = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    date_of_joining = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)

    # Profile fields (optional)
    admission_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    guardian_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    guardian_phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    academic_unit_id = serializers.UUIDField(required=False, allow_null=True)
    roll_number = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    employee_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    qualification = serializers.CharField(max_length=255, required=False, allow_blank=True)
    staff_type = serializers.ChoiceField(choices=['FINANCE', 'RECEPTION', 'LIBRARY', 'OTHER'], required=False)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True)


