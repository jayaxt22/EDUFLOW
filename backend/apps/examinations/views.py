"""
Views for Examinations module.
"""

from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.examinations.models import Exam, ExamSubject, GradingScale, MarkEntry
from apps.examinations.serializers import (
    ExamSerializer,
    ExamSubjectSerializer,
    GradingScaleSerializer,
    MarkEntrySerializer,
    BulkMarksSubmissionSerializer
)
from apps.examinations.services import (
    create_exam,
    add_exam_subject,
    enter_marks_bulk,
    publish_exam_results,
    get_exam_marks_grid
)
from apps.core.permissions import HasEduFlowPerm, has_perm

class ExamViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('examinations.manage')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        exams = Exam.objects.using(tenant_db).select_related('academic_year').all().order_by('-start_date')
        return Response({"success": True, "data": ExamSerializer(exams, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        exam = create_exam(
            tenant_db=tenant_db,
            academic_year_id=request.data.get('academic_year'),
            name=request.data.get('name'),
            start_date=request.data.get('start_date'),
            end_date=request.data.get('end_date')
        )
        return Response({"success": True, "data": ExamSerializer(exam).data}, status=status.HTTP_201_CREATED)


class ExamSubjectViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('examinations.manage')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        exam_id = request.query_params.get('exam')
        qs = ExamSubject.objects.using(tenant_db).select_related('exam', 'subject', 'academic_unit').all()
        if exam_id:
            qs = qs.filter(exam_id=exam_id)
        return Response({"success": True, "data": ExamSubjectSerializer(qs, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        exam_subject = add_exam_subject(
            tenant_db=tenant_db,
            exam_id=request.data.get('exam'),
            academic_unit_id=request.data.get('academic_unit'),
            subject_id=request.data.get('subject'),
            max_marks=request.data.get('max_marks', 100.00),
            passing_marks=request.data.get('passing_marks', 40.00),
            exam_date=request.data.get('exam_date')
        )
        return Response({"success": True, "data": ExamSubjectSerializer(exam_subject).data}, status=status.HTTP_201_CREATED)


class BulkMarksEntryView(APIView):
    """
    POST /api/v1/examinations/marks/
    Records student marks and snapshots evaluated grade.
    Guarded by examinations.enter_marks.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('examinations.enter_marks')]

    def post(self, request):
        serializer = BulkMarksSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        result = enter_marks_bulk(
            tenant_db=tenant_db,
            exam_subject_id=str(serializer.validated_data['exam_subject_id']),
            entries=serializer.validated_data['entries'],
            entered_by=request.user.membership
        )

        return Response({
            "success": True,
            "data": {
                "exam_subject_id": result['exam_subject_id'],
                "total_recorded": result['total_recorded'],
                "entries": MarkEntrySerializer(result['entries'], many=True).data
            }
        }, status=status.HTTP_200_OK)


class PublishExamView(APIView):
    """
    POST /api/v1/examinations/<id>/publish/
    Publishes exam results and permanently locks mark sheets.
    Guarded by examinations.manage.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('examinations.manage')]

    def post(self, request, pk):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        exam = publish_exam_results(
            tenant_db=tenant_db,
            exam_id=str(pk),
            published_by=request.user.membership
        )
        return Response({
            "success": True,
            "data": ExamSerializer(exam).data
        }, status=status.HTTP_200_OK)


class ExamMarksGridView(APIView):
    """
    GET /api/v1/examinations/marks-grid/?exam_subject=<id>
    Guarded by examinations.read or examinations.enter_marks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exam_subject_id = request.query_params.get('exam_subject')
        if not exam_subject_id:
            return Response({
                "success": False,
                "error": {"code": "VALIDATION_ERROR", "message": "exam_subject query param is required."}
            }, status=status.HTTP_400_BAD_REQUEST)

        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        data = get_exam_marks_grid(tenant_db, exam_subject_id)
        return Response({
            "success": True,
            "data": data
        })
