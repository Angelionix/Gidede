"""
Gidede — Тесты pipeline_service (сквозной пайплайн)
Фаза 4.C.9: Расширение пайплайна до Блоков 1–5

Покрытие:
1. _prepare_balance_input — обогащение данных из Блоков 1-3
2. _prepare_progression_and_economy_input — подготовка входа для Блока 5
3. Cascade-обновление stale-блоков
4. Блок-зависимости и STALE_DOWNSTREAM
5. Pipeline state с 5 блоками
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.pipeline_service import (
    PipelineService,
    BlockStatus,
    PipelineEvent,
    BLOCK_DEPENDENCIES,
    BLOCK_EVENTS,
    STALE_DOWNSTREAM,
    BLOCK_NAMES,
    BlockProgress,
    PipelineState,
)


# ============================================================
# ФИКСТУРЫ
# ============================================================

@pytest.fixture
def mock_db():
    """Mock AsyncSession."""
    db = AsyncMock()
    return db


@pytest.fixture
def mock_redis():
    """Mock RedisClient."""
    redis = AsyncMock()
    redis.get_cache = AsyncMock(return_value=None)
    redis.set_cache = AsyncMock(return_value=True)
    redis.delete_cache = AsyncMock(return_value=True)
    redis.publish_event = AsyncMock()
    return redis


@pytest.fixture
def pipeline_service(mock_db, mock_redis):
    """PipelineService с mock-зависимостями."""
    return PipelineService(db=mock_db, redis_client=mock_redis)


@pytest.fixture
def pipeline_service_no_redis(mock_db):
    """PipelineService без Redis."""
    return PipelineService(db=mock_db, redis_client=None)


def make_mock_project(
    has_concept=True,
    has_core_loop=True,
    has_mda=True,
    has_balance=True,
    has_progression=True,
    has_economy=True,
):
    """Создать mock-проект с заполненными блоками."""
    project = MagicMock()
    project.id = "test-project-id"
    project.name = "Test Game"
    project.project_stage = "concept"

    # Concept (Block 1)
    concept = MagicMock()
    concept.id = "concept-id"
    concept.genre = "rpg"
    concept.aesthetic_profile = {"primary": "challenge", "secondary": "fantasy", "tertiary": "discovery"} if has_concept else None
    concept.dynamics_profile = {"target_dynamics": ["competition", "narrative"]}
    concept.mechanic_set = {"base": [{"name": "Exploration"}], "combat": [{"name": "Turn-based"}]}
    concept.core_loop_candidates = [{"name": "Explore-Fight-Loot"}]
    concept.usp = "Unique progression system"
    concept.one_pager_data = {"title": "Test Game"}
    concept.input_data = {"idea": "A roguelike about alchemy"}
    project.concept = concept

    # Core Loop (Block 2)
    core_loop = MagicMock()
    core_loop.structural_type = "Engine"
    core_loop.steps_data = [
        {"name": "Explore", "mechanics": ["Exploration"], "resource": "gold"},
        {"name": "Fight", "mechanics": ["Turn-based"], "resource_in": "gold", "resource_out": "xp"},
    ] if has_core_loop else None
    core_loop.inner_loops = []
    core_loop.outer_loops = []
    core_loop.meta_loop = None
    core_loop.loop_hierarchy = {"levels": 6}
    core_loop.pathologies = []
    core_loop.recommendations = []
    core_loop.full_profile = {}
    project.core_loop = core_loop

    # MDA (Block 3)
    mda = MagicMock()
    mda.mechanic_set = {"selected": ["Exploration", "Turn-based"]} if has_mda else None
    mda.target_dynamics = ["competition", "narrative"]
    mda.primary_aesthetic = "challenge"
    mda.secondary_aesthetic = "fantasy"
    mda.machinations_model = {}
    mda.full_profile = {}
    project.mda_profile = mda

    # Balance (Block 4)
    balance = MagicMock()
    balance.elements = [{"name": "Sword", "cost": 100, "power": 50}] if has_balance else None
    balance.overall_balance_score = 0.85
    balance.full_result = {}
    project.balance_result = balance

    # Progression (Block 5a)
    progression = MagicMock()
    progression.curves = {"xp_to_level": "exponential"} if has_progression else None
    progression.tier_model = {"tiers": 3} if has_progression else None
    progression.total_levels = 50 if has_progression else None
    progression.full_profile = {}
    project.progression = progression

    # Economy (Block 5b)
    economy = MagicMock()
    economy.resource_model = {"gold": "Valued"} if has_economy else None
    economy.full_profile = {}
    project.economy = economy

    # GDD, Checklist (Blocks 6, 7+)
    project.gdd = None
    project.checklist = None

    return project


# ============================================================
# ТЕСТЫ: _prepare_balance_input
# ============================================================

class TestPrepareBalanceInput:
    """Тесты подготовки входных данных для Блока 4 (Баланс)."""

    @pytest.mark.asyncio
    async def test_balance_input_with_all_blocks(self, pipeline_service):
        """Все предыдущие блоки заполнены — балансировка полноценная."""
        project = make_mock_project()
        result = await pipeline_service._prepare_balance_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is True
        assert result["has_mda"] is True
        assert "genre" in result
        assert "concept_data" in result
        assert "core_loop_data" in result
        assert "mda_data" in result
        assert "warnings" not in result

    @pytest.mark.asyncio
    async def test_balance_input_missing_concept(self, pipeline_service):
        """Нет концепции — предупреждение."""
        project = make_mock_project(has_concept=False)
        result = await pipeline_service._prepare_balance_input(project)

        assert result["has_concept"] is False
        assert "warnings" in result
        assert any("Концепция" in w for w in result["warnings"])

    @pytest.mark.asyncio
    async def test_balance_input_missing_core_loop(self, pipeline_service):
        """Нет Core Loop — предупреждение о циклах."""
        project = make_mock_project(has_core_loop=False)
        result = await pipeline_service._prepare_balance_input(project)

        assert result["has_core_loop"] is False
        assert "warnings" in result
        assert any("Core Loop" in w for w in result["warnings"])

    @pytest.mark.asyncio
    async def test_balance_input_missing_mda(self, pipeline_service):
        """Нет MDA — предупреждение о механиках."""
        project = make_mock_project(has_mda=False)
        result = await pipeline_service._prepare_balance_input(project)

        assert result["has_mda"] is False
        assert "warnings" in result
        assert any("MDA" in w for w in result["warnings"])


# ============================================================
# ТЕСТЫ: _prepare_progression_and_economy_input
# ============================================================

class TestPrepareProgressionAndEconomyInput:
    """Тесты подготовки входных данных для Блока 5."""

    @pytest.mark.asyncio
    async def test_full_input_with_all_blocks(self, pipeline_service):
        """Все 4 предыдущих блока заполнены — полные данные."""
        project = make_mock_project()
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is True
        assert result["has_mda"] is True
        assert result["has_balance"] is True

        # Прогрессия
        prog = result["progression_input"]
        assert prog["genre"] == "rpg"
        assert prog["idea"] == "A roguelike about alchemy"
        assert "aesthetic_profile" in prog
        assert "core_loop_type" in prog
        assert "mda_mechanics" in prog
        assert "balance_elements" in prog

        # Экономика
        econ = result["economy_input"]
        assert "core_loop_resources" in econ
        assert "core_loop_type" in econ
        assert "mda_mechanics" in econ
        assert "genre" in econ

    @pytest.mark.asyncio
    async def test_progression_input_extracts_resources(self, pipeline_service):
        """Ресурсы извлекаются из шагов Core Loop."""
        project = make_mock_project()
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        econ = result["economy_input"]
        resources = econ["core_loop_resources"]
        assert "gold" in resources
        assert "xp" in resources

    @pytest.mark.asyncio
    async def test_progression_input_with_existing_progression(self, pipeline_service):
        """Если прогрессия уже есть — связываем с экономикой."""
        project = make_mock_project(has_progression=True)
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        econ = result["economy_input"]
        assert "progression_curves" in econ
        assert "tier_model" in econ
        assert "total_levels" in econ
        assert econ["total_levels"] == 50

    @pytest.mark.asyncio
    async def test_missing_all_previous_blocks(self, pipeline_service):
        """Все предыдущие блоки пусты — 4 предупреждения."""
        project = make_mock_project(
            has_concept=False, has_core_loop=False, has_mda=False, has_balance=False
        )
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        assert result["has_concept"] is False
        assert result["has_core_loop"] is False
        assert result["has_mda"] is False
        assert result["has_balance"] is False
        assert "warnings" in result
        assert len(result["warnings"]) == 4


# ============================================================
# ТЕСТЫ: STALE_DOWNSTREAM и зависимости
# ============================================================

class TestBlockDependencies:
    """Тесты карты зависимостей и stale-распространения."""

    def test_block_1_stale_downstream(self):
        """Обновление Блока 1 → все зависимые stale."""
        downstream = STALE_DOWNSTREAM[1]
        assert 2 in downstream
        assert 3 in downstream
        assert 4 in downstream
        assert 5 in downstream
        assert 6 in downstream
        assert 7 in downstream
        assert 8 in downstream

    def test_block_4_stale_downstream(self):
        """Обновление Блока 4 → Блоки 5, 6, 8 stale."""
        downstream = STALE_DOWNSTREAM[4]
        assert 5 in downstream
        assert 6 in downstream
        assert 8 in downstream
        assert 3 not in downstream  # Блок 3 не зависит от 4
        assert 2 not in downstream

    def test_block_5_stale_downstream(self):
        """Обновление Блока 5 → Блоки 6, 8 stale."""
        downstream = STALE_DOWNSTREAM[5]
        assert 6 in downstream
        assert 8 in downstream
        assert 4 not in downstream  # Блок 4 не зависит от 5

    def test_block_dependencies_chain(self):
        """Цепочка зависимостей: 1→2→3→4→5."""
        assert BLOCK_DEPENDENCIES[1] == []
        assert 1 in BLOCK_DEPENDENCIES[2]
        assert 1 in BLOCK_DEPENDENCIES[3]
        assert 2 in BLOCK_DEPENDENCIES[3]
        assert 1 in BLOCK_DEPENDENCIES[4]
        assert 2 in BLOCK_DEPENDENCIES[4]
        assert 3 in BLOCK_DEPENDENCIES[4]
        assert 4 in BLOCK_DEPENDENCIES[5]

    def test_all_blocks_have_events(self):
        """Блоки 1-6 генерируют события."""
        for block_id in [1, 2, 3, 4, 5, 6]:
            assert block_id in BLOCK_EVENTS

    def test_block_5_event_is_progression(self):
        """Блок 5 генерирует событие PROGRESSION_UPDATED."""
        assert BLOCK_EVENTS[5] == PipelineEvent.PROGRESSION_UPDATED


# ============================================================
# ТЕСТЫ: Notify и stale-механика
# ============================================================

class TestNotifyAndUpdate:
    """Тесты уведомлений и stale-механики."""

    @pytest.mark.asyncio
    async def test_notify_block_4_marks_5_6_8_stale(self, pipeline_service, mock_redis):
        """Обновление Блока 4 → Блоки 5, 6, 8 помечаются stale."""
        result = await pipeline_service.notify_block_updated(
            project_id="test-project",
            block_id=4,
            user_id="user-1",
        )

        assert result["status"] == "ok"
        assert result["event"] == "balance_updated"
        assert 5 in result["stale_blocks"]
        assert 6 in result["stale_blocks"]
        assert 8 in result["stale_blocks"]
        assert 3 not in result["stale_blocks"]

    @pytest.mark.asyncio
    async def test_notify_block_1_marks_many_stale(self, pipeline_service, mock_redis):
        """Обновление Блока 1 → 7 блоков stale."""
        result = await pipeline_service.notify_block_updated(
            project_id="test-project",
            block_id=1,
            user_id="user-1",
        )

        assert result["status"] == "ok"
        assert len(result["stale_blocks"]) == 7

    @pytest.mark.asyncio
    async def test_notify_unknown_block_ignored(self, pipeline_service, mock_redis):
        """Неизвестный блок не генерирует событий."""
        result = await pipeline_service.notify_block_updated(
            project_id="test-project",
            block_id=9,
            user_id="user-1",
        )

        assert result["status"] == "ignored"

    @pytest.mark.asyncio
    async def test_clear_stale_no_redis(self, pipeline_service_no_redis):
        """Без Redis — clear_stale всегда успешен."""
        result = await pipeline_service_no_redis.clear_stale_status("proj", 5)
        assert result is True


# ============================================================
# ТЕСТЫ: PipelineState и BlockProgress
# ============================================================

class TestPipelineStateModels:
    """Тесты моделей данных пайплайна."""

    def test_block_progress_to_dict(self):
        """BlockProgress корректно сериализуется."""
        bp = BlockProgress(
            block_id=5,
            name="Экономика и прогрессия",
            status=BlockStatus.COMPLETED,
            is_filled=True,
            updated_at="2026-05-19T12:00:00Z",
        )
        d = bp.to_dict()
        assert d["block_id"] == 5
        assert d["status"] == "completed"
        assert d["is_filled"] is True

    def test_pipeline_state_to_dict(self):
        """PipelineState корректно сериализуется."""
        blocks = [
            BlockProgress(block_id=1, name="Генератор концепции", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=5, name="Экономика и прогрессия", status=BlockStatus.EMPTY),
        ]
        state = PipelineState(
            project_id="test-id",
            project_name="Test Game",
            blocks=blocks,
            completion_percent=62,
            current_stage="progression",
            next_block=5,
        )
        d = state.to_dict()
        assert d["completion_percent"] == 62
        assert len(d["blocks"]) == 2
        assert d["next_block"] == 5

    def test_block_status_values(self):
        """Все статусы корректно определены."""
        assert BlockStatus.EMPTY.value == "empty"
        assert BlockStatus.IN_PROGRESS.value == "in_progress"
        assert BlockStatus.COMPLETED.value == "completed"
        assert BlockStatus.STALE.value == "stale"

    def test_pipeline_event_values(self):
        """Все события пайплайна корректно определены."""
        assert PipelineEvent.BALANCE_UPDATED.value == "balance_updated"
        assert PipelineEvent.PROGRESSION_UPDATED.value == "progression_updated"
        assert PipelineEvent.ECONOMY_UPDATED.value == "economy_updated"


# ============================================================
# ТЕСТЫ: _flag_key маппинг
# ============================================================

class TestFlagKeyMapping:
    """Тесты маппинга block_id → флаг заполненности."""

    def test_all_blocks_mapped(self, pipeline_service):
        """Все блоки 1-8 имеют маппинг флагов."""
        for block_id in range(1, 9):
            key = pipeline_service._flag_key(block_id)
            assert key != "", f"Блок {block_id} не имеет маппинга флага"

    def test_block_5_flag_is_progression(self, pipeline_service):
        """Блок 5 маппится на has_progression."""
        assert pipeline_service._flag_key(5) == "has_progression"

    def test_block_4_flag_is_balance(self, pipeline_service):
        """Блок 4 маппится на has_balance."""
        assert pipeline_service._flag_key(4) == "has_balance"


# ============================================================
# ТЕСТЫ: _generate_notifications
# ============================================================

class TestNotifications:
    """Тесты генерации уведомлений."""

    def test_stale_block_5_notification(self, pipeline_service):
        """Stale Блок 5 → уведомление о пересчёте прогрессии."""
        blocks = [
            BlockProgress(block_id=5, name="Экономика и прогрессия", status=BlockStatus.STALE, stale_since="2026-05-19T12:00:00Z"),
        ]
        notifications = pipeline_service._generate_notifications(blocks)
        assert len(notifications) == 1
        assert "прогрессию" in notifications[0]["message"].lower() or "экономику" in notifications[0]["message"].lower()

    def test_no_notifications_for_completed(self, pipeline_service):
        """Завершённые блоки не генерируют уведомлений."""
        blocks = [
            BlockProgress(block_id=1, name="Генератор концепции", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=2, name="Core Loop Designer", status=BlockStatus.COMPLETED, is_filled=True),
        ]
        notifications = pipeline_service._generate_notifications(blocks)
        assert len(notifications) == 0

    def test_multiple_stale_blocks(self, pipeline_service):
        """Несколько stale-блоков → несколько уведомлений."""
        blocks = [
            BlockProgress(block_id=4, name="Баланс", status=BlockStatus.STALE, stale_since="2026-05-19T12:00:00Z"),
            BlockProgress(block_id=5, name="Экономика и прогрессия", status=BlockStatus.STALE, stale_since="2026-05-19T12:00:00Z"),
        ]
        notifications = pipeline_service._generate_notifications(blocks)
        assert len(notifications) == 2


# ============================================================
# ТЕСТЫ: _determine_next_block
# ============================================================

class TestDetermineNextBlock:
    """Тесты определения следующего блока."""

    def test_first_empty_block(self, pipeline_service):
        """Первый пустой блок — следующий для заполнения."""
        blocks = [
            BlockProgress(block_id=1, name="Блок 1", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=2, name="Блок 2", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=3, name="Блок 3", status=BlockStatus.EMPTY),
            BlockProgress(block_id=4, name="Блок 4", status=BlockStatus.EMPTY),
            BlockProgress(block_id=5, name="Блок 5", status=BlockStatus.EMPTY),
        ]
        next_block = pipeline_service._determine_next_block(blocks)
        assert next_block == 3

    def test_stale_block_when_all_filled(self, pipeline_service):
        """Все заполнены, но есть stale → первый stale."""
        blocks = [
            BlockProgress(block_id=1, name="Блок 1", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=2, name="Блок 2", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=3, name="Блок 3", status=BlockStatus.STALE, is_filled=True),
            BlockProgress(block_id=4, name="Блок 4", status=BlockStatus.STALE, is_filled=True),
            BlockProgress(block_id=5, name="Блок 5", status=BlockStatus.COMPLETED, is_filled=True),
        ]
        next_block = pipeline_service._determine_next_block(blocks)
        assert next_block == 3

    def test_all_good_returns_none(self, pipeline_service):
        """Все блоки заполнены и не stale → None."""
        blocks = [
            BlockProgress(block_id=1, name="Блок 1", status=BlockStatus.COMPLETED, is_filled=True),
            BlockProgress(block_id=2, name="Блок 2", status=BlockStatus.COMPLETED, is_filled=True),
        ]
        next_block = pipeline_service._determine_next_block(blocks)
        assert next_block is None
