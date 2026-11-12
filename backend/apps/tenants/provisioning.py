"""
Tenant Provisioning Service for EduFlow ERP.
Coordinates physical database creation, schema migrations, and administrator seeding.
Used by both the create_tenant management command and the Django Admin interface.
"""

from urllib.parse import urlparse, unquote
from datetime import date
import logging
import re

from django.core.management import call_command
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.conf import settings

from apps.tenants.models import Institution, TenantRegistry
from apps.tenants.database import register_tenant_database
from apps.tenants.context import tenant_context
from apps.identity.models import User, Membership
from apps.academics.models import AcademicYear

logger = logging.getLogger('apps.tenants.provisioning')


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
    from psycopg import sql
    db_name = unquote(parsed.path.lstrip('/'))
    if not db_name:
        return

    maintenance_name = 'neondb' if 'neon.tech' in (parsed.hostname or '') else 'postgres'
    maintenance_url = db_url.replace(f"/{db_name}", f"/{maintenance_name}")

    try:
        with psycopg.connect(maintenance_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (db_name,))
                if not cur.fetchone():
                    cur.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(db_name)))
                    logger.info(f"Created PostgreSQL database '{db_name}' on server.")
    except Exception as e:
        logger.warning(f"Note on ensure_postgres_database for '{db_name}': {e}")


def derive_tenant_database_url(slug: str) -> str:
    """
    Derives an appropriate tenant database URL based on the control plane database settings.
    """
    control_cfg = settings.DATABASES.get('default', {})
    control_url = getattr(settings, 'CONTROL_DATABASE_URL', None)

    if control_url and ('postgresql' in control_url or 'postgres' in control_url):
        parsed = urlparse(control_url)
        curr_db = parsed.path.lstrip('/')
        new_db = f"eduflow_tenant_{slug}"
        return control_url.replace(f"/{curr_db}", f"/{new_db}")
    elif control_cfg.get('ENGINE') == 'django.db.backends.postgresql':
        host = control_cfg.get('HOST', 'localhost')
        port = control_cfg.get('PORT', '5432')
        user = control_cfg.get('USER', 'postgres')
        pw = control_cfg.get('PASSWORD', '')
        opts = control_cfg.get('OPTIONS', {})
        opt_str = f"?{'&'.join(f'{k}={v}' for k, v in opts.items())}" if opts else ''
        auth_part = f"{user}:{pw}@" if (user or pw) else ""
        return f"postgresql://{auth_part}{host}:{port}/eduflow_tenant_{slug}{opt_str}"
    else:
        sqlite_path = str(settings.BASE_DIR / f"eduflow_tenant_{slug}.sqlite3").replace('\\', '/')
        return f"sqlite:///{sqlite_path}"


def provision_new_tenant(
    slug: str,
    name: str,
    db_url: str = None,
    admin_email: str = None,
    admin_password: str = None,
    admin_username: str = None,
    admin_name: str = None,
    verbosity: int = 1
) -> dict:
    """
    Full vertical provisioning flow for an educational institution tenant:
    1. Validates slug.
    2. Guarantees uniqueness in Control DB.
    3. Derives and ensures physical database.
    4. Registers connection and runs migrations.
    5. Saves Institution and TenantRegistry in Control DB.
    6. Seeds AcademicYear and initial ADMIN user in tenant DB.
    Returns dictionary with details of the created resources.
    """
    clean_slug = slug.strip().lower()
    clean_name = name.strip()

    if not re.match(r'^[a-z0-9_-]+$', clean_slug):
        raise ValueError(f"Invalid slug '{clean_slug}'. Slugs must contain only lowercase letters, digits, hyphens, and underscores.")

    if Institution.objects.using('default').filter(slug=clean_slug).exists():
        raise ValueError(f"Institution with slug '{clean_slug}' already exists in Control Database.")

    effective_db_url = db_url or derive_tenant_database_url(clean_slug)
    effective_admin_email = admin_email or f"admin@{clean_slug}.edu"
    effective_admin_password = admin_password or "SchoolPass123!"
    effective_admin_username = admin_username or f"admin_{clean_slug}"
    effective_admin_name = admin_name or "School Administrator"

    # 1. Ensure Postgres database exists if on PostgreSQL
    ensure_postgres_database(effective_db_url)

    # 2. Register connection alias
    db_alias = f"tenant_{clean_slug}"
    register_tenant_database(db_alias, effective_db_url)

    # 3. Apply schema migrations
    logger.info(f"Applying tenant schema migrations to '{db_alias}'...")
    call_command('migrate', database=db_alias, interactive=False, verbosity=verbosity)

    # 4. Register Institution and Registry in Control DB
    with transaction.atomic(using='default'):
        institution = Institution.objects.using('default').create(
            slug=clean_slug,
            name=clean_name,
            status='ACTIVE',
            external_tenant_id=f"EXT-{clean_slug.upper()}-001"
        )
        provider = 'neon' if 'neon.tech' in effective_db_url else ('postgresql' if 'postgres' in effective_db_url else 'local')
        registry = TenantRegistry.objects.using('default').create(
            institution=institution,
            db_url=effective_db_url,
            provider=provider,
            status='ACTIVE'
        )

    # 5. Seed initial Academic Year and Admin User in tenant DB
    with tenant_context(db_alias, slug=clean_slug):
        with transaction.atomic(using=db_alias):
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

            password_hash = make_password(effective_admin_password, hasher='argon2')
            admin_user, _ = User.objects.using(db_alias).get_or_create(
                username=effective_admin_username,
                defaults={
                    'email': effective_admin_email,
                    'password_hash': password_hash,
                    'full_name': effective_admin_name,
                    'is_active': True,
                }
            )

            membership, _ = Membership.objects.using(db_alias).get_or_create(
                user=admin_user,
                defaults={
                    'role': 'ADMIN',
                    'status': 'ACTIVE',
                }
            )

    return {
        "institution": institution,
        "registry": registry,
        "admin_user": admin_user,
        "membership": membership,
        "admin_username": effective_admin_username,
        "admin_email": effective_admin_email,
        "db_alias": db_alias,
        "db_url": effective_db_url,
    }
