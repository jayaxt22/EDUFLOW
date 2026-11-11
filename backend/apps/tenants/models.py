"""
Control database models for EduFlow ERP.
These models reside exclusively in the 'control' (eduflow_control) database.
"""

from django.db import models
from apps.core.models import BaseModel

class PlatformUser(BaseModel):
    """
    Super-administrators and platform operators for the SaaS control plane.
    """
    email = models.EmailField(unique=True, db_index=True)
    password_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'platform_users'
        verbose_name = 'Platform User'
        verbose_name_plural = 'Platform Users'

    def __str__(self):
        return self.email


class Institution(BaseModel):
    """
    Represents an onboarded educational institution (tenant).
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('ARCHIVED', 'Archived'),
    ]

    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='ACTIVE')
    external_tenant_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'institutions'
        verbose_name = 'Institution'
        verbose_name_plural = 'Institutions'

    def __str__(self):
        return f"{self.name} ({self.slug})"


class TenantRegistry(BaseModel):
    """
    Maps an institution to its dedicated physical database and provider configuration.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('MAINTENANCE', 'Maintenance'),
        ('DECOMMISSIONED', 'Decommissioned'),
    ]

    institution = models.OneToOneField(
        Institution,
        on_delete=models.CASCADE,
        related_name='tenant_registry'
    )
    db_url = models.CharField(max_length=1000)
    provider = models.CharField(max_length=100, default='postgresql')
    provider_project_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='ACTIVE')

    class Meta:
        db_table = 'tenant_registry'
        verbose_name = 'Tenant Registry'
        verbose_name_plural = 'Tenant Registries'

    def __str__(self):
        return f"Registry for {self.institution.slug} [{self.provider}]"
