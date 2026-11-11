"""
Views for Fees & Finance module.
"""

from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.fees.models import FeeStructure, Invoice, Payment, Refund
from apps.fees.serializers import (
    FeeStructureSerializer,
    InvoiceSerializer,
    PaymentSerializer,
    RefundSerializer,
    RecordPaymentInputSerializer
)
from apps.fees.services import (
    create_fee_structure,
    create_invoice,
    record_payment,
    process_refund,
    get_finance_metrics
)
from apps.core.permissions import HasEduFlowPerm, has_perm

class FeeStructureViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('fees.structures_crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        structures = FeeStructure.objects.using(tenant_db).select_related('academic_year', 'academic_unit').all()
        return Response({"success": True, "data": FeeStructureSerializer(structures, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        fs = create_fee_structure(
            tenant_db=tenant_db,
            academic_year_id=request.data.get('academic_year'),
            name=request.data.get('name'),
            amount=request.data.get('amount'),
            due_date=request.data.get('due_date'),
            academic_unit_id=request.data.get('academic_unit')
        )
        return Response({"success": True, "data": FeeStructureSerializer(fs).data}, status=status.HTTP_201_CREATED)


class InvoiceViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('fees.invoices_crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        if has_perm(request.user, 'fees.read_all', request=request, view=self):
            invoices = Invoice.objects.using(tenant_db).select_related(
                'student_membership__user', 'student_membership__student_profile', 'fee_structure'
            ).all().order_by('-issue_date')
        elif has_perm(request.user, 'fees.read_own', request=request, view=self):
            invoices = Invoice.objects.using(tenant_db).select_related(
                'student_membership__user', 'student_membership__student_profile', 'fee_structure'
            ).filter(student_membership=request.user.membership).order_by('-issue_date')
        else:
            return Response({"success": False, "error": {"code": "PERMISSION_DENIED", "message": "Permission denied."}}, status=status.HTTP_403_FORBIDDEN)

        return Response({"success": True, "data": InvoiceSerializer(invoices, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        invoice = create_invoice(
            tenant_db=tenant_db,
            student_membership_id=request.data.get('student_membership'),
            fee_structure_id=request.data.get('fee_structure'),
            issue_date=request.data.get('issue_date'),
            due_date=request.data.get('due_date'),
            total_amount=request.data.get('total_amount'),
            invoice_number=request.data.get('invoice_number')
        )
        return Response({"success": True, "data": InvoiceSerializer(invoice).data}, status=status.HTTP_201_CREATED)


class PaymentView(APIView):
    """
    POST /api/v1/fees/payments/
    Records payment receipt against an invoice.
    Guarded by fees.payments_crud.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('fees.payments_crud')]

    def post(self, request):
        serializer = RecordPaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        payment = record_payment(
            tenant_db=tenant_db,
            invoice_id=str(serializer.validated_data['invoice_id']),
            amount=serializer.validated_data['amount'],
            idempotency_key=str(serializer.validated_data['idempotency_key']),
            payment_method=serializer.validated_data.get('payment_method', 'CASH'),
            transaction_reference=serializer.validated_data.get('transaction_reference', ''),
            payment_date=serializer.validated_data.get('payment_date'),
            recorded_by=request.user.membership
        )

        return Response({"success": True, "data": PaymentSerializer(payment).data}, status=status.HTTP_201_CREATED)

    def get(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        payments = Payment.objects.using(tenant_db).select_related('invoice', 'recorded_by__user').all().order_by('-payment_date')[:50]
        return Response({"success": True, "data": PaymentSerializer(payments, many=True).data})


class RefundView(APIView):
    """
    POST /api/v1/fees/refunds/
    Processes refund. Guarded by fees.refunds_crud.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('fees.refunds_crud')]

    def post(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        refund = process_refund(
            tenant_db=tenant_db,
            payment_id=request.data.get('payment_id'),
            amount=request.data.get('amount'),
            reason=request.data.get('reason', 'Parent request'),
            processed_by=request.user.membership
        )
        return Response({"success": True, "data": RefundSerializer(refund).data}, status=status.HTTP_201_CREATED)


class FinanceMetricsView(APIView):
    """
    GET /api/v1/fees/metrics/
    Guarded by fees.read_all.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('fees.read_all')]

    def get(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        metrics = get_finance_metrics(tenant_db)
        return Response({"success": True, "data": metrics})
