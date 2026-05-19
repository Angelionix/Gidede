"""
Gidede — Тесты интеграции Блоков 6-7 с пайплайном (4.D.9)

Покрытие:
1. _prepare_gdd_input — подготовка входа GDD Generator из Блоков 1-5
2. _prepare_ai_assistant_input — подготовка контекста AI-ассистента
3. prepare_block_input для Блоков 6 и 7 — маршрутизация
4. get_full_project_state — единый API Project State
5. BLOCK_REGISTRY для Блоков 6-7-8 — конфигурация реестра
"""

import pytest
import inspect
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.pipeline_service import (
    PipelineService,
    BlockStatus,
    PipelineEvent,
    BLOCK_REGISTRY,
    BLOCK_DEPENDENCIES,
    BLOCK_EVENTS,
    STALE_DOWNSTREAM,
    BLOCK_NAMES,
    BlockConfig,
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


def make_mock_project(
    has_concept=True,
    has_core_loop=True,
    has_mda=True,
    has_balance=True,
    has_progression=True,
    has_economy=True,
    has_gdd=False,
    has_checklist=False,
):
    """
    Создать mock-проект с настраиваемыми блоками.

    Расширенная версия: добавлены GDD и Checklist (Блоки 6-8),
    а также все атрибуты, необходимые для _prepare_gdd_input и
    _prepare_ai_assistant_input.
    """
    project = MagicMock()
    project.id = "test-project-id"
    project.name = "Test Game"
    project.genre = "rpg"
    project.project_stage = "gdd"

    # ---- Concept (Блок 1) ----
    concept = MagicMock()
    concept.id = "concept-id"
    concept.genre = "rpg"
    concept.aesthetic_profile = (
        {"primary": "challenge", "secondary": "fantasy", "tertiary": "discovery"}
        if has_concept else None
    )
    concept.primary_aesthetic = "challenge"
    concept.dynamics_profile = {"target_dynamics": ["competition", "narrative"]}
    concept.mechanic_set = {
        "base": [{"name": "Exploration"}],
        "combat": [{"name": "Turn-based"}],
    }
    concept.core_loop_candidates = [{"name": "Explore-Fight-Loot"}]
    concept.usp = "Unique progression system"
    concept.one_pager_data = {"title": "Test Game"} if has_concept else None
    concept.input_data = {"idea": "A roguelike about alchemy", "platforms": ["PC", "Mobile"]}
    concept.subgenre = "roguelike"
    concept.validation_report = None
    concept.usp_candidates = None
    project.concept = concept

    # ---- Core Loop (Блок 2) ----
    core_loop = MagicMock()
    core_loop.structural_type = "Engine"
    core_loop.steps_data = [
        {"name": "Explore", "mechanics": ["Exploration"], "resource": "gold"},
        {"name": "Fight", "mechanics": ["Turn-based"], "resource_in": "gold", "resource_out": "xp"},
    ] if has_core_loop else None
    core_loop.step_count = 2
    core_loop.inner_loops = []
    core_loop.outer_loops = []
    core_loop.meta_loop = None
    core_loop.loop_hierarchy = {"levels": 6}
    core_loop.pathologies = []
    core_loop.recommendations = []
    core_loop.full_profile = {}
    core_loop.input_data = {}
    core_loop.structural_subtype = None
    core_loop.validation_data = None
    project.core_loop = core_loop

    # ---- MDA (Блок 3) ----
    mda = MagicMock()
    mda.mechanic_set = {"selected": ["Exploration", "Turn-based"]} if has_mda else None
    mda.target_dynamics = ["competition", "narrative"]
    mda.primary_aesthetic = "challenge"
    mda.secondary_aesthetic = "fantasy"
    mda.machinations_model = {}
    mda.full_profile = {}
    mda.observed_dynamics = ["competition"]
    mda.predicted_aesthetics = {"challenge": 0.9}
    mda.match_scores = {"challenge": 0.85}
    mda.lens_validation = {}
    mda.bond_validation = {}
    mda.ludonarrative_check = {}
    mda.overall_match = 0.85
    mda.iteration_count = 3
    mda.simulation_results = None
    project.mda_profile = mda

    # ---- Balance (Блок 4) ----
    balance = MagicMock()
    balance.elements = [{"name": "Sword", "cost": 100, "power": 50}] if has_balance else None
    balance.overall_balance_score = 0.85
    balance.full_result = {}
    balance.balance_type = "cost_power"
    balance.imbalance_count = 2
    balance.element_count = 10
    balance.cost_power_curves = {}
    balance.intransitive_matrix = None
    balance.nash_equilibrium = None
    balance.monte_carlo_results = None
    balance.machinations_results = None
    balance.pathologies = []
    balance.corrections = []
    balance.situational_values = None
    balance.input_data = {}
    project.balance_result = balance

    # ---- Progression (Блок 5a) ----
    progression = MagicMock()
    progression.curves = {"xp_to_level": "exponential"} if has_progression else None
    progression.tier_model = {"tiers": 3} if has_progression else None
    progression.total_levels = 50 if has_progression else None
    progression.full_profile = {}
    progression.tier_count = 3
    progression.curve_type = "exponential"
    progression.macro_model = {}
    progression.content_plan = {}
    progression.validation = {}
    progression.target_duration_hours = 40
    progression.input_data = {}
    progression.economy_link = {}
    project.progression = progression

    # ---- Economy (Блок 5b) ----
    economy = MagicMock()
    economy.resource_model = {"gold": "Valued"} if has_economy else None
    economy.full_profile = {}
    economy.system_type = "premium"
    economy.resource_count = 5
    economy.machinations_model = {}
    economy.conversion_chains = []
    economy.pathologies = []
    economy.corrections = []
    economy.simulation_results = None
    economy.monetization_model = {}
    economy.has_pathology = False
    economy.input_data = {}
    project.economy = economy

    # ---- GDD (Блок 6) ----
    gdd = MagicMock()
    gdd.sections = {"intro": "...", "mechanics": "..."} if has_gdd else None
    gdd.full_profile = {} if has_gdd else None
    gdd.format = "full"
    gdd.section_count = 5
    gdd.completeness_percent = 80
    gdd.input_data = {}
    gdd.visual_elements = []
    gdd.consistency_issues = []
    gdd.completeness_report = {}
    project.gdd = gdd

    # ---- Checklist (Блоки 7-8) ----
    checklist = MagicMock()
    checklist.issues = [{"severity": "high", "text": "Missing economy loop"}] if has_checklist else None
    checklist.full_results = {} if has_checklist else None
    checklist.overall_score = 0.6
    checklist.readiness_level = "alpha"
    checklist.critical_issue_count = 1
    checklist.total_issue_count = 3
    checklist.input_data = {}
    checklist.mda_check = {}
    checklist.balance_check = {}
    checklist.narrative_check = {}
    checklist.economy_check = {}
    checklist.lens_check = {}
    checklist.remediation_plan = {}
    project.checklist = checklist

    return project


# ============================================================
# 1. ТЕСТЫ: _prepare_gdd_input
# ============================================================

class TestPrepareGddInput:
    """Тесты подготовки входных данных для Блока 6 (GDD Generator)."""

    @pytest.mark.asyncio
    async def test_full_data_complete_gdd_input(self, pipeline_service):
        """Все 5 блоков заполнены → полный GDD-вход без предупреждений."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["status"] == "ready"
        assert result["project_id"] == "test-project-id"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is True
        assert result["has_mda"] is True
        assert result["has_balance"] is True
        assert result["has_progression"] is True
        assert result["has_economy"] is True

        # Все секции GDD заполнены
        assert "concept" in result
        assert "core_loop" in result
        assert "mda_profile" in result
        assert "balance_result" in result
        assert "progression_profile" in result
        assert "economy_profile" in result

        # Нет предупреждений при полных данных
        assert "warnings" not in result

    @pytest.mark.asyncio
    async def test_partial_data_concept_only(self, pipeline_service):
        """Только концепция → минимальный GDD-вход с предупреждениями."""
        project = make_mock_project(
            has_concept=True,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is False
        assert result["has_mda"] is False
        assert result["has_balance"] is False
        assert result["has_progression"] is False
        assert result["has_economy"] is False

        # Только секция concept
        assert "concept" in result
        assert "core_loop" not in result
        assert "mda_profile" not in result
        assert "balance_result" not in result
        assert "progression_profile" not in result
        assert "economy_profile" not in result

        # Есть предупреждения
        assert "warnings" in result
        assert any("Core Loop" in w for w in result["warnings"])
        assert any("MDA" in w for w in result["warnings"])
        assert any("Баланс" in w for w in result["warnings"])
        assert any("Прогрессия" in w for w in result["warnings"])
        assert any("Экономика" in w for w in result["warnings"])

    @pytest.mark.asyncio
    async def test_no_data_all_blocks_false(self, pipeline_service):
        """Нет данных → все has_* = False, warnings = 6."""
        project = make_mock_project(
            has_concept=False,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is False
        assert result["has_core_loop"] is False
        assert result["has_mda"] is False
        assert result["has_balance"] is False
        assert result["has_progression"] is False
        assert result["has_economy"] is False

        # Ни одна секция не заполнена
        assert "concept" not in result
        assert "core_loop" not in result
        assert "mda_profile" not in result
        assert "balance_result" not in result
        assert "progression_profile" not in result
        assert "economy_profile" not in result

        # 6 предупреждений (по одному на каждый пустой блок)
        assert "warnings" in result
        assert len(result["warnings"]) == 6

    @pytest.mark.asyncio
    async def test_coverage_score_full(self, pipeline_service):
        """Все блоки заполнены → coverage_score = 1.0."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["coverage_score"] == 1.0

    @pytest.mark.asyncio
    async def test_coverage_score_concept_only(self, pipeline_service):
        """Только концепция → coverage_score = 0.2 (1/5)."""
        project = make_mock_project(
            has_concept=True,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        # filled = sum([True, False, False, False, False]) = 1
        # coverage = round(1 / 5, 2) = 0.2
        assert result["coverage_score"] == 0.2

    @pytest.mark.asyncio
    async def test_coverage_score_no_data(self, pipeline_service):
        """Нет данных → coverage_score = 0.0."""
        project = make_mock_project(
            has_concept=False,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["coverage_score"] == 0.0

    @pytest.mark.asyncio
    async def test_coverage_score_progression_or_economy(self, pipeline_service):
        """Progression XOR Economy → один из них считается за блок 5."""
        # Только progression, без economy
        project = make_mock_project(
            has_concept=True,
            has_core_loop=True,
            has_mda=True,
            has_balance=True,
            has_progression=True,
            has_economy=False,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        # has_progression=True → (True or False) = True → +1
        # filled = 5 (concept, core_loop, mda, balance, progression|economy)
        assert result["coverage_score"] == 1.0

    @pytest.mark.asyncio
    async def test_coverage_score_economy_only_for_block5(self, pipeline_service):
        """Economy без progression → блок 5 всё равно считается заполненным."""
        project = make_mock_project(
            has_concept=True,
            has_core_loop=True,
            has_mda=True,
            has_balance=True,
            has_progression=False,
            has_economy=True,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        # has_progression=False, has_economy=True → (False or True) = True → +1
        assert result["coverage_score"] == 1.0

    @pytest.mark.asyncio
    async def test_gdd_defaults_language_ru(self, pipeline_service):
        """GDD input всегда содержит language='ru'."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["language"] == "ru"

    @pytest.mark.asyncio
    async def test_gdd_defaults_project_stage(self, pipeline_service):
        """GDD input содержит project_stage из проекта."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["project_stage"] == "gdd"

    @pytest.mark.asyncio
    async def test_gdd_defaults_language_ru_even_empty(self, pipeline_service):
        """language='ru' даже при пустых данных."""
        project = make_mock_project(
            has_concept=False,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
        )
        result = await pipeline_service._prepare_gdd_input(project)

        assert result["language"] == "ru"
        assert result["project_stage"] == "gdd"

    @pytest.mark.asyncio
    async def test_concept_section_fields(self, pipeline_service):
        """Секция concept содержит все ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        concept = result["concept"]
        assert concept["genre"] == "rpg"
        assert concept["title"] == "Test Game"
        assert concept["description"] == "A roguelike about alchemy"
        assert "aesthetic_profile" in concept
        assert "dynamics_profile" in concept
        assert "mechanic_set" in concept
        assert "one_pager" in concept
        assert concept["usp"] == "Unique progression system"
        assert concept["platforms"] == ["PC", "Mobile"]

    @pytest.mark.asyncio
    async def test_core_loop_section_fields(self, pipeline_service):
        """Секция core_loop содержит все ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        cl = result["core_loop"]
        assert cl["structural_type"] == "Engine"
        assert "steps" in cl
        assert "inner_loops" in cl
        assert "outer_loops" in cl
        assert "pathologies" in cl
        assert "recommendations" in cl
        assert "full_profile" in cl

    @pytest.mark.asyncio
    async def test_mda_profile_section_fields(self, pipeline_service):
        """Секция mda_profile содержит все ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        mda = result["mda_profile"]
        assert mda["primary_aesthetic"] == "challenge"
        assert mda["secondary_aesthetic"] == "fantasy"
        assert "mechanic_set" in mda
        assert "target_dynamics" in mda
        assert "observed_dynamics" in mda
        assert "predicted_aesthetics" in mda
        assert "match_scores" in mda
        assert "lens_validation" in mda
        assert "bond_validation" in mda
        assert "ludonarrative_check" in mda
        assert "full_profile" in mda

    @pytest.mark.asyncio
    async def test_balance_result_section_fields(self, pipeline_service):
        """Секция balance_result содержит все ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        br = result["balance_result"]
        assert br["balance_type"] == "cost_power"
        assert br["overall_balance_score"] == 0.85
        assert "elements" in br
        assert "pathologies" in br
        assert "corrections" in br
        assert "full_result" in br

    @pytest.mark.asyncio
    async def test_progression_profile_section_fields(self, pipeline_service):
        """Секция progression_profile содержит все ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        prog = result["progression_profile"]
        assert prog["total_levels"] == 50
        assert prog["tier_count"] == 3
        assert prog["curve_type"] == "exponential"
        assert "macro_model" in prog
        assert "tier_model" in prog
        assert "curves" in prog
        assert "content_plan" in prog
        assert "validation" in prog
        assert "full_profile" in prog

    @pytest.mark.asyncio
    async def test_economy_profile_section_fields(self, pipeline_service):
        """Секция economy_profile содержит все ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_gdd_input(project)

        econ = result["economy_profile"]
        assert econ["system_type"] == "premium"
        assert econ["resource_count"] == 5
        assert "resource_model" in econ
        assert "machinations_model" in econ
        assert "conversion_chains" in econ
        assert "pathologies" in econ
        assert "corrections" in econ
        assert "simulation_results" in econ
        assert "monetization_model" in econ
        assert "full_profile" in econ


# ============================================================
# 2. ТЕСТЫ: _prepare_ai_assistant_input
# ============================================================

class TestPrepareAiAssistantInput:
    """Тесты подготовки входных данных для Блока 7 (AI-ассистент)."""

    @pytest.mark.asyncio
    async def test_full_data_all_contexts(self, pipeline_service):
        """Все блоки заполнены → assistant_input со всеми контекстами."""
        project = make_mock_project(has_gdd=True, has_checklist=True)
        result = await pipeline_service._prepare_ai_assistant_input(project)

        assert result["status"] == "ready"
        assert result["project_id"] == "test-project-id"
        assert result["project_name"] == "Test Game"
        assert result["genre"] == "rpg"

        # Все контексты присутствуют
        assert "concept_context" in result
        assert "core_loop_context" in result
        assert "mda_context" in result
        assert "balance_context" in result
        assert "progression_context" in result
        assert "economy_context" in result
        assert "gdd_context" in result
        assert "checklist_context" in result

    @pytest.mark.asyncio
    async def test_concept_only_limited_context(self, pipeline_service):
        """Только концепция → ограниченный контекст."""
        project = make_mock_project(
            has_concept=True,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
            has_gdd=False,
            has_checklist=False,
        )
        result = await pipeline_service._prepare_ai_assistant_input(project)

        assert result["status"] == "ready"
        assert "concept_context" in result
        assert "core_loop_context" not in result
        assert "mda_context" not in result
        assert "balance_context" not in result
        assert "progression_context" not in result
        assert "economy_context" not in result

    @pytest.mark.asyncio
    async def test_no_data_minimal_context_with_block_flags(self, pipeline_service):
        """Нет данных → минимальный контекст с block_flags."""
        project = make_mock_project(
            has_concept=False,
            has_core_loop=False,
            has_mda=False,
            has_balance=False,
            has_progression=False,
            has_economy=False,
            has_gdd=False,
            has_checklist=False,
        )
        # Явно обнуляем отношения, чтобы `if concept:` etc. были False
        project.concept = None
        project.core_loop = None
        project.mda_profile = None
        project.balance_result = None
        project.progression = None
        project.economy = None
        project.gdd = None
        project.checklist = None

        result = await pipeline_service._prepare_ai_assistant_input(project)

        assert result["status"] == "ready"
        assert "block_flags" in result
        assert result["has_concept"] is False
        assert result["has_core_loop"] is False
        assert result["has_mda"] is False
        assert result["has_balance"] is False
        assert result["has_progression"] is False
        assert result["has_economy"] is False
        assert result["has_gdd"] is False
        assert result["has_checklist"] is False

        # Нет контекстных секций
        assert "concept_context" not in result
        assert "core_loop_context" not in result
        assert "mda_context" not in result
        assert "balance_context" not in result
        assert "progression_context" not in result
        assert "economy_context" not in result

    @pytest.mark.asyncio
    async def test_block_flags_delegated_to_compute_block_flags(self, pipeline_service):
        """block_flags берётся из compute_block_flags(project)."""
        project = make_mock_project(has_concept=True)

        # _prepare_ai_assistant_input импортирует compute_block_flags
        # внутри метода: `from app.services.project_service import compute_block_flags`
        # Патчим в том месте, где функция уже импортирована в модуль
        with patch("app.services.project_service.compute_block_flags") as mock_flags:
            mock_flags.return_value = {
                "has_concept": True,
                "has_core_loop": False,
                "has_mda": False,
                "has_balance": False,
                "has_progression": False,
                "has_economy": False,
                "has_gdd": False,
                "has_checklist": False,
            }
            result = await pipeline_service._prepare_ai_assistant_input(project)

            mock_flags.assert_called_once_with(project)
            assert result["block_flags"] == mock_flags.return_value
            assert result["has_concept"] is True

    @pytest.mark.asyncio
    async def test_concept_context_fields(self, pipeline_service):
        """concept_context содержит ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_ai_assistant_input(project)

        cc = result["concept_context"]
        assert cc["genre"] == "rpg"
        assert cc["usp"] == "Unique progression system"
        assert cc["primary_aesthetic"] == "challenge"
        assert "aesthetic_profile" in cc
        assert "dynamics_profile" in cc
        assert "mechanic_set" in cc

    @pytest.mark.asyncio
    async def test_core_loop_context_fields(self, pipeline_service):
        """core_loop_context содержит ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_ai_assistant_input(project)

        clc = result["core_loop_context"]
        assert clc["structural_type"] == "Engine"
        assert clc["step_count"] == 2
        assert "pathologies" in clc
        assert "recommendations" in clc

    @pytest.mark.asyncio
    async def test_mda_context_fields(self, pipeline_service):
        """mda_context содержит ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_ai_assistant_input(project)

        mc = result["mda_context"]
        assert mc["primary_aesthetic"] == "challenge"
        assert mc["secondary_aesthetic"] == "fantasy"
        assert "mechanic_set" in mc
        assert mc["overall_match"] == 0.85

    @pytest.mark.asyncio
    async def test_balance_context_fields(self, pipeline_service):
        """balance_context содержит ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_ai_assistant_input(project)

        bc = result["balance_context"]
        assert bc["balance_type"] == "cost_power"
        assert bc["overall_balance_score"] == 0.85
        assert bc["imbalance_count"] == 2
        assert "pathologies" in bc

    @pytest.mark.asyncio
    async def test_progression_context_fields(self, pipeline_service):
        """progression_context содержит ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_ai_assistant_input(project)

        pc = result["progression_context"]
        assert pc["total_levels"] == 50
        assert pc["curve_type"] == "exponential"
        assert "validation" in pc

    @pytest.mark.asyncio
    async def test_economy_context_fields(self, pipeline_service):
        """economy_context содержит ожидаемые поля."""
        project = make_mock_project()
        result = await pipeline_service._prepare_ai_assistant_input(project)

        ec = result["economy_context"]
        assert ec["system_type"] == "premium"
        assert ec["has_pathology"] is False
        assert "pathologies" in ec

    @pytest.mark.asyncio
    async def test_gdd_context_fields(self, pipeline_service):
        """gdd_context содержит ожидаемые поля."""
        project = make_mock_project(has_gdd=True)
        result = await pipeline_service._prepare_ai_assistant_input(project)

        gc = result["gdd_context"]
        assert gc["format"] == "full"
        assert gc["section_count"] == 5
        assert gc["completeness_percent"] == 80
        assert "consistency_issues" in gc

    @pytest.mark.asyncio
    async def test_checklist_context_fields(self, pipeline_service):
        """checklist_context содержит ожидаемые поля."""
        project = make_mock_project(has_checklist=True)
        result = await pipeline_service._prepare_ai_assistant_input(project)

        chk = result["checklist_context"]
        assert chk["overall_score"] == 0.6
        assert chk["readiness_level"] == "alpha"
        assert chk["critical_issue_count"] == 1
        assert "issues" in chk

    @pytest.mark.asyncio
    async def test_proactive_alerts_via_block_flags(self, pipeline_service):
        """AI-ассистент получает block_flags для генерации proactive alerts."""
        project = make_mock_project(
            has_concept=True,
            has_core_loop=True,
            has_mda=False,  # MDA не заполнен
        )
        result = await pipeline_service._prepare_ai_assistant_input(project)

        # block_flags позволяют AI сгенерировать рекомендации
        assert result["has_mda"] is False
        assert result["has_concept"] is True
        assert result["has_core_loop"] is True


# ============================================================
# 3. ТЕСТЫ: prepare_block_input для Блоков 6 и 7
# ============================================================

class TestPrepareBlockInputRouting:
    """Тесты маршрутизации prepare_block_input для Блоков 6, 7 и unknown."""

    @pytest.mark.asyncio
    async def test_block_6_calls_prepare_gdd_input(self, pipeline_service):
        """target_block=6 → вызывает _prepare_gdd_input."""
        project = make_mock_project()

        with patch.object(pipeline_service, '_prepare_gdd_input', new_callable=AsyncMock) as mock_gdd:
            mock_gdd.return_value = {"status": "ready", "coverage_score": 1.0}

            # Мокаем DB-запрос
            mock_result = MagicMock()
            mock_result.unique.return_value.scalar_one_or_none.return_value = project
            pipeline_service.db.execute = AsyncMock(return_value=mock_result)

            result = await pipeline_service.prepare_block_input("test-project-id", 6)

            mock_gdd.assert_called_once_with(project)
            assert result["status"] == "ready"

    @pytest.mark.asyncio
    async def test_block_7_calls_prepare_ai_assistant_input(self, pipeline_service):
        """target_block=7 → вызывает _prepare_ai_assistant_input."""
        project = make_mock_project()

        with patch.object(pipeline_service, '_prepare_ai_assistant_input', new_callable=AsyncMock) as mock_ai:
            mock_ai.return_value = {"status": "ready", "has_concept": True}

            # Мокаем DB-запрос
            mock_result = MagicMock()
            mock_result.unique.return_value.scalar_one_or_none.return_value = project
            pipeline_service.db.execute = AsyncMock(return_value=mock_result)

            result = await pipeline_service.prepare_block_input("test-project-id", 7)

            mock_ai.assert_called_once_with(project)
            assert result["status"] == "ready"

    @pytest.mark.asyncio
    async def test_unknown_block_returns_project_id_and_block(self, pipeline_service):
        """Неизвестный блок (9, 10, и т.д.) → project_id и block."""
        project = make_mock_project()

        # Мокаем DB-запрос
        mock_result = MagicMock()
        mock_result.unique.return_value.scalar_one_or_none.return_value = project
        pipeline_service.db.execute = AsyncMock(return_value=mock_result)

        result = await pipeline_service.prepare_block_input("test-project-id", 9)

        assert result["project_id"] == "test-project-id"
        assert result["block"] == 9

    @pytest.mark.asyncio
    async def test_block_0_returns_project_id_and_block(self, pipeline_service):
        """target_block=0 → fallback: project_id и block."""
        project = make_mock_project()

        mock_result = MagicMock()
        mock_result.unique.return_value.scalar_one_or_none.return_value = project
        pipeline_service.db.execute = AsyncMock(return_value=mock_result)

        result = await pipeline_service.prepare_block_input("test-project-id", 0)

        assert result["project_id"] == "test-project-id"
        assert result["block"] == 0

    @pytest.mark.asyncio
    async def test_project_not_found_returns_error(self, pipeline_service):
        """Проект не найден → error."""
        mock_result = MagicMock()
        mock_result.unique.return_value.scalar_one_or_none.return_value = None
        pipeline_service.db.execute = AsyncMock(return_value=mock_result)

        result = await pipeline_service.prepare_block_input("nonexistent-id", 6)

        assert "error" in result


# ============================================================
# 4. ТЕСТЫ: get_full_project_state
# ============================================================

class TestGetFullProjectState:
    """Тесты единого API get_full_project_state (4.D.9)."""

    def test_importable(self):
        """get_full_project_state импортируется из project_service."""
        from app.services.project_service import get_full_project_state
        assert callable(get_full_project_state)

    def test_correct_signature(self):
        """get_full_project_state принимает (db, project_id, user_id)."""
        from app.services.project_service import get_full_project_state
        sig = inspect.signature(get_full_project_state)
        params = list(sig.parameters.keys())
        assert "db" in params
        assert "project_id" in params
        assert "user_id" in params

    @pytest.mark.asyncio
    async def test_returns_dict_with_project_state(self):
        """При успешном вызове возвращает dict с ключами ProjectState."""
        from app.services.project_service import get_full_project_state

        mock_db = AsyncMock()
        project = make_mock_project()

        with patch("app.services.project_service.get_project_with_blocks", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = project

            result = await get_full_project_state(mock_db, "test-project-id", "user-1")

            assert result is not None
            assert isinstance(result, dict)
            assert result["id"] == "test-project-id"
            assert result["name"] == "Test Game"
            assert "block_flags" in result
            assert "blocks_available" in result
            assert "concept" in result
            assert "core_loop" in result
            assert "mda_profile" in result
            assert "balance_result" in result
            assert "progression_profile" in result
            assert "economy_profile" in result
            assert "completion_percent" in result

    @pytest.mark.asyncio
    async def test_returns_none_when_project_not_found(self):
        """Проект не найден → None."""
        from app.services.project_service import get_full_project_state

        mock_db = AsyncMock()

        with patch("app.services.project_service.get_project_with_blocks", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            result = await get_full_project_state(mock_db, "nonexistent-id", "user-1")

            assert result is None

    @pytest.mark.asyncio
    async def test_block_flags_in_result(self):
        """Результат содержит block_flags."""
        from app.services.project_service import get_full_project_state

        mock_db = AsyncMock()
        project = make_mock_project()

        with patch("app.services.project_service.get_project_with_blocks", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = project

            result = await get_full_project_state(mock_db, "test-project-id", "user-1")

            assert "block_flags" in result
            assert isinstance(result["block_flags"], dict)
            assert "has_concept" in result["block_flags"]

    @pytest.mark.asyncio
    async def test_blocks_available_in_result(self):
        """Результат содержит blocks_available."""
        from app.services.project_service import get_full_project_state

        mock_db = AsyncMock()
        project = make_mock_project()

        with patch("app.services.project_service.get_project_with_blocks", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = project

            result = await get_full_project_state(mock_db, "test-project-id", "user-1")

            assert "blocks_available" in result
            ba = result["blocks_available"]
            assert "concept" in ba
            assert "core_loop" in ba
            assert "mda" in ba
            assert "balance" in ba
            assert "progression" in ba
            assert "economy" in ba
            assert "gdd" in ba
            assert "checklist" in ba

    @pytest.mark.asyncio
    async def test_aliases_present(self):
        """Результат содержит алиасы для совместимости (coreLoop, mda, balance, etc.)."""
        from app.services.project_service import get_full_project_state

        mock_db = AsyncMock()
        project = make_mock_project()

        with patch("app.services.project_service.get_project_with_blocks", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = project

            result = await get_full_project_state(mock_db, "test-project-id", "user-1")

            # Алиасы для AI-ассистента
            assert "coreLoop" in result
            assert "mda" in result
            assert "balance" in result
            assert "progression" in result
            assert "economy" in result
            assert "gdd" in result
            assert "checklist" in result


# ============================================================
# 5. ТЕСТЫ: BLOCK_REGISTRY для Блоков 6-7-8
# ============================================================

class TestBlockRegistryBlocks678:
    """Тесты конфигурации реестра блоков 6, 7, 8 (4.D.9)."""

    def test_block_6_config(self):
        """Блок 6 (GDD Generator) имеет корректную конфигурацию."""
        cfg = BLOCK_REGISTRY[6]
        assert cfg.id == 6
        assert cfg.name == "GDD Generator"
        assert cfg.flag_key == "has_gdd"
        assert cfg.stage == "gdd"
        assert cfg.event == PipelineEvent.GDD_UPDATED
        assert cfg.relation_attr == "gdd"

    def test_block_6_dependencies(self):
        """Блок 6 зависит от Блоков 1, 2, 3, 4, 5."""
        cfg = BLOCK_REGISTRY[6]
        assert cfg.dependencies == [1, 2, 3, 4, 5]

    def test_block_6_stale_downstream(self):
        """Обновление Блока 6 → Блок 8 становится stale."""
        cfg = BLOCK_REGISTRY[6]
        assert cfg.stale_downstream == [8]

    def test_block_7_config(self):
        """Блок 7 (AI-ассистент) имеет корректную конфигурацию."""
        cfg = BLOCK_REGISTRY[7]
        assert cfg.id == 7
        assert cfg.name == "AI-ассистент"
        assert cfg.flag_key == "has_checklist"
        assert cfg.stage == "gdd"
        assert cfg.relation_attr == "checklist"

    def test_block_7_no_event(self):
        """Блок 7 не генерирует событий пайплайна."""
        cfg = BLOCK_REGISTRY[7]
        assert cfg.event is None

    def test_block_7_dependencies(self):
        """Блок 7 зависит от Блоков 1, 2, 3."""
        cfg = BLOCK_REGISTRY[7]
        assert cfg.dependencies == [1, 2, 3]

    def test_block_7_stale_downstream_empty(self):
        """Блок 7 не делает другие блоки stale."""
        cfg = BLOCK_REGISTRY[7]
        assert cfg.stale_downstream == []

    def test_block_8_config(self):
        """Блок 8 (Интеграция GBE) имеет корректную конфигурацию."""
        cfg = BLOCK_REGISTRY[8]
        assert cfg.id == 8
        assert cfg.name == "Интеграция GBE"
        assert cfg.flag_key == "has_checklist"
        assert cfg.stage == "gdd"
        assert cfg.relation_attr == "checklist"

    def test_block_8_no_event(self):
        """Блок 8 не генерирует событий пайплайна."""
        cfg = BLOCK_REGISTRY[8]
        assert cfg.event is None

    def test_block_8_dependencies(self):
        """Блок 8 зависит от Блоков 1, 2, 3, 4, 5, 6."""
        cfg = BLOCK_REGISTRY[8]
        assert cfg.dependencies == [1, 2, 3, 4, 5, 6]

    def test_block_8_stale_downstream_empty(self):
        """Блок 8 не делает другие блоки stale."""
        cfg = BLOCK_REGISTRY[8]
        assert cfg.stale_downstream == []

    def test_backward_compat_block_dependencies(self):
        """BLOCK_DEPENDENCIES содержит записи для Блоков 6, 7, 8."""
        assert 6 in BLOCK_DEPENDENCIES
        assert 7 in BLOCK_DEPENDENCIES
        assert 8 in BLOCK_DEPENDENCIES
        assert BLOCK_DEPENDENCIES[6] == [1, 2, 3, 4, 5]
        assert BLOCK_DEPENDENCIES[7] == [1, 2, 3]
        assert BLOCK_DEPENDENCIES[8] == [1, 2, 3, 4, 5, 6]

    def test_backward_compat_stale_downstream(self):
        """STALE_DOWNSTREAM содержит записи для Блоков 6, 7, 8."""
        assert 6 in STALE_DOWNSTREAM
        assert 7 in STALE_DOWNSTREAM
        assert 8 in STALE_DOWNSTREAM
        assert STALE_DOWNSTREAM[6] == [8]
        assert STALE_DOWNSTREAM[7] == []
        assert STALE_DOWNSTREAM[8] == []

    def test_backward_compat_block_events(self):
        """BLOCK_EVENTS содержит событие для Блока 6, но не для 7 и 8."""
        assert 6 in BLOCK_EVENTS
        assert BLOCK_EVENTS[6] == PipelineEvent.GDD_UPDATED
        assert 7 not in BLOCK_EVENTS
        assert 8 not in BLOCK_EVENTS

    def test_backward_compat_block_names(self):
        """BLOCK_NAMES содержит имена для Блоков 6, 7, 8."""
        assert BLOCK_NAMES[6] == "GDD Generator"
        assert BLOCK_NAMES[7] == "AI-ассистент"
        assert BLOCK_NAMES[8] == "Интеграция GBE"

    def test_block_6_event_gdd_updated(self):
        """PipelineEvent.GDD_UPDATED определён."""
        assert PipelineEvent.GDD_UPDATED.value == "gdd_updated"

    def test_all_blocks_1_through_8_in_registry(self):
        """BLOCK_REGISTRY содержит все блоки 1-8."""
        for i in range(1, 9):
            assert i in BLOCK_REGISTRY, f"Блок {i} отсутствует в BLOCK_REGISTRY"

    def test_block_configs_are_dataclass_instances(self):
        """Все записи BLOCK_REGISTRY — экземпляры BlockConfig."""
        for bid, cfg in BLOCK_REGISTRY.items():
            assert isinstance(cfg, BlockConfig), f"Блок {bid} не является BlockConfig"
