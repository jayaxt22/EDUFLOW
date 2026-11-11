"""
Attendance models for EduFlow ERP.
Reside exclusively in the tenant database per doc/dbplanning.md.
"""

from django.db import models
from apps.core.models import BaseModel
from apps.identity.models import Membership
from apps.academics.models import AcademicUnit

class AttendanceRecord(BaseModel):
    """
    Represents an attendance log for a member (student in classroom or staff/teacher self check-in).
    Strict DB constraints:
    - UNIQUE(subject_user_id, date, context)
    - CHECK(context = 'CLASSROOM' -> academic_unit_id IS NOT NULL)
    """
    CONTEXT_CHOICES = [
        ('CLASSROOM', 'Classroom'),
        ('SELF', 'Self Check-in'),
    ]

    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('EXCUSED', 'Excused'),
    ]

    subject_user = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    context = models.CharField(
        max_length=20,
        choices=CONTEXT_CHOICES,
        default='CLASSROOM'
    )
    academic_unit = models.ForeignKey(
        AcademicUnit,
        on_delete=models.CASCADE,
        related_name='attendance_records',
        null=True,
        blank=True
    )
    date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES
    )
    marked_by = models.ForeignKey(
        Membership,
        on_delete=models.SET_NULL,
        related_name='marked_attendances',
        null=True,
        blank=True
    )
    remarks = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'attendance_records'
        verbose_name = 'Attendance Record'
        verbose_name_plural = 'Attendance Records'
        constraints = [
            models.UniqueConstraint(
                fields=['subject_user', 'date', 'context'],
                name='unique_attendance_subject_date_context'
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(context='SELF') |
                    (models.Q(context='CLASSROOM') & models.Q(academic_unit__isnull=False))
                ),
                name='check_classroom_requires_academic_unit'
            )
        ]

    def __str__(self):
        return f"{self.subject_user} - {self.date} ({self.status})"
