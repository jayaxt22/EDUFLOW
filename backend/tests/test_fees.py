"""
Tests for Fees & Finance module per doc/planning.md Phase 6 DoD:
1. DoD: No floats (strictly Decimal / NUMERIC(14,2)).
2. DoD: Duplicate payments blocked via idempotency keys.
3. Invoice balance calculations & partial/paid status transitions.
4. Mandatory 4 variants on payment endpoint (Allow, Deny 403, Anonymous 401, Cross-tenant 404).
"""

import uuid
import pytest
from datetime import date
from decimal import Decimal
from django.db import IntegrityError
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError

from apps.tenants.models import Institution, TenantRegistry
from apps.identity.services import create_user_with_membership
from apps.academics.services import create_academic_year, create_academic_unit, enroll_student
from apps.fees.models import FeeStructure, Invoice, Payment, Refund
from apps.fees.services import (
    create_fee_structure,
    create_invoice,
    record_payment,
    process_refund
)

@pytest.mark.django_db(databases=['default', 'tenant_demo'])
class TestFeesAndFinance:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.client = APIClient()

        # Control Plane Institution & Tenant
        self.inst, _ = Institution.objects.using('default').update_or_create(
            slug='demo',
            defaults={'name': 'Demo School', 'status': 'ACTIVE'}
        )
        TenantRegistry.objects.using('default').update_or_create(
            institution=self.inst,
            defaults={'db_url': 'sqlite:///eduflow_tenant_demo.sqlite3', 'status': 'ACTIVE'}
        )

        # Admin, Finance Staff, Teacher, Student
        self.admin = create_user_with_membership('tenant_demo', {
            'email': 'admin_fees@demo.edu',
            'username': 'admin_fees',
            'password': 'Pass12345!',
            'full_name': 'Admin Fees',
            'role': 'ADMIN',
        })
        self.finance_staff = create_user_with_membership('tenant_demo', {
            'email': 'finance_fees@demo.edu',
            'username': 'finance_fees',
            'password': 'Pass12345!',
            'full_name': 'Finance Staff',
            'role': 'STAFF',
            'staff_type': 'FINANCE',
            'employee_id': 'STF-FIN-01'
        })
        self.teacher = create_user_with_membership('tenant_demo', {
            'email': 'teacher_fees@demo.edu',
            'username': 'teacher_fees',
            'password': 'Pass12345!',
            'full_name': 'Teacher Fees',
            'role': 'TEACHER',
            'employee_id': 'T-FEES-01'
        })
        self.student = create_user_with_membership('tenant_demo', {
            'email': 'student_fees@demo.edu',
            'username': 'student_fees',
            'password': 'Pass12345!',
            'full_name': 'Student Fees',
            'role': 'STUDENT',
            'admission_number': 'FEE-STU-01'
        })

        # Year
        self.year = create_academic_year(
            tenant_db='tenant_demo',
            name='2026-2027',
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True
        )

        # Fee Structure: $1200.00
        self.structure = create_fee_structure(
            tenant_db='tenant_demo',
            academic_year_id=str(self.year.id),
            name='Annual Tuition 2026-2027',
            amount=Decimal('1200.00'),
            due_date=date(2026, 9, 30)
        )

        # Student Invoice: $1200.00
        self.invoice = create_invoice(
            tenant_db='tenant_demo',
            student_membership_id=str(self.student.id),
            fee_structure_id=str(self.structure.id),
            issue_date=date(2026, 9, 1),
            due_date=date(2026, 9, 30),
            total_amount=Decimal('1200.00')
        )

        self.payments_url = reverse('fees-payments')

    def test_payment_happy_path_and_invoice_status_transition(self):
        """Happy path: Partial payment followed by full settlement updates invoice status."""
        key1 = uuid.uuid4()
        p1 = record_payment(
            tenant_db='tenant_demo',
            invoice_id=str(self.invoice.id),
            amount=Decimal('500.00'),
            idempotency_key=str(key1),
            recorded_by=self.finance_staff
        )
        assert p1.amount == Decimal('500.00')
        self.invoice.refresh_from_db()
        assert self.invoice.paid_amount == Decimal('500.00')
        assert self.invoice.balance_due == Decimal('700.00')
        assert self.invoice.status == 'PARTIAL'

        # Settle the remaining balance: $700.00
        key2 = uuid.uuid4()
        record_payment(
            tenant_db='tenant_demo',
            invoice_id=str(self.invoice.id),
            amount=Decimal('700.00'),
            idempotency_key=str(key2),
            recorded_by=self.finance_staff
        )
        self.invoice.refresh_from_db()
        assert self.invoice.paid_amount == Decimal('1200.00')
        assert self.invoice.balance_due == Decimal('0.00')
        assert self.invoice.status == 'PAID'

    def test_duplicate_payment_blocked_by_idempotency_key(self):
        """DoD: Duplicate payment with same idempotency key is blocked."""
        key = uuid.uuid4()
        record_payment(
            tenant_db='tenant_demo',
            invoice_id=str(self.invoice.id),
            amount=Decimal('200.00'),
            idempotency_key=str(key),
            recorded_by=self.finance_staff
        )

        # Attempt duplicate with identical idempotency key -> blocked!
        with pytest.raises(ValidationError) as exc:
            record_payment(
                tenant_db='tenant_demo',
                invoice_id=str(self.invoice.id),
                amount=Decimal('200.00'),
                idempotency_key=str(key),
                recorded_by=self.finance_staff
            )
        assert "Duplicate payment blocked" in str(exc.value)

    def test_overpayment_rejected(self):
        """Payment amount exceeding invoice balance due is rejected."""
        key = uuid.uuid4()
        with pytest.raises(ValidationError) as exc:
            record_payment(
                tenant_db='tenant_demo',
                invoice_id=str(self.invoice.id),
                amount=Decimal('1500.00'),  # Exceeds $1200.00
                idempotency_key=str(key),
                recorded_by=self.finance_staff
            )
        assert "exceeds current invoice balance" in str(exc.value)

    # ------------------------------------------------------------------
    # POST /api/v1/fees/payments/ (Mandatory 4 Variants)
    # ------------------------------------------------------------------

    def test_record_payment_allow_finance_staff(self):
        """Variant 1: Allow - Finance staff with fees.payments_crud can record payments."""
        self.client.force_authenticate(user=self.finance_staff.user)
        payload = {
            'invoice_id': str(self.invoice.id),
            'amount': '350.00',
            'idempotency_key': str(uuid.uuid4()),
            'payment_method': 'CARD'
        }
        response = self.client.post(self.payments_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 201
        assert response.data['success'] is True
        assert Decimal(response.data['data']['amount']) == Decimal('350.00')

    def test_record_payment_deny_teacher_403(self):
        """Variant 2: Deny (403) - Teacher lacks fees.payments_crud permission."""
        self.client.force_authenticate(user=self.teacher.user)
        payload = {
            'invoice_id': str(self.invoice.id),
            'amount': '100.00',
            'idempotency_key': str(uuid.uuid4())
        }
        response = self.client.post(self.payments_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 403

    def test_record_payment_anonymous_401(self):
        """Variant 3: Anonymous (401) - Unauthenticated request fails."""
        payload = {'invoice_id': str(self.invoice.id), 'amount': '100.00', 'idempotency_key': str(uuid.uuid4())}
        response = self.client.post(self.payments_url, payload, format='json', HTTP_X_TENANT_SLUG='demo')
        assert response.status_code == 401

    def test_record_payment_cross_tenant_404(self):
        """Variant 4: Cross-tenant (404) - Nonexistent tenant header returns 404."""
        self.client.force_authenticate(user=self.finance_staff.user)
        payload = {'invoice_id': str(self.invoice.id), 'amount': '100.00', 'idempotency_key': str(uuid.uuid4())}
        response = self.client.post(self.payments_url, payload, format='json', HTTP_X_TENANT_SLUG='wrong-tenant')
        assert response.status_code == 404

    # ------------------------------------------------------------------
    # Refunds & Model Constraints & Read-own Restrictions
    # ------------------------------------------------------------------

    def test_refund_happy_path_and_guards(self):
        """Refund decreases invoice paid amount and guards against excess refund."""
        key = uuid.uuid4()
        payment = record_payment(
            tenant_db='tenant_demo',
            invoice_id=str(self.invoice.id),
            amount=Decimal('500.00'),
            idempotency_key=str(key),
            recorded_by=self.finance_staff
        )
        self.invoice.refresh_from_db()
        assert self.invoice.paid_amount == Decimal('500.00')

        # Guard: Cannot refund more than original payment amount ($500.00)
        with pytest.raises(ValidationError) as exc:
            process_refund(
                tenant_db='tenant_demo',
                payment_id=str(payment.id),
                amount=Decimal('600.00'),
                reason='Over-refund test',
                processed_by=self.finance_staff
            )
        assert "cannot exceed original payment amount" in str(exc.value)

        # Happy path: Refund $200.00
        refund = process_refund(
            tenant_db='tenant_demo',
            payment_id=str(payment.id),
            amount=Decimal('200.00'),
            reason='Partial refund requested',
            processed_by=self.finance_staff
        )
        assert refund.amount == Decimal('200.00')
        self.invoice.refresh_from_db()
        assert self.invoice.paid_amount == Decimal('300.00')
        assert self.invoice.balance_due == Decimal('900.00')
        assert self.invoice.status == 'PARTIAL'

    def test_db_idempotency_key_unique_constraint(self):
        """Proves that database-level unique constraint on idempotency_key triggers IntegrityError."""
        key = uuid.uuid4()
        Payment.objects.using('tenant_demo').create(
            invoice=self.invoice,
            idempotency_key=key,
            amount=Decimal('100.00'),
            payment_date=date.today()
        )
        with pytest.raises(IntegrityError):
            Payment.objects.using('tenant_demo').create(
                invoice=self.invoice,
                idempotency_key=key,
                amount=Decimal('100.00'),
                payment_date=date.today()
            )

    def test_student_read_own_invoices_isolation(self):
        """Student with fees.read_own can only view their own invoices, never others."""
        # Create a second student with an invoice
        student2 = create_user_with_membership('tenant_demo', {
            'email': 'student2_fees@demo.edu',
            'username': 'student2_fees',
            'password': 'Pass12345!',
            'full_name': 'Student Two',
            'role': 'STUDENT',
            'admission_number': 'FEE-STU-02'
        })
        invoice2 = create_invoice(
            tenant_db='tenant_demo',
            student_membership_id=str(student2.id),
            fee_structure_id=str(self.structure.id),
            issue_date=date(2026, 9, 1),
            due_date=date(2026, 9, 30),
            total_amount=Decimal('800.00'),
            invoice_number='INV-TEST-002'
        )

        invoices_url = reverse('fees-invoices')

        # When student 1 fetches invoices: only sees student 1's invoice
        self.client.force_authenticate(user=self.student.user)
        res1 = self.client.get(invoices_url, HTTP_X_TENANT_SLUG='demo')
        assert res1.status_code == 200
        inv_ids1 = [item['id'] for item in res1.data['data']]
        assert str(self.invoice.id) in inv_ids1
        assert str(invoice2.id) not in inv_ids1

        # When finance staff (fees.read_all) fetches: sees both invoices
        self.client.force_authenticate(user=self.finance_staff.user)
        res_all = self.client.get(invoices_url, HTTP_X_TENANT_SLUG='demo')
        assert res_all.status_code == 200
        inv_ids_all = [item['id'] for item in res_all.data['data']]
        assert str(self.invoice.id) in inv_ids_all
        assert str(invoice2.id) in inv_ids_all

