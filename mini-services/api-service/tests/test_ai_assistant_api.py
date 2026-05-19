"""
Gidede — Тесты AI Assistant API Endpoints
Блок 7: Полный набор тестов для всех эндпоинтов AI-ассистента

Тестирует:
- POST /chat           — чат с AI-ассистентом
- POST /chat/stream    — SSE streaming чат
- GET  /suggestions    — контекстные подсказки для блока
- GET  /alerts         — проактивные уведомления
- GET  /history        — история чата
- POST /history/clear  — очистить историю
- GET  /status         — статус AI-сервиса (публичный)
- POST /test           — тест AI-подключения
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.ai_assistant_service import (
    AIAssistantService,
    ChatMessageRecord,
    ProactiveAlert,
    ContextualSuggestion,
)


# ============================================================
# Helper: create a mocked AIAssistantService
# ============================================================

def _make_mock_service():
    """Создать мок AIAssistantService с преднастроенными методами."""
    service = AsyncMock(spec=AIAssistantService)

    # chat() → dict
    service.chat.return_value = {
        "reply": "Test AI response",
        "model_used": "test-model",
        "provider": "test",
        "sources": [{"title": "MDA Framework", "relevance": 0.9}],
        "suggestions": ["Попробуйте добавить механику крафта"],
        "latency_ms": 150,
        "from_cache": False,
    }

    # chat_stream() → async generator
    async def _stream_chunks(*args, **kwargs):
        chunks = [
            '{"type": "message", "content": "Hello"}',
            '{"type": "message", "content": " from AI"}',
            '{"type": "done", "latency_ms": 100, "model_used": "test-model", "provider": "test"}',
        ]
        for chunk in chunks:
            yield chunk

    service.chat_stream.side_effect = _stream_chunks

    # generate_suggestions() → list of ContextualSuggestion
    service.generate_suggestions.return_value = [
        ContextualSuggestion(
            block_id=1,
            title="Определить жанр",
            description="Начните с выбора жанра игры",
            action="generate",
            priority="high",
        ),
        ContextualSuggestion(
            block_id=1,
            title="Добавить механику",
            description="Добавьте ключевую механику",
            action="review",
            priority="medium",
        ),
    ]

    # check_proactive_alerts() → list of ProactiveAlert
    service.check_proactive_alerts.return_value = [
        ProactiveAlert(
            id="alert-1",
            alert_type="runaway",
            severity="critical",
            block_id=5,
            title="Runaway в экономике",
            description="Обнаружен экспоненциальный рост валюты",
            suggestion="Увеличьте cost-компоненту в экономике",
        ),
    ]

    # get_chat_history() → list of ChatMessageRecord
    service.get_chat_history.return_value = [
        ChatMessageRecord(
            id="msg-1",
            role="user",
            content="Привет!",
            timestamp=1700000000.0,
            metadata={},
        ),
        ChatMessageRecord(
            id="msg-2",
            role="assistant",
            content="Здравствуйте! Чем могу помочь?",
            timestamp=1700000001.0,
            metadata={"model": "test-model"},
        ),
    ]

    # manage_session() → ChatSession mock
    from app.services.ai_assistant_service import ChatSession
    service.manage_session.return_value = ChatSession(
        session_id="test-session",
        user_id="test_user_id",
        project_id=None,
    )

    return service


# ============================================================
# Fixture: test app with mocked auth
# ============================================================

@pytest_asyncio.fixture
async def authed_client(test_app):
    """HTTP-клиент с замоканной авторизацией (без реальной БД)."""
    from httpx import AsyncClient, ASGITransport
    from app.core.auth_middleware import get_current_active_user
    from app.models.db import User

    # Создать мок-пользователя
    mock_user = User(
        id="test_user_id",
        email="test@gidede.com",
        name="Test User",
        hashed_password="mock_hash",
        plan="free",
    )

    # Переопределить зависимость авторизации
    async def override_auth():
        return mock_user

    test_app.dependency_overrides[get_current_active_user] = override_auth

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    test_app.dependency_overrides.pop(get_current_active_user, None)


# ============================================================
# TestChatEndpoint
# ============================================================

class TestChatEndpoint:
    """Тесты POST /api/v1/ai/chat"""

    @pytest.mark.asyncio
    async def test_chat_success(self, authed_client):
        """POST /chat с валидным сообщением → 200 + ChatResponse."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.post(
                "/api/v1/ai/chat",
                json={"message": "Расскажи про MDA Framework"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert data["reply"] == "Test AI response"
        assert data["model_used"] == "test-model"
        assert data["provider"] == "test"
        assert isinstance(data["sources"], list)
        assert isinstance(data["suggestions"], list)
        assert data["latency_ms"] == 150
        assert data["from_cache"] is False

    @pytest.mark.asyncio
    async def test_chat_unauthorized(self, test_client):
        """POST /chat без авторизации → 401 или 403."""
        response = await test_client.post(
            "/api/v1/ai/chat",
            json={"message": "Привет"},
        )
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_chat_empty_message(self, authed_client):
        """POST /chat с пустым сообщением — сервис обрабатывает сам."""
        mock_service = _make_mock_service()
        mock_service.chat.return_value = {
            "reply": "Пожалуйста, задайте вопрос.",
            "model_used": "test-model",
            "provider": "test",
            "sources": [],
            "suggestions": [],
            "latency_ms": 10,
            "from_cache": False,
        }

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.post(
                "/api/v1/ai/chat",
                json={"message": ""},
            )

        assert response.status_code == 200
        data = response.json()
        assert "reply" in data


# ============================================================
# TestChatStreamEndpoint
# ============================================================

class TestChatStreamEndpoint:
    """Тесты POST /api/v1/ai/chat/stream"""

    @pytest.mark.asyncio
    async def test_chat_stream_success(self, authed_client):
        """POST /chat/stream → 200 + SSE ответ."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.post(
                "/api/v1/ai/chat/stream",
                json={"message": "Расскажи про баланс"},
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_chat_stream_unauthorized(self, test_client):
        """POST /chat/stream без авторизации → 401 или 403."""
        response = await test_client.post(
            "/api/v1/ai/chat/stream",
            json={"message": "Привет"},
        )
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_chat_stream_content_type(self, authed_client):
        """Ответ содержит content-type text/event-stream."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.post(
                "/api/v1/ai/chat/stream",
                json={"message": "Расскажи про экономику"},
            )

        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "text/event-stream" in content_type


# ============================================================
# TestSuggestionsEndpoint
# ============================================================

class TestSuggestionsEndpoint:
    """Тесты GET /api/v1/ai/suggestions"""

    @pytest.mark.asyncio
    async def test_suggestions_success(self, authed_client):
        """GET /suggestions?block_id=1 → 200 + подсказки."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.get(
                "/api/v1/ai/suggestions",
                params={"block_id": 1},
            )

        assert response.status_code == 200
        data = response.json()
        assert "block_id" in data
        assert data["block_id"] == 1
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) == 2
        for s in data["suggestions"]:
            assert "title" in s
            assert "description" in s
            assert "action" in s
            assert "priority" in s

    @pytest.mark.asyncio
    async def test_suggestions_unauthorized(self, test_client):
        """GET /suggestions без авторизации → 401 или 403."""
        response = await test_client.get(
            "/api/v1/ai/suggestions",
            params={"block_id": 1},
        )
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_suggestions_invalid_block(self, authed_client):
        """GET /suggestions с block_id вне диапазона (0 или 9) → 422."""
        response = await authed_client.get(
            "/api/v1/ai/suggestions",
            params={"block_id": 0},
        )
        assert response.status_code == 422

        response = await authed_client.get(
            "/api/v1/ai/suggestions",
            params={"block_id": 9},
        )
        assert response.status_code == 422


# ============================================================
# TestAlertsEndpoint
# ============================================================

class TestAlertsEndpoint:
    """Тесты GET /api/v1/ai/alerts"""

    @pytest.mark.asyncio
    async def test_alerts_success(self, authed_client):
        """GET /alerts → 200 + список уведомлений."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.get(
                "/api/v1/ai/alerts",
                params={"project_id": "test-project"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        assert "total" in data
        assert isinstance(data["alerts"], list)
        assert data["total"] >= 0
        if data["alerts"]:
            alert = data["alerts"][0]
            assert "id" in alert
            assert "alert_type" in alert
            assert "severity" in alert
            assert "title" in alert

    @pytest.mark.asyncio
    async def test_alerts_unauthorized(self, test_client):
        """GET /alerts без авторизации → 401 или 403."""
        response = await test_client.get("/api/v1/ai/alerts")
        assert response.status_code in (401, 403)


# ============================================================
# TestHistoryEndpoint
# ============================================================

class TestHistoryEndpoint:
    """Тесты GET /api/v1/ai/history"""

    @pytest.mark.asyncio
    async def test_history_success(self, authed_client):
        """GET /history → 200 + сообщения истории."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.get(
                "/api/v1/ai/history",
                params={"project_id": "test-project", "limit": 50},
            )

        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert "total" in data
        assert isinstance(data["messages"], list)
        assert data["total"] >= 0
        if data["messages"]:
            msg = data["messages"][0]
            assert "id" in msg
            assert "role" in msg
            assert "content" in msg

    @pytest.mark.asyncio
    async def test_history_empty(self, authed_client):
        """GET /history для новой сессии → пустой список сообщений."""
        mock_service = _make_mock_service()
        mock_service.get_chat_history.return_value = []

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.get("/api/v1/ai/history")

        assert response.status_code == 200
        data = response.json()
        assert data["messages"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_history_unauthorized(self, test_client):
        """GET /history без авторизации → 401 или 403."""
        response = await test_client.get("/api/v1/ai/history")
        assert response.status_code in (401, 403)


# ============================================================
# TestHistoryClearEndpoint
# ============================================================

class TestHistoryClearEndpoint:
    """Тесты POST /api/v1/ai/history/clear"""

    @pytest.mark.asyncio
    async def test_history_clear_success(self, authed_client):
        """POST /history/clear → 200 + {"status": "cleared"}."""
        mock_service = _make_mock_service()

        with patch(
            "app.api.v1.ai_assistant._get_assistant_service",
            return_value=mock_service,
        ):
            response = await authed_client.post("/api/v1/ai/history/clear")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cleared"

    @pytest.mark.asyncio
    async def test_history_clear_unauthorized(self, test_client):
        """POST /history/clear без авторизации → 401 или 403."""
        response = await test_client.post("/api/v1/ai/history/clear")
        assert response.status_code in (401, 403)


# ============================================================
# TestStatusEndpoint
# ============================================================

class TestStatusEndpoint:
    """Тесты GET /api/v1/ai/status (публичный эндпоинт)"""

    @pytest.mark.asyncio
    async def test_status_success(self, test_client):
        """GET /status → 200 + AIStatusResponse (без авторизации)."""
        mock_provider = MagicMock()
        mock_provider.name = "test-provider"
        mock_provider.is_available = True
        mock_provider.get_available_models.return_value = ["test-model-1", "test-model-2"]
        mock_provider.config = MagicMock(priority=1)

        mock_router_instance = MagicMock()
        mock_router_instance.get_routing_info.return_value = {"strategy": "priority"}

        with patch("app.ai.providers.zai_provider.ZAIProvider", return_value=mock_provider), \
             patch("app.ai.providers.ollama_provider.OllamaProvider", return_value=mock_provider), \
             patch("app.ai.providers.openai_provider.OpenAIProvider", return_value=mock_provider), \
             patch("app.ai.providers.anthropic_provider.AnthropicProvider", return_value=mock_provider), \
             patch("app.ai.router.PromptRouter", return_value=mock_router_instance):
            response = await test_client.get("/api/v1/ai/status")

        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert "providers" in data
        assert "routing_info" in data
        assert isinstance(data["available"], bool)
        assert isinstance(data["providers"], dict)

    @pytest.mark.asyncio
    async def test_status_has_providers(self, test_client):
        """Ответ включает словарь providers с информацией о провайдерах."""
        mock_provider = MagicMock()
        mock_provider.name = "zai"
        mock_provider.is_available = True
        mock_provider.get_available_models.return_value = ["model-a"]
        mock_provider.config = MagicMock(priority=1)

        mock_router_instance = MagicMock()
        mock_router_instance.get_routing_info.return_value = {"strategy": "priority"}

        with patch("app.ai.providers.zai_provider.ZAIProvider", return_value=mock_provider), \
             patch("app.ai.providers.ollama_provider.OllamaProvider", return_value=mock_provider), \
             patch("app.ai.providers.openai_provider.OpenAIProvider", return_value=mock_provider), \
             patch("app.ai.providers.anthropic_provider.AnthropicProvider", return_value=mock_provider), \
             patch("app.ai.router.PromptRouter", return_value=mock_router_instance):
            response = await test_client.get("/api/v1/ai/status")

        assert response.status_code == 200
        data = response.json()
        providers = data["providers"]
        assert isinstance(providers, dict)
        assert len(providers) > 0
        for provider_name, provider_info in providers.items():
            assert "available" in provider_info
            assert "models" in provider_info
            assert "priority" in provider_info


# ============================================================
# TestTestEndpoint
# ============================================================

class TestTestEndpoint:
    """Тесты POST /api/v1/ai/test"""

    @pytest.mark.asyncio
    async def test_test_endpoint_exists(self, authed_client):
        """POST /test → эндпоинт существует и отвечает."""
        # /test создаёт провайдеров напрямую, мокаем на уровне модулей
        mock_provider = MagicMock()
        mock_provider.is_available = False  # Нет доступных → сообщение об ошибке
        mock_provider.name = "test-mock"
        mock_provider.config = MagicMock(priority=1)

        with patch("app.ai.providers.zai_provider.ZAIProvider", return_value=mock_provider), \
             patch("app.ai.providers.ollama_provider.OllamaProvider", return_value=mock_provider), \
             patch("app.ai.providers.openai_provider.OpenAIProvider", return_value=mock_provider), \
             patch("app.ai.providers.anthropic_provider.AnthropicProvider", return_value=mock_provider):
            response = await authed_client.post("/api/v1/ai/test")

        # Endpoint существует и возвращает ChatResponse (даже если нет провайдеров)
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data

    @pytest.mark.asyncio
    async def test_test_endpoint_unauthorized(self, test_client):
        """POST /test без авторизации → 401 или 403."""
        response = await test_client.post("/api/v1/ai/test")
        assert response.status_code in (401, 403)
