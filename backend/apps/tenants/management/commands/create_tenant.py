"""
Management command to provision a new educational institution (tenant):
1. Ensures or creates physical database (PostgreSQL/Neon or SQLite).
2. Dynamically registers the tenant connection and runs domain migrations.
3. Creates Institution and TenantRegistry records in the Control DB (eduflow_control).
4. Creates initial current AcademicYear and root ADMIN user in the tenant database.
"""

from django.core.management.base import BaseCommand, CommandError
from apps.tenants.provisioning import provision_new_tenant


class Command(BaseCommand):
    help = 'Provisions a new tenant database, runs migrations, and registers the institution with an Admin user.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--slug',
            required=True,
            help='Unique slug for the institution (e.g. apex, horizon)'
        )
        parser.add_argument(
            '--name',
            required=True,
            help='Full display name of the institution (e.g. "Apex Academy")'
        )
        parser.add_argument(
            '--db_url',
            required=False,
            default=None,
            help='Database connection string. If omitted, automatically derived from active PostgreSQL or SQLite configuration.'
        )
        parser.add_argument(
            '--admin_email',
            required=False,
            default=None,
            help='Email address for the initial school Administrator (defaults to admin@<slug>.edu)'
        )
        parser.add_argument(
            '--admin_password',
            required=False,
            default=None,
            help='Password for the initial school Administrator (defaults to SchoolPass123!)'
        )
        parser.add_argument(
            '--admin_username',
            required=False,
            default=None,
            help='Username for the initial school Administrator (defaults to admin_<slug>)'
        )
        parser.add_argument(
            '--admin_name',
            required=False,
            default='School Administrator',
            help='Full name for the initial school Administrator'
        )

    def handle(self, *args, **options):
        slug = options['slug']
        name = options['name']
        db_url = options.get('db_url')
        admin_email = options.get('admin_email')
        admin_password = options.get('admin_password')
        admin_username = options.get('admin_username')
        admin_name = options.get('admin_name')

        self.stdout.write(self.style.MIGRATE_HEADING(f"=== Provisioning Tenant: {name} [{slug}] ==="))

        try:
            result = provision_new_tenant(
                slug=slug,
                name=name,
                db_url=db_url,
                admin_email=admin_email,
                admin_password=admin_password,
                admin_username=admin_username,
                admin_name=admin_name,
                verbosity=1
            )
        except Exception as e:
            raise CommandError(str(e))

        self.stdout.write(self.style.SUCCESS(f"\nSuccessfully provisioned tenant '{name}' [{slug}]!"))
        self.stdout.write(f" - Institution ID: {result['institution'].id}")
        self.stdout.write(f" - Database Alias: {result['db_alias']}")
        self.stdout.write(f" - Database Target: {result['db_url']}")
        self.stdout.write(f" - Initial Admin Username: {result['admin_username']}")
        self.stdout.write(f" - Initial Admin Email: {result['admin_email']}")
        self.stdout.write(f" - Initial Admin Password: {admin_password or 'SchoolPass123!'}")
        self.stdout.write("Use these credentials to sign in on the school's frontend portal.\n")
