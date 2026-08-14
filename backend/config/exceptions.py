from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


def villaone_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    request = context.get("request")
    original = response.data
    if isinstance(original, dict):
        detail = original.get("detail", original)
        field_errors = {key: value for key, value in original.items() if key != "detail"}
    else:
        detail = original
        field_errors = {}
    if isinstance(detail, (list, dict)):
        human_detail = detail
    else:
        human_detail = str(detail)
    default_code = getattr(exc, "default_code", "api_error")
    compatibility_fields = original if isinstance(original, dict) else {}
    response.data = {
        **compatibility_fields,
        "detail": human_detail,
        "code": default_code,
        "field_errors": field_errors,
        "request_id": getattr(request, "request_id", ""),
        "retryable": response.status_code >= 500,
    }
    return response
