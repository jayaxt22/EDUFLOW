"""
URLs for Examinations module.
"""

from django.urls import path
from apps.examinations.views import (
    ExamViewSet,
    ExamSubjectViewSet,
    BulkMarksEntryView,
    PublishExamView,
    ExamMarksGridView
)

urlpatterns = [
    path('exams/', ExamViewSet.as_view({'get': 'list', 'post': 'create'}), name='examinations-exams'),
    path('exam-subjects/', ExamSubjectViewSet.as_view({'get': 'list', 'post': 'create'}), name='examinations-subjects'),
    path('marks/', BulkMarksEntryView.as_view(), name='examinations-marks'),
    path('exams/<uuid:pk>/publish/', PublishExamView.as_view(), name='examinations-publish'),
    path('marks-grid/', ExamMarksGridView.as_view(), name='examinations-marks-grid'),
]
