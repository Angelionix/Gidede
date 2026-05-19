"""
Gidede — GBE Bridge Service Tests (Фаза 4.E.1)
Блок 8: API Bridge для интеграции с GDCombine/GBE

Покрытие:
- Маппинг Gidede → GBE (6 моделей)
- Обратный маппинг GBE → Gidede (3 модели)
- sync_to_gbe: полный/частичный/пустой project state
- sync_from_gbe: полный/частичный/пустой GBE data
- handle_webhook: 4 типа событий + неизвестный
- get_project_status
- test_connection
- get_sync_history
- API endpoints (6 endpoints)
- Legacy methods (обратная совместимость)
- Edge cases

Итого: 70 тестов
"""

import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.gbe_bridge_service import (
    GBEBridgeService,
    GBEBlueprint,
    GBEMDAModel,
    GBEDiagram,
    GBEBalanceReport,
    GBEProgressionModel,
    GBEEconomyModel,
    GBESyncResult,
    GBEWebhookPayload,
    GBEWebhookResult,
    GBEConnectionStatus,
)


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def gbe_service():
    """Создать GBEBridgeService для тестов."""
    return GBEBridgeService(base_url="https://gbe.test.com/api/v1", api_key="test-key-123")


@pytest.fixture
def full_project_state():
    """Полный Project State Gidede для тестов."""
    return {
        "concept": {
            "title": "Alchemy Roguelike",
            "genre": "RPG",
            "logline": "A roguelike where every potion has consequences",
            "target_audience": ["achievement", "immersion"],
            "platforms": ["PC", "Mobile"],
            "budget": "small",
        },
        "core_loop": {
            "structural_type": "Engine",
            "sub_type": "braked",
            "steps": ["explore", "gather", "craft", "fight"],
        },
        "mda_profile": {
            "mechanics": ["exploration", "crafting", "combat"],
            "dynamics": ["resource_management", "risk_reward", "emergent_combos"],
            "aesthetics": ["challenge", "discovery", "narrative"],
            "feedback_loops": [
                {"type": "reinforcing", "from_node": "craft", "to_node": "fight", "label": "better_potions"},
            ],
            "bond_matrix": {"rows": 4, "cols": 3, "values": [[1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 0, 1]]},
            "lens_scores": [{"lens_id": 1, "score": 8, "notes": "Strong core loop"}],
        },
        "balance_result": {
            "balance_type": "transitive",
            "elements": [
                {"name": "Sword", "cost": 100, "power": 80, "ratio": 0.8, "status": "balanced"},
                {"name": "Axe", "cost": 120, "power": 110, "ratio": 0.917, "status": "overpowered"},
            ],
            "payoff_matrix": [[0.5, 0.3], [0.7, 0.5]],
            "dominant_strategies": ["Axe"],
            "nash_equilibria": [{"strategy_a": "Axe", "strategy_b": "Axe"}],
            "recommendations": ["Nerf Axe power by 15%"],
        },
        "progression_profile": {
            "total_levels": 30,
            "curve_type": "exponential",
            "tiers": [
                {"name": "Novice", "levels": "1-10"},
                {"name": "Adept", "levels": "11-20"},
            ],
            "curves": [
                {"type": "xp_to_level", "formula": "100 * level^1.5"},
            ],
            "content_plan": {"unlock_tree": {"level_1": ["basic_crafting"]}},
        },
        "economy_profile": {
            "economy_type": "engine",
            "resources": [
                {"name": "Gold", "class": "valued"},
                {"name": "Herbs", "class": "commodity"},
            ],
            "machinations_model": {
                "nodes": [
                    {"id": "pool_gold", "type": "pool", "label": "Gold", "resources": 100},
                    {"id": "source_herbs", "type": "source", "label": "Herbs"},
                ],
                "connections": [
                    {"id": "flow_1", "from_node": "source_herbs", "to_node": "pool_gold", "resource_flow": 5},
                ],
                "simulation_results": {"ticks": 1000, "pathologies": []},
            },
            "faucet_drain_ratios": {"Gold": 1.1, "Herbs": 0.95},
            "pathologies": [],
            "conversion_graph": {"edges": [{"from": "Herbs", "to": "Gold", "rate": 0.5}]},
        },
    }


@pytest.fixture
def full_gbe_data():
    """Полные данные GBE для тестов импорта."""
    return {
        "blueprint": {
            "name": "Test Game from GBE",
            "genre": "Strategy",
            "description": "A strategy game about empire building",
            "target_audience": ["strategy", "social"],
            "platforms": ["PC"],
            "team_size": "medium",
        },
        "mda_model": {
            "mechanics": ["building", "trading", "warfare"],
            "dynamics": ["territorial_control", "resource_racing"],
            "aesthetics": ["submission", "fellowship", "challenge"],
            "feedback_loops": [],
            "lens_scores": [],
        },
        "balance_report": {
            "balance_type": "intransitive",
            "elements": [],
            "dominant_strategies": [],
            "nash_equilibria": [],
            "recommendations": ["Balance unit costs"],
        },
        "progression_model": {
            "total_levels": 50,
            "curve_type": "step",
            "tiers": [],
            "curves": [],
        },
        "economy_model": {
            "economy_type": "economy",
            "resources": [{"name": "Gold"}],
            "faucet_drain_ratios": {},
            "pathologies": [],
        },
    }


# ============================================================
# Тесты маппинга Gidede → GBE
# ============================================================

class TestMappingToGBE:
    """Тесты маппинга моделей Gidede → GBE."""

    def test_map_concept_to_blueprint_full(self, gbe_service):
        """OnePager с полными данными → Blueprint с правильными полями."""
        concept = {
            "title": "My Game",
            "genre": "RPG",
            "logline": "An epic adventure",
            "target_audience": ["immersion"],
            "platforms": ["PC"],
            "budget": "solo",
        }
        result = gbe_service.map_concept_to_blueprint(concept)

        assert isinstance(result, GBEBlueprint)
        assert result.name == "My Game"
        assert result.genre == "RPG"
        assert result.description == "An epic adventure"
        assert result.target_audience == ["immersion"]
        assert result.platforms == ["PC"]
        assert result.team_size == "solo"

    def test_map_concept_to_blueprint_missing_fields(self, gbe_service):
        """OnePager с отсутствующими полями → Blueprint с дефолтами."""
        concept = {}
        result = gbe_service.map_concept_to_blueprint(concept)

        assert result.name == "Untitled Project"
        assert result.genre == "unknown"
        assert result.description == ""
        assert result.target_audience == []
        assert result.platforms == []

    def test_map_concept_to_blueprint_name_fallback(self, gbe_service):
        """OnePager с 'name' вместо 'title' → Blueprint использует name."""
        concept = {"name": "Game Name"}
        result = gbe_service.map_concept_to_blueprint(concept)
        assert result.name == "Game Name"

    def test_map_concept_to_blueprint_idea_fallback(self, gbe_service):
        """OnePager с 'idea' вместо 'logline' → Blueprint использует idea."""
        concept = {"idea": "A cool game"}
        result = gbe_service.map_concept_to_blueprint(concept)
        assert result.description == "A cool game"

    def test_map_mda_to_gbe_model(self, gbe_service):
        """MDAProfile → GBEMDAModel с правильными полями."""
        mda = {
            "mechanics": ["combat", "exploration"],
            "dynamics": ["risk_reward"],
            "aesthetics": ["challenge"],
            "feedback_loops": [{"type": "reinforcing", "label": "combat_loop"}],
            "bond_matrix": {"rows": 4, "cols": 3},
            "lens_scores": [{"lens_id": 1, "score": 9}],
        }
        result = gbe_service.map_mda_to_gbe_model(mda)

        assert isinstance(result, GBEMDAModel)
        assert result.mechanics == ["combat", "exploration"]
        assert result.dynamics == ["risk_reward"]
        assert result.aesthetics == ["challenge"]
        assert len(result.feedback_loops) == 1
        assert result.bond_matrix is not None
        assert len(result.lens_scores) == 1

    def test_map_mda_to_gbe_model_empty(self, gbe_service):
        """Пустой MDAProfile → GBEMDAModel с дефолтами."""
        result = gbe_service.map_mda_to_gbe_model({})
        assert result.mechanics == []
        assert result.dynamics == []
        assert result.aesthetics == []
        assert result.bond_matrix is None

    def test_map_machinations_to_gbe_diagram(self, gbe_service):
        """Machinations → GBEDiagram с узлами и связями."""
        machinations = {
            "nodes": [{"id": "pool_1", "type": "pool"}],
            "connections": [{"id": "flow_1", "from_node": "s1", "to_node": "p1"}],
            "simulation_results": {"ticks": 500},
        }
        result = gbe_service.map_machinations_to_gbe_diagram(machinations)

        assert isinstance(result, GBEDiagram)
        assert len(result.nodes) == 1
        assert len(result.connections) == 1
        assert result.simulation_results is not None

    def test_map_machinations_to_gbe_diagram_flows_fallback(self, gbe_service):
        """Machinations с 'flows' вместо 'connections' → GBEDiagram."""
        machinations = {
            "nodes": [],
            "flows": [{"id": "f1", "from": "a", "to": "b"}],
        }
        result = gbe_service.map_machinations_to_gbe_diagram(machinations)
        assert len(result.connections) == 1

    def test_map_balance_to_gbe_report(self, gbe_service):
        """BalanceResult → GBEBalanceReport."""
        balance = {
            "balance_type": "intransitive",
            "elements": [{"name": "Sword", "cost": 100}],
            "payoff_matrix": [[0.5, 0.3]],
            "dominant_strategies": ["Sword"],
            "nash_equilibria": [],
            "recommendations": ["Nerf Sword"],
        }
        result = gbe_service.map_balance_to_gbe_report(balance)

        assert isinstance(result, GBEBalanceReport)
        assert result.balance_type == "intransitive"
        assert len(result.elements) == 1
        assert result.payoff_matrix is not None
        assert result.dominant_strategies == ["Sword"]

    def test_map_progression_to_gbe_model(self, gbe_service):
        """ProgressionProfile → GBEProgressionModel."""
        progression = {
            "total_levels": 50,
            "curve_type": "logistic",
            "tiers": [{"name": "Beginner"}],
            "curves": [{"type": "xp"}],
            "content_plan": {"unlocks": []},
        }
        result = gbe_service.map_progression_to_gbe_model(progression)

        assert isinstance(result, GBEProgressionModel)
        assert result.total_levels == 50
        assert result.curve_type == "logistic"
        assert result.content_plan is not None

    def test_map_economy_to_gbe_model(self, gbe_service):
        """EconomyProfile → GBEEconomyModel с вложенным Machinations."""
        economy = {
            "economy_type": "ecology",
            "resources": [{"name": "Wood"}],
            "machinations_model": {
                "nodes": [{"id": "n1", "type": "pool"}],
                "connections": [],
            },
            "faucet_drain_ratios": {"Wood": 1.0},
            "pathologies": [{"type": "runaway"}],
            "conversion_graph": None,
        }
        result = gbe_service.map_economy_to_gbe_model(economy)

        assert isinstance(result, GBEEconomyModel)
        assert result.economy_type == "ecology"
        assert len(result.resources) == 1
        assert result.machinations_diagram is not None
        assert isinstance(result.machinations_diagram, GBEDiagram)
        assert len(result.pathologies) == 1

    def test_map_economy_without_machinations(self, gbe_service):
        """EconomyProfile без Machinations → GBEEconomyModel без диаграммы."""
        economy = {"economy_type": "engine", "resources": []}
        result = gbe_service.map_economy_to_gbe_model(economy)
        assert result.machinations_diagram is None


# ============================================================
# Тесты обратного маппинга GBE → Gidede
# ============================================================

class TestMappingFromGBE:
    """Тесты обратного маппинга GBE → Gidede."""

    def test_map_blueprint_to_concept(self, gbe_service):
        """GBE Blueprint → Gidede concept."""
        blueprint = {
            "name": "Test Game",
            "genre": "FPS",
            "description": "A shooter",
            "target_audience": ["competition"],
            "platforms": ["PC", "Console"],
            "team_size": "large",
        }
        result = gbe_service.map_blueprint_to_concept(blueprint)

        assert result["title"] == "Test Game"
        assert result["genre"] == "FPS"
        assert result["idea"] == "A shooter"
        assert result["logline"] == "A shooter"
        assert result["platforms"] == ["PC", "Console"]
        assert result["budget"] == "large"

    def test_map_blueprint_to_concept_empty(self, gbe_service):
        """Пустой Blueprint → concept с дефолтами."""
        result = gbe_service.map_blueprint_to_concept({})
        assert result["title"] == ""
        assert result["genre"] == "unknown"

    def test_map_gbe_mda_to_profile(self, gbe_service):
        """GBE MDAModel → Gidede mda_profile."""
        mda = {
            "mechanics": ["shoot", "cover"],
            "dynamics": ["positioning"],
            "aesthetics": ["challenge"],
            "feedback_loops": [],
            "bond_matrix": None,
            "lens_scores": [{"lens_id": 5, "score": 7}],
        }
        result = gbe_service.map_gbe_mda_to_profile(mda)

        assert result["mechanics"] == ["shoot", "cover"]
        assert result["dynamics"] == ["positioning"]
        assert result["aesthetics"] == ["challenge"]
        assert result["bond_matrix"] is None
        assert len(result["lens_scores"]) == 1

    def test_map_gbe_balance_to_result(self, gbe_service):
        """GBE BalanceReport → Gidede balance_result."""
        report = {
            "balance_type": "transitive",
            "elements": [{"name": "Pistol"}],
            "payoff_matrix": None,
            "dominant_strategies": [],
            "nash_equilibria": [],
            "recommendations": [],
        }
        result = gbe_service.map_gbe_balance_to_result(report)

        assert result["balance_type"] == "transitive"
        assert len(result["elements"]) == 1


# ============================================================
# Тесты sync_to_gbe
# ============================================================

class TestSyncToGBE:
    """Тесты экспорта Project State в GBE."""

    @pytest.mark.asyncio
    async def test_sync_to_gbe_full(self, gbe_service, full_project_state):
        """Полный Project State → все компоненты синхронизированы."""
        result = await gbe_service.sync_to_gbe(full_project_state)

        assert isinstance(result, GBESyncResult)
        assert result.direction == "to_gbe"
        assert result.status == "synced"
        assert "concept" in result.components_synced
        assert "core_loop" in result.components_synced
        assert "mda_profile" in result.components_synced
        assert "balance_result" in result.components_synced
        assert "progression_profile" in result.components_synced
        assert "economy_profile" in result.components_synced
        assert len(result.components_synced) == 6
        assert len(result.components_skipped) == 0
        assert len(result.warnings) == 0
        assert result.latency_ms >= 0

    @pytest.mark.asyncio
    async def test_sync_to_gbe_partial(self, gbe_service):
        """Частичный Project State → синхронизированы только заполненные."""
        partial_state = {
            "concept": {"title": "My Game", "genre": "RPG"},
            "mda_profile": {"mechanics": ["combat"]},
        }
        result = await gbe_service.sync_to_gbe(partial_state)

        assert "concept" in result.components_synced
        assert "mda_profile" in result.components_synced
        assert "core_loop" in result.components_skipped
        assert "balance_result" in result.components_skipped
        assert "progression_profile" in result.components_skipped
        assert "economy_profile" in result.components_skipped
        assert result.status == "synced_with_warnings"

    @pytest.mark.asyncio
    async def test_sync_to_gbe_empty(self, gbe_service):
        """Пустой Project State → все компоненты пропущены."""
        result = await gbe_service.sync_to_gbe({})

        assert len(result.components_synced) == 0
        assert len(result.components_skipped) == 6
        assert len(result.warnings) > 0
        assert result.status == "synced_with_warnings"

    @pytest.mark.asyncio
    async def test_sync_to_gbe_null_values(self, gbe_service):
        """Project State с null-значениями → компоненты пропущены."""
        state = {
            "concept": None,
            "core_loop": None,
            "mda_profile": {"mechanics": ["test"]},
            "balance_result": None,
            "progression_profile": None,
            "economy_profile": None,
        }
        result = await gbe_service.sync_to_gbe(state)

        assert "mda_profile" in result.components_synced
        assert "concept" in result.components_skipped

    @pytest.mark.asyncio
    async def test_sync_to_gbe_saves_to_history(self, gbe_service, full_project_state):
        """sync_to_gbe сохраняет запись в историю синхронизаций."""
        await gbe_service.sync_to_gbe(full_project_state)

        history = gbe_service.get_sync_history()
        assert len(history) == 1
        assert history[0]["direction"] == "to_gbe"
        assert len(history[0]["components_synced"]) == 6

    @pytest.mark.asyncio
    async def test_sync_to_gbe_concept_missing_economy_warning(self, gbe_service):
        """Отсутствие economy → предупреждение о Machinations."""
        state = {
            "concept": {"title": "Game"},
            "economy_profile": None,
        }
        result = await gbe_service.sync_to_gbe(state)
        assert any("Machinations" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_sync_to_gbe_sync_id_unique(self, gbe_service, full_project_state):
        """Каждый sync_to_gbe генерирует уникальный sync_id."""
        result1 = await gbe_service.sync_to_gbe(full_project_state)
        result2 = await gbe_service.sync_to_gbe(full_project_state)
        assert result1.sync_id != result2.sync_id


# ============================================================
# Тесты sync_from_gbe
# ============================================================

class TestSyncFromGBE:
    """Тесты импорта данных из GBE."""

    @pytest.mark.asyncio
    async def test_sync_from_gbe_full(self, gbe_service, full_gbe_data):
        """Полные данные GBE → все компоненты синхронизированы."""
        result = await gbe_service.sync_from_gbe(full_gbe_data)

        assert isinstance(result, GBESyncResult)
        assert result.direction == "from_gbe"
        assert "concept" in result.components_synced
        assert "mda_profile" in result.components_synced
        assert "balance_result" in result.components_synced
        assert "progression_profile" in result.components_synced
        assert "economy_profile" in result.components_synced

    @pytest.mark.asyncio
    async def test_sync_from_gbe_partial(self, gbe_service):
        """Частичные данные GBE → только blueprint импортирован."""
        partial_data = {
            "blueprint": {"name": "Game", "genre": "RPG"},
        }
        result = await gbe_service.sync_from_gbe(partial_data)

        assert "concept" in result.components_synced
        assert "mda_profile" in result.components_skipped

    @pytest.mark.asyncio
    async def test_sync_from_gbe_empty(self, gbe_service):
        """Пустые данные GBE → все компоненты пропущены."""
        result = await gbe_service.sync_from_gbe({})

        assert len(result.components_synced) == 0
        assert len(result.components_skipped) == 5
        assert any("blueprint" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_sync_from_gbe_saves_to_history(self, gbe_service, full_gbe_data):
        """sync_from_gbe сохраняет запись в историю."""
        await gbe_service.sync_from_gbe(full_gbe_data)

        history = gbe_service.get_sync_history()
        assert len(history) == 1
        assert history[0]["direction"] == "from_gbe"


# ============================================================
# Тесты handle_webhook
# ============================================================

class TestHandleWebhook:
    """Тесты обработки вебхуков от GBE."""

    @pytest.mark.asyncio
    async def test_webhook_blueprint_updated(self, gbe_service):
        """Вебхук blueprint.updated → queued."""
        payload = GBEWebhookPayload(
            event_type="blueprint.updated",
            project_id="proj-001",
            component="blueprint",
            changed_fields=["name", "genre"],
        )
        result = await gbe_service.handle_webhook(payload)

        assert isinstance(result, GBEWebhookResult)
        assert result.acknowledged is True
        assert result.action_taken == "queued"
        assert result.event_type == "blueprint.updated"
        assert "stale" in result.message.lower()

    @pytest.mark.asyncio
    async def test_webhook_diagram_changed(self, gbe_service):
        """Вебхук diagram.changed → queued."""
        payload = GBEWebhookPayload(
            event_type="diagram.changed",
            project_id="proj-001",
            component="diagram",
        )
        result = await gbe_service.handle_webhook(payload)

        assert result.acknowledged is True
        assert result.action_taken == "queued"
        assert "Economy" in result.message or "recalculation" in result.message.lower()

    @pytest.mark.asyncio
    async def test_webhook_sync_requested(self, gbe_service):
        """Вебхук sync.requested → queued."""
        payload = GBEWebhookPayload(
            event_type="sync.requested",
            project_id="proj-001",
            component="blueprint",
        )
        result = await gbe_service.handle_webhook(payload)

        assert result.action_taken == "queued"
        assert "Sync requested" in result.message

    @pytest.mark.asyncio
    async def test_webhook_lint_completed(self, gbe_service):
        """Вебхук lint.completed → processed."""
        payload = GBEWebhookPayload(
            event_type="lint.completed",
            project_id="proj-001",
            component="balance",
        )
        result = await gbe_service.handle_webhook(payload)

        assert result.action_taken == "processed"
        assert "Lint completed" in result.message

    @pytest.mark.asyncio
    async def test_webhook_unknown_event(self, gbe_service):
        """Неизвестный тип события → ignored."""
        payload = GBEWebhookPayload(
            event_type="unknown.event",
            project_id="proj-001",
        )
        result = await gbe_service.handle_webhook(payload)

        assert result.acknowledged is True
        assert result.action_taken == "ignored"
        assert "Unknown" in result.message

    @pytest.mark.asyncio
    async def test_webhook_has_timestamp(self, gbe_service):
        """Вебхук возвращает корректный timestamp."""
        payload = GBEWebhookPayload(
            event_type="blueprint.updated",
            project_id="proj-001",
        )
        result = await gbe_service.handle_webhook(payload)
        assert result.timestamp is not None
        assert len(result.timestamp) > 0


# ============================================================
# Тесты get_project_status
# ============================================================

class TestGetProjectStatus:
    """Тесты получения статуса проекта."""

    @pytest.mark.asyncio
    async def test_get_project_status_returns_dict(self, gbe_service):
        """get_project_status возвращает dict."""
        result = await gbe_service.get_project_status("proj-001")

        assert isinstance(result, dict)
        assert result["project_id"] == "proj-001"
        assert result["status"] == "active"

    @pytest.mark.asyncio
    async def test_get_project_status_has_components(self, gbe_service):
        """Статус содержит все компоненты."""
        result = await gbe_service.get_project_status("proj-001")

        components = result["components"]
        assert "concept" in components
        assert "core_loop" in components
        assert "mda_profile" in components
        assert "balance" in components
        assert "progression" in components
        assert "economy" in components
        assert "gdd" in components

    @pytest.mark.asyncio
    async def test_get_project_status_is_mock(self, gbe_service):
        """Статус показывает mock-режим."""
        result = await gbe_service.get_project_status("proj-001")
        assert result["is_mock"] is True

    @pytest.mark.asyncio
    async def test_get_project_status_has_gbe_version(self, gbe_service):
        """Статус содержит версию GBE."""
        result = await gbe_service.get_project_status("proj-001")
        assert "gbe_version" in result

    @pytest.mark.asyncio
    async def test_get_project_status_has_sync_history_count(self, gbe_service):
        """Статус содержит счётчик истории синхронизаций."""
        result = await gbe_service.get_project_status("proj-001")
        assert "sync_history_count" in result


# ============================================================
# Тесты test_connection
# ============================================================

class TestConnection:
    """Тесты проверки подключения к GBE."""

    @pytest.mark.asyncio
    async def test_test_connection_mock_mode(self, gbe_service):
        """Mock-режим → подключение всегда успешно."""
        result = await gbe_service.test_connection()

        assert isinstance(result, GBEConnectionStatus)
        assert result.connected is True
        assert result.is_mock is True
        assert result.message is not None

    @pytest.mark.asyncio
    async def test_test_connection_has_base_url(self, gbe_service):
        """Результат содержит base_url."""
        result = await gbe_service.test_connection()
        assert result.base_url == "https://gbe.test.com/api/v1"

    @pytest.mark.asyncio
    async def test_test_connection_has_latency(self, gbe_service):
        """Результат содержит latency_ms."""
        result = await gbe_service.test_connection()
        assert isinstance(result.latency_ms, int)
        assert result.latency_ms >= 0


# ============================================================
# Тесты get_sync_history
# ============================================================

class TestSyncHistory:
    """Тесты истории синхронизаций."""

    @pytest.mark.asyncio
    async def test_sync_history_empty(self, gbe_service):
        """Изначально история пуста."""
        history = gbe_service.get_sync_history()
        assert len(history) == 0

    @pytest.mark.asyncio
    async def test_sync_history_after_sync(self, gbe_service, full_project_state):
        """После sync_to_gbe история содержит запись."""
        await gbe_service.sync_to_gbe(full_project_state)
        history = gbe_service.get_sync_history()
        assert len(history) == 1

    @pytest.mark.asyncio
    async def test_sync_history_multiple(self, gbe_service, full_project_state, full_gbe_data):
        """Несколько синхронизаций → несколько записей."""
        await gbe_service.sync_to_gbe(full_project_state)
        await gbe_service.sync_from_gbe(full_gbe_data)
        await gbe_service.sync_to_gbe(full_project_state)

        history = gbe_service.get_sync_history()
        assert len(history) == 3

    @pytest.mark.asyncio
    async def test_sync_history_limit(self, gbe_service, full_project_state):
        """Ограничение количества записей в истории."""
        for _ in range(5):
            await gbe_service.sync_to_gbe(full_project_state)

        history = gbe_service.get_sync_history(limit=3)
        assert len(history) == 3


# ============================================================
# Тесты Legacy methods
# ============================================================

class TestLegacyMethods:
    """Тесты обратной совместимости legacy-методов."""

    @pytest.mark.asyncio
    async def test_import_gdd_returns_dict(self, gbe_service, full_project_state):
        """import_gdd возвращает dict (legacy)."""
        result = await gbe_service.import_gdd(full_project_state)
        assert isinstance(result, dict)
        assert "sync_id" in result
        assert "status" in result

    @pytest.mark.asyncio
    async def test_export_to_gbe_returns_dict(self, gbe_service, full_project_state):
        """export_to_gbe возвращает dict с legacy-полями (legacy)."""
        result = await gbe_service.export_to_gbe(full_project_state)
        assert isinstance(result, dict)
        assert "export_id" in result
        assert "format" in result
        assert "status" in result
        assert "validation" in result
        assert "components_exported" in result

    @pytest.mark.asyncio
    async def test_export_to_gbe_validation(self, gbe_service, full_project_state):
        """export_to_gbe: validation.valid зависит от warnings."""
        result = await gbe_service.export_to_gbe(full_project_state)
        # Полный проект → нет warnings → valid=True
        assert result["validation"]["valid"] is True

    @pytest.mark.asyncio
    async def test_sync_changes_returns_dict(self, gbe_service):
        """sync_changes возвращает dict (legacy)."""
        result = await gbe_service.sync_changes("proj-001", {"concept": {"title": "X"}})
        assert isinstance(result, dict)
        assert "sync_id" in result


# ============================================================
# Тесты моделей Pydantic
# ============================================================

class TestPydanticModels:
    """Тесты Pydantic-моделей маппинга."""

    def test_gbe_blueprint_defaults(self):
        """GBEBlueprint с дефолтами."""
        bp = GBEBlueprint()
        assert bp.name == ""
        assert bp.genre == ""
        assert bp.blueprint_type == "game_project"

    def test_gbe_mda_model_defaults(self):
        """GBEMDAModel с дефолтами."""
        mda = GBEMDAModel()
        assert mda.mechanics == []
        assert mda.dynamics == []
        assert mda.aesthetics == []

    def test_gbe_diagram_defaults(self):
        """GBEDiagram с дефолтами."""
        dia = GBEDiagram()
        assert dia.diagram_type == "machinations"
        assert dia.nodes == []
        assert dia.connections == []

    def test_gbe_balance_report_defaults(self):
        """GBEBalanceReport с дефолтами."""
        br = GBEBalanceReport()
        assert br.balance_type == "transitive"
        assert br.elements == []

    def test_gbe_progression_model_defaults(self):
        """GBEProgressionModel с дефолтами."""
        pm = GBEProgressionModel()
        assert pm.total_levels == 0
        assert pm.curve_type == "linear"

    def test_gbe_economy_model_defaults(self):
        """GBEEconomyModel с дефолтами."""
        em = GBEEconomyModel()
        assert em.economy_type == "engine"
        assert em.resources == []

    def test_gbe_sync_result_defaults(self):
        """GBESyncResult с дефолтами."""
        sr = GBESyncResult()
        assert sr.direction == "to_gbe"
        assert sr.status == "synced"

    def test_gbe_webhook_result_defaults(self):
        """GBEWebhookResult с дефолтами."""
        wr = GBEWebhookResult()
        assert wr.acknowledged is True
        assert wr.action_taken == ""

    def test_gbe_connection_status_defaults(self):
        """GBEConnectionStatus с дефолтами."""
        cs = GBEConnectionStatus()
        assert cs.connected is False
        assert cs.is_mock is True

    def test_gbe_blueprint_serialization(self):
        """GBEBlueprint сериализуется в dict."""
        bp = GBEBlueprint(name="Test", genre="RPG")
        d = bp.model_dump()
        assert d["name"] == "Test"
        assert d["genre"] == "RPG"
        assert "blueprint_id" in d

    def test_gbe_sync_result_serialization(self):
        """GBESyncResult сериализуется в dict."""
        sr = GBESyncResult(
            direction="from_gbe",
            components_synced=["concept"],
        )
        d = sr.model_dump()
        assert d["direction"] == "from_gbe"
        assert d["components_synced"] == ["concept"]


# ============================================================
# Тесты Edge Cases
# ============================================================

class TestEdgeCases:
    """Граничные случаи."""

    def test_service_with_empty_api_key(self):
        """Сервис с пустым API-ключом."""
        service = GBEBridgeService(api_key="")
        assert service.api_key == ""
        assert service._is_mock is True

    def test_service_with_custom_url(self):
        """Сервис с кастомным URL."""
        service = GBEBridgeService(base_url="http://localhost:8080/api")
        assert service.base_url == "http://localhost:8080/api"

    @pytest.mark.asyncio
    async def test_sync_to_gbe_concept_with_extra_fields(self, gbe_service):
        """Concept с неожиданными полями → маппинг не ломается."""
        state = {
            "concept": {
                "title": "Game",
                "genre": "RPG",
                "unexpected_field": "value",
                "nested": {"deep": True},
            },
        }
        result = await gbe_service.sync_to_gbe(state)
        assert "concept" in result.components_synced

    @pytest.mark.asyncio
    async def test_sync_from_gbe_with_extra_gbe_fields(self, gbe_service):
        """GBE данные с неожиданными полями → маппинг не ломается."""
        gbe_data = {
            "blueprint": {
                "name": "Game",
                "genre": "RPG",
                "extra_field": "value",
            },
        }
        result = await gbe_service.sync_from_gbe(gbe_data)
        assert "concept" in result.components_synced

    @pytest.mark.asyncio
    async def test_webhook_empty_component(self, gbe_service):
        """Вебхук с пустым component → всё равно обрабатывается."""
        payload = GBEWebhookPayload(
            event_type="blueprint.updated",
            project_id="proj-001",
            component="",
        )
        result = await gbe_service.handle_webhook(payload)
        assert result.acknowledged is True

    @pytest.mark.asyncio
    async def test_webhook_with_data(self, gbe_service):
        """Вебхук с data → обрабатывается корректно."""
        payload = GBEWebhookPayload(
            event_type="diagram.changed",
            project_id="proj-001",
            component="diagram",
            data={"nodes_added": 3, "nodes_removed": 1},
        )
        result = await gbe_service.handle_webhook(payload)
        assert result.acknowledged is True

    def test_map_economy_with_empty_machinations(self, gbe_service):
        """Economy с пустым machinations_model ({}) → нет диаграммы (falsy)."""
        economy = {"economy_type": "engine", "resources": [], "machinations_model": {}}
        result = gbe_service.map_economy_to_gbe_model(economy)
        # Пустой dict {} — falsy в Python, поэтому маппинг не срабатывает
        assert result.machinations_diagram is None

    def test_map_economy_with_nonempty_machinations(self, gbe_service):
        """Economy с непустым machinations_model → диаграмма создана."""
        economy = {
            "economy_type": "engine",
            "resources": [],
            "machinations_model": {"nodes": [{"id": "n1"}], "connections": []},
        }
        result = gbe_service.map_economy_to_gbe_model(economy)
        assert result.machinations_diagram is not None
        assert len(result.machinations_diagram.nodes) == 1

    @pytest.mark.asyncio
    async def test_multiple_syncs_independent(self, gbe_service, full_project_state):
        """Множественные синхронизации не влияют друг на друга."""
        result1 = await gbe_service.sync_to_gbe(full_project_state)
        result2 = await gbe_service.sync_to_gbe(full_project_state)

        assert result1.sync_id != result2.sync_id
        assert result1.components_synced == result2.components_synced
