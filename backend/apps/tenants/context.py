"""
Thread-safe context management for active tenant database routing.
"""

import contextvars
from typing import Optional

_current_tenant_db_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'current_tenant_db',
    default=None
)

_current_tenant_slug_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'current_tenant_slug',
    default=None
)

def get_current_tenant_db() -> Optional[str]:
    """Retrieve the database alias for the current request context."""
    return _current_tenant_db_var.get()

def set_current_tenant_db(db_alias: Optional[str]):
    """Set the database alias for the current request context."""
    return _current_tenant_db_var.set(db_alias)

def get_current_tenant_slug() -> Optional[str]:
    """Retrieve the slug for the active tenant."""
    return _current_tenant_slug_var.get()

def set_current_tenant_slug(slug: Optional[str]):
    """Set the active tenant slug."""
    return _current_tenant_slug_var.set(slug)

def reset_current_tenant(db_token, slug_token):
    """Reset context variables using tokens from set()."""
    if db_token is not None:
        _current_tenant_db_var.reset(db_token)
    if slug_token is not None:
        _current_tenant_slug_var.reset(slug_token)

class tenant_context:
    """
    Context manager to execute a code block under a specified tenant database context.
    Example:
        with tenant_context('tenant_horizon', slug='demo'):
            User.objects.all()
    """
    def __init__(self, db_alias: str, slug: Optional[str] = None):
        self.db_alias = db_alias
        self.slug = slug
        self.db_token = None
        self.slug_token = None

    def __enter__(self):
        self.db_token = set_current_tenant_db(self.db_alias)
        self.slug_token = set_current_tenant_slug(self.slug)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        reset_current_tenant(self.db_token, self.slug_token)
