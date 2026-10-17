import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("fraudgraph.api")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Structured request logging middleware.
    Tracks HTTP method, URL path, client IP, response status code, and latency in milliseconds.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                f"{request.method} {request.url.path} | Status: {response.status_code} | "
                f"Latency: {duration_ms:.2f}ms | Client: {client_ip}"
            )
            response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"
            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"{request.method} {request.url.path} | EXCEPTION: {exc} | "
                f"Latency: {duration_ms:.2f}ms | Client: {client_ip}",
                exc_info=True,
            )
            raise exc
