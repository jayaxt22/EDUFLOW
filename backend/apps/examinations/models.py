"""
Models for Examinations module.
Reside exclusively in the tenant database per doc/dbplanning.md.
"""

from django.db import models
from apps.core.models import BaseModel
from apps.identity.models import Membership
from apps.academics.models import AcademicYear, AcademicUnit, Subject

class GradingScale(BaseModel):
    """
    Institution grading policy / bracket scale (e.g. CBSE 10-point, Letter grading).
    rules contains list of grade tiers:
    [{"grade": "A+", "min_percentage": 90, "max_percentage": 100, "grade_point": 10.0}, ...]
    """
    name = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    rules = models.JSONField(default=list)

    class Meta:
        db_table = 'grading_scales'
        verbose_name = 'Grading Scale'
        verbose_name_plural = 'Grading Scales'

    def __str__(self):
        return f"{self.name} {'(Default)' if self.is_default else ''}"


class Exam(BaseModel):
    """
    Represents an institutional examination term (e.g. 'Term 1 Mid-Term 2026').
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SCHEDULED', 'Scheduled'),
        ('COMPLETED', 'Completed'),
        ('PUBLISHED', 'Published'),
    ]

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name='exams'
    )
    name = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'exams'
        verbose_name = 'Exam'
        verbose_name_plural = 'Exams'

    def __str__(self):
        return f"{self.name} ({self.status})"


class ExamSubject(BaseModel):
    """
    Subject test paper under an exam for an academic unit.
    """
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name='exam_subjects'
    )
    academic_unit = models.ForeignKey(
        AcademicUnit,
        on_delete=models.CASCADE,
        related_name='exam_subjects'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='exam_subjects'
    )
    max_marks = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    passing_marks = models.DecimalField(max_digits=5, decimal_places=2, default=40.00)
    exam_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'exam_subjects'
        verbose_name = 'Exam Subject'
        verbose_name_plural = 'Exam Subjects'
        constraints = [
            models.UniqueConstraint(
                fields=['exam', 'academic_unit', 'subject'],
                name='unique_exam_unit_subject'
            )
        ]

    def __str__(self):
        return f"{self.exam.name} - {self.subject.name} ({self.academic_unit.name})"


class MarkEntry(BaseModel):
    """
    Individual student mark sheet record.
    DoD:
    - Snapshots evaluated grade against active policy
    - Once exam is published, is_locked=True makes results immutable.
    """
    exam_subject = models.ForeignKey(
        ExamSubject,
        on_delete=models.CASCADE,
        related_name='marks'
    )
    student_membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='exam_marks'
    )
    marks_obtained = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_absent = models.BooleanField(default=False)
    grade_snapshot = models.CharField(max_length=10, blank=True, default='')
    remarks = models.TextField(blank=True, default='')
    is_locked = models.BooleanField(default=False)

    class Meta:
        db_table = 'mark_entries'
        verbose_name = 'Mark Entry'
        verbose_name_plural = 'Mark Entries'
        constraints = [
            models.UniqueConstraint(
                fields=['exam_subject', 'student_membership'],
                name='unique_mark_exam_subject_student'
            )
        ]

    def __str__(self):
        return f"{self.student_membership.user.full_name} - {self.exam_subject.subject.name}: {self.marks_obtained}"
