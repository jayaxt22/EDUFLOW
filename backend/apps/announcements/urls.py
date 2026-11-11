"""
URLs for Announcements module.
"""

from django.urls import path
from apps.announcements.views import AnnouncementViewSet

urlpatterns = [
    path('', AnnouncementViewSet.as_view({'get': 'list', 'post': 'create'}), name='announcements-list-create'),
    path('<uuid:pk>/forward/', AnnouncementViewSet.as_view({'post': 'forward'}), name='announcements-forward'),
]
