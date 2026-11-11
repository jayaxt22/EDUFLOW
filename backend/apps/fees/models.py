"""
Fees and Financial accounting models for EduFlow ERP.
Reside exclusively in the tenant database per doc/dbplanning.md.
Non-negotiable rule: Money is strictly NUMERIC(14,2) in DB, Python Decimal in code, no floats.
"""

from decimal import Decimal
from django.db import models
from apps.core.models import BaseModel
from apps.identity.models import Membership
from apps.academics.models import AcademicYear, AcademicUnit

class FeeStructure(BaseModel):
    """
    Standard fee templates and structures per grade/term.
    """
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.CASCADE,
        related_name='fee_structures'
    )
    academic_unit = models.ForeignKey(
        AcademicUnit,
        on_delete=models.SET_NULL,
        related_name='fee_structures',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    due_date = models.DateField()

    class Meta:
        db_table = 'fee_structures'
        verbose_name = 'Fee Structure'
        verbose_name_plural = 'Fee Structures'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=Decimal('0.00')),
                name='check_fee_structure_amount_non_negative'
            )
        ]

    def __str__(self):
        return f"{self.name} - ${self.amount}"


class Invoice(BaseModel):
    """
    Student fee bill/invoice.
    """
    STATUS_CHOICES = [
        ('UNPAID', 'Unpaid'),
        ('PARTIAL', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    student_membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.SET_NULL,
        related_name='invoices',
        null=True,
        blank=True
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UNPAID')

    class Meta:
        db_table = 'invoices'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=Decimal('0.00')) & models.Q(paid_amount__gte=Decimal('0.00')),
                name='check_invoice_amounts_non_negative'
            )
        ]

    @property
    def balance_due(self) -> Decimal:
        return max(Decimal('0.00'), self.total_amount - self.paid_amount)

    def __str__(self):
        return f"Invoice {self.invoice_number} ({self.student_membership.user.full_name}): ${self.paid_amount}/${self.total_amount}"


class Payment(BaseModel):
    """
    Payment receipt entry against an invoice.
    Strictly enforced idempotency via idempotency_key to block duplicate charges.
    """
    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CARD', 'Card'),
        ('ONLINE', 'Online Payment'),
    ]

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    idempotency_key = models.UUIDField(unique=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHOD_CHOICES, default='CASH')
    transaction_reference = models.CharField(max_length=100, blank=True, default='')
    payment_date = models.DateField()
    recorded_by = models.ForeignKey(
        Membership,
        on_delete=models.SET_NULL,
        related_name='recorded_payments',
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'payments'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal('0.00')),
                name='check_payment_amount_positive'
            )
        ]

    def __str__(self):
        return f"Payment {self.id} for Invoice {self.invoice.invoice_number}: ${self.amount}"


class Refund(BaseModel):
    """
    Refund processing log.
    """
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='refunds'
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField()
    refund_date = models.DateField()
    processed_by = models.ForeignKey(
        Membership,
        on_delete=models.SET_NULL,
        related_name='processed_refunds',
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'refunds'
        verbose_name = 'Refund'
        verbose_name_plural = 'Refunds'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal('0.00')),
                name='check_refund_amount_positive'
            )
        ]

    def __str__(self):
        return f"Refund {self.id} for Payment {self.payment.id}: ${self.amount}"
