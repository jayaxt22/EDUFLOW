"""
URL patterns for Attendance module.
"""

from django.urls import path
from apps.attendance.views import (
    BulkClassAttendanceView,
    SelfAttendanceView,
    AttendanceCorrectionView,
    ClassAttendanceSummaryView,
    AttendanceRecordListView,
    SchoolAttendanceAnalyticsView,
    SelfAttendanceStatusView
)

urlpatterns = [
    path('mark-class/', BulkClassAttendanceView.as_view(), name='attendance-mark-class'),
    path('mark-self/', SelfAttendanceView.as_view(), name='attendance-mark-self'),
    path('self-status/', SelfAttendanceStatusView.as_view(), name='attendance-self-status'),
    path('<uuid:pk>/correct/', AttendanceCorrectionView.as_view(), name='attendance-correct'),
    path('summary/', ClassAttendanceSummaryView.as_view(), name='attendance-summary'),
    path('analytics/', SchoolAttendanceAnalyticsView.as_view(), name='attendance-analytics'),
    path('records/', AttendanceRecordListView.as_view(), name='attendance-records'),
]
