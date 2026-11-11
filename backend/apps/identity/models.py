"""
Tenant Identity models for EduFlow ERP.
Reside exclusively in the tenant database.
Roles live on Membership, not on User.
"""

from django.db import models
from apps.core.models import BaseModel

class User(BaseModel):
    """
    Tenant user record representing a person affiliated with the institution.
    """
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]

    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, db_index=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    dob = models.DateField(blank=True, null=True)
    nationality = models.CharField(max_length=100, blank=True, null=True)
    date_of_joining = models.DateField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True, null=True)
    marital_status = models.CharField(max_length=50, blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=255, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=50, blank=True, null=True)
    emergency_contact_relation = models.CharField(max_length=100, blank=True, null=True)
    current_address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    @property
    def avatar_url(self):
        if self.avatar:
            try:
                return self.avatar.url
            except Exception:
                return str(self.avatar)
        return None

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.full_name} ({self.username})"


class Membership(BaseModel):
    """
    Tenant membership defining the role and status of the user within this institution.
    Non-negotiable rule: Roles live on membership, not user.
    Exactly 4 roles: ADMIN, TEACHER, STUDENT, STAFF.
    """
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('TEACHER', 'Teacher'),
        ('STUDENT', 'Student'),
        ('STAFF', 'Staff'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('EXPELLED', 'Expelled'),
        ('RESIGNED', 'Resigned'),
        ('GRADUATED', 'Graduated'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='membership'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    class Meta:
        db_table = 'memberships'
        verbose_name = 'Membership'
        verbose_name_plural = 'Memberships'

    def __str__(self):
        return f"{self.user.username} - {self.role} [{self.status}]"


class StudentProfile(BaseModel):
    """
    Profile extension for memberships with role=STUDENT.
    """
    membership = models.OneToOneField(
        Membership,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    admission_number = models.CharField(max_length=100, unique=True, db_index=True)
    dob = models.DateField(blank=True, null=True)
    guardian_name = models.CharField(max_length=255, blank=True, null=True)
    guardian_phone = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = 'student_profiles'
        verbose_name = 'Student Profile'
        verbose_name_plural = 'Student Profiles'

    def __str__(self):
        return f"Student: {self.admission_number} ({self.membership.user.full_name})"


class TeacherProfile(BaseModel):
    """
    Profile extension for memberships with role=TEACHER.
    """
    membership = models.OneToOneField(
        Membership,
        on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    employee_id = models.CharField(max_length=100, unique=True, db_index=True)
    qualification = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'teacher_profiles'
        verbose_name = 'Teacher Profile'
        verbose_name_plural = 'Teacher Profiles'

    def __str__(self):
        return f"Teacher: {self.employee_id} ({self.membership.user.full_name})"


class StaffProfile(BaseModel):
    """
    Profile extension for memberships with role=STAFF.
    staff_type ∈ {FINANCE, RECEPTION, LIBRARY, OTHER}
    """
    STAFF_TYPE_CHOICES = [
        ('FINANCE', 'Finance'),
        ('RECEPTION', 'Reception'),
        ('LIBRARY', 'Library'),
        ('OTHER', 'Other'),
    ]

    membership = models.OneToOneField(
        Membership,
        on_delete=models.CASCADE,
        related_name='staff_profile'
    )
    employee_id = models.CharField(max_length=100, unique=True, db_index=True)
    staff_type = models.CharField(max_length=50, choices=STAFF_TYPE_CHOICES, default='OTHER')
    department = models.CharField(max_length=100, blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'staff_profiles'
        verbose_name = 'Staff Profile'
        verbose_name_plural = 'Staff Profiles'

    def __str__(self):
        return f"Staff ({self.staff_type}): {self.employee_id} ({self.membership.user.full_name})"
