import json
import logging
import time
import uuid


request_logger = logging.getLogger("villaone.request")


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID", "")[:80] or str(uuid.uuid4())
        request.request_id = request_id
        started = time.monotonic()
        response = self.get_response(request)
        duration_ms = int((time.monotonic() - started) * 1000)
        response["X-Request-ID"] = request_id
        request_logger.info(
            "request completed",
            extra={
                "event": "http_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "actor_id": getattr(getattr(request, "user", None), "pk", None),
            },
        )
        return response


class JsonFormatter(logging.Formatter):
    SAFE_FIELDS = ("event", "request_id", "method", "path", "status_code", "duration_ms", "actor_id", "task_name", "processed_count")

    def format(self, record):
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in self.SAFE_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False)
