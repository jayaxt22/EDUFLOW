"""
Services for Fees & Finance module.
Enforces Phase 6 DoD:
1. No floats: strict Decimal / NUMERIC(14,2).
2. Duplicate payments blocked via idempotency keys.
"""

import uuid
import logging
from decimal import Decimal
from datetime import date
from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from apps.fees.models import FeeStructure, Invoice, Payment, Refund
from apps.identity.models import Membership
from apps.academics.models import AcademicYear, AcademicUnit

logger = logging.getLogger(__name__)

def create_fee_structure(
    tenant_db: str,
    academic_year_id: str,
    name: str,
    amount: Decimal,
    due_date: date,
    academic_unit_id: str = None
) -> FeeStructure:
    """Creates a new fee schedule template."""
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))

    if amount < Decimal('0.00'):
        raise ValidationError({"amount": "Fee amount cannot be negative."})

    try:
        year = AcademicYear.objects.using(tenant_db).get(id=academic_year_id)
        unit = AcademicUnit.objects.using(tenant_db).get(id=academic_unit_id) if academic_unit_id else None
    except (AcademicYear.DoesNotExist, AcademicUnit.DoesNotExist) as e:
        raise ValidationError({"error": str(e)})

    return FeeStructure.objects.using(tenant_db).create(
        academic_year=year,
        academic_unit=unit,
        name=name,
        amount=amount,
        due_date=due_date
    )


def create_invoice(
    tenant_db: str,
    student_membership_id: str,
    fee_structure_id: str = None,
    issue_date: date = None,
    due_date: date = None,
    total_amount: Decimal = None,
    invoice_number: str = None
) -> Invoice:
    """Issues a fee bill to a student."""
    try:
        student = Membership.objects.using(tenant_db).get(id=student_membership_id, role='STUDENT')
    except Membership.DoesNotExist:
        raise ValidationError({"student_membership_id": "Student membership not found."})

    structure = None
    if fee_structure_id:
        try:
            structure = FeeStructure.objects.using(tenant_db).get(id=fee_structure_id)
            if total_amount is None:
                total_amount = structure.amount
            if due_date is None:
                due_date = structure.due_date
        except FeeStructure.DoesNotExist:
            raise ValidationError({"fee_structure_id": "Fee structure not found."})

    if total_amount is None:
        raise ValidationError({"total_amount": "Total amount is required."})

    if not isinstance(total_amount, Decimal):
        total_amount = Decimal(str(total_amount))

    if not invoice_number:
        count = Invoice.objects.using(tenant_db).count() + 1
        invoice_number = f"INV-{date.today().year}-{count:05d}"

    if not issue_date:
        issue_date = date.today()
    if not due_date:
        due_date = issue_date

    invoice = Invoice.objects.using(tenant_db).create(
        student_membership=student,
        fee_structure=structure,
        invoice_number=invoice_number,
        issue_date=issue_date,
        due_date=due_date,
        total_amount=total_amount,
        paid_amount=Decimal('0.00'),
        status='UNPAID'
    )
    return invoice


def record_payment(
    tenant_db: str,
    invoice_id: str,
    amount: Decimal,
    idempotency_key: str,
    payment_method: str = 'CASH',
    transaction_reference: str = '',
    payment_date: date = None,
    recorded_by: Membership = None
) -> Payment:
    """
    Records an invoice payment receipt.
    DoD:
    - No floats (pure Decimal)
    - Duplicate payment blocked via idempotency key
    """
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))

    if amount <= Decimal('0.00'):
        raise ValidationError({"amount": "Payment amount must be greater than zero."})

    # DoD: Duplicate payment blocked via idempotency key
    if Payment.objects.using(tenant_db).filter(idempotency_key=idempotency_key).exists():
        raise ValidationError({
            "idempotency_key": "Duplicate payment blocked: A transaction with this idempotency key has already been processed."
        })

    try:
        invoice = Invoice.objects.using(tenant_db).select_for_update().get(id=invoice_id)
    except Invoice.DoesNotExist:
        raise ValidationError({"invoice_id": "Invoice not found."})

    if amount > invoice.balance_due:
        raise ValidationError({
            "amount": f"Payment amount (${amount}) exceeds current invoice balance due (${invoice.balance_due})."
        })

    if not payment_date:
        payment_date = date.today()

    with transaction.atomic(using=tenant_db):
        payment = Payment.objects.using(tenant_db).create(
            invoice=invoice,
            idempotency_key=idempotency_key,
            amount=amount,
            payment_method=payment_method,
            transaction_reference=transaction_reference,
            payment_date=payment_date,
            recorded_by=recorded_by
        )

        invoice.paid_amount += amount
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = 'PAID'
        else:
            invoice.status = 'PARTIAL'
        invoice.save(using=tenant_db)

    logger.info(f"Recorded payment ${amount} for invoice {invoice.invoice_number} (Idempotency: {idempotency_key}) in {tenant_db}")
    return payment


def process_refund(
    tenant_db: str,
    payment_id: str,
    amount: Decimal,
    reason: str,
    processed_by: Membership = None
) -> Refund:
    """Processes a refund against an existing payment."""
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))

    if amount <= Decimal('0.00'):
        raise ValidationError({"amount": "Refund amount must be greater than zero."})

    try:
        payment = Payment.objects.using(tenant_db).select_related('invoice').get(id=payment_id)
    except Payment.DoesNotExist:
        raise ValidationError({"payment_id": "Payment record not found."})

    if amount > payment.amount:
        raise ValidationError({"amount": f"Refund amount cannot exceed original payment amount (${payment.amount})."})

    invoice = payment.invoice
    with transaction.atomic(using=tenant_db):
        refund = Refund.objects.using(tenant_db).create(
            payment=payment,
            amount=amount,
            reason=reason,
            refund_date=date.today(),
            processed_by=processed_by
        )

        invoice.paid_amount = max(Decimal('0.00'), invoice.paid_amount - amount)
        if invoice.paid_amount == Decimal('0.00'):
            invoice.status = 'UNPAID'
        elif invoice.paid_amount < invoice.total_amount:
            invoice.status = 'PARTIAL'
        invoice.save(using=tenant_db)

    logger.info(f"Processed refund of ${amount} for payment {payment.id} in {tenant_db}")
    return refund


def get_finance_metrics(tenant_db: str) -> dict:
    """Calculates overall financial overview metrics."""
    invoices_agg = Invoice.objects.using(tenant_db).aggregate(
        total_invoiced=Sum('total_amount'),
        total_collected=Sum('paid_amount')
    )
    refunds_agg = Refund.objects.using(tenant_db).aggregate(
        total_refunded=Sum('amount')
    )

    invoiced = invoices_agg['total_invoiced'] or Decimal('0.00')
    collected = invoices_agg['total_collected'] or Decimal('0.00')
    refunded = refunds_agg['total_refunded'] or Decimal('0.00')
    outstanding = max(Decimal('0.00'), invoiced - collected)

    return {
        "total_invoiced": str(invoiced),
        "total_collected": str(collected),
        "total_outstanding": str(outstanding),
        "total_refunded": str(refunded),
        "collection_rate": round(float((collected / invoiced) * 100), 1) if invoiced > Decimal('0.00') else 0.0
    }
