"""
Announcements and School Communications model per doc/dbplanning.md.
Resides exclusively in tenant databases.
"""

from django.db import models
from apps.core.models import BaseModel
from apps.identity.models import Membership
from apps.academics.models import AcademicUnit

class Announcement(BaseModel):
    """
    School-wide or targeted bulletin announcement.
    Schema per doc/dbplanning.md Section 3.4.
    """
    TARGET_ROLE_CHOICES = [
        ('ALL', 'All Roles'),
        ('TEACHER', 'Teachers Only'),
        ('STUDENT', 'Students Only'),
        ('STAFF', 'Staff Only'),
    ]

    title = models.CharField(max_length=200)
    content = models.TextField()
    created_by = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='announcements'
    )
    target_role = models.CharField(
        max_length=20,
        choices=TARGET_ROLE_CHOICES,
        default='ALL'
    )
    target_academic_unit = models.ForeignKey(
        AcademicUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='unit_announcements'
    )
    forwarded_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='forwards'
    )
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'announcements'
        verbose_name = 'Announcement'
        verbose_name_plural = 'Announcements'
        ordering = ['-published_at']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(title=''),
                name='check_announcement_title_not_empty'
            )
        ]

    def __str__(self):
        target = self.target_academic_unit.name if self.target_academic_unit else self.target_role
        return f"{self.title} [{target}]"
