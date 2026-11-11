"""
Serializers for Announcements module.
"""

from rest_framework import serializers
from apps.announcements.models import Announcement

class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='created_by.user.full_name', read_only=True)
    author_role = serializers.CharField(source='created_by.role', read_only=True)
    target_academic_unit_name = serializers.CharField(source='target_academic_unit.name', read_only=True, default=None)
    forwarded_from_title = serializers.CharField(source='forwarded_from.title', read_only=True, default=None)

    class Meta:
        model = Announcement
        fields = [
            'id',
            'title',
            'content',
            'author_name',
            'author_role',
            'target_role',
            'target_academic_unit',
            'target_academic_unit_name',
            'forwarded_from',
            'forwarded_from_title',
            'published_at',
            'created_at',
        ]
        read_only_fields = ['id', 'published_at', 'created_at']


class CreateAnnouncementInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    content = serializers.CharField()
    target_role = serializers.ChoiceField(
        choices=['ALL', 'TEACHER', 'STUDENT', 'STAFF'],
        default='ALL',
        required=False
    )
    target_academic_unit_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class ForwardAnnouncementInputSerializer(serializers.Serializer):
    target_academic_unit_id = serializers.UUIDField(required=True)
