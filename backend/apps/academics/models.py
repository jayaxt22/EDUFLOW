"""
Academics models for EduFlow ERP.
Reside exclusively in the tenant database.
"""

from django.db import models
from apps.core.models import BaseModel
from apps.identity.models import Membership

class AcademicYear(BaseModel):
    """
    Academic operational cycle for the institution.
    """
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = 'academic_years'
        verbose_name = 'Academic Year'
        verbose_name_plural = 'Academic Years'
        constraints = [
            models.UniqueConstraint(
                fields=['is_current'],
                condition=models.Q(is_current=True),
                name='unique_current_academic_year'
            )
        ]

    def __str__(self):
        return f"{self.name} {'(Current)' if self.is_current else ''}"


class AcademicUnit(BaseModel):
    """
    Represents classes, grades, sections, or streams. Self-referential for hierarchy.
    """
    UNIT_TYPE_CHOICES = [
        ('CLASS', 'Class / Grade'),
        ('SECTION', 'Section'),
    ]

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name='academic_units'
    )
    name = models.CharField(max_length=100)
    unit_type = models.CharField(max_length=50, choices=UNIT_TYPE_CHOICES)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    class Meta:
        db_table = 'academic_units'
        verbose_name = 'Academic Unit'
        verbose_name_plural = 'Academic Units'
        constraints = [
            models.UniqueConstraint(
                fields=['academic_year', 'name'],
                condition=models.Q(unit_type='CLASS', parent__isnull=True),
                name='unique_class_name_per_year'
            ),
            models.UniqueConstraint(
                fields=['parent', 'name'],
                condition=models.Q(unit_type='SECTION', parent__isnull=False),
                name='unique_section_name_per_parent'
            )
        ]

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} - {self.name}"
        return self.name


class Subject(BaseModel):
    """
    Curriculum course or subject offered by the school.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, db_index=True)

    class Meta:
        db_table = 'subjects'
        verbose_name = 'Subject'
        verbose_name_plural = 'Subjects'

    def __str__(self):
        return f"{self.name} ({self.code})"


class StudentEnrollment(BaseModel):
    """
    Enrollment of a student membership in a specific academic unit (section).
    """
    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    academic_unit = models.ForeignKey(
        AcademicUnit,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    roll_number = models.CharField(max_length=50)
    enrolled_from = models.DateField()
    enrolled_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'student_enrollments'
        verbose_name = 'Student Enrollment'
        verbose_name_plural = 'Student Enrollments'
        constraints = [
            models.UniqueConstraint(
                fields=['academic_unit', 'roll_number', 'enrolled_from'],
                name='unique_unit_roll_enrolled_from'
            )
        ]

    def __str__(self):
        return f"Roll {self.roll_number}: {self.membership.user.full_name} in {self.academic_unit}"


class TeachingAssignment(BaseModel):
    """
    Assignment of a teacher to subjects and academic units.
    is_class_teacher grants conditional permission teacher.my_class.view.
    """
    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='teaching_assignments'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='assignments'
    )
    academic_unit = models.ForeignKey(
        AcademicUnit,
        on_delete=models.CASCADE,
        related_name='teaching_assignments'
    )
    is_class_teacher = models.BooleanField(default=False)

    class Meta:
        db_table = 'teaching_assignments'
        verbose_name = 'Teaching Assignment'
        verbose_name_plural = 'Teaching Assignments'
        constraints = [
            models.UniqueConstraint(
                fields=['academic_unit'],
                condition=models.Q(is_class_teacher=True),
                name='unique_class_teacher_per_unit'
            )
        ]

    def __str__(self):
        role = "Class Teacher" if self.is_class_teacher else (self.subject.name if self.subject else "Teacher")
        return f"{self.membership.user.full_name} -> {self.academic_unit} ({role})"
