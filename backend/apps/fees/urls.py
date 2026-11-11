"""
URLs for Fees module.
"""

from django.urls import path
from apps.fees.views import (
    FeeStructureViewSet,
    InvoiceViewSet,
    PaymentView,
    RefundView,
    FinanceMetricsView
)

urlpatterns = [
    path('structures/', FeeStructureViewSet.as_view({'get': 'list', 'post': 'create'}), name='fees-structures'),
    path('invoices/', InvoiceViewSet.as_view({'get': 'list', 'post': 'create'}), name='fees-invoices'),
    path('payments/', PaymentView.as_view(), name='fees-payments'),
    path('refunds/', RefundView.as_view(), name='fees-refunds'),
    path('metrics/', FinanceMetricsView.as_view(), name='fees-metrics'),
]
