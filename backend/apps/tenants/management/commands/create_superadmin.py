"""
Management command to create or update a Django Superadmin on the Control Database (eduflow_control).
Enables platform operators to log into the /admin/ web dashboard.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User as DjangoUser
from django.contrib.auth.hashers import make_password
from apps.tenants.models import PlatformUser


class Command(BaseCommand):
    help = 'Creates or updates a platform superadmin in the Control Database (eduflow_control).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            default='superadmin',
            help='Superadmin username (default: superadmin)'
        )
        parser.add_argument(
            '--email',
            default='admin@eduflow.local',
            help='Superadmin email (default: admin@eduflow.local)'
        )
        parser.add_argument(
            '--password',
            default='SuperAdminPass123!',
            help='Superadmin password (default: SuperAdminPass123!)'
        )

    def handle(self, *args, **options):
        username = options['username'].strip()
        email = options['email'].strip().lower()
        password = options['password']

        self.stdout.write(f"Provisioning Superadmin on Control DB ('default')...")

        # 1. Create or update Django auth.User on 'default' database
        user, created = DjangoUser.objects.using('default').update_or_create(
            username=username,
            defaults={
                'email': email,
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )
        user.set_password(password)
        user.save(using='default')

        # 2. Sync PlatformUser on 'default' database
        PlatformUser.objects.using('default').update_or_create(
            email=email,
            defaults={
                'password_hash': make_password(password, hasher='argon2'),
                'is_active': True,
            }
        )

        status_str = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"\nSuccessfully {status_str} Superadmin!"))
        self.stdout.write(f" - Username: {username}")
        self.stdout.write(f" - Email:    {email}")
        self.stdout.write(f" - Password: {password}")
        self.stdout.write(f" - Admin URL: /admin/\n")
