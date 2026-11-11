"""
Management command to provision a new educational institution (tenant):
1. Ensures or creates physical database (PostgreSQL/Neon or SQLite).
2. Dynamically registers the tenant connection and runs domain migrations.
3. Creates Institution and TenantRegistry records in the Control DB (eduflow_control).
4. Creates initial current AcademicYear and root ADMIN user in the tenant database.
"""

from urllib.parse import urlparse, unquote
from datetime import date
from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.conf import settings
import logging

from apps.tenants.models import Institution, TenantRegistry
from apps.tenants.database import register_tenant_database, parse_db_url
from apps.tenants.context import tenant_context
from apps.identity.models import User, Membership
from apps.academics.models import AcademicYear

logger = logging.getLogger('apps.tenants.create_tenant')


def ensure_postgres_database(db_url: str):
    """
    If db_url is PostgreSQL, connects to the server's default/maintenance database
    and creates the target database if it does not yet exist.
    """
    parsed = urlparse(db_url)
    scheme = parsed.scheme.lower()
    if scheme not in ('postgresql', 'postgres'):
        return

    import psycopg
    db_name = unquote(parsed.path.lstrip('/'))
    if not db_name:
        return

    # Connect to 'postgres' or 'neondb' maintenance database to check/create
    maintenance_name = 'neondb' if 'neon.tech' in parsed.hostname else 'postgres'
    maintenance_url = db_url.replace(f"/{db_name}", f"/{maintenance_name}")

    try:
        with psycopg.connect(maintenance_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (db_name,))
                if not cur.fetchone():
                    cur.execute(f'CREATE DATABASE "{db_name}";')
                    logger.info(f"Created PostgreSQL database '{db_name}' on server.")
    except Exception as e:
        logger.warning(f"Note on ensure_postgres_database for '{db_name}': {e}")


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
        slug = options['slug'].strip().lower()
        name = options['name'].strip()
        db_url = options.get('db_url')
        admin_email = options.get('admin_email') or f"admin@{slug}.edu"
        admin_password = options.get('admin_password') or "SchoolPass123!"
        admin_username = options.get('admin_username') or f"admin_{slug}"
        admin_name = options.get('admin_name')

        self.stdout.write(self.style.MIGRATE_HEADING(f"=== Provisioning Tenant: {name} [{slug}] ==="))

        # 1. Guard against duplicate slug in Control DB
        if Institution.objects.using('default').filter(slug=slug).exists():
            raise CommandError(f"Institution with slug '{slug}' already exists in Control Database.")

        # 2. Derive database URL if not explicitly provided
        if not db_url:
            control_cfg = settings.DATABASES.get('default', {})
            control_url = getattr(settings, 'CONTROL_DATABASE_URL', None)

            if control_url and ('postgresql' in control_url or 'postgres' in control_url):
                # Derive tenant url from control url
                parsed = urlparse(control_url)
                curr_db = parsed.path.lstrip('/')
                new_db = f"eduflow_tenant_{slug}"
                db_url = control_url.replace(f"/{curr_db}", f"/{new_db}")
            elif control_cfg.get('ENGINE') == 'django.db.backends.postgresql':
                host = control_cfg.get('HOST', 'localhost')
                port = control_cfg.get('PORT', '5432')
                user = control_cfg.get('USER', 'postgres')
                pw = control_cfg.get('PASSWORD', '')
                opts = control_cfg.get('OPTIONS', {})
                opt_str = f"?{'&'.join(f'{k}={v}' for k, v in opts.items())}" if opts else ''
                auth_part = f"{user}:{pw}@" if (user or pw) else ""
                db_url = f"postgresql://{auth_part}{host}:{port}/eduflow_tenant_{slug}{opt_str}"
            else:
                # Local SQLite fallback
                sqlite_path = str(settings.BASE_DIR / f"eduflow_tenant_{slug}.sqlite3").replace('\\', '/')
                db_url = f"sqlite:///{sqlite_path}"

        self.stdout.write(f"1. Database Target: {db_url}")

        # 3. Ensure database exists on server (for PostgreSQL)
        ensure_postgres_database(db_url)

        # 4. Register connection alias in Django connection pool
        db_alias = f"tenant_{slug}"
        register_tenant_database(db_alias, db_url)
        self.stdout.write(f"2. Registered connection alias: '{db_alias}'")

        # 5. Run migrations against tenant database
        self.stdout.write(f"3. Applying tenant schema migrations to '{db_alias}'...")
        try:
            call_command('migrate', database=db_alias, interactive=False, verbosity=1)
        except Exception as e:
            raise CommandError(f"Failed migrating tenant database '{db_alias}': {e}")

        # 6. Register Institution and TenantRegistry in Control DB
        self.stdout.write("4. Registering Institution in Control Plane (eduflow_control)...")
        with transaction.atomic(using='default'):
            institution = Institution.objects.using('default').create(
                slug=slug,
                name=name,
                status='ACTIVE',
                external_tenant_id=f"EXT-{slug.upper()}-001"
            )
            provider = 'neon' if 'neon.tech' in db_url else ('postgresql' if 'postgres' in db_url else 'local')
            registry = TenantRegistry.objects.using('default').create(
                institution=institution,
                db_url=db_url,
                provider=provider,
                status='ACTIVE'
            )
            self.stdout.write(f"   - Institution ID: {institution.id}")
            self.stdout.write(f"   - Tenant Registry ID: {registry.id} [{provider}]")

        # 7. Seed initial Academic Year and Admin User in new tenant database
        self.stdout.write(f"5. Seeding initial Administrator in tenant database '{db_alias}'...")
        with tenant_context(db_alias, slug=slug):
            with transaction.atomic(using=db_alias):
                # Academic Year
                today = date.today()
                start_year = today.year if today.month >= 4 else today.year - 1
                acad_year, _ = AcademicYear.objects.using(db_alias).get_or_create(
                    name=f"{start_year}-{start_year + 1}",
                    defaults={
                        'start_date': date(start_year, 4, 1),
                        'end_date': date(start_year + 1, 3, 31),
                        'is_current': True,
                    }
                )

                # Administrator User & Membership
                password_hash = make_password(admin_password, hasher='argon2')
                admin_user, _ = User.objects.using(db_alias).get_or_create(
                    email=admin_email,
                    defaults={
                        'username': admin_username,
                        'full_name': admin_name,
                        'password_hash': password_hash,
                        'is_active': True,
                    }
                )
                admin_membership, _ = Membership.objects.using(db_alias).get_or_create(
                    user=admin_user,
                    defaults={
                        'role': 'ADMIN',
                        'status': 'ACTIVE',
                    }
                )

        self.stdout.write(self.style.SUCCESS(f"\n[SUCCESS] Tenant '{name}' ({slug}) successfully provisioned!"))
        self.stdout.write(f"   - Slug: {slug}")
        self.stdout.write(f"   - Database Alias: {db_alias}")
        self.stdout.write(f"   - Academic Year: {acad_year.name}")
        self.stdout.write(f"   - Admin User: {admin_user.full_name} ({admin_user.username} / {admin_user.email})")
        self.stdout.write(f"   - Admin Password: {admin_password}")
