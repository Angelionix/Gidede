"""
Prometheus metrics middleware for Gidede API.
Фаза 4.E.7: Нагрузочное тестирование и мониторинг

Grafful degradation: если prometheus_client не установлен — метрики
записываются в лог, эндпоинт /metrics возвращает 503.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("gidede.metrics")

# ---------------------------------------------------------------------------
# Попытка импорта prometheus_client
# ---------------------------------------------------------------------------
try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        generate_latest,
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
    )

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client не установлен — метрики будут записываться в лог")

# ---------------------------------------------------------------------------
# Пропускаемые пути (не считаем метрики для этих эндпоинтов)
# ---------------------------------------------------------------------------
SKIP_PATHS = frozenset({
    "/metrics",
    "/api/v1/metrics",
    "/docs",
    "/api/v1/docs",
    "/redoc",
    "/api/v1/redoc",
    "/openapi.json",
    "/api/v1/openapi.json",
    "/favicon.ico",
})

# ---------------------------------------------------------------------------
# Registry (isolated, чтобы не конфликтовать с другими приложениями)
# ---------------------------------------------------------------------------
REGISTRY = CollectorRegistry() if PROMETHEUS_AVAILABLE else None

# ---------------------------------------------------------------------------
# Метрики (11 штук)
# ---------------------------------------------------------------------------
if PROMETHEUS_AVAILABLE:
    # 1. HTTP Request Total
    http_requests_total = Counter(
        "http_requests_total",
        "Total count of HTTP requests",
        ["method", "endpoint", "status_code"],
        registry=REGISTRY,
    )

    # 2. HTTP Request Duration
    http_request_duration_seconds = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency in seconds",
        ["method", "endpoint"],
        buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
        registry=REGISTRY,
    )

    # 3. AI Calls Total
    ai_calls_total = Counter(
        "ai_calls_total",
        "Total count of AI service calls",
        ["provider", "model", "status"],
        registry=REGISTRY,
    )

    # 4. AI Call Duration
    ai_call_duration_seconds = Histogram(
        "ai_call_duration_seconds",
        "AI call latency in seconds",
        ["provider", "model"],
        buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
        registry=REGISTRY,
    )

    # 5. DB Query Duration
    db_query_duration_seconds = Histogram(
        "db_query_duration_seconds",
        "Database query latency in seconds",
        ["operation"],
        buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0),
        registry=REGISTRY,
    )

    # 6. Active Users Gauge
    active_users_gauge = Gauge(
        "active_users_gauge",
        "Number of currently active users",
        registry=REGISTRY,
    )

    # 7. Rate Limit Hits
    rate_limit_hits_total = Counter(
        "rate_limit_hits_total",
        "Total count of rate limit hits",
        ["endpoint", "plan"],
        registry=REGISTRY,
    )

    # 8. Cache Operations
    cache_operations_total = Counter(
        "cache_operations_total",
        "Total count of cache operations",
        ["operation", "result"],
        registry=REGISTRY,
    )

    # 9. Projects Total
    projects_total = Gauge(
        "projects_total",
        "Total number of projects",
        registry=REGISTRY,
    )

    # 10. Errors Total
    errors_total = Counter(
        "errors_total",
        "Total count of errors",
        ["type", "endpoint"],
        registry=REGISTRY,
    )

    # 11. HTTP Request Duration — histogram для p95/p99
    # (уже определён выше как http_request_duration_seconds)


# ---------------------------------------------------------------------------
# PrometheusMiddleware
# ---------------------------------------------------------------------------

# Шаблоны для нормализации путей
_UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)
_NUMERIC_ID_RE = re.compile(r"/\d+(\b|$)")


class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    ASGI middleware: собирает HTTP-метрики для каждого запроса.

    - Нормализует UUID и числовые ID в путях
    - Пропускает /metrics, /docs, /redoc, /openapi.json, /favicon.ico
    """

    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)

    @staticmethod
    def normalize_path(path: str) -> str:
        """Заменить UUID и числовые ID на плейсхолдеры."""
        # Заменить UUID
        path = _UUID_RE.sub(":id", path)
        # Заменить числовые ID
        path = _NUMERIC_ID_RE.sub("/:id", path)
        return path

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Проверить, нужно ли пропустить путь
        path = request.url.path
        if path in SKIP_PATHS or any(path.startswith(p) for p in ("/docs", "/redoc", "/openapi")):
            return await call_next(request)

        # Нормализовать путь
        normalized_path = self.normalize_path(path)
        method = request.method

        # Засечь время
        start_time = time.perf_counter()

        # Вызвать следующий middleware / handler
        response = await call_next(request)

        # Вычислить длительность
        duration = time.perf_counter() - start_time
        status_code = str(response.status_code)

        # Записать метрики
        if PROMETHEUS_AVAILABLE:
            http_requests_total.labels(
                method=method,
                endpoint=normalized_path,
                status_code=status_code,
            ).inc()
            http_request_duration_seconds.labels(
                method=method,
                endpoint=normalized_path,
            ).observe(duration)
        else:
            logger.debug(
                "HTTP %s %s → %s (%.3fs)",
                method,
                normalized_path,
                status_code,
                duration,
            )

        return response


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def record_ai_call(provider: str, model: str, status: str, duration: float) -> None:
    """Записать метрику AI-вызова."""
    if PROMETHEUS_AVAILABLE:
        ai_calls_total.labels(provider=provider, model=model, status=status).inc()
        ai_call_duration_seconds.labels(provider=provider, model=model).observe(duration)
    else:
        logger.debug("AI call: %s/%s status=%s %.3fs", provider, model, status, duration)


def record_db_query(operation: str, duration: float) -> None:
    """Записать метрику DB-запроса."""
    if PROMETHEUS_AVAILABLE:
        db_query_duration_seconds.labels(operation=operation).observe(duration)
    else:
        logger.debug("DB query: %s %.3fs", operation, duration)


def record_cache_operation(operation: str, result: str) -> None:
    """Записать метрику кэш-операции (hit/miss/set/delete)."""
    if PROMETHEUS_AVAILABLE:
        cache_operations_total.labels(operation=operation, result=result).inc()
    else:
        logger.debug("Cache: %s result=%s", operation, result)


def record_rate_limit_hit(endpoint: str, plan: str = "free") -> None:
    """Записать метрику попадания в rate limit."""
    if PROMETHEUS_AVAILABLE:
        rate_limit_hits_total.labels(endpoint=endpoint, plan=plan).inc()
    else:
        logger.debug("Rate limit hit: %s plan=%s", endpoint, plan)


def record_error(error_type: str, endpoint: str = "unknown") -> None:
    """Записать метрику ошибки."""
    if PROMETHEUS_AVAILABLE:
        errors_total.labels(type=error_type, endpoint=endpoint).inc()
    else:
        logger.debug("Error: type=%s endpoint=%s", error_type, endpoint)


def set_active_users(count: int) -> None:
    """Установить gauge активных пользователей."""
    if PROMETHEUS_AVAILABLE:
        active_users_gauge.set(count)
    else:
        logger.debug("Active users: %d", count)


def set_projects_total(count: int) -> None:
    """Установить gauge общего числа проектов."""
    if PROMETHEUS_AVAILABLE:
        projects_total.set(count)
    else:
        logger.debug("Projects total: %d", count)


# ---------------------------------------------------------------------------
# Metrics endpoint
# ---------------------------------------------------------------------------

async def metrics_endpoint() -> Response:
    """
    Асинхронный эндпоинт для отдачи Prometheus-метрик.

    Возвращает 503, если prometheus_client не установлен.
    """
    if not PROMETHEUS_AVAILABLE:
        return Response(
            content="Prometheus metrics unavailable: prometheus_client not installed",
            status_code=503,
            media_type="text/plain",
        )

    content = generate_latest(registry=REGISTRY)
    return Response(content=content, media_type=CONTENT_TYPE_LATEST)
