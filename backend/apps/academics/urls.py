"""
URL dispatcher for Academics module.
"""

from django.urls import path
from apps.academics.views import (
    AcademicYearViewSet,
    AcademicUnitViewSet,
    SubjectViewSet,
    TeachingAssignmentViewSet,
    StudentEnrollmentViewSet,
    PromotionView,
    MyClassView
)

urlpatterns = [
    path('years/', AcademicYearViewSet.as_view({'get': 'list', 'post': 'create'}), name='academics-years'),
    path('units/', AcademicUnitViewSet.as_view({'get': 'list', 'post': 'create'}), name='academics-units'),
    path('units/<uuid:pk>/', AcademicUnitViewSet.as_view({'delete': 'destroy'}), name='academics-unit-detail'),
    path('subjects/', SubjectViewSet.as_view({'get': 'list', 'post': 'create'}), name='academics-subjects'),
    path('assignments/unassign-class-teacher/', TeachingAssignmentViewSet.as_view({'post': 'unassign_class_teacher'}), name='academics-unassign-class-teacher'),
    path('assignments/', TeachingAssignmentViewSet.as_view({'get': 'list', 'post': 'create'}), name='academics-assignments'),
    path('enrollments/', StudentEnrollmentViewSet.as_view({'get': 'list', 'post': 'create'}), name='academics-enrollments'),
    path('enrollments/transfer/', StudentEnrollmentViewSet.as_view({'post': 'transfer'}), name='academics-enrollments-transfer'),
    path('promote/', PromotionView.as_view(), name='academics-promote'),
    path('my-class/', MyClassView.as_view(), name='academics-my-class'),
]
