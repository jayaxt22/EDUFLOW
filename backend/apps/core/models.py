"""
Core abstract models for EduFlow ERP.
Enforces UUIDv7 primary keys and UTC timestamps across all domain models.
"""

from django.db import models
import uuid6

class UUIDv7Model(models.Model):
    """
    Abstract base model providing a UUIDv7 primary key.
    UUIDv7 offers time-ordered locality, providing optimal B-tree indexing in PostgreSQL.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid6.uuid7,
        editable=False
    )

    class Meta:
        abstract = True

class TimeStampedModel(models.Model):
    """
    Abstract base model providing UTC creation and update timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class BaseModel(UUIDv7Model, TimeStampedModel):
    """
    Base model combining UUIDv7 primary key and audit timestamps.
    """
    class Meta:
        abstract = True
