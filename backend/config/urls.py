"""
Root URL configuration for EduFlow ERP.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from apps.academics.views import TeacherMyClassRosterView

def health_check(request):
    return JsonResponse({"status": "ok", "app": "EduFlow ERP"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', health_check, name='root-health'),
    path('health/', health_check, name='health-check'),
    path('api/v1/', include('apps.identity.urls')),
    path('api/v1/academics/', include('apps.academics.urls')),
    path('api/v1/teacher/my-class-roster/', TeacherMyClassRosterView.as_view(), name='teacher-my-class-roster'),
    path('api/v1/attendance/', include('apps.attendance.urls')),
    path('api/v1/examinations/', include('apps.examinations.urls')),
    path('api/v1/fees/', include('apps.fees.urls')),
    path('api/v1/announcements/', include('apps.announcements.urls')),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
