"""
Serializers for Fees & Finance module.
"""

from rest_framework import serializers
from apps.fees.models import FeeStructure, Invoice, Payment, Refund

class FeeStructureSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    academic_unit_name = serializers.CharField(source='academic_unit.name', read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'academic_year',
            'academic_year_name',
            'academic_unit',
            'academic_unit_name',
            'name',
            'amount',
            'due_date',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student_membership.user.full_name', read_only=True)
    admission_number = serializers.CharField(source='student_membership.student_profile.admission_number', read_only=True)
    structure_name = serializers.CharField(source='fee_structure.name', read_only=True)
    balance_due = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'student_membership',
            'student_name',
            'admission_number',
            'fee_structure',
            'structure_name',
            'invoice_number',
            'issue_date',
            'due_date',
            'total_amount',
            'paid_amount',
            'balance_due',
            'status',
            'created_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'paid_amount', 'balance_due', 'status', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.user.full_name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'invoice',
            'invoice_number',
            'idempotency_key',
            'amount',
            'payment_method',
            'transaction_reference',
            'payment_date',
            'recorded_by',
            'recorded_by_name',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RecordPaymentInputSerializer(serializers.Serializer):
    invoice_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    idempotency_key = serializers.UUIDField()
    payment_method = serializers.ChoiceField(choices=['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE'], default='CASH')
    transaction_reference = serializers.CharField(required=False, allow_blank=True, default='')
    payment_date = serializers.DateField(required=False)


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = [
            'id',
            'payment',
            'amount',
            'reason',
            'refund_date',
            'processed_by',
            'created_at'
        ]
        read_only_fields = ['id', 'refund_date', 'created_at']
