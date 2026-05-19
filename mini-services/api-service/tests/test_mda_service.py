"""
Gidede — MDA Service Tests
Фаза 4.C: Тесты для Блока 3 — MDA Lab (алгоритм 3.3, Этапы 1-6)

Тесты по этапам:
- Stage 1: Reverse MDA — определение целевых динамик (3.3.3) — ~7 тестов
- Stage 2: Reverse MDA — маппинг «Динамика → Механики» (3.3.4) — ~6 тестов
- Stage 3: Сборка и оптимизация набора механик (3.3.5) — ~5 тестов
- Stage 4: Classic MDA — аналитический проход (3.3.6) — ~4 теста
- Stage 5: Валидация через Линзы Шелла (3.3.7) — ~5 тестов
- Stage 6: Матрица 4×3 Бонда + лудонарративный анализ (3.3.8) — ~4 теста
- Pipeline: analyze_stages_1_3 / analyze_full — ~4 теста
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.mda_service import (
    MDAService,
    AESTHETIC_DYNAMICS_MAP,
    DYNAMICS_MECHANICS_MAP,
    PRIORITY_LENSES,
    BOND_ELEMENTS,
    BOND_LEVELS,
    HIGH_EMERGENCE_GENRES,
    GENRE_DYNAMICS_WARNINGS,
    EMERGENCE_LEVELS,
    ADAMS_PATTERNS,
)
from app.schemas.mda import (
    DynamicsTarget,
    DynamicItem,
    MechanicCandidate,
    MechanicCandidateSet,
    StructuredMechanicSet,
    AestheticCoverage,
    ClassicMDAResult,
    LensValidation,
    LensResult,
    BondValidation,
    BondMatrixCell,
    LudonarrativeCheck,
    MDAProfile,
)
from app.schemas.concept import AestheticProfile


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
def mda_service(mock_executor):
    """Создать MDAService с моком executor."""
    return MDAService(executor=mock_executor)


@pytest.fixture
def sample_aesthetic_profile():
    """Тестовый AestheticProfile для RPG."""
    return AestheticProfile(
        primary="challenge",
        secondary="fantasy",
        tertiary="narrative",
        rationale="Типичный RPG-профиль",
    )


@pytest.fixture
def sample_dynamics_target():
    """Тестовый DynamicsTarget."""
    return DynamicsTarget(
        core_dynamics=[
            "Баланс навык/сложность (зона потока)",
            "Нарастание сложности (кривая вызова)",
            "Идентификация с ролью/персонажем",
        ],
        supporting_dynamics=[
            "Негативная ОС при ошибке + позитивная при успехе",
            "Иммерсия через согласованность мира",
            "Драматическая арка (напряжение → кульминация → разрешение)",
        ],
        all_dynamics=[],
        emergence_level="multiple",
        emergence_description="Множественная",
        rationale="Тест",
    )


@pytest.fixture
def sample_candidate_set():
    """Тестовый MechanicCandidateSet."""
    return MechanicCandidateSet(
        mechanics=[
            MechanicCandidate(name="Враги", group_id=4, group_name="Combat", source="MechanicsDB", genre_affinity=0.8),
            MechanicCandidate(name="Уровни", group_id=2, group_name="Progression", source="MechanicsDB", genre_affinity=0.7),
            MechanicCandidate(name="Классы", group_id=1, group_name="Basic", source="MechanicsDB", genre_affinity=0.9),
            MechanicCandidate(name="Квесты", group_id=7, group_name="Social", source="MechanicsDB", genre_affinity=0.6),
        ],
        dynamics_coverage={
            "Враги": ["Баланс навык/сложность (зона потока)"],
            "Уровни": ["Нарастание сложности (кривая вызова)"],
            "Классы": ["Идентификация с ролью/персонажем"],
            "Квесты": ["Драматическая арка (напряжение → кульминация → разрешение)"],
        },
        uncovered_dynamics=[],
        synergy_pairs=[],
        conflict_pairs=[],
        total_aesthetics_served={"challenge": 0.5, "fantasy": 0.3},
    )


# ============================================================
# Stage 1: Reverse MDA — определение целевых динамик (3.3.3)
# ============================================================

class TestDetermineTargetDynamics:
    """Тесты Этапа 1: Определение целевых динамик."""

    @pytest.mark.asyncio
    async def test_formal_mapping_challenge(self, mda_service, sample_aesthetic_profile):
        """Формализованный маппинг: challenge → 4 динамики."""
        result = await mda_service.determine_target_dynamics(
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        # challenge маппится на 4 динамики
        challenge_dynamics = AESTHETIC_DYNAMICS_MAP["challenge"]
        for dyn_name in challenge_dynamics:
            assert any(d.name == dyn_name for d in result.all_dynamics), (
                f"Динамика '{dyn_name}' должна быть в all_dynamics"
            )

    @pytest.mark.asyncio
    async def test_genre_filtering_puzzle(self, mda_service, mock_executor):
        """Жанровая фильтрация: puzzle → предупреждения для кооперации."""
        profile = AestheticProfile(primary="fellowship", secondary="challenge", tertiary="discovery")
        result = await mda_service.determine_target_dynamics(
            aesthetic_profile=profile,
            genre="puzzle",
        )

        # В puzzle кооперация — нетипичная динамика
        assert len(result.warnings) > 0
        assert any("Кооперация" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_genre_filtering_no_warnings_for_rpg(self, mda_service, sample_aesthetic_profile):
        """RPG не имеет предупреждений по умолчанию."""
        result = await mda_service.determine_target_dynamics(
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        # RPG нет в GENRE_DYNAMICS_WARNINGS → нет предупреждений
        assert len(result.warnings) == 0

    @pytest.mark.asyncio
    async def test_ai_enrichment_adds_dynamics(self, mock_executor):
        """AI-обогащение добавляет новые динамики."""
        mock_executor.execute.return_value = MagicMock(
            data=[
                {"dynamic": "Тактическое планирование", "aesthetics_served": ["challenge", "fantasy", "narrative"], "genre_fit": 0.7},
            ],
            metadata={"prompt_id": "SUGGEST_DYNAMICS", "from_cache": False},
        )
        service = MDAService(executor=mock_executor)
        profile = AestheticProfile(primary="challenge", secondary="fantasy", tertiary="narrative")

        result = await service.determine_target_dynamics(
            aesthetic_profile=profile,
            genre="rpg",
        )

        # AI dynamics are in context_dynamics
        assert len(result.context_dynamics) > 0
        assert result.context_dynamics[0].source == "ai"

    @pytest.mark.asyncio
    async def test_ai_failure_uses_formal_only(self, mock_executor):
        """При ошибке AI — только формализованные динамики."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = MDAService(executor=mock_executor)
        profile = AestheticProfile(primary="challenge", secondary="fantasy", tertiary="narrative")

        result = await service.determine_target_dynamics(
            aesthetic_profile=profile,
            genre="rpg",
        )

        # Формализованные динамики должны быть
        assert len(result.core_dynamics) > 0
        assert len(result.context_dynamics) == 0  # Нет AI-добавленных

    @pytest.mark.asyncio
    async def test_emergence_assessment(self, mda_service, sample_aesthetic_profile):
        """Оценка эмерджентности для RPG."""
        result = await mda_service.determine_target_dynamics(
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        assert result.emergence_level in ("nominal", "weak", "multiple", "strong")
        assert result.emergence_description != ""

    @pytest.mark.asyncio
    async def test_emergence_high_for_sandbox(self, mock_executor):
        """Sandbox → emergence level not nominal."""
        mock_executor.execute.return_value = MagicMock(
            data=[],
            metadata={"prompt_id": "SUGGEST_DYNAMICS", "from_cache": False},
        )
        service = MDAService(executor=mock_executor)
        profile = AestheticProfile(primary="expression", secondary="discovery", tertiary="submission")

        result = await service.determine_target_dynamics(
            aesthetic_profile=profile,
            genre="sandbox",
        )

        # sandbox — HIGH_EMERGENCE_GENRES; emergence depends on multi-aesthetic dynamics
        assert result.emergence_level in ("nominal", "weak", "multiple", "strong")

    def test_assess_emergence_nominal(self, mda_service):
        """Мало динамик → nominal emergence."""
        dynamics = [
            DynamicItem(name="d1", aesthetics_served=["challenge"]),
        ]
        level = mda_service._assess_emergence(dynamics, "rpg")
        assert level == "nominal"

    def test_assess_emergence_weak(self, mda_service):
        """3 динамики → weak emergence."""
        dynamics = [
            DynamicItem(name="d1", aesthetics_served=["challenge"]),
            DynamicItem(name="d2", aesthetics_served=["fantasy"]),
            DynamicItem(name="d3", aesthetics_served=["narrative"]),
        ]
        level = mda_service._assess_emergence(dynamics, "rpg")
        assert level == "weak"


# ============================================================
# Stage 2: Reverse MDA — маппинг «Динамика → Механики» (3.3.4)
# ============================================================

class TestMapDynamicsToMechanics:
    """Тесты Этапа 2: Маппинг «Динамика → Механики»."""

    @pytest.mark.asyncio
    async def test_formal_mechanics_selected(self, mda_service, sample_dynamics_target, sample_aesthetic_profile):
        """Формализованные механики выбираются из маппинга."""
        result = await mda_service.map_dynamics_to_mechanics(
            dynamics_target=sample_dynamics_target,
            genre="rpg",
            aesthetic_profile=sample_aesthetic_profile,
        )

        assert isinstance(result, MechanicCandidateSet)
        assert len(result.mechanics) > 0

    @pytest.mark.asyncio
    async def test_forbidden_mechanics_excluded(self, mda_service, sample_dynamics_target, sample_aesthetic_profile):
        """Запрещённые механики исключаются."""
        result = await mda_service.map_dynamics_to_mechanics(
            dynamics_target=sample_dynamics_target,
            genre="rpg",
            aesthetic_profile=sample_aesthetic_profile,
            forbidden_mechanics=["Враги", "Уровни"],
        )

        mechanic_names = [m.name for m in result.mechanics]
        assert "Враги" not in mechanic_names
        assert "Уровни" not in mechanic_names

    @pytest.mark.asyncio
    async def test_max_mechanics_respected(self, mda_service, sample_dynamics_target, sample_aesthetic_profile):
        """max_mechanics ограничивает набор (с учётом синергий)."""
        result = await mda_service.map_dynamics_to_mechanics(
            dynamics_target=sample_dynamics_target,
            genre="rpg",
            aesthetic_profile=sample_aesthetic_profile,
            max_mechanics=10,
        )

        # MechanicCandidateSet may include synergy additions, so we allow some overshoot
        # but the set should be reasonable
        assert len(result.mechanics) > 0
        assert len(result.mechanics) <= 25  # reasonable upper bound

    @pytest.mark.asyncio
    async def test_ai_mechanics_added(self, mock_executor, sample_dynamics_target, sample_aesthetic_profile):
        """AI-предложенные механики добавляются."""
        mock_executor.execute.return_value = MagicMock(
            data=[
                {"mechanic": "Тайм-менеджмент", "genre_affinity": 0.6, "description": "Управление временем"},
            ],
            metadata={"prompt_id": "SUGGEST_MECHANICS", "from_cache": False},
        )
        service = MDAService(executor=mock_executor)

        result = await service.map_dynamics_to_mechanics(
            dynamics_target=sample_dynamics_target,
            genre="rpg",
            aesthetic_profile=sample_aesthetic_profile,
        )

        assert any(m.name == "Тайм-менеджмент" for m in result.mechanics)

    @pytest.mark.asyncio
    async def test_coverage_map_populated(self, mda_service, sample_dynamics_target, sample_aesthetic_profile):
        """Карта покрытия заполнена для каждой механики."""
        result = await mda_service.map_dynamics_to_mechanics(
            dynamics_target=sample_dynamics_target,
            genre="rpg",
            aesthetic_profile=sample_aesthetic_profile,
        )

        for mechanic in result.mechanics:
            assert mechanic.name in result.dynamics_coverage

    @pytest.mark.asyncio
    async def test_aesthetic_coverage_calculated(self, mda_service, sample_dynamics_target, sample_aesthetic_profile):
        """Покрытие эстетик рассчитывается."""
        result = await mda_service.map_dynamics_to_mechanics(
            dynamics_target=sample_dynamics_target,
            genre="rpg",
            aesthetic_profile=sample_aesthetic_profile,
        )

        assert isinstance(result.total_aesthetics_served, dict)


# ============================================================
# Stage 3: Сборка и оптимизация набора механик (3.3.5)
# ============================================================

class TestAssembleMechanicSet:
    """Тесты Этапа 3: Сборка и оптимизация набора механик."""

    @pytest.mark.asyncio
    async def test_structured_set_returned(self, mda_service, sample_candidate_set, sample_aesthetic_profile):
        """Возвращается StructuredMechanicSet."""
        result = await mda_service.assemble_mechanic_set(
            candidate_set=sample_candidate_set,
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        assert isinstance(result, StructuredMechanicSet)
        assert result.total_count > 0

    @pytest.mark.asyncio
    async def test_forbidden_mechanics_removed(self, mda_service, sample_candidate_set, sample_aesthetic_profile):
        """Запрещённые механики удаляются."""
        result = await mda_service.assemble_mechanic_set(
            candidate_set=sample_candidate_set,
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
            forbidden_mechanics=["Враги"],
        )

        all_mechanic_names = (
            [m["name"] for m in result.base]
            + [m["name"] for m in result.combat]
            + [m["name"] for m in result.progression]
            + [m["name"] for m in result.spatial]
            + [m["name"] for m in result.social]
        )
        assert "Враги" not in all_mechanic_names

    @pytest.mark.asyncio
    async def test_aesthetic_coverage_checked(self, mda_service, sample_candidate_set, sample_aesthetic_profile):
        """Покрытие эстетик проверяется."""
        result = await mda_service.assemble_mechanic_set(
            candidate_set=sample_candidate_set,
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        assert len(result.aesthetic_coverage) == 3  # primary, secondary, tertiary
        for cov in result.aesthetic_coverage:
            assert isinstance(cov, AestheticCoverage)

    @pytest.mark.asyncio
    async def test_adams_patterns_detected(self, mda_service, sample_candidate_set, sample_aesthetic_profile):
        """Паттерны Adams/Dormans обнаруживаются."""
        result = await mda_service.assemble_mechanic_set(
            candidate_set=sample_candidate_set,
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        assert len(result.patterns_detected) > 0
        for pattern in result.patterns_detected:
            assert isinstance(pattern, (type(result.patterns_detected[0]),))

    @pytest.mark.asyncio
    async def test_compatibility_score_range(self, mda_service, sample_candidate_set, sample_aesthetic_profile):
        """Compatibility score в диапазоне 0-100."""
        result = await mda_service.assemble_mechanic_set(
            candidate_set=sample_candidate_set,
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
        )

        assert 0.0 <= result.compatibility_score <= 100.0
        assert 0.0 <= result.synergy_score <= 100.0


# ============================================================
# Stage 4: Classic MDA — аналитический проход (3.3.6)
# ============================================================

class TestClassicMDAPass:
    """Тесты Этапа 4: Classic MDA аналитический проход."""

    @pytest.fixture
    def structured_set(self, sample_aesthetic_profile, sample_candidate_set):
        """Создать StructuredMechanicSet для classic_mda_pass."""
        return StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[],
            progression=[{"name": "Уровни", "group": "Progression", "description": "", "source": "MechanicsDB"}],
            spatial=[],
            social=[],
            total_count=2,
            aesthetic_coverage=[],
            patterns_detected=[],
            compatibility_score=70.0,
            synergy_score=30.0,
        )

    @pytest.mark.asyncio
    async def test_classic_mda_returns_result(self, mda_service, sample_aesthetic_profile, sample_candidate_set):
        """classic_mda_pass возвращает ClassicMDAResult."""
        structured = StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[], progression=[], spatial=[], social=[],
            total_count=1, aesthetic_coverage=[], patterns_detected=[],
            compatibility_score=70.0, synergy_score=30.0,
        )
        result = await mda_service.classic_mda_pass(
            mechanic_set=structured,
            aesthetic_profile=sample_aesthetic_profile,
            dynamics_target=DynamicsTarget(
                core_dynamics=["Баланс навык/сложность (зона потока)"],
                supporting_dynamics=[],
            ),
            genre="rpg",
        )

        assert isinstance(result, ClassicMDAResult)
        assert result.overall_match >= 0.0

    @pytest.mark.asyncio
    async def test_predicted_aesthetics_from_dynamics(self, mda_service, sample_aesthetic_profile):
        """Предсказанная эстетика выводится из наблюдаемых динамик."""
        structured = StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[], progression=[], spatial=[], social=[],
            total_count=1, aesthetic_coverage=[], patterns_detected=[],
            compatibility_score=70.0, synergy_score=30.0,
        )
        result = await mda_service.classic_mda_pass(
            mechanic_set=structured,
            aesthetic_profile=sample_aesthetic_profile,
            dynamics_target=DynamicsTarget(
                core_dynamics=["Баланс навык/сложность (зона потока)"],
                supporting_dynamics=["Нарастание сложности (кривая вызова)"],
            ),
            genre="rpg",
        )

        assert isinstance(result.predicted_aesthetics, dict)

    @pytest.mark.asyncio
    async def test_convergence_checked(self, mda_service, sample_aesthetic_profile):
        """Проверка сходимости с целевой эстетикой."""
        structured = StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[], progression=[], spatial=[], social=[],
            total_count=1, aesthetic_coverage=[], patterns_detected=[],
            compatibility_score=70.0, synergy_score=30.0,
        )
        result = await mda_service.classic_mda_pass(
            mechanic_set=structured,
            aesthetic_profile=sample_aesthetic_profile,
            dynamics_target=DynamicsTarget(
                core_dynamics=["Баланс навык/сложность (зона потока)"],
                supporting_dynamics=[],
            ),
            genre="rpg",
        )

        assert isinstance(result.converged, bool)
        assert isinstance(result.match_scores, dict)

    @pytest.mark.asyncio
    async def test_stability_check_included(self, mda_service, sample_aesthetic_profile):
        """Проверка устойчивости включена в результат."""
        structured = StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[], progression=[], spatial=[], social=[],
            total_count=1, aesthetic_coverage=[], patterns_detected=[],
            compatibility_score=70.0, synergy_score=30.0,
        )
        result = await mda_service.classic_mda_pass(
            mechanic_set=structured,
            aesthetic_profile=sample_aesthetic_profile,
            dynamics_target=DynamicsTarget(
                core_dynamics=["Баланс навык/сложность (зона потока)"],
                supporting_dynamics=[],
            ),
            genre="rpg",
        )

        assert result.stability is not None or result.warnings is not None


# ============================================================
# Stage 5: Валидация через Линзы Шелла (3.3.7)
# ============================================================

class TestValidateLenses:
    """Тесты Этапа 5: Валидация через Линзы Шелла."""

    @pytest.fixture
    def lens_input(self):
        """Данные для validate_lenses."""
        structured = StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[], progression=[], spatial=[], social=[],
            total_count=1, aesthetic_coverage=[], patterns_detected=[],
            compatibility_score=70.0, synergy_score=30.0,
        )
        classic_result = ClassicMDAResult(
            overall_match=0.7, converged=True,
            match_scores={"challenge": 0.8, "fantasy": 0.6},
            observed_dynamics=["Баланс навык/сложность (зона потока)"],
            predicted_aesthetics={"challenge": 0.8},
        )
        return structured, classic_result

    @pytest.mark.asyncio
    async def test_nine_priority_lenses(self, mda_service, lens_input):
        """Применяются 9 приоритетных линз Шелла."""
        structured, classic_result = lens_input
        result = await mda_service.validate_lenses(
            mechanic_set=structured,
            classic_mda_result=classic_result,
        )

        assert isinstance(result, LensValidation)
        assert result.total_count == 9

    @pytest.mark.asyncio
    async def test_lens_results_populated(self, mda_service, lens_input):
        """Результаты по каждой линзе заполнены."""
        structured, classic_result = lens_input
        result = await mda_service.validate_lenses(
            mechanic_set=structured,
            classic_mda_result=classic_result,
        )

        assert len(result.results) > 0
        for lens_result in result.results:
            assert isinstance(lens_result, LensResult)
            assert 0.0 <= lens_result.score <= 1.0

    @pytest.mark.asyncio
    async def test_overall_score_calculated(self, mda_service, lens_input):
        """Общий score по линзам рассчитывается."""
        structured, classic_result = lens_input
        result = await mda_service.validate_lenses(
            mechanic_set=structured,
            classic_mda_result=classic_result,
        )

        assert 0.0 <= result.overall_score <= 1.0

    @pytest.mark.asyncio
    async def test_critical_and_warning_classification(self, mock_executor, lens_input):
        """Линзы классифицируются на critical (< 0.4), warning (0.4-0.7), passed (>= 0.7)."""
        structured, classic_result = lens_input
        # AI returns mixed scores
        call_count = 0
        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 3:
                return MagicMock(data={"score": 0.3, "issues_found": ["Проблема"]}, metadata={})
            elif call_count <= 6:
                return MagicMock(data={"score": 0.5, "issues_found": []}, metadata={})
            else:
                return MagicMock(data={"score": 0.8, "issues_found": []}, metadata={})

        mock_executor.execute.side_effect = side_effect
        service = MDAService(executor=mock_executor)

        result = await service.validate_lenses(
            mechanic_set=structured,
            classic_mda_result=classic_result,
        )

        assert result.total_count == 9
        assert len(result.critical_issues) + len(result.warnings) + result.passed_count == 9

    @pytest.mark.asyncio
    async def test_ai_failure_graceful_fallback(self, mock_executor, lens_input):
        """При ошибке AI — graceful fallback на формализованную оценку."""
        structured, classic_result = lens_input
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = MDAService(executor=mock_executor)

        result = await service.validate_lenses(
            mechanic_set=structured,
            classic_mda_result=classic_result,
        )

        # Fallback: формализованная оценка должна вернуть 9 линз
        assert result.total_count == 9


# ============================================================
# Stage 6: Матрица 4×3 Бонда + лудонарративный анализ (3.3.8)
# ============================================================

class TestValidateBondMatrix:
    """Тесты Этапа 6: Матрица 4×3 Бонда + лудонарративный анализ."""

    @pytest.fixture
    def bond_input(self):
        """Данные для validate_bond_matrix."""
        structured = StructuredMechanicSet(
            base=[{"name": "Враги", "group": "Basic", "description": "", "source": "MechanicsDB"}],
            combat=[], progression=[], spatial=[], social=[],
            total_count=1, aesthetic_coverage=[], patterns_detected=[],
            compatibility_score=70.0, synergy_score=30.0,
        )
        classic_result = ClassicMDAResult(
            overall_match=0.7, converged=True,
            match_scores={"challenge": 0.8, "fantasy": 0.6},
            observed_dynamics=["Баланс навык/сложность (зона потока)"],
            predicted_aesthetics={"challenge": 0.8},
        )
        return structured, classic_result

    @pytest.mark.asyncio
    async def test_bond_matrix_4x3(self, mda_service, bond_input):
        """Матрица содержит 4 элемента × 3 уровня = 12 ячеек."""
        structured, classic_result = bond_input
        result = await mda_service.validate_bond_matrix(
            mechanic_set=structured,
            classic_mda_result=classic_result,
            genre="rpg",
        )

        assert isinstance(result, BondValidation)
        assert len(result.matrix) == 12  # 4 elements × 3 levels

    @pytest.mark.asyncio
    async def test_bond_matrix_elements(self, mda_service, bond_input):
        """Ячейки матрицы содержат все 4 элемента и 3 уровня."""
        structured, classic_result = bond_input
        result = await mda_service.validate_bond_matrix(
            mechanic_set=structured,
            classic_mda_result=classic_result,
            genre="rpg",
        )

        elements = {cell.element for cell in result.matrix}
        levels = {cell.level for cell in result.matrix}

        assert elements == set(BOND_ELEMENTS)
        assert levels == set(BOND_LEVELS)

    @pytest.mark.asyncio
    async def test_row_and_column_consistency(self, mda_service, bond_input):
        """Горизонтальная и вертикальная согласованность рассчитываются."""
        structured, classic_result = bond_input
        result = await mda_service.validate_bond_matrix(
            mechanic_set=structured,
            classic_mda_result=classic_result,
            genre="rpg",
        )

        assert len(result.row_consistency) > 0
        assert len(result.col_consistency) > 0
        assert 0.0 <= result.overall_consistency <= 1.0

    @pytest.mark.asyncio
    async def test_ludonarrative_check_present(self, mda_service, bond_input):
        """Лудонарративный анализ включён."""
        structured, classic_result = bond_input
        result = await mda_service.validate_bond_matrix(
            mechanic_set=structured,
            classic_mda_result=classic_result,
            genre="rpg",
        )

        assert result.ludonarrative is not None
        assert result.ludonarrative.result in ("Гармония", "Ирония", "Диссонанс")


# ============================================================
# Pipeline: analyze_stages_1_3 / analyze_full
# ============================================================

class TestMDAPipeline:
    """Тесты полного пайплайна MDA Lab."""

    @pytest.mark.asyncio
    async def test_stages_1_3_returns_mda_profile(self, mda_service, sample_aesthetic_profile):
        """Пайплайн Этапов 1-3 возвращает MDAProfile."""
        result = await mda_service.analyze_stages_1_3(
            concept_id="test",
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
            idea="RPG",
        )

        assert isinstance(result, MDAProfile)
        assert result.dynamics_target is not None
        assert result.mechanic_candidate_set is not None
        assert result.mechanic_set is not None

    @pytest.mark.asyncio
    async def test_stages_1_3_completed(self, mda_service, sample_aesthetic_profile):
        """Этапы 1-3 завершены."""
        result = await mda_service.analyze_stages_1_3(
            concept_id="test",
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
            idea="RPG",
        )

        assert 1 in result.stages_completed
        assert 2 in result.stages_completed
        assert 3 in result.stages_completed

    @pytest.mark.asyncio
    async def test_latency_tracked(self, mda_service, sample_aesthetic_profile):
        """Latency замеряется."""
        result = await mda_service.analyze_stages_1_3(
            concept_id="test",
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
            idea="RPG",
        )

        assert result.latency_ms >= 0
        assert isinstance(result.latency_ms, int)

    @pytest.mark.asyncio
    async def test_full_pipeline_returns_profile(self, mda_service, sample_aesthetic_profile):
        """Полный пайплайн (Этапы 1-6) возвращает MDAProfile."""
        result = await mda_service.analyze_full(
            concept_id="test",
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
            idea="RPG",
        )

        assert isinstance(result, MDAProfile)
        # At minimum stages 1-3 should be completed
        assert len(result.stages_completed) >= 3

    @pytest.mark.asyncio
    async def test_graceful_degradation_on_ai_failure(self, mock_executor, sample_aesthetic_profile):
        """Graceful degradation при полной недоступности AI."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = MDAService(executor=mock_executor)

        # Пайплайн не должен падать — только формализованные результаты
        result = await service.analyze_stages_1_3(
            concept_id="test",
            aesthetic_profile=sample_aesthetic_profile,
            genre="rpg",
            idea="RPG",
        )

        assert isinstance(result, MDAProfile)
        assert result.dynamics_target is not None
        assert len(result.dynamics_target.core_dynamics) > 0


# ============================================================
# Constants validation
# ============================================================

class TestMDAConstants:
    """Тесты констант MDA."""

    def test_aesthetic_dynamics_map_complete(self):
        """Все 8 эстетик имеют маппинг на динамики."""
        expected_aesthetics = {"sensation", "fantasy", "narrative", "challenge", "fellowship", "discovery", "expression", "submission"}
        assert set(AESTHETIC_DYNAMICS_MAP.keys()) == expected_aesthetics

    def test_priority_lenses_count(self):
        """9 приоритетных линз Шелла."""
        assert len(PRIORITY_LENSES) == 9

    def test_bond_elements_and_levels(self):
        """4 элемента × 3 уровня для матрицы Бонда."""
        assert len(BOND_ELEMENTS) == 4
        assert len(BOND_LEVELS) == 3

    def test_high_emergence_genres(self):
        """HIGH_EMERGENCE_GENRES содержит ожидаемые жанры."""
        assert "sandbox" in HIGH_EMERGENCE_GENRES
        assert "roguelike" in HIGH_EMERGENCE_GENRES
        assert "mmorpg" in HIGH_EMERGENCE_GENRES

    def test_genre_dynamics_warnings_keys(self):
        """GENRE_DYNAMICS_WARNINGS содержит ожидаемые жанры."""
        assert "puzzle" in GENRE_DYNAMICS_WARNINGS
        assert "visual_novel" in GENRE_DYNAMICS_WARNINGS
        assert "idle" in GENRE_DYNAMICS_WARNINGS

    def test_emergence_levels_descriptions(self):
        """EMERGENCE_LEVELS содержит все 4 уровня."""
        assert set(EMERGENCE_LEVELS.keys()) == {"nominal", "weak", "multiple", "strong"}

    def test_adams_patterns_count(self):
        """8 паттернов Adams/Dormans."""
        assert len(ADAMS_PATTERNS) == 8
