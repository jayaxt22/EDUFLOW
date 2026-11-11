"""
Serializers for Academics module.
"""

from rest_framework import serializers
from apps.academics.models import AcademicYear, AcademicUnit, Subject, StudentEnrollment, TeachingAssignment

class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'start_date', 'end_date', 'is_current', 'created_at']


class AcademicUnitSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    children = serializers.SerializerMethodField()
    class_teacher_name = serializers.SerializerMethodField()
    class_teacher_id = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicUnit
        fields = [
            'id', 'name', 'unit_type', 'academic_year', 'academic_year_name',
            'parent', 'parent_name', 'children', 'class_teacher_name',
            'class_teacher_id', 'student_count', 'created_at'
        ]

    def get_class_teacher_name(self, obj):
        for ta in obj.teaching_assignments.all():
            if ta.is_class_teacher and ta.membership and ta.membership.user:
                return ta.membership.user.full_name
        return None

    def get_class_teacher_id(self, obj):
        for ta in obj.teaching_assignments.all():
            if ta.is_class_teacher and ta.membership:
                return str(ta.membership.id)
        return None

    def get_student_count(self, obj):
        active_self = len([e for e in obj.enrollments.all() if e.enrolled_to is None])
        if obj.unit_type == 'CLASS':
            active_children = sum(
                len([e for e in c.enrollments.all() if e.enrolled_to is None])
                for c in obj.children.all()
            )
            return active_self + active_children
        return active_self

    def get_children(self, obj):
        if obj.unit_type == 'CLASS':
            children = obj.children.all()
            result = []
            for c in children:
                ct_name = None
                ct_id = None
                for ta in c.teaching_assignments.all():
                    if ta.is_class_teacher and ta.membership and ta.membership.user:
                        ct_name = ta.membership.user.full_name
                        ct_id = str(ta.membership.id)
                        break
                sec_student_count = len([e for e in c.enrollments.all() if e.enrolled_to is None])
                result.append({
                    "id": str(c.id),
                    "name": c.name,
                    "unit_type": c.unit_type,
                    "class_teacher_name": ct_name,
                    "class_teacher_id": ct_id,
                    "student_count": sec_student_count,
                })
            return result
        return []


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'created_at']


class TeachingAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='membership.user.full_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True, default=None)
    academic_unit_name = serializers.CharField(source='academic_unit.name', read_only=True)
    unit_name = serializers.CharField(source='academic_unit.name', read_only=True)

    class Meta:
        model = TeachingAssignment
        fields = [
            'id', 'membership', 'teacher_name', 'subject', 'subject_name',
            'academic_unit', 'academic_unit_name', 'unit_name', 'is_class_teacher', 'created_at'
        ]


class StudentEnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='membership.user.full_name', read_only=True)
    admission_number = serializers.CharField(source='membership.student_profile.admission_number', read_only=True)
    academic_unit_name = serializers.CharField(source='academic_unit.name', read_only=True)

    class Meta:
        model = StudentEnrollment
        fields = [
            'id', 'membership', 'student_name', 'admission_number',
            'academic_unit', 'academic_unit_name', 'roll_number',
            'enrolled_from', 'enrolled_to', 'created_at'
        ]


class StudentPromotionItemSerializer(serializers.Serializer):
    student_membership_id = serializers.UUIDField(required=True)
    roll_number = serializers.CharField(max_length=50, required=False, allow_blank=True)


class PromotionBatchRequestSerializer(serializers.Serializer):
    target_unit_id = serializers.UUIDField(required=True)
    promotion_date = serializers.DateField(required=True)
    promotions = StudentPromotionItemSerializer(many=True, required=True)


class StudentTransferRequestSerializer(serializers.Serializer):
    student_membership_id = serializers.CharField(required=True)
    target_unit_id = serializers.UUIDField(required=True)
    new_roll_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default=None)
    transfer_date = serializers.DateField(required=False, default=None)

