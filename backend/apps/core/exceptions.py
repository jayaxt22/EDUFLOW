"""
Error envelope and exception handling for EduFlow ERP.
Ensures consistent API error structures across all endpoints.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger('eduflow.errors')

def custom_exception_handler(exc, context):
    """
    Standardizes error responses into the EduFlow envelope:
    {
        "success": False,
        "error": {
            "code": "...",
            "message": "...",
            "details": {...}
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_code = getattr(exc, 'default_code', exc.__class__.__name__)
        if hasattr(exc, 'detail'):
            if isinstance(exc.detail, dict):
                first_msgs = []
                for k, v in exc.detail.items():
                    if isinstance(v, list) and v:
                        first_msgs.append(f"{k}: {v[0]}")
                    elif isinstance(v, str):
                        first_msgs.append(f"{k}: {v}")
                message = "; ".join(first_msgs) if first_msgs else "Validation or processing error"
                details = response.data
            elif isinstance(exc.detail, list):
                message = "; ".join(str(d) for d in exc.detail)
                details = {"errors": response.data}
            else:
                message = str(exc.detail)
                details = {}
        else:
            message = str(exc)
            details = response.data if isinstance(response.data, dict) else {"error": str(response.data)}

        custom_data = {
            "success": False,
            "error": {
                "code": str(error_code).upper(),
                "message": message,
                "details": details,
            }
        }
        response.data = custom_data
        return response

    # Unhandled exception
    view_name = context.get('view', 'unknown')
    logger.exception(f"Unhandled exception in view {view_name}: {exc}")
    return Response({
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected server error occurred.",
            "details": {}
        }
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
