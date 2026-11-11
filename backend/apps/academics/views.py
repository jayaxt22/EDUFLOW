"""
Views for Academics module.
Thin views dispatching business logic to services.py.
"""

from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment
from apps.academics.serializers import (
    AcademicYearSerializer,
    AcademicUnitSerializer,
    SubjectSerializer,
    TeachingAssignmentSerializer,
    StudentEnrollmentSerializer,
    PromotionBatchRequestSerializer,
    StudentTransferRequestSerializer
)
from apps.academics.services import (
    create_academic_year,
    create_academic_unit,
    delete_academic_unit,
    create_subject,
    assign_teacher,
    unassign_class_teacher,
    enroll_student,
    promote_students,
    transfer_student_section,
    get_my_class_roster
)
from apps.core.permissions import HasEduFlowPerm, has_perm

class AcademicYearViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('academic_units.crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        years = AcademicYear.objects.using(tenant_db).all().order_by('-start_date')
        return Response({"success": True, "data": AcademicYearSerializer(years, many=True).data})

    def create(self, request):
        serializer = AcademicYearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        year = create_academic_year(
            tenant_db=tenant_db,
            name=serializer.validated_data['name'],
            start_date=serializer.validated_data['start_date'],
            end_date=serializer.validated_data['end_date'],
            is_current=serializer.validated_data.get('is_current', False)
        )
        return Response({"success": True, "data": AcademicYearSerializer(year).data}, status=status.HTTP_201_CREATED)


class AcademicUnitViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('academic_units.crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        units = AcademicUnit.objects.using(tenant_db).select_related(
            'academic_year', 'parent'
        ).prefetch_related(
            'children',
            'children__teaching_assignments__membership__user',
            'teaching_assignments__membership__user',
            'enrollments',
            'children__enrollments'
        ).all()
        return Response({"success": True, "data": AcademicUnitSerializer(units, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        unit_type = request.data.get('unit_type')
        parent_id = request.data.get('parent')

        if unit_type == 'SECTION' and (not parent_id or str(parent_id).strip() in ('', 'null', 'undefined')):
            raise ValidationError({"parent": "A section must be attached to a parent Class."})

        initial_section_name = request.data.get('initial_section_name') or request.data.get('section_name')
        if unit_type == 'CLASS' and not initial_section_name:
            initial_section_name = 'Section A'

        unit = create_academic_unit(
            tenant_db=tenant_db,
            academic_year_id=request.data.get('academic_year'),
            name=request.data.get('name'),
            unit_type=unit_type,
            parent_id=parent_id,
            initial_section_name=initial_section_name
        )
        return Response({"success": True, "data": AcademicUnitSerializer(unit).data}, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        delete_academic_unit(tenant_db=tenant_db, unit_id=pk)
        return Response({"success": True, "message": "Academic unit deleted successfully."}, status=status.HTTP_200_OK)


class SubjectViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy'):
            return [IsAuthenticated(), HasEduFlowPerm('subjects.crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        subjects = Subject.objects.using(tenant_db).all().order_by('name')
        return Response({"success": True, "data": SubjectSerializer(subjects, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        subject = create_subject(
            tenant_db=tenant_db,
            name=request.data.get('name'),
            code=request.data.get('code')
        )
        return Response({"success": True, "data": SubjectSerializer(subject).data}, status=status.HTTP_201_CREATED)


class TeachingAssignmentViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy', 'unassign_class_teacher'):
            return [IsAuthenticated(), HasEduFlowPerm('allocations.crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        if has_perm(request.user, 'allocations.crud', request=request, view=self):
            assignments = TeachingAssignment.objects.using(tenant_db).select_related(
                'membership__user', 'subject', 'academic_unit'
            ).all()
        else:
            # Teacher listing own assignments
            assignments = TeachingAssignment.objects.using(tenant_db).select_related(
                'membership__user', 'subject', 'academic_unit'
            ).filter(membership=request.user.membership)

        return Response({"success": True, "data": TeachingAssignmentSerializer(assignments, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        subject_id = request.data.get('subject')
        if not subject_id or str(subject_id).strip() in ('', 'null', 'undefined'):
            subject_id = None

        reassign_class_teacher = bool(
            request.data.get('reassign_class_teacher', False) or
            request.data.get('reassign', False) or
            request.data.get('replace_existing', False)
        )

        assignment = assign_teacher(
            tenant_db=tenant_db,
            teacher_membership_id=request.data.get('membership'),
            academic_unit_id=request.data.get('academic_unit'),
            subject_id=subject_id,
            is_class_teacher=bool(request.data.get('is_class_teacher', False)),
            reassign_class_teacher=reassign_class_teacher
        )
        return Response({"success": True, "data": TeachingAssignmentSerializer(assignment).data}, status=status.HTTP_201_CREATED)

    def unassign_class_teacher(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        unit_id = request.data.get('academic_unit')
        if not unit_id:
            raise ValidationError({"academic_unit": "Academic unit is required."})
        unassign_class_teacher(tenant_db, unit_id)
        return Response({"success": True, "message": "Class teacher unassigned successfully."})


class StudentEnrollmentViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ('create', 'update', 'destroy', 'transfer'):
            return [IsAuthenticated(), HasEduFlowPerm('enrollments.crud')()]
        return [IsAuthenticated()]

    def list(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        qs = StudentEnrollment.objects.using(tenant_db).select_related(
            'membership__user', 'membership__student_profile', 'academic_unit'
        ).filter(enrolled_to__isnull=True)
        unit_id = request.query_params.get('academic_unit')
        if unit_id:
            qs = qs.filter(academic_unit_id=unit_id)
        return Response({"success": True, "data": StudentEnrollmentSerializer(qs, many=True).data})

    def create(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        enrollment = enroll_student(
            tenant_db=tenant_db,
            student_membership_id=request.data.get('membership'),
            academic_unit_id=request.data.get('academic_unit'),
            roll_number=request.data.get('roll_number'),
            enrolled_from=request.data.get('enrolled_from'),
            enrolled_to=request.data.get('enrolled_to')
        )
        return Response({"success": True, "data": StudentEnrollmentSerializer(enrollment).data}, status=status.HTTP_201_CREATED)

    def transfer(self, request):
        serializer = StudentTransferRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')

        enrollment = transfer_student_section(
            tenant_db=tenant_db,
            student_membership_id=str(serializer.validated_data['student_membership_id']),
            target_section_id=str(serializer.validated_data['target_unit_id']),
            new_roll_number=serializer.validated_data.get('new_roll_number'),
            transfer_date=serializer.validated_data.get('transfer_date')
        )
        return Response({
            "success": True,
            "message": "Student transferred successfully.",
            "data": StudentEnrollmentSerializer(enrollment).data
        }, status=status.HTTP_200_OK)


class PromotionView(APIView):
    """
    POST /api/v1/academics/promote/
    Executes atomic student promotion batch.
    Guarded by enrollments.crud.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('enrollments.crud')]

    def post(self, request):
        serializer = PromotionBatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        new_enrollments = promote_students(
            tenant_db=tenant_db,
            target_unit_id=str(serializer.validated_data['target_unit_id']),
            promotion_date=serializer.validated_data['promotion_date'],
            promotions=[
                {
                    "student_membership_id": str(p['student_membership_id']),
                    "roll_number": p.get('roll_number', '')
                }
                for p in serializer.validated_data['promotions']
            ]
        )

        return Response({
            "success": True,
            "data": {
                "promoted_count": len(new_enrollments),
                "enrollments": StudentEnrollmentSerializer(new_enrollments, many=True).data
            }
        }, status=status.HTTP_200_OK)


class MyClassView(APIView):
    """
    GET /api/v1/academics/my-class/
    Returns roster and attendance overview for assigned Class Teacher.
    Guarded conditionally by teacher.my_class.view.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('teacher.my_class.view')]

    def get(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        roster_data = get_my_class_roster(tenant_db, request.user.membership)
        return Response({
            "success": True,
            "data": roster_data
        })


class TeacherMyClassRosterView(APIView):
    """
    GET /api/v1/teacher/my-class-roster/
    Returns list of students in the teacher's assigned class.
    Guarded conditionally by teacher.my_class.view.
    Returns 403 if the requesting teacher is not a designated class teacher.
    """
    permission_classes = [IsAuthenticated, HasEduFlowPerm('teacher.my_class.view')]

    def get(self, request):
        tenant_db = getattr(request, 'tenant_db', 'tenant_horizon')
        roster_data = get_my_class_roster(tenant_db, request.user.membership)
        return Response({
            "success": True,
            "data": roster_data
        }, status=status.HTTP_200_OK)
