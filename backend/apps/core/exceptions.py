"""
Error envelope and exception handling for EduFlow ERP.
Ensures consistent API error structures across all endpoints.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from django.core.exceptions import ValidationError as DjangoValidationError
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

    # Handle database uniqueness / integrity constraint violations
    if isinstance(exc, IntegrityError):
        raw_msg = str(exc)
        lower_msg = raw_msg.lower()
        field = 'non_field_errors'
        friendly_msg = "A record with this identifier or unique value already exists."

        if 'email' in lower_msg:
            field = 'email'
            friendly_msg = "A user with this email address already exists."
        elif 'username' in lower_msg:
            field = 'username'
            friendly_msg = "This username is already taken."
        elif 'admission_number' in lower_msg:
            field = 'admission_number'
            friendly_msg = "This admission number is already assigned to another student."
        elif 'employee_id' in lower_msg:
            field = 'employee_id'
            friendly_msg = "This employee ID is already assigned."
        elif 'roll_number' in lower_msg:
            field = 'roll_number'
            friendly_msg = "This roll number is already assigned in this class or section."
        elif 'foreign key' in lower_msg:
            friendly_msg = "Referenced related entity does not exist."

        logger.warning(f"IntegrityError intercepted: {raw_msg} -> 400 Bad Request ({field}: {friendly_msg})")
        return Response({
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": friendly_msg,
                "details": {field: [friendly_msg]}
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    # Handle Django model validation errors
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            details = exc.message_dict
            message = "; ".join(f"{k}: {', '.join(v)}" for k, v in details.items())
        elif hasattr(exc, 'messages'):
            details = {"non_field_errors": list(exc.messages)}
            message = "; ".join(exc.messages)
        else:
            details = {"non_field_errors": [str(exc)]}
            message = str(exc)

        return Response({
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": message,
                "details": details
            }
        }, status=status.HTTP_400_BAD_REQUEST)

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
