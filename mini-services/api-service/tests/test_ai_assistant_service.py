"""
Gidede — AI Assistant Service Tests
Фаза 4.D.6–4.D.7: Тесты для Блока 7 — AI-ассистент

Тесты:
- BuildAssistantContext: сборка контекста из Project State (8)
- ManageSession: управление сессиями чата (6)
- AddMessageAndGetHistory: сообщения и история (6)
- SearchKnowledge: RAG-поиск по базе знаний (6)
- CheckProactiveAlerts: проактивные уведомления (12)
- GenerateSuggestions: контекстные подсказки (8)
- Chat: полный пайплайн чата (8)
- ChatStream: streaming чат (6)
"""

import json
import time
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.ai.executor import PromptResult
from app.services.ai_assistant_service import (
    AIAssistantService,
    ChatMessageRecord,
    ChatSession,
    ProactiveAlert,
    ContextualSuggestion,
    AssistantContext,
    BLOCK_SUGGESTION_TEMPLATES,
)


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def mock_executor():
    """Мок PromptExecutor для тестирования без реальных AI-вызовов."""
    executor = AsyncMock()
    executor.execute = AsyncMock()
    # По умолчанию — успешный ответ AI
    executor.execute.return_value = PromptResult(
        data={"reply": "Test AI reply", "content": "Test AI reply", "sources": []},
        metadata={
            "model": "test-model",
            "provider": "test",
            "latency_ms": 100,
            "from_cache": False,
        },
    )
    return executor


@pytest.fixture
def service(mock_executor):
    """Создать AIAssistantService с моком executor."""
    return AIAssistantService(executor=mock_executor)


@pytest.fixture
def full_project_state():
    """Полный Project State со всеми блоками заполненными."""
    return {
        "name": "Epic Quest",
        "concept": {
            "title": "Epic Quest: Realm of Shadows",
            "genre": "RPG",
            "aesthetic_profile": {
                "primary_aesthetics": ["Fantasy", "Challenge", "Discovery"],
            },
        },
        "core_loop": {
            "structural_type": "Engine",
            "steps": [
                {"name": "Explore"},
                {"name": "Fight"},
                {"name": "Loot"},
                {"name": "Upgrade"},
                {"name": "Repeat"},
            ],
        },
        "mda": {
            "mechanics": ["exploration", "combat", "crafting", "trading", "dialogue"],
        },
        "balance": {
            "balance_type": "transitive",
            "issues": [],
            "elements": [
                {"name": "Sword", "status": "balanced"},
                {"name": "Bow", "status": "balanced"},
                {"name": "Staff", "status": "balanced"},
            ],
            "has_dominant_strategy": False,
        },
        "progression": {
            "total_levels": 30,
        },
        "economy": {
            "resource_model": {"core": ["Gold", "Gems", "XP"]},
            "diagnostics": {
                "runaway_detected": False,
                "deadlock_detected": False,
            },
        },
        "gdd": {
            "target_format": "full",
        },
        "checklist": {
            "shell_lenses": True,
        },
        "pipeline_state": {
            "1": {"status": "completed"},
            "2": {"status": "completed"},
            "3": {"status": "completed"},
            "4": {"status": "completed"},
            "5": {"status": "completed"},
        },
    }


# ============================================================
# Тесты: BuildAssistantContext (8 тестов)
# ============================================================

class TestBuildAssistantContext:
    """Тесты сборки контекста AI-ассистента из Project State."""

    @pytest.mark.asyncio
    async def test_context_from_full_project_state(self, service, full_project_state):
        """Полный Project State → все поля контекста заполнены."""
        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value="RAG context"):
            ctx = await service.build_assistant_context(full_project_state, include_rag=True)

        assert isinstance(ctx, AssistantContext)
        assert ctx.project_name == "Epic Quest: Realm of Shadows"
        assert ctx.genre == "RPG"
        assert ctx.aesthetic_profile["primary_aesthetics"] == ["Fantasy", "Challenge", "Discovery"]
        assert ctx.core_loop["structural_type"] == "Engine"
        assert len(ctx.core_loop["steps"]) == 5
        assert ctx.mda_profile["mechanics"] == ["exploration", "combat", "crafting", "trading", "dialogue"]
        assert ctx.balance_result["balance_type"] == "transitive"
        assert ctx.progression_profile["total_levels"] == 30
        assert ctx.economy_profile["resource_model"]["core"] == ["Gold", "Gems", "XP"]
        assert ctx.gdd_profile["target_format"] == "full"
        assert ctx.checklist_results["shell_lenses"] is True
        assert ctx.rag_context == "RAG context"

    @pytest.mark.asyncio
    async def test_context_empty_project_state(self, service):
        """None → AssistantContext с дефолтными значениями."""
        ctx = await service.build_assistant_context(None)

        assert isinstance(ctx, AssistantContext)
        assert ctx.project_name == ""
        assert ctx.genre == ""
        assert ctx.rag_context == ""
        assert ctx.aesthetic_profile == {}
        assert ctx.core_loop == {}
        assert ctx.mda_profile == {}

    @pytest.mark.asyncio
    async def test_context_partial_concept_only(self, service):
        """Только concept → ограниченный контекст."""
        project_state = {
            "concept": {
                "title": "My Game",
                "genre": "Strategy",
            }
        }

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value="RAG"):
            ctx = await service.build_assistant_context(project_state, include_rag=True)

        assert ctx.project_name == "My Game"
        assert ctx.genre == "Strategy"
        assert ctx.core_loop == {}
        assert ctx.mda_profile == {}
        assert ctx.balance_result == {}

    @pytest.mark.asyncio
    async def test_context_blocks_1_through_5(self, service):
        """Блоки 1-5 заполнены → полный контекст."""
        project_state = {
            "name": "Block Test",
            "concept": {"genre": "FPS", "aesthetic_profile": {"primary_aesthetics": ["Challenge"]}},
            "core_loop": {"structural_type": "Economy", "steps": [{"name": "Shoot"}]},
            "mda": {"mechanics": ["aiming", "cover"]},
            "balance": {"balance_type": "intransitive"},
            "progression": {"total_levels": 10},
            "economy": {"resource_model": {"core": ["Ammo"]}},
        }

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            ctx = await service.build_assistant_context(project_state, include_rag=False)

        assert ctx.genre == "FPS"
        assert ctx.core_loop["structural_type"] == "Economy"
        assert ctx.mda_profile["mechanics"] == ["aiming", "cover"]
        assert ctx.balance_result["balance_type"] == "intransitive"
        assert ctx.progression_profile["total_levels"] == 10
        assert ctx.economy_profile["resource_model"]["core"] == ["Ammo"]

    @pytest.mark.asyncio
    async def test_context_token_limit_truncation(self, service):
        """Очень длинные данные → контекст всё равно строится (to_prompt_string работает)."""
        long_string = "А" * 5000
        project_state = {
            "concept": {
                "title": long_string,
                "genre": "RPG",
                "aesthetic_profile": {"primary_aesthetics": [long_string]},
            },
            "core_loop": {
                "structural_type": long_string[:100],
                "steps": [{"name": long_string[:50]}] * 10,
            },
        }

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            ctx = await service.build_assistant_context(project_state, include_rag=False)

        prompt_str = ctx.to_prompt_string()
        assert isinstance(prompt_str, str)
        assert len(prompt_str) > 0

    @pytest.mark.asyncio
    async def test_context_preserves_genre(self, service):
        """Жанр из concept сохраняется."""
        project_state = {
            "concept": {"genre": "Metroidvania"},
        }

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            ctx = await service.build_assistant_context(project_state, include_rag=True)

        assert ctx.genre == "Metroidvania"

    @pytest.mark.asyncio
    async def test_context_rag_included_when_genre(self, service):
        """Жанр указан → RAG вызывается и контекст включается."""
        project_state = {
            "concept": {"genre": "RPG"},
        }

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value="RAG RPG context") as mock_rag:
            ctx = await service.build_assistant_context(project_state, include_rag=True)

        mock_rag.assert_called_once_with(
            query="геймдизайн RPG рекомендации",
            max_tokens=1500,
        )
        assert ctx.rag_context == "RAG RPG context"

    @pytest.mark.asyncio
    async def test_context_rag_disabled(self, service, full_project_state):
        """include_rag=False → RAG не вызывается."""
        with patch.object(service, "search_knowledge", new_callable=AsyncMock) as mock_rag:
            ctx = await service.build_assistant_context(full_project_state, include_rag=False)

        mock_rag.assert_not_called()
        assert ctx.rag_context == ""


# ============================================================
# Тесты: ManageSession (6 тестов)
# ============================================================

class TestManageSession:
    """Тесты управления сессиями чата."""

    @pytest.mark.asyncio
    async def test_create_new_session(self, service):
        """action='create' → новая сессия создана."""
        session = await service.manage_session("user1", "proj1", "create")

        assert isinstance(session, ChatSession)
        assert session.user_id == "user1"
        assert session.project_id == "proj1"
        assert session.session_id  # Non-empty
        assert session.messages == []

    @pytest.mark.asyncio
    async def test_get_or_create_existing(self, service):
        """get_or_create возвращает существующую сессию."""
        session1 = await service.manage_session("user1", "proj1", "create")
        session2 = await service.manage_session("user1", "proj1", "get_or_create")

        assert session1.session_id == session2.session_id
        assert session2.user_id == "user1"

    @pytest.mark.asyncio
    async def test_clear_session(self, service):
        """action='clear' → сообщения очищены, сессия удалена."""
        session = await service.manage_session("user1", "proj1", "create")
        session.messages.append(ChatMessageRecord(
            id="msg1", role="user", content="Hello", timestamp=time.time(),
        ))

        cleared = await service.manage_session("user1", "proj1", "clear")

        assert isinstance(cleared, ChatSession)
        assert cleared.messages == []
        assert cleared.session_id != session.session_id  # New session object

    @pytest.mark.asyncio
    async def test_session_ttl(self, service):
        """Сессия имеет created_at и updated_at."""
        session = await service.manage_session("user1", "proj1", "create")

        assert session.created_at > 0
        assert session.updated_at > 0

    @pytest.mark.asyncio
    async def test_duplicate_create_creates_new(self, service):
        """Два create → две разные сессии (вторая перезаписывает первую по ключу)."""
        session1 = await service.manage_session("user1", "proj1", "create")
        session2 = await service.manage_session("user1", "proj1", "create")

        # Второй create перезаписывает первую по session_key
        assert session2.session_id != session1.session_id
        # get_or_create вернёт вторую
        session3 = await service.manage_session("user1", "proj1", "get_or_create")
        assert session3.session_id == session2.session_id

    @pytest.mark.asyncio
    async def test_session_key_format(self, service):
        """Разные project_id → разные сессии."""
        session1 = await service.manage_session("user1", "projA", "create")
        session2 = await service.manage_session("user1", "projB", "create")

        assert session1.session_id != session2.session_id
        # Каждая доступна по своему ключу
        got1 = await service.manage_session("user1", "projA", "get_or_create")
        got2 = await service.manage_session("user1", "projB", "get_or_create")
        assert got1.session_id == session1.session_id
        assert got2.session_id == session2.session_id


# ============================================================
# Тесты: AddMessageAndGetHistory (6 тестов)
# ============================================================

class TestAddMessageAndGetHistory:
    """Тесты добавления сообщений и получения истории."""

    @pytest.mark.asyncio
    async def test_add_user_message(self, service):
        """Добавление user-сообщения → появляется в истории."""
        msg = await service.add_message("user1", "proj1", "user", "Hello, AI!")

        assert isinstance(msg, ChatMessageRecord)
        assert msg.role == "user"
        assert msg.content == "Hello, AI!"
        assert msg.id  # Non-empty
        assert msg.timestamp > 0

        history = await service.get_chat_history("user1", "proj1")
        assert len(history) == 1
        assert history[0].content == "Hello, AI!"

    @pytest.mark.asyncio
    async def test_add_assistant_message(self, service):
        """Добавление assistant-сообщения → появляется в истории."""
        msg = await service.add_message(
            "user1", "proj1", "assistant", "Hello! How can I help?",
            metadata={"model": "test-model"},
        )

        assert msg.role == "assistant"
        assert msg.content == "Hello! How can I help?"
        assert msg.metadata["model"] == "test-model"

        history = await service.get_chat_history("user1", "proj1")
        assert any(m.role == "assistant" for m in history)

    @pytest.mark.asyncio
    async def test_get_history_chronological(self, service):
        """Сообщения возвращаются в хронологическом порядке."""
        await service.add_message("user1", "proj1", "user", "First")
        await service.add_message("user1", "proj1", "assistant", "Second")
        await service.add_message("user1", "proj1", "user", "Third")

        history = await service.get_chat_history("user1", "proj1")

        assert len(history) == 3
        assert history[0].content == "First"
        assert history[1].content == "Second"
        assert history[2].content == "Third"

    @pytest.mark.asyncio
    async def test_history_limit(self, service):
        """get_chat_history с limit возвращает последние N сообщений."""
        for i in range(10):
            await service.add_message("user1", "proj1", "user", f"Message {i}")

        history = await service.get_chat_history("user1", "proj1", limit=3)

        assert len(history) == 3
        assert history[0].content == "Message 7"
        assert history[1].content == "Message 8"
        assert history[2].content == "Message 9"

    @pytest.mark.asyncio
    async def test_empty_history(self, service):
        """Новая сессия → пустая история."""
        history = await service.get_chat_history("new_user", "new_proj")

        assert isinstance(history, list)
        assert len(history) == 0

    @pytest.mark.asyncio
    async def test_message_truncation(self, service):
        """>MAX_CONTEXT_MESSAGES*2 → truncation срабатывает."""
        # MAX_CONTEXT_MESSAGES = 20, so > 40 messages triggers truncation
        # Truncation fires when len > 40, keeping last 20;
        # then remaining messages keep appending until next threshold.
        for i in range(45):
            await service.add_message("user1", "proj1", "user", f"Msg {i}")

        session = await service.manage_session("user1", "proj1", "get_or_create")

        # After 45 messages, truncation happened at msg 41 (→20 kept),
        # then 4 more added = 24. Key: latest messages are preserved.
        assert len(session.messages) < 45
        assert session.messages[-1].content == "Msg 44"
        # Oldest messages were trimmed away
        assert session.messages[0].content != "Msg 0"


# ============================================================
# Тесты: SearchKnowledge (6 тестов)
# ============================================================

class TestSearchKnowledge:
    """Тесты RAG-поиска по базе знаний."""

    @pytest.fixture(autouse=True)
    def _inject_rag_mock_module(self):
        """Inject a mock app.core.rag_service module into sys.modules so
        the local import inside search_knowledge() can be patched."""
        import sys
        import types

        mock_mod = types.ModuleType("app.core.rag_service")
        mock_mod.get_rag_service = AsyncMock()
        # Save originals
        had_core = "app.core.rag_service" in sys.modules
        orig = sys.modules.get("app.core.rag_service")
        sys.modules["app.core.rag_service"] = mock_mod
        yield
        # Restore
        if had_core:
            sys.modules["app.core.rag_service"] = orig
        else:
            del sys.modules["app.core.rag_service"]

    @pytest.mark.asyncio
    async def test_rag_search_success(self, service):
        """Успешный RAG-поиск → контекст возвращён."""
        mock_rag = AsyncMock()
        mock_rag.enrich_prompt = AsyncMock(return_value="Game design principles for RPG")

        with patch("app.core.rag_service.get_rag_service", new_callable=AsyncMock, return_value=mock_rag):
            result = await service.search_knowledge("геймдизайн RPG", max_tokens=2000)

        assert result == "Game design principles for RPG"
        mock_rag.enrich_prompt.assert_called_once_with(
            query="геймдизайн RPG",
            max_context_tokens=2000,
        )

    @pytest.mark.asyncio
    async def test_rag_search_empty_result(self, service):
        """Нет релевантных данных → пустая строка."""
        mock_rag = AsyncMock()
        mock_rag.enrich_prompt = AsyncMock(return_value="")

        with patch("app.core.rag_service.get_rag_service", new_callable=AsyncMock, return_value=mock_rag):
            result = await service.search_knowledge("nonexistent query", max_tokens=1000)

        assert result == ""

    @pytest.mark.asyncio
    async def test_rag_search_failure_graceful(self, service):
        """Исключение в RAG → пустая строка, без падения."""
        with patch("app.core.rag_service.get_rag_service", new_callable=AsyncMock, side_effect=RuntimeError("RAG unavailable")):
            result = await service.search_knowledge("test query")

        assert result == ""

    @pytest.mark.asyncio
    async def test_rag_search_calls_rag_service(self, service):
        """Проверка вызова rag_service.enrich_prompt."""
        mock_rag = AsyncMock()
        mock_rag.enrich_prompt = AsyncMock(return_value="Context")

        with patch("app.core.rag_service.get_rag_service", new_callable=AsyncMock, return_value=mock_rag):
            await service.search_knowledge("balance tips", max_tokens=1500)

        mock_rag.enrich_prompt.assert_called_once()
        call_kwargs = mock_rag.enrich_prompt.call_args
        assert call_kwargs.kwargs["query"] == "balance tips"
        assert call_kwargs.kwargs["max_context_tokens"] == 1500

    @pytest.mark.asyncio
    async def test_rag_max_tokens_parameter(self, service):
        """max_tokens передаётся в enrich_prompt."""
        mock_rag = AsyncMock()
        mock_rag.enrich_prompt = AsyncMock(return_value="RAG data")

        with patch("app.core.rag_service.get_rag_service", new_callable=AsyncMock, return_value=mock_rag):
            await service.search_knowledge("test", max_tokens=500)

        mock_rag.enrich_prompt.assert_called_once_with(
            query="test",
            max_context_tokens=500,
        )

    @pytest.mark.asyncio
    async def test_rag_import_error_graceful(self, service):
        """ImportError при импорте rag_service → graceful degradation."""
        import sys
        # Remove the mock module so the local import triggers ImportError
        with patch.dict(sys.modules, {}, clear=False):
            # Ensure the module cannot be found
            sys.modules.pop("app.core.rag_service", None)
            result = await service.search_knowledge("test query")

        assert result == ""


# ============================================================
# Тесты: CheckProactiveAlerts (12 тестов)
# ============================================================

class TestCheckProactiveAlerts:
    """Тесты проактивных уведомлений."""

    @pytest.mark.asyncio
    async def test_no_alerts_empty_state(self, service):
        """None → пустой список."""
        alerts = await service.check_proactive_alerts(None)

        assert alerts == []

    @pytest.mark.asyncio
    async def test_economy_runaway_alert(self, service):
        """runaway_detected → critical alert."""
        project_state = {
            "economy": {
                "diagnostics": {
                    "runaway_detected": True,
                    "deadlock_detected": False,
                },
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        runaway_alerts = [a for a in alerts if a.alert_type == "runaway"]
        assert len(runaway_alerts) >= 1
        assert runaway_alerts[0].severity == "critical"
        assert runaway_alerts[0].block_id == 5

    @pytest.mark.asyncio
    async def test_economy_stable_no_alert(self, service):
        """Нет runaway → нет economy alert."""
        project_state = {
            "economy": {
                "diagnostics": {
                    "runaway_detected": False,
                    "deadlock_detected": False,
                },
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        economy_alerts = [a for a in alerts if a.alert_type in ("runaway", "deadlock")]
        assert len(economy_alerts) == 0

    @pytest.mark.asyncio
    async def test_economy_deadlock_alert(self, service):
        """deadlock_detected → critical alert."""
        project_state = {
            "economy": {
                "diagnostics": {
                    "runaway_detected": False,
                    "deadlock_detected": True,
                },
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        deadlock_alerts = [a for a in alerts if a.alert_type == "deadlock"]
        assert len(deadlock_alerts) >= 1
        assert deadlock_alerts[0].severity == "critical"
        assert deadlock_alerts[0].block_id == 5

    @pytest.mark.asyncio
    async def test_balance_overpowered_alert(self, service):
        """>20% переоценённых элементов → warning alert."""
        # 3 out of 5 = 60% overpowered
        project_state = {
            "balance": {
                "elements": [
                    {"name": "A", "status": "overpowered"},
                    {"name": "B", "status": "overpowered"},
                    {"name": "C", "status": "overpowered"},
                    {"name": "D", "status": "balanced"},
                    {"name": "E", "status": "balanced"},
                ],
                "has_dominant_strategy": False,
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        op_alerts = [a for a in alerts if "переоценён" in a.title.lower() or "overpowered" in a.title.lower()]
        # The alert title is in Russian: "Слишком много переоценённых элементов"
        overpowered_alerts = [a for a in alerts if a.block_id == 4 and a.severity == "warning"]
        assert len(overpowered_alerts) >= 1

    @pytest.mark.asyncio
    async def test_balance_dominant_strategy_alert(self, service):
        """has_dominant_strategy → critical alert."""
        project_state = {
            "balance": {
                "elements": [{"name": "A", "status": "balanced"}],
                "has_dominant_strategy": True,
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        dominant_alerts = [a for a in alerts if "доминантн" in a.title.lower()]
        assert len(dominant_alerts) >= 1
        assert dominant_alerts[0].severity == "critical"
        assert dominant_alerts[0].block_id == 4

    @pytest.mark.asyncio
    async def test_mda_ludonarrative_dissonance_alert(self, service):
        """ludonarrative_dissonance → warning alert."""
        project_state = {
            "mda": {
                "ludonarrative_dissonance": True,
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        dissonance_alerts = [a for a in alerts if a.alert_type == "dissonance"]
        assert len(dissonance_alerts) >= 1
        assert dissonance_alerts[0].severity == "warning"
        assert dissonance_alerts[0].block_id == 3

    @pytest.mark.asyncio
    async def test_core_loop_pathology_alert(self, service):
        """Патологии в core_loop → alerts."""
        project_state = {
            "core_loop": {
                "pathologies": [
                    {"type": "runaway", "description": "Runaway loop", "severity": "critical", "recommendation": "Fix it"},
                    {"type": "stall", "description": "Stalling loop", "severity": "warning", "recommendation": "Adjust pacing"},
                ],
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        pathology_alerts = [a for a in alerts if a.block_id == 2]
        assert len(pathology_alerts) >= 2
        # One should be critical (runaway), one warning (stall)
        severities = {a.severity for a in pathology_alerts}
        assert "critical" in severities

    @pytest.mark.asyncio
    async def test_data_gap_alerts(self, service):
        """Отсутствующие блоки → info alerts."""
        project_state = {
            "concept": {"genre": "RPG"},
        }

        alerts = await service.check_proactive_alerts(project_state)

        gap_alerts = [a for a in alerts if a.alert_type == "gap"]
        # Blocks 2-6 should be reported as gaps
        gap_block_ids = {a.block_id for a in gap_alerts}
        assert 2 in gap_block_ids
        assert 3 in gap_block_ids
        assert 4 in gap_block_ids
        for a in gap_alerts:
            assert a.severity == "info"

    @pytest.mark.asyncio
    async def test_all_blocks_filled_no_gap_alerts(self, service):
        """Все блоки заполнены → нет gap alerts."""
        project_state = {
            "concept": {"genre": "RPG"},
            "core_loop": {"structural_type": "Engine"},
            "mda": {"mechanics": ["test"]},
            "balance": {"elements": []},
            "economy": {"resource_model": {"core": ["Gold"]}},
            "progression": {"total_levels": 10},
            "gdd": {"target_format": "full"},
        }

        alerts = await service.check_proactive_alerts(project_state)

        gap_alerts = [a for a in alerts if a.alert_type == "gap"]
        assert len(gap_alerts) == 0

    @pytest.mark.asyncio
    async def test_alerts_sorted_by_severity(self, service):
        """Сортировка: critical, warning, info."""
        project_state = {
            "economy": {
                "diagnostics": {"runaway_detected": True, "deadlock_detected": False},
            },
            "mda": {
                "ludonarrative_dissonance": True,
            },
            # Missing blocks → gap alerts (info)
        }

        alerts = await service.check_proactive_alerts(project_state)

        severity_order = {"critical": 0, "warning": 1, "info": 2}
        for i in range(len(alerts) - 1):
            assert severity_order.get(alerts[i].severity, 3) <= severity_order.get(alerts[i + 1].severity, 3)

    @pytest.mark.asyncio
    async def test_multiple_alerts_combined(self, service):
        """Несколько проблем → несколько alerts."""
        project_state = {
            "economy": {
                "diagnostics": {"runaway_detected": True, "deadlock_detected": True},
            },
            "mda": {
                "ludonarrative_dissonance": True,
            },
            "balance": {
                "has_dominant_strategy": True,
                "elements": [],
            },
        }

        alerts = await service.check_proactive_alerts(project_state)

        assert len(alerts) >= 4  # runaway + deadlock + dissonance + dominant + gaps
        alert_types = {a.alert_type for a in alerts}
        assert "runaway" in alert_types
        assert "deadlock" in alert_types
        assert "dissonance" in alert_types


# ============================================================
# Тесты: GenerateSuggestions (8 тестов)
# ============================================================

class TestGenerateSuggestions:
    """Тесты контекстных подсказок."""

    @pytest.mark.asyncio
    async def test_suggestions_for_block_1(self, service):
        """Блок 1 → концепт-подсказки."""
        suggestions = await service.generate_suggestions(1)

        assert len(suggestions) > 0
        assert all(s.block_id == 1 for s in suggestions)
        titles = [s.title for s in suggestions]
        assert any("жанр" in t.lower() for t in titles)

    @pytest.mark.asyncio
    async def test_suggestions_for_block_4(self, service):
        """Блок 4 → подсказки баланса."""
        suggestions = await service.generate_suggestions(4)

        assert len(suggestions) > 0
        assert all(s.block_id == 4 for s in suggestions)
        titles = [s.title for s in suggestions]
        assert any("dominant" in t.lower() or "доминантн" in t.lower() or "transitive" in t.lower() for t in titles)

    @pytest.mark.asyncio
    async def test_suggestions_for_block_5(self, service):
        """Блок 5 → подсказки экономики/прогрессии."""
        suggestions = await service.generate_suggestions(5)

        assert len(suggestions) > 0
        assert all(s.block_id == 5 for s in suggestions)
        titles = [s.title for s in suggestions]
        assert any("экономик" in t.lower() or "прогресс" in t.lower() or "runaway" in t.lower() for t in titles)

    @pytest.mark.asyncio
    async def test_suggestions_with_project_state(self, service):
        """project_state → дополнительные контекстные подсказки."""
        project_state = {
            "concept": {"genre": ""},
        }

        suggestions = await service.generate_suggestions(1, project_state)

        # Template + context suggestion for missing genre
        context_suggestions = [s for s in suggestions if "Определить жанр" in s.title]
        assert len(context_suggestions) >= 1
        assert context_suggestions[0].priority == "high"

    @pytest.mark.asyncio
    async def test_suggestions_without_project_state(self, service):
        """Нет project_state → только шаблонные подсказки."""
        suggestions = await service.generate_suggestions(1, None)
        template_count = len(BLOCK_SUGGESTION_TEMPLATES.get(1, []))

        assert len(suggestions) == template_count

    @pytest.mark.asyncio
    async def test_suggestions_invalid_block(self, service):
        """Неверный block_id → пустой список."""
        suggestions = await service.generate_suggestions(99)

        assert suggestions == []

    @pytest.mark.asyncio
    async def test_suggestions_all_blocks_have_templates(self, service):
        """Блоки 1-8 все имеют шаблоны."""
        for block_id in range(1, 9):
            suggestions = await service.generate_suggestions(block_id)
            assert len(suggestions) > 0, f"Block {block_id} should have template suggestions"

    @pytest.mark.asyncio
    async def test_context_suggestion_dominant_strategy(self, service):
        """Блок 4 с dominant_strategy → подсказка для исправления."""
        project_state = {
            "balance": {
                "has_dominant_strategy": True,
                "elements": [{"name": "X", "status": "balanced"}],
            },
        }

        suggestions = await service.generate_suggestions(4, project_state)

        fix_suggestions = [s for s in suggestions if s.action == "fix" and "доминантн" in s.title.lower()]
        assert len(fix_suggestions) >= 1
        assert fix_suggestions[0].data.get("issue") == "dominant_strategy"


# ============================================================
# Тесты: Chat (8 тестов)
# ============================================================

class TestChat:
    """Тесты полного пайплайна чата."""

    @pytest.mark.asyncio
    async def test_chat_success(self, service, mock_executor):
        """Успешный чат → dict с reply, sources и т.д."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "RPG games focus on character progression", "sources": ["MDA book"]},
            metadata={"model": "gpt-4", "provider": "openai", "latency_ms": 500, "from_cache": False},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            result = await service.chat(
                message="Tell me about RPG",
                user_id="user1",
                project_id="proj1",
            )

        assert isinstance(result, dict)
        assert "reply" in result
        assert "sources" in result
        assert "suggestions" in result
        assert "model_used" in result
        assert "provider" in result
        assert "latency_ms" in result
        assert "from_cache" in result
        assert result["reply"] == "RPG games focus on character progression"

    @pytest.mark.asyncio
    async def test_chat_saves_user_message(self, service, mock_executor):
        """Сообщение пользователя сохраняется в сессии."""
        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            await service.chat(
                message="Hello assistant",
                user_id="user1",
                project_id="proj1",
            )

        history = await service.get_chat_history("user1", "proj1")
        user_msgs = [m for m in history if m.role == "user"]
        assert len(user_msgs) >= 1
        assert user_msgs[0].content == "Hello assistant"

    @pytest.mark.asyncio
    async def test_chat_saves_assistant_message(self, service, mock_executor):
        """Ответ AI сохраняется в сессии."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "AI response here"},
            metadata={"model": "test", "provider": "test", "latency_ms": 50},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            await service.chat(
                message="Test question",
                user_id="user1",
                project_id="proj1",
            )

        history = await service.get_chat_history("user1", "proj1")
        assistant_msgs = [m for m in history if m.role == "assistant"]
        assert len(assistant_msgs) >= 1
        assert assistant_msgs[0].content == "AI response here"

    @pytest.mark.asyncio
    async def test_chat_ai_error_fallback(self, service, mock_executor):
        """Ошибка AI → fallback-ответ."""
        mock_executor.execute.side_effect = RuntimeError("AI service unavailable")

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            result = await service.chat(
                message="Help me",
                user_id="user1",
                project_id="proj1",
            )

        assert "reply" in result
        assert "не удалось получить ответ" in result["reply"].lower() or "Извините" in result["reply"]
        assert result["model_used"] == "error"
        assert result["provider"] == "error"
        assert result["sources"] == []

    @pytest.mark.asyncio
    async def test_chat_returns_latency(self, service, mock_executor):
        """Результат содержит latency_ms."""
        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            result = await service.chat(
                message="Quick test",
                user_id="user1",
                project_id="proj1",
            )

        assert "latency_ms" in result
        assert isinstance(result["latency_ms"], int)
        assert result["latency_ms"] >= 0

    @pytest.mark.asyncio
    async def test_chat_includes_rag_context(self, service, mock_executor):
        """RAG-контекст используется при чате."""
        with patch.object(service, "build_assistant_context", new_callable=AsyncMock) as mock_ctx:
            mock_ctx.return_value = AssistantContext(
                project_name="Test",
                genre="RPG",
                rag_context="RAG knowledge here",
            )
            result = await service.chat(
                message="About RPG",
                user_id="user1",
                project_id="proj1",
            )

        mock_ctx.assert_called_once()

    @pytest.mark.asyncio
    async def test_chat_empty_message_handled(self, service, mock_executor):
        """Пустое сообщение → всё равно вызывается executor (или fallback)."""
        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            result = await service.chat(
                message="",
                user_id="user1",
                project_id="proj1",
            )

        # Should not crash — either gets a reply or falls back
        assert isinstance(result, dict)
        assert "reply" in result

    @pytest.mark.asyncio
    async def test_chat_result_format(self, service, mock_executor):
        """Результат содержит все обязательные ключи."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Test", "sources": ["src1"]},
            metadata={"model": "gpt-4", "provider": "openai", "latency_ms": 200, "from_cache": True},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            result = await service.chat(
                message="Format test",
                user_id="user1",
                project_id="proj1",
            )

        required_keys = {"reply", "sources", "suggestions", "model_used", "provider", "latency_ms", "from_cache"}
        assert required_keys.issubset(set(result.keys()))
        assert isinstance(result["sources"], list)
        assert isinstance(result["suggestions"], list)
        assert isinstance(result["from_cache"], bool)


# ============================================================
# Тесты: ChatStream (6 тестов)
# ============================================================

class TestChatStream:
    """Тесты streaming чата."""

    @pytest.mark.asyncio
    async def test_stream_yields_events(self, service, mock_executor):
        """Streaming возвращает JSON-строки."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Streaming reply", "sources": []},
            metadata={"model": "test", "provider": "test", "latency_ms": 100},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in service.chat_stream(
                message="Stream test",
                user_id="user1",
                project_id="proj1",
            ):
                events.append(event)

        assert len(events) >= 2
        for event in events:
            parsed = json.loads(event)
            assert "type" in parsed

    @pytest.mark.asyncio
    async def test_stream_done_marker(self, service, mock_executor):
        """Последний event имеет type='done'."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Done test"},
            metadata={"model": "test", "provider": "test", "latency_ms": 50},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in service.chat_stream(
                message="Done test",
                user_id="user1",
                project_id="proj1",
            ):
                events.append(event)

        last = json.loads(events[-1])
        assert last["type"] == "done"

    @pytest.mark.asyncio
    async def test_stream_content_in_message(self, service, mock_executor):
        """Первый event имеет type='message' и content."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Message content here"},
            metadata={"model": "test", "provider": "test", "latency_ms": 50},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in service.chat_stream(
                message="Content test",
                user_id="user1",
                project_id="proj1",
            ):
                events.append(event)

        first = json.loads(events[0])
        assert first["type"] == "message"
        assert "content" in first
        assert first["content"] == "Message content here"

    @pytest.mark.asyncio
    async def test_stream_calls_chat(self, service, mock_executor):
        """Streaming внутренне вызывает chat()."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Internal chat"},
            metadata={"model": "test", "provider": "test", "latency_ms": 50},
        )

        with patch.object(service, "chat", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = {
                "reply": "Mocked chat reply",
                "sources": [],
                "suggestions": [],
                "model_used": "test",
                "provider": "test",
                "latency_ms": 50,
                "from_cache": False,
            }

            events = []
            async for event in service.chat_stream(
                message="Verify chat call",
                user_id="user1",
                project_id="proj1",
            ):
                events.append(event)

        # chat() is called internally (but add_message is called first, then chat)
        mock_chat.assert_called_once()

    @pytest.mark.asyncio
    async def test_stream_sse_format(self, service, mock_executor):
        """Каждый chunk — валидный JSON."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "SSE format test"},
            metadata={"model": "test", "provider": "test", "latency_ms": 30},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in service.chat_stream(
                message="SSE test",
                user_id="user1",
                project_id="proj1",
            ):
                events.append(event)

        for event in events:
            # Each chunk should be valid JSON
            parsed = json.loads(event)
            assert isinstance(parsed, dict)

    @pytest.mark.asyncio
    async def test_stream_latency_in_done(self, service, mock_executor):
        """done event содержит latency_ms."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Latency test"},
            metadata={"model": "test-model", "provider": "test", "latency_ms": 75},
        )

        with patch.object(service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            events = []
            async for event in service.chat_stream(
                message="Latency test",
                user_id="user1",
                project_id="proj1",
            ):
                events.append(event)

        done_event = json.loads(events[-1])
        assert done_event["type"] == "done"
        assert "latency_ms" in done_event
        assert isinstance(done_event["latency_ms"], int)
