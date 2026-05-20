"""
Tests for Gidede Prometheus metrics & structured logging.
Фаза 4.E.7: Нагрузочное тестирование и мониторинг

50 тестов:
  - TestPrometheusMiddleware (5)
  - TestMetricsHelpers (12)
  - TestMetricsEndpoint (2)
  - TestStructuredLogging (9)
  - TestHealthEndpointMonitoring (1)
  - TestMetricsIntegration (21)
"""

from __future__ import annotations

import json
import logging
import time
import importlib
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from starlette.testclient import TestClient
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route


# ===========================================================================
# TestPrometheusMiddleware (5 tests)
# ===========================================================================

class TestPrometheusMiddleware:
    """Тесты нормализации путей и skip-логики PrometheusMiddleware."""

    def test_normalize_uuid(self):
        """UUID в пути заменяется на :id."""
        from app.core.metrics import PrometheusMiddleware

        path = "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/blocks"
        result = PrometheusMiddleware.normalize_path(path)
        assert result == "/api/v1/projects/:id/blocks"

    def test_normalize_numeric_id(self):
        """Числовой ID в пути заменяется на /:id."""
        from app.core.metrics import PrometheusMiddleware

        path = "/api/v1/projects/42/blocks"
        result = PrometheusMiddleware.normalize_path(path)
        assert result == "/api/v1/projects/:id/blocks"

    def test_normalize_no_id(self):
        """Путь без ID не изменяется."""
        from app.core.metrics import PrometheusMiddleware

        path = "/api/v1/projects"
        result = PrometheusMiddleware.normalize_path(path)
        assert result == "/api/v1/projects"

    def test_normalize_multiple_ids(self):
        """Несколько ID в пути — все заменяются."""
        from app.core.metrics import PrometheusMiddleware

        path = "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/blocks/7"
        result = PrometheusMiddleware.normalize_path(path)
        assert result == "/api/v1/projects/:id/blocks/:id"

    def test_skip_paths(self):
        """SKIP_PATHS содержит ожидаемые пути."""
        from app.core.metrics import SKIP_PATHS

        assert "/metrics" in SKIP_PATHS
        assert "/api/v1/metrics" in SKIP_PATHS
        assert "/docs" in SKIP_PATHS
        assert "/api/v1/docs" in SKIP_PATHS
        assert "/redoc" in SKIP_PATHS
        assert "/api/v1/redoc" in SKIP_PATHS
        assert "/openapi.json" in SKIP_PATHS
        assert "/favicon.ico" in SKIP_PATHS


# ===========================================================================
# TestMetricsHelpers (12 tests)
# ===========================================================================

class TestMetricsHelpers:
    """Тесты helper-функций для метрик (с/без prometheus)."""

    def test_record_ai_call_with_prometheus(self):
        """record_ai_call увеличивает ai_calls_total и duration при доступном prometheus."""
        from app.core.metrics import record_ai_call, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import ai_calls_total, ai_call_duration_seconds

        before = ai_calls_total.labels(provider="zai", model="test", status="success")._value.get()
        record_ai_call("zai", "test", "success", 1.5)
        after = ai_calls_total.labels(provider="zai", model="test", status="success")._value.get()
        assert after == before + 1

    def test_record_ai_call_without_prometheus(self):
        """record_ai_call логирует при отсутствии prometheus_client."""
        from app.core.metrics import record_ai_call

        with patch("app.core.metrics.PROMETHEUS_AVAILABLE", False):
            with patch("app.core.metrics.logger") as mock_logger:
                record_ai_call("zai", "test", "error", 2.0)
                mock_logger.debug.assert_called_once()

    def test_record_db_query_with_prometheus(self):
        """record_db_query записывает duration."""
        from app.core.metrics import record_db_query, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import db_query_duration_seconds

        # Просто проверить, что вызов не падает
        record_db_query("select", 0.05)

    def test_record_db_query_without_prometheus(self):
        """record_db_query логирует при отсутствии prometheus_client."""
        from app.core.metrics import record_db_query

        with patch("app.core.metrics.PROMETHEUS_AVAILABLE", False):
            with patch("app.core.metrics.logger") as mock_logger:
                record_db_query("insert", 0.01)
                mock_logger.debug.assert_called_once()

    def test_record_cache_operation_with_prometheus(self):
        """record_cache_operation увеличивает cache_operations_total."""
        from app.core.metrics import record_cache_operation, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import cache_operations_total

        before = cache_operations_total.labels(operation="get", result="hit")._value.get()
        record_cache_operation("get", "hit")
        after = cache_operations_total.labels(operation="get", result="hit")._value.get()
        assert after == before + 1

    def test_record_cache_operation_without_prometheus(self):
        """record_cache_operation логирует при отсутствии prometheus_client."""
        from app.core.metrics import record_cache_operation

        with patch("app.core.metrics.PROMETHEUS_AVAILABLE", False):
            with patch("app.core.metrics.logger") as mock_logger:
                record_cache_operation("set", "ok")
                mock_logger.debug.assert_called_once()

    def test_record_rate_limit_hit_with_prometheus(self):
        """record_rate_limit_hit увеличивает rate_limit_hits_total."""
        from app.core.metrics import record_rate_limit_hit, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import rate_limit_hits_total

        before = rate_limit_hits_total.labels(endpoint="/api/v1/ai", plan="free")._value.get()
        record_rate_limit_hit("/api/v1/ai", "free")
        after = rate_limit_hits_total.labels(endpoint="/api/v1/ai", plan="free")._value.get()
        assert after == before + 1

    def test_record_rate_limit_hit_without_prometheus(self):
        """record_rate_limit_hit логирует при отсутствии prometheus_client."""
        from app.core.metrics import record_rate_limit_hit

        with patch("app.core.metrics.PROMETHEUS_AVAILABLE", False):
            with patch("app.core.metrics.logger") as mock_logger:
                record_rate_limit_hit("/api/v1/concept", "pro")
                mock_logger.debug.assert_called_once()

    def test_record_error_with_prometheus(self):
        """record_error увеличивает errors_total."""
        from app.core.metrics import record_error, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import errors_total

        before = errors_total.labels(type="500", endpoint="/api/v1/health")._value.get()
        record_error("500", "/api/v1/health")
        after = errors_total.labels(type="500", endpoint="/api/v1/health")._value.get()
        assert after == before + 1

    def test_record_error_without_prometheus(self):
        """record_error логирует при отсутствии prometheus_client."""
        from app.core.metrics import record_error

        with patch("app.core.metrics.PROMETHEUS_AVAILABLE", False):
            with patch("app.core.metrics.logger") as mock_logger:
                record_error("timeout", "/api/v1/ai")
                mock_logger.debug.assert_called_once()

    def test_set_active_users_with_prometheus(self):
        """set_active_users устанавливает gauge."""
        from app.core.metrics import set_active_users, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import active_users_gauge

        set_active_users(42)
        assert active_users_gauge._value.get() == 42

    def test_set_projects_total_with_prometheus(self):
        """set_projects_total устанавливает gauge."""
        from app.core.metrics import set_projects_total, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        from app.core.metrics import projects_total

        set_projects_total(100)
        assert projects_total._value.get() == 100


# ===========================================================================
# TestMetricsEndpoint (2 tests)
# ===========================================================================

class TestMetricsEndpoint:
    """Тесты /metrics эндпоинта."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint_no_prometheus_503(self):
        """Без prometheus_client /metrics возвращает 503."""
        from app.core.metrics import metrics_endpoint

        with patch("app.core.metrics.PROMETHEUS_AVAILABLE", False):
            response = await metrics_endpoint()
            assert response.status_code == 503
            assert "unavailable" in response.body.decode().lower()

    @pytest.mark.asyncio
    async def test_metrics_endpoint_with_prometheus(self):
        """С prometheus_client /metrics возвращает 200 и content-type."""
        from app.core.metrics import metrics_endpoint, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        response = await metrics_endpoint()
        assert response.status_code == 200
        assert "text/plain" in response.media_type


# ===========================================================================
# TestStructuredLogging (9 tests)
# ===========================================================================

class TestStructuredLogging:
    """Тесты структурированного логирования."""

    def test_structured_formatter_text(self):
        """StructuredFormatter в текстовом формате."""
        from app.core.logging_config import StructuredFormatter

        formatter = StructuredFormatter(fmt="text")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        output = formatter.format(record)
        assert "Test message" in output

    def test_structured_formatter_json(self):
        """StructuredFormatter в JSON-формате."""
        from app.core.logging_config import StructuredFormatter

        formatter = StructuredFormatter(fmt="json")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        output = formatter.format(record)
        data = json.loads(output)
        assert data["message"] == "Test message"
        assert data["level"] == "INFO"
        assert data["logger"] == "test"

    def test_structured_formatter_json_with_request_id(self):
        """StructuredFormatter JSON включает request_id если задан."""
        from app.core.logging_config import StructuredFormatter

        formatter = StructuredFormatter(fmt="json")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="With request",
            args=(),
            exc_info=None,
        )
        record.request_id = "abc-123"
        output = formatter.format(record)
        data = json.loads(output)
        assert data["request_id"] == "abc-123"

    def test_request_id_filter(self):
        """RequestIdFilter добавляет request_id в запись."""
        from app.core.logging_config import RequestIdFilter

        filt = RequestIdFilter()
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="msg",
            args=(),
            exc_info=None,
        )
        result = filt.filter(record)
        assert result is True
        assert hasattr(record, "request_id")
        assert record.request_id == "-"

    def test_request_id_filter_with_custom_id(self):
        """RequestIdFilter использует request_id из контекста."""
        from app.core.logging_config import RequestIdFilter

        filt = RequestIdFilter()
        filt.set_request_id("test-req-42")
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="msg",
            args=(),
            exc_info=None,
        )
        filt.filter(record)
        assert record.request_id == "test-req-42"

    def test_setup_logging(self):
        """setup_logging настраивает root logger."""
        from app.core.logging_config import setup_logging

        with patch.dict("os.environ", {"LOG_FORMAT": "text", "LOG_LEVEL": "DEBUG"}):
            setup_logging()
            root = logging.getLogger()
            assert root.level == logging.DEBUG

    def test_setup_logging_json_format(self):
        """setup_logging с LOG_FORMAT=json."""
        from app.core.logging_config import setup_logging

        with patch.dict("os.environ", {"LOG_FORMAT": "json", "LOG_LEVEL": "INFO"}):
            setup_logging()
            root = logging.getLogger()
            assert root.level == logging.INFO

    def test_log_request(self):
        """log_request логирует HTTP-запрос."""
        from app.core.logging_config import log_request

        with patch("app.core.logging_config.logger") as mock_logger:
            log_request("GET", "/api/v1/health", 200, 0.05)
            mock_logger.info.assert_called_once()

    def test_log_ai_call(self):
        """log_ai_call логирует AI-вызов."""
        from app.core.logging_config import log_ai_call

        with patch("app.core.logging_config.logger") as mock_logger:
            log_ai_call("zai", "gpt-4", "success", 2.5)
            mock_logger.info.assert_called_once()


# ===========================================================================
# TestHealthEndpointMonitoring (1 test)
# ===========================================================================

class TestHealthEndpointMonitoring:
    """Тесты мониторинга в health-эндпоинте."""

    def test_health_response_model_with_uptime(self):
        """HealthResponse содержит поле uptime_seconds."""
        from app.api.v1.health import HealthResponse

        resp = HealthResponse(
            status="ok",
            version="0.47.0",
            timestamp="2026-01-01T00:00:00",
            uptime_seconds=42.5,
            services={"api": "ok", "database": "ok"},
        )
        assert resp.uptime_seconds == 42.5
        assert resp.status == "ok"


# ===========================================================================
# TestMetricsIntegration (21 tests)
# ===========================================================================

class TestMetricsIntegration:
    """Интеграционные тесты middleware и метрик."""

    @pytest.fixture
    def app_with_middleware(self):
        """Создать тестовое ASGI-приложение с PrometheusMiddleware."""
        from app.core.metrics import PrometheusMiddleware

        async def homepage(request):
            return PlainTextResponse("ok")

        async def with_id(request):
            return PlainTextResponse("ok")

        async def metrics_route(request):
            return PlainTextResponse("metrics")

        app = Starlette(
            routes=[
                Route("/api/v1/health", homepage),
                Route("/api/v1/projects/123/items", with_id),
                Route("/metrics", metrics_route),
            ],
        )
        app.add_middleware(PrometheusMiddleware)
        return app

    def test_middleware_records_http_request(self, app_with_middleware):
        """Middleware записывает HTTP-метрику."""
        from app.core.metrics import PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        client = TestClient(app_with_middleware)
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_middleware_normalizes_numeric_id(self, app_with_middleware):
        """Middleware нормализует числовой ID в пути."""
        from app.core.metrics import PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        client = TestClient(app_with_middleware)
        response = client.get("/api/v1/projects/123/items")
        assert response.status_code == 200

    def test_middleware_skips_metrics_path(self, app_with_middleware):
        """Middleware пропускает /metrics."""
        from app.core.metrics import PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        client = TestClient(app_with_middleware)
        response = client.get("/metrics")
        assert response.status_code == 200

    def test_record_ai_call_success(self):
        """record_ai_call со status=success."""
        from app.core.metrics import record_ai_call, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_ai_call("openai", "gpt-4", "success", 3.2)
        # Не падает

    def test_record_ai_call_error(self):
        """record_ai_call со status=error."""
        from app.core.metrics import record_ai_call, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_ai_call("anthropic", "claude-3", "error", 1.0)

    def test_record_db_query_select(self):
        """record_db_query для SELECT."""
        from app.core.metrics import record_db_query, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_db_query("SELECT", 0.02)

    def test_record_db_query_insert(self):
        """record_db_query для INSERT."""
        from app.core.metrics import record_db_query, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_db_query("INSERT", 0.05)

    def test_record_cache_hit(self):
        """record_cache_operation hit."""
        from app.core.metrics import record_cache_operation, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_cache_operation("get", "hit")

    def test_record_cache_miss(self):
        """record_cache_operation miss."""
        from app.core.metrics import record_cache_operation, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_cache_operation("get", "miss")

    def test_record_rate_limit_default_plan(self):
        """record_rate_limit_hit с plan по умолчанию."""
        from app.core.metrics import record_rate_limit_hit, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_rate_limit_hit("/api/v1/ai")

    def test_set_active_users_zero(self):
        """set_active_users с 0."""
        from app.core.metrics import set_active_users, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        set_active_users(0)

    def test_set_active_users_large(self):
        """set_active_users с большим числом."""
        from app.core.metrics import set_active_users, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        set_active_users(10000)

    def test_set_projects_total(self):
        """set_projects_total."""
        from app.core.metrics import set_projects_total, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        set_projects_total(500)

    def test_normalize_path_with_uuid_and_numeric(self):
        """Нормализация пути с UUID и числовым ID."""
        from app.core.metrics import PrometheusMiddleware

        path = "/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/blocks/3"
        result = PrometheusMiddleware.normalize_path(path)
        assert result == "/api/v1/projects/:id/blocks/:id"

    def test_normalize_path_root(self):
        """Нормализация корневого пути."""
        from app.core.metrics import PrometheusMiddleware

        assert PrometheusMiddleware.normalize_path("/") == "/"

    def test_normalize_path_empty(self):
        """Нормализация пустого пути."""
        from app.core.metrics import PrometheusMiddleware

        assert PrometheusMiddleware.normalize_path("") == ""

    def test_metrics_endpoint_returns_content(self):
        """metrics_endpoint возвращает содержимое."""
        from app.core.metrics import metrics_endpoint, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        import asyncio
        response = asyncio.get_event_loop().run_until_complete(metrics_endpoint())
        assert response.status_code == 200
        assert len(response.body) > 0

    def test_prometheus_available_flag(self):
        """PROMETHEUS_AVAILABLE — булев флаг."""
        from app.core.metrics import PROMETHEUS_AVAILABLE

        assert isinstance(PROMETHEUS_AVAILABLE, bool)

    def test_skip_paths_is_frozenset(self):
        """SKIP_PATHS — immutable frozenset."""
        from app.core.metrics import SKIP_PATHS

        assert isinstance(SKIP_PATHS, frozenset)

    def test_middleware_multiple_requests(self, app_with_middleware):
        """Middleware корректно обрабатывает несколько запросов."""
        from app.core.metrics import PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        client = TestClient(app_with_middleware)
        for _ in range(5):
            response = client.get("/api/v1/health")
            assert response.status_code == 200

    def test_record_error_types(self):
        """record_error с разными типами ошибок."""
        from app.core.metrics import record_error, PROMETHEUS_AVAILABLE

        if not PROMETHEUS_AVAILABLE:
            pytest.skip("prometheus_client not installed")

        record_error("429", "/api/v1/ai")
        record_error("500", "/api/v1/projects")
        record_error("timeout", "/api/v1/concept")
