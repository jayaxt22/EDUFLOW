"""
Logging and audit utilities for EduFlow ERP.
"""

import logging
from typing import Any, Optional

audit_logger = logging.getLogger('eduflow.audit')

def log_audit_event(
    action: str,
    actor_id: Optional[str] = None,
    tenant_slug: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
):
    """
    Standard audit log entry for write operations.
    """
    event_data = {
        "action": action,
        "actor_id": str(actor_id) if actor_id else "SYSTEM",
        "tenant_slug": tenant_slug or "UNKNOWN",
        "target_type": target_type or "GENERAL",
        "target_id": str(target_id) if target_id else None,
        "details": details or {},
    }
    audit_logger.info(f"AUDIT_EVENT: {event_data}")
    return event_data
