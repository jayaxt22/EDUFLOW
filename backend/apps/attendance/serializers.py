"""
Serializers for Attendance module.
"""

from rest_framework import serializers
from apps.attendance.models import AttendanceRecord

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='subject_user.user.full_name', read_only=True)
    marked_by_name = serializers.CharField(source='marked_by.user.full_name', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            'id',
            'subject_user',
            'student_name',
            'context',
            'academic_unit',
            'date',
            'status',
            'marked_by',
            'marked_by_name',
            'remarks',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StudentAttendanceItemSerializer(serializers.Serializer):
    student_membership_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class BulkClassAttendanceSerializer(serializers.Serializer):
    academic_unit_id = serializers.UUIDField()
    date = serializers.DateField()
    records = StudentAttendanceItemSerializer(many=True)


class SelfAttendanceSerializer(serializers.Serializer):
    date = serializers.DateField()
    status = serializers.ChoiceField(choices=['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], default='PRESENT')
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class AttendanceCorrectionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
