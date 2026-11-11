"""
Views for Attendance module.
Thin views that delegate business operations to services.py.
"""

from datetime import date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.attendance.models import AttendanceRecord
from apps.attendance.serializers import (
    AttendanceRecordSerializer,
    BulkClassAttendanceSerializer,
    SelfAttendanceSerializer,
    AttendanceCorrectionSerializer
)
from apps.attendance.services import (
    mark_class_attendance,
    mark_self_attendance,
    correct_attendance,
    get_class_attendance_summary,
    get_school_attendance_analytics,
    get_self_checkin_status
)
from apps.core.permissions import HasEduFlowPerm, has_perm

class BulkClassAttendanceView(APIView):
    """
    POST /api/v1/attendance/mark-class/
    Bulk marks attendance for a class unit.
    Guarded by attendance.mark_class.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('attendance.mark_class')]

    def post(self, request):
        serializer = BulkClassAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        result = mark_class_attendance(
            tenant_db=tenant_db,
            academic_unit_id=str(serializer.validated_data['academic_unit_id']),
            attendance_date=serializer.validated_data['date'],
            records=serializer.validated_data['records'],
            marked_by=request.user.membership
        )

        return Response({
            "success": True,
            "data": {
                "unit_id": result['unit_id'],
                "unit_name": result['unit_name'],
                "date": str(result['date']),
                "total_marked": result['total_marked'],
                "present_count": result['present_count'],
                "absent_count": result['absent_count'],
                "late_count": result['late_count'],
                "excused_count": result['excused_count'],
                "records": AttendanceRecordSerializer(result['records'], many=True).data
            }
        }, status=status.HTTP_200_OK)


class SelfAttendanceView(APIView):
    """
    POST /api/v1/attendance/mark-self/
    Self check-in for staff and faculty.
    Guarded by attendance.mark_self.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('attendance.mark_self')]

    def post(self, request):
        serializer = SelfAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        record = mark_self_attendance(
            tenant_db=tenant_db,
            membership=request.user.membership,
            attendance_date=serializer.validated_data['date'],
            status=serializer.validated_data['status'],
            remarks=serializer.validated_data.get('remarks', '')
        )

        return Response({
            "success": True,
            "data": AttendanceRecordSerializer(record).data
        }, status=status.HTTP_200_OK)


class AttendanceCorrectionView(APIView):
    """
    PATCH /api/v1/attendance/<id>/correct/
    Guarded by attendance.correct (same-day restriction enforced).
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('attendance.correct')]

    def patch(self, request, pk):
        serializer = AttendanceCorrectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')
        is_admin = has_perm(request.user, 'users.create', request=request, view=self)

        record = correct_attendance(
            tenant_db=tenant_db,
            record_id=str(pk),
            new_status=serializer.validated_data['status'],
            new_remarks=serializer.validated_data.get('remarks'),
            actor_membership=request.user.membership,
            is_admin=is_admin
        )

        return Response({
            "success": True,
            "data": AttendanceRecordSerializer(record).data
        }, status=status.HTTP_200_OK)


class ClassAttendanceSummaryView(APIView):
    """
    GET /api/v1/attendance/summary/?academic_unit=<id>&date=<YYYY-MM-DD>
    Guarded by attendance.read_class.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('attendance.read_class')]

    def get(self, request):
        academic_unit_id = request.query_params.get('academic_unit')
        date_str = request.query_params.get('date')

        if not academic_unit_id:
            return Response({
                "success": False,
                "error": {"code": "VALIDATION_ERROR", "message": "academic_unit query param is required."}
            }, status=status.HTTP_400_BAD_REQUEST)

        attendance_date = date.fromisoformat(date_str) if date_str else date.today()
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')

        summary = get_class_attendance_summary(
            tenant_db=tenant_db,
            academic_unit_id=academic_unit_id,
            attendance_date=attendance_date
        )

        return Response({
            "success": True,
            "data": summary
        })


class AttendanceRecordListView(APIView):
    """
    GET /api/v1/attendance/records/
    Guarded by attendance.read_class (class view) or attendance.read_own (personal view).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')

        if has_perm(request.user, 'attendance.read_class', request=request, view=self):
            qs = AttendanceRecord.objects.using(tenant_db).select_related(
                'subject_user__user', 'marked_by__user', 'academic_unit'
            ).all().order_by('-date')

            unit_id = request.query_params.get('academic_unit')
            if unit_id:
                qs = qs.filter(academic_unit_id=unit_id)
            date_param = request.query_params.get('date')
            if date_param:
                qs = qs.filter(date=date_param)

            return Response({
                "success": True,
                "data": AttendanceRecordSerializer(qs[:100], many=True).data
            })

        elif has_perm(request.user, 'attendance.read_own', request=request, view=self):
            qs = AttendanceRecord.objects.using(tenant_db).filter(
                subject_user=request.user.membership
            )
            context_param = request.query_params.get('context')
            if context_param:
                qs = qs.filter(context=context_param)
            qs = qs.order_by('-date')
            return Response({
                "success": True,
                "data": AttendanceRecordSerializer(qs[:100], many=True).data
            })

        return Response({
            "success": False,
            "error": {"code": "PERMISSION_DENIED", "message": "You lack permission to read attendance records."}
        }, status=status.HTTP_403_FORBIDDEN)


class SchoolAttendanceAnalyticsView(APIView):
    """
    GET /api/v1/attendance/analytics/?date=<YYYY-MM-DD>
    Whole-school attendance analytics for Admin and authorized faculty.
    Guarded by attendance.read_class.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('attendance.read_class')]

    def get(self, request):
        date_str = request.query_params.get('date')
        target_date = date.fromisoformat(date_str) if date_str else date.today()
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')

        analytics = get_school_attendance_analytics(
            tenant_db=tenant_db,
            target_date=target_date
        )

        return Response({
            "success": True,
            "data": analytics
        }, status=status.HTTP_200_OK)


class SelfAttendanceStatusView(APIView):
    """
    GET /api/v1/attendance/self-status/?date=<YYYY-MM-DD>
    Returns today's check-in status and personal history for the authenticated member.
    Guarded by attendance.mark_self.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('attendance.mark_self')]

    def get(self, request):
        date_str = request.query_params.get('date')
        target_date = date.fromisoformat(date_str) if date_str else date.today()
        tenant_db = getattr(request, 'tenant_db', 'tenant_demo')

        status_data = get_self_checkin_status(
            tenant_db=tenant_db,
            membership=request.user.membership,
            target_date=target_date
        )

        return Response({
            "success": True,
            "data": status_data
        }, status=status.HTTP_200_OK)
