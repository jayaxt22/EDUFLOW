"""
Serializers for Examinations module.
"""

from rest_framework import serializers
from apps.examinations.models import GradingScale, Exam, ExamSubject, MarkEntry

class GradingScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradingScale
        fields = ['id', 'name', 'is_default', 'rules', 'created_at']
        read_only_fields = ['id', 'created_at']


class ExamSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id',
            'academic_year',
            'academic_year_name',
            'name',
            'start_date',
            'end_date',
            'status',
            'is_published',
            'published_at',
            'created_at'
        ]
        read_only_fields = ['id', 'status', 'is_published', 'published_at', 'created_at']


class ExamSubjectSerializer(serializers.ModelSerializer):
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    unit_name = serializers.CharField(source='academic_unit.name', read_only=True)

    class Meta:
        model = ExamSubject
        fields = [
            'id',
            'exam',
            'exam_name',
            'academic_unit',
            'unit_name',
            'subject',
            'subject_name',
            'subject_code',
            'max_marks',
            'passing_marks',
            'exam_date',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MarkEntrySerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student_membership.user.full_name', read_only=True)

    class Meta:
        model = MarkEntry
        fields = [
            'id',
            'exam_subject',
            'student_membership',
            'student_name',
            'marks_obtained',
            'is_absent',
            'grade_snapshot',
            'remarks',
            'is_locked',
            'created_at'
        ]
        read_only_fields = ['id', 'grade_snapshot', 'is_locked', 'created_at']


class SingleMarkInputSerializer(serializers.Serializer):
    student_membership_id = serializers.UUIDField()
    marks_obtained = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    is_absent = serializers.BooleanField(default=False)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class BulkMarksSubmissionSerializer(serializers.Serializer):
    exam_subject_id = serializers.UUIDField()
    entries = SingleMarkInputSerializer(many=True)
