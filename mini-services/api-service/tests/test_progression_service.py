"""
Gidede — Progression Service Tests
Фаза 4.C: Тесты для Блока 5 — Прогрессия (алгоритм 3.5, Этапы 1-4)

Тесты по этапам:
- Stage 1: Макро-параметры (3.5.1) — ~7 тестов
- Stage 2: Разбиение на тиры (3.5.2) — ~6 тестов
- Stage 3: Кривые прогрессии (3.5.3) — ~7 тестов
- Stage 4: Контент-план (3.5.4) — ~5 тестов
- Validation: grind, walls, empty levels — ~3 теста
- Pipeline: progression_design_full — ~4 теста
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.progression_service import (
    ProgressionService,
    GENRE_DURATION_MAP,
    PACING_MAP,
    GENRE_PROGRESSION_MAP,
    GENRE_LOCK_KEY_MAP,
    TIER_DISTRIBUTIONS,
    GENRE_XP_CURVE_MAP,
    GENRE_POWER_CURVE_MAP,
    MONETIZATION_GRIND_MULTIPLIER,
    MIN_TIER_LEVELS,
    GRIND_WARNING_THRESHOLD,
    GRIND_CRITICAL_THRESHOLD,
    WALL_DIFFICULTY_SPIKE,
)
from app.schemas.progression import (
    ProgressionInput,
    ProgressionConstraints,
    ProgressionMacroModel,
    TierInfo,
    TierModel,
    CurveSpec,
    ProgressionCurves,
    ContentTierPlan,
    UnlockEntry,
    PerceivedDifficultyEntry,
    ContentPlan,
    ProgressionValidation,
    ProgressionProfile,
)


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def mock_executor():
    """Мок PromptExecutor для тестирования без реальных AI-вызовов."""
    executor = AsyncMock()
    executor.execute = AsyncMock()
    executor.execute.return_value = MagicMock(
        data={},
        metadata={"prompt_id": "DEFAULT", "from_cache": False},
    )
    return executor


@pytest.fixture
def progression_service(mock_executor):
    """Создать ProgressionService с моком executor."""
    return ProgressionService(executor=mock_executor)


@pytest.fixture
def sample_input():
    """Тестовый ProgressionInput для RPG."""
    return ProgressionInput(
        concept={"genre": "rpg"},
        coreLoop={"structural_type": "engine", "resources": ["health", "mana", "gold"]},
        mdaProfile=None,
        targetDuration=None,
        targetLevels=None,
        progressionType=None,
        monetizationModel="premium",
        constraints=ProgressionConstraints(
            maxGrindTolerance=5,
            minRewardInterval=3,
            flowTarget="balanced",
            contentBudget="medium",
        ),
    )


@pytest.fixture
def sample_macro():
    """Тестовый ProgressionMacroModel для RPG."""
    return ProgressionMacroModel(
        duration=50,
        levels=30,
        progressionType="s_curve",
        monetizationModel="premium",
        contentRequirements={
            "genre": "rpg",
            "content_stages": 3,
            "enemy_configs": 22,
            "reward_types": 22,
            "ability_count": 9,
        },
        emergenceRatio=0.3,
        lockKeyModel="metroidvania",
    )


@pytest.fixture
def sample_tier_model(sample_macro):
    """Создать TierModel через сервис."""
    return TierModel(
        tiers=[
            TierInfo(index=0, level_range=[1, 6], level_count=6, scale="Локальный",
                     dominant_mechanic="Исследование", balance_type="transitive",
                     difficulty_curve="gradual", resource_state="scarcity",
                     transition_trigger="Достижение порога мощности"),
            TierInfo(index=1, level_range=[7, 15], level_count=9, scale="Региональный",
                     dominant_mechanic="Сражения", balance_type="intransitive",
                     difficulty_curve="gradual", resource_state="growth",
                     transition_trigger="Победа над боссом тира"),
            TierInfo(index=2, level_range=[16, 30], level_count=15, scale="Мировой",
                     dominant_mechanic="Развитие персонажа", balance_type="situational",
                     difficulty_curve="spike", resource_state="abundance",
                     transition_trigger=""),
        ],
        num_tiers=3,
        total_levels=30,
        transition_map={
            "tier_0 → tier_1": "Достижение порога мощности",
            "tier_1 → tier_2": "Победа над боссом тира",
        },
    )


@pytest.fixture
def sample_curves():
    """Тестовый ProgressionCurves."""
    return ProgressionCurves(
        xp_to_level=CurveSpec(
            type="triangular",
            formula="xp_to_level(L) = 50 * L * (L + 1) / 2",
            parameters={"base": 50, "multiplier": 1.0},
        ),
        level_to_power=CurveSpec(
            type="polynomial",
            formula="power = 10 * level^1.3",
            parameters={"base": 10, "exponent": 1.3},
        ),
        level_to_cost=CurveSpec(
            type="polynomial",
            formula="cost = 10.0 * level^1.3",
            parameters={"base": 10.0, "exponent": 1.3, "multiplier": 1.0},
        ),
        difficulty=CurveSpec(
            type="logistic_with_spikes",
            formula="perceived_difficulty(L) = 0.7 * L / 30 + Σ(spike)",
            parameters={
                "k": 0.7, "total_levels": 30, "spike_height": 0.25,
                "spike_width": 1.5, "tier_boundaries": [6, 15],
                "base_difficulty": 0.15, "max_difficulty": 0.95,
            },
        ),
    )


# ============================================================
# Stage 1: Макро-параметры (3.5.1)
# ============================================================

class TestCalculateMacroParams:
    """Тесты Этапа 1: Макро-параметры прогрессии."""

    @pytest.mark.asyncio
    async def test_duration_from_genre(self, progression_service, sample_input):
        """Длительность определяется по жанру, если не задана."""
        result = await progression_service.calculate_macro_params(sample_input)

        assert result.duration == GENRE_DURATION_MAP["rpg"]  # 50 часов

    @pytest.mark.asyncio
    async def test_explicit_duration_overrides(self, progression_service):
        """Явно заданная длительность не перезаписывается жанром."""
        input_data = ProgressionInput(
            concept={"genre": "rpg"},
            targetDuration=25,
            constraints=ProgressionConstraints(),
        )
        result = await progression_service.calculate_macro_params(input_data)

        assert result.duration == 25

    @pytest.mark.asyncio
    async def test_levels_calculated_from_pacing(self, progression_service, sample_input):
        """Количество уровней рассчитывается из pacing × duration."""
        result = await progression_service.calculate_macro_params(sample_input)

        assert result.levels >= 10
        # balanced pacing = 0.5 transitions/hour, 50h, 5 levels/transition
        # levels = max(10, int(50 * 0.5 * 5)) = 125
        assert result.levels == 125

    @pytest.mark.asyncio
    async def test_progression_type_from_genre(self, progression_service, sample_input):
        """Тип прогрессии определяется по жанру."""
        result = await progression_service.calculate_macro_params(sample_input)

        assert result.progressionType == GENRE_PROGRESSION_MAP["rpg"]  # s_curve

    @pytest.mark.asyncio
    async def test_emergence_ratio_range(self, progression_service, sample_input):
        """Emergence ratio в диапазоне 0-1."""
        result = await progression_service.calculate_macro_params(sample_input)

        assert 0.0 <= result.emergenceRatio <= 1.0

    @pytest.mark.asyncio
    async def test_lock_key_model_from_genre(self, progression_service, sample_input):
        """Модель замок-ключ определяется по жанру."""
        result = await progression_service.calculate_macro_params(sample_input)

        assert result.lockKeyModel == GENRE_LOCK_KEY_MAP["rpg"]  # metroidvania

    @pytest.mark.asyncio
    async def test_content_requirements_populated(self, progression_service, sample_input):
        """Требования к контенту заполнены."""
        result = await progression_service.calculate_macro_params(sample_input)

        assert "content_stages" in result.contentRequirements
        assert "enemy_configs" in result.contentRequirements
        assert "reward_types" in result.contentRequirements
        assert "ability_count" in result.contentRequirements

    @pytest.mark.asyncio
    async def test_ai_enrichment_applied(self, mock_executor):
        """AI-обогащение обновляет макро-параметры."""
        mock_executor.execute.return_value = MagicMock(
            data={
                "suggested_duration": 60,
                "suggested_levels": 40,
                "suggested_progression_type": "exponential",
                "emergence_ratio": 0.45,
                "lock_key_model": "dynamic",
            },
            metadata={"prompt_id": "PLAN_PROGRESSION_MACROS", "from_cache": False},
        )
        service = ProgressionService(executor=mock_executor)
        input_data = ProgressionInput(
            concept={"genre": "rpg"},
            targetDuration=50,
            targetLevels=30,
            constraints=ProgressionConstraints(),
        )

        result = await service.calculate_macro_params(input_data)

        assert result.duration == 60
        assert result.levels == 40
        assert result.progressionType == "exponential"
        assert result.emergenceRatio == 0.45
        assert result.lockKeyModel == "dynamic"

    @pytest.mark.asyncio
    async def test_ai_failure_uses_heuristics(self, mock_executor, sample_input):
        """При ошибке AI — эвристики."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = ProgressionService(executor=mock_executor)

        result = await service.calculate_macro_params(sample_input)

        assert result.duration > 0
        assert result.levels > 0


# ============================================================
# Stage 2: Разбиение на тиры (3.5.2)
# ============================================================

class TestPlanTiers:
    """Тесты Этапа 2: Разбиение на тиры."""

    @pytest.mark.asyncio
    async def test_tier_count_2_for_small_games(self, progression_service):
        """≤10 уровней → 2 тира."""
        macro = ProgressionMacroModel(
            duration=5, levels=10, progressionType="linear",
            monetizationModel="premium", contentRequirements={"genre": "casual"},
            emergenceRatio=0.1, lockKeyModel="linear",
        )
        result = await progression_service.plan_tiers(macro)

        assert result.num_tiers == 2

    @pytest.mark.asyncio
    async def test_tier_count_3_for_medium_games(self, progression_service):
        """11-25 уровней → 3 тира."""
        macro = ProgressionMacroModel(
            duration=15, levels=20, progressionType="linear",
            monetizationModel="premium", contentRequirements={"genre": "action"},
            emergenceRatio=0.2, lockKeyModel="linear",
        )
        result = await progression_service.plan_tiers(macro)

        assert result.num_tiers == 3

    @pytest.mark.asyncio
    async def test_tier_count_4_for_large_games(self, progression_service):
        """26-50 уровней → 4 тира."""
        macro = ProgressionMacroModel(
            duration=50, levels=30, progressionType="s_curve",
            monetizationModel="premium", contentRequirements={"genre": "rpg"},
            emergenceRatio=0.3, lockKeyModel="metroidvania",
        )
        result = await progression_service.plan_tiers(macro)

        assert result.num_tiers == 4

    @pytest.mark.asyncio
    async def test_tier_count_5_for_huge_games(self, progression_service):
        """50+ уровней → 5 тиров."""
        macro = ProgressionMacroModel(
            duration=100, levels=80, progressionType="diminishing",
            monetizationModel="premium", contentRequirements={"genre": "mmorpg"},
            emergenceRatio=0.4, lockKeyModel="hybrid",
        )
        result = await progression_service.plan_tiers(macro)

        assert result.num_tiers == 5

    @pytest.mark.asyncio
    async def test_tier_level_ranges_contiguous(self, progression_service, sample_macro):
        """Уровни тиров непрерывны."""
        result = await progression_service.plan_tiers(sample_macro)

        for i in range(len(result.tiers) - 1):
            current_end = result.tiers[i].level_range[1]
            next_start = result.tiers[i + 1].level_range[0]
            assert next_start == current_end + 1

    @pytest.mark.asyncio
    async def test_tier_minimum_levels(self, progression_service, sample_macro):
        """Каждый тир содержит минимум MIN_TIER_LEVELS уровней."""
        result = await progression_service.plan_tiers(sample_macro)

        for tier in result.tiers:
            assert tier.level_count >= MIN_TIER_LEVELS

    @pytest.mark.asyncio
    async def test_transition_map_populated(self, progression_service, sample_macro):
        """Карта переходов заполнена."""
        result = await progression_service.plan_tiers(sample_macro)

        assert len(result.transition_map) == result.num_tiers - 1

    @pytest.mark.asyncio
    async def test_ecology_resource_states(self, progression_service):
        """Структурный тип ecology → ECOLOGY_RESOURCE_STATES."""
        macro = ProgressionMacroModel(
            duration=50, levels=30, progressionType="s_curve",
            monetizationModel="premium", contentRequirements={"genre": "rpg"},
            emergenceRatio=0.3, lockKeyModel="metroidvania",
        )
        result = await progression_service.plan_tiers(
            macro, core_loop_profile={"structural_type": "ecology"}
        )

        ecology_states = {"tension", "expansion", "metastability", "competition"}
        for tier in result.tiers:
            assert tier.resource_state in ecology_states


# ============================================================
# Stage 3: Кривые прогрессии (3.5.3)
# ============================================================

class TestBuildCurves:
    """Тесты Этапа 3: Кривые прогрессии."""

    @pytest.mark.asyncio
    async def test_four_curves_returned(self, progression_service, sample_macro, sample_tier_model):
        """Возвращаются 4 кривые."""
        result = await progression_service.build_curves(sample_macro, sample_tier_model)

        assert isinstance(result, ProgressionCurves)
        assert result.xp_to_level is not None
        assert result.level_to_power is not None
        assert result.level_to_cost is not None
        assert result.difficulty is not None

    @pytest.mark.asyncio
    async def test_xp_curve_type_by_genre(self, progression_service, sample_macro, sample_tier_model):
        """Тип XP-кривой определяется по жанру."""
        result = await progression_service.build_curves(sample_macro, sample_tier_model)

        # RPG → triangular
        assert result.xp_to_level.type == "triangular"

    @pytest.mark.asyncio
    async def test_power_curve_type_by_genre(self, progression_service, sample_macro, sample_tier_model):
        """Тип power-кривой определяется по жанру."""
        result = await progression_service.build_curves(sample_macro, sample_tier_model)

        # RPG → polynomial
        assert result.level_to_power.type == "polynomial"

    @pytest.mark.asyncio
    async def test_cost_curve_includes_multiplier(self, progression_service, sample_macro, sample_tier_model):
        """Cost-кривая включает множитель монетизации."""
        result = await progression_service.build_curves(sample_macro, sample_tier_model)

        cost_multiplier = result.level_to_cost.parameters.get("multiplier", 1.0)
        expected = MONETIZATION_GRIND_MULTIPLIER.get("premium", 1.0)
        assert cost_multiplier == expected

    @pytest.mark.asyncio
    async def test_difficulty_curve_has_spikes(self, progression_service, sample_macro, sample_tier_model):
        """Difficulty-кривая содержит границы тиров для spike-ов."""
        result = await progression_service.build_curves(sample_macro, sample_tier_model)

        assert result.difficulty.type == "logistic_with_spikes"
        assert "tier_boundaries" in result.difficulty.parameters

    @pytest.mark.asyncio
    async def test_p2w_monetization_higher_cost(self, mock_executor):
        """Модель p2w → повышенный cost multiplier."""
        service = ProgressionService(executor=mock_executor)
        macro = ProgressionMacroModel(
            duration=50, levels=30, progressionType="s_curve",
            monetizationModel="p2w",
            contentRequirements={"genre": "rpg"},
            emergenceRatio=0.3, lockKeyModel="metroidvania",
        )
        tier_model = TierModel(
            tiers=[TierInfo(index=0, level_range=[1, 30], level_count=30)],
            num_tiers=1, total_levels=30, transition_map={},
        )

        result = await service.build_curves(macro, tier_model)

        cost_multiplier = result.level_to_cost.parameters.get("multiplier", 1.0)
        assert cost_multiplier == MONETIZATION_GRIND_MULTIPLIER["p2w"]  # 1.8

    @pytest.mark.asyncio
    async def test_linear_xp_curve_for_action(self, mock_executor):
        """Action → linear XP-кривая."""
        service = ProgressionService(executor=mock_executor)
        macro = ProgressionMacroModel(
            duration=15, levels=15, progressionType="linear",
            monetizationModel="premium",
            contentRequirements={"genre": "action"},
            emergenceRatio=0.2, lockKeyModel="linear",
        )
        tier_model = TierModel(
            tiers=[TierInfo(index=0, level_range=[1, 15], level_count=15)],
            num_tiers=1, total_levels=15, transition_map={},
        )

        result = await service.build_curves(macro, tier_model)
        assert result.xp_to_level.type == "linear"

    @pytest.mark.asyncio
    async def test_exponential_xp_curve_for_mmorpg(self, mock_executor):
        """MMORPG → exponential XP-кривая."""
        service = ProgressionService(executor=mock_executor)
        macro = ProgressionMacroModel(
            duration=500, levels=100, progressionType="diminishing",
            monetizationModel="freemium",
            contentRequirements={"genre": "mmorpg"},
            emergenceRatio=0.4, lockKeyModel="hybrid",
        )
        tier_model = TierModel(
            tiers=[
                TierInfo(index=i, level_range=[1, 100], level_count=100,
                         scale="Мировой", dominant_mechanic="Квесты",
                         balance_type="mixed", difficulty_curve="gradual",
                         resource_state="growth")
                for i in range(1)
            ],
            num_tiers=1, total_levels=100, transition_map={},
        )

        result = await service.build_curves(macro, tier_model)
        assert result.xp_to_level.type == "exponential"


# ============================================================
# Stage 4: Контент-план (3.5.4)
# ============================================================

class TestGenerateContentPlan:
    """Тесты Этапа 4: Контент-план."""

    @pytest.mark.asyncio
    async def test_content_plan_returned(self, progression_service, sample_macro, sample_tier_model, sample_curves):
        """Возвращается ContentPlan."""
        result = await progression_service.generate_content_plan(
            sample_macro, sample_tier_model, sample_curves,
        )

        assert isinstance(result, ContentPlan)

    @pytest.mark.asyncio
    async def test_tier_plans_match_tier_count(self, progression_service, sample_macro, sample_tier_model, sample_curves):
        """Количество tier_plans равно числу тиров."""
        result = await progression_service.generate_content_plan(
            sample_macro, sample_tier_model, sample_curves,
        )

        assert len(result.tier_plans) == sample_tier_model.num_tiers

    @pytest.mark.asyncio
    async def test_unlock_tree_populated(self, progression_service, sample_macro, sample_tier_model, sample_curves):
        """Дерево разблокировок заполнено."""
        result = await progression_service.generate_content_plan(
            sample_macro, sample_tier_model, sample_curves,
        )

        assert len(result.unlock_tree) > 0
        for entry in result.unlock_tree:
            assert isinstance(entry, UnlockEntry)
            assert entry.level >= 1

    @pytest.mark.asyncio
    async def test_difficulty_table_populated(self, progression_service, sample_macro, sample_tier_model, sample_curves):
        """Таблица сложности заполнена."""
        result = await progression_service.generate_content_plan(
            sample_macro, sample_tier_model, sample_curves,
        )

        assert len(result.perceived_difficulty_table) > 0
        for entry in result.perceived_difficulty_table:
            assert isinstance(entry, PerceivedDifficultyEntry)
            assert 0.0 <= entry.target_perceived_difficulty <= 1.0

    @pytest.mark.asyncio
    async def test_total_content_requirements(self, progression_service, sample_macro, sample_tier_model, sample_curves):
        """Общие требования к контенту рассчитываются."""
        result = await progression_service.generate_content_plan(
            sample_macro, sample_tier_model, sample_curves,
        )

        assert "enemy_types" in result.total_content_requirements
        assert "reward_types" in result.total_content_requirements
        assert "total_unlocks" in result.total_content_requirements


# ============================================================
# Validation
# ============================================================

class TestProgressionValidation:
    """Тесты валидации прогрессии."""

    def test_assess_emergence_ratio_sandbox(self, progression_service):
        """Sandbox → высокий emergence ratio."""
        ratio = progression_service._assess_emergence_ratio(None, None, "sandbox")
        assert ratio >= 0.7

    def test_assess_emergence_ratio_visual_novel(self, progression_service):
        """Visual novel → низкий emergence ratio."""
        ratio = progression_service._assess_emergence_ratio(None, None, "visual_novel")
        assert ratio <= 0.15

    def test_assess_emergence_ratio_ecology_boost(self, progression_service):
        """Ecology core loop → +0.2 к emergence ratio."""
        base_ratio = progression_service._assess_emergence_ratio(None, None, "rpg")
        ecology_ratio = progression_service._assess_emergence_ratio(
            {"structural_type": "ecology"}, None, "rpg"
        )
        assert ecology_ratio > base_ratio

    def test_assess_emergence_ratio_engine_penalty(self, progression_service):
        """Engine core loop → -0.1 к emergence ratio."""
        base_ratio = progression_service._assess_emergence_ratio(None, None, "rpg")
        engine_ratio = progression_service._assess_emergence_ratio(
            {"structural_type": "engine"}, None, "rpg"
        )
        assert engine_ratio < base_ratio

    def test_content_requirements_budget_low(self, progression_service):
        """Низкий бюджет → меньше контента."""
        result_low = progression_service._calculate_content_requirements(
            "rpg", 30, 50, "s_curve", "low"
        )
        result_high = progression_service._calculate_content_requirements(
            "rpg", 30, 50, "s_curve", "high"
        )
        assert result_low["enemy_configs"] < result_high["enemy_configs"]


# ============================================================
# Pipeline: progression_design_full
# ============================================================

class TestProgressionDesignFull:
    """Тесты полного пайплайна проектирования прогрессии."""

    @pytest.mark.asyncio
    async def test_full_pipeline_returns_profile(self, progression_service, sample_input):
        """Полный пайплайн возвращает ProgressionProfile."""
        result = await progression_service.progression_design_full(sample_input)

        assert isinstance(result, ProgressionProfile)

    @pytest.mark.asyncio
    async def test_all_stages_completed(self, progression_service, sample_input):
        """Все 4 этапа завершены."""
        result = await progression_service.progression_design_full(sample_input)

        assert result.stages_completed == [1, 2, 3, 4]

    @pytest.mark.asyncio
    async def test_latency_tracked(self, progression_service, sample_input):
        """Latency замеряется."""
        result = await progression_service.progression_design_full(sample_input)

        assert result.latency_ms >= 0
        assert isinstance(result.latency_ms, int)

    @pytest.mark.asyncio
    async def test_validation_included(self, progression_service, sample_input):
        """Валидация включена в профиль."""
        result = await progression_service.progression_design_full(sample_input)

        assert isinstance(result.validation, ProgressionValidation)
        assert result.validation.overall_score >= 0

    @pytest.mark.asyncio
    async def test_ai_failure_graceful_degradation(self, mock_executor):
        """При полной недоступности AI — graceful degradation."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = ProgressionService(executor=mock_executor)
        input_data = ProgressionInput(
            concept={"genre": "rpg"},
            targetDuration=50,
            targetLevels=30,
            constraints=ProgressionConstraints(),
        )

        result = await service.progression_design_full(input_data)

        assert isinstance(result, ProgressionProfile)
        assert result.macroModel.duration == 50
        assert result.macroModel.levels == 30
        assert result.stages_completed == [1, 2, 3, 4]


# ============================================================
# Constants validation
# ============================================================

class TestProgressionConstants:
    """Тесты констант прогрессии."""

    def test_genre_duration_map_rpg(self):
        """RPG duration = 50h."""
        assert GENRE_DURATION_MAP["rpg"] == 50

    def test_pacing_map_complete(self):
        """Все 3 pacing уровня определены."""
        assert set(PACING_MAP.keys()) == {"relaxed", "balanced", "intense"}

    def test_genre_progression_map_keys(self):
        """Как минимум основные жанры определены."""
        for genre in ["rpg", "action", "roguelike", "strategy", "mmorpg"]:
            assert genre in GENRE_PROGRESSION_MAP

    def test_tier_distributions_sum(self):
        """Доли тиров в сумме ≈ 1.0."""
        for num_tiers, fractions in TIER_DISTRIBUTIONS.items():
            assert len(fractions) == num_tiers
            assert 0.9 <= sum(fractions) <= 1.1

    def test_monetization_grind_multipliers(self):
        """Множители гринда корректны."""
        assert MONETIZATION_GRIND_MULTIPLIER["premium"] == 1.0
        assert MONETIZATION_GRIND_MULTIPLIER["p2w"] > MONETIZATION_GRIND_MULTIPLIER["premium"]
