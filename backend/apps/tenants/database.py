"""
Dynamic database connection management for project-per-tenant architecture.
"""

from urllib.parse import urlparse, unquote, parse_qs
from django.db import connections
from pathlib import Path
import os
import logging

logger = logging.getLogger('apps.tenants')

def parse_db_url(url: str, base_dir=None) -> dict:
    """
    Parses database URL into Django DATABASES settings format.
    Supports postgresql:// and sqlite:/// schemes.
    """
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()

    base_defaults = {
        'ATOMIC_REQUESTS': False,
        'AUTOCOMMIT': True,
        'CONN_MAX_AGE': 0,
        'CONN_HEALTH_CHECKS': False,
        'OPTIONS': {},
        'TIME_ZONE': None,
    }

    if scheme in ('postgresql', 'postgres'):
        options = {}
        if parsed.query:
            for k, v in parse_qs(parsed.query).items():
                options[k] = v[0]
        config = {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(parsed.path.lstrip('/')),
            'USER': unquote(parsed.username) if parsed.username else '',
            'PASSWORD': unquote(parsed.password) if parsed.password else '',
            'HOST': parsed.hostname or 'localhost',
            'PORT': str(parsed.port or 5432),
            'CONN_MAX_AGE': 600,
            'OPTIONS': options,
        }
    elif scheme in ('sqlite', 'sqlite3'):
        # sqlite:///absolute/path or sqlite://./relative/path
        db_path = parsed.path.lstrip('/') if parsed.netloc == '' else f"{parsed.netloc}{parsed.path}"
        if not db_path:
            db_path = ':memory:'
        elif db_path != ':memory:' and not os.path.isabs(db_path):
            target_dir = base_dir
            if not target_dir:
                try:
                    from django.conf import settings
                    target_dir = settings.BASE_DIR
                except Exception:
                    target_dir = Path(__file__).resolve().parent.parent.parent
            db_path = str(Path(target_dir) / db_path)
        config = {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': db_path,
        }
    else:
        raise ValueError(f"Unsupported database scheme: {scheme}")

    return {**base_defaults, **config}

def register_tenant_database(db_alias: str, db_url: str):
    """
    Registers a tenant database in django.db.connections.databases if not already present.
    """
    if db_alias in connections.databases:
        return

    db_config = parse_db_url(db_url)
    connections.databases[db_alias] = db_config
    logger.info(f"Registered tenant database connection '{db_alias}' -> {db_config['ENGINE']}")
