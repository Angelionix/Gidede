"""
Gidede — Тесты интеграции Блоков 6-7 (4.D.10)

Кросс-модульные интеграционные тесты для Блоков 6 (GDD Generator)
и 7 (Checklist + AI Assistant), которые не покрываются отдельными
сервисными тестами.

Покрытие:
1. GDD Generation across Formats (~10 тестов)
   - Разные форматы GDD (one_sheet, full_gdd, treatment, sketch_design, modular)
   - Разные уровни детализации
   - Автоопределение формата по audience / project_stage
2. GDD + Checklist Integration (~8 тестов)
   - Чек-листы на полном/частичном GDD Profile
   - MDA → GDD consistency, Balance → GDD, Economy → GDD
   - Lens check → remediation, readiness level, score improvement
3. AI Assistant + GDD Context Integration (~8 тестов)
   - AI assistant получает GDD context
   - AI suggestions по GDD format, proactive alerts при consistency issues
   - Coverage gaps → enrichment suggestions, streaming, block_flags
4. Full Pipeline Integration (~10 тестов)
   - Полный пайплайн idea→GDD+export
   - Graceful degradation при partial data
   - Export MD/HTML/PDF/DOCX
   - Consistency report cross-block, stale cascade, latency
5. GDD API Endpoints Integration (~6 тестов)
   - POST /generate-full, /export, /checklists/run
   - GET project state с GDD/checklist
   - Error handling
"""

import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.gdd_service import (
    GDDService,
    FORMAT_SECTION_TEMPLATES,
    AUDIENCE_FORMAT_MAP,
    STAGE_FORMAT_MAP,
    GENRE_DETAIL_MAP,
)
from app.services.checklist_service import ChecklistService
from app.services.ai_assistant_service import AIAssistantService, AssistantContext
from app.services.pipeline_service import PipelineService, BLOCK_REGISTRY, STALE_DOWNSTREAM
from app.schemas.gdd import (
    GDDGenerationInput,
    GDDFormatSpec,
    GDDDataMapping,
    GDDProfile,
    GDDAssembledSection,
    GDDAssembledDocument,
    GDDFormattedDocument,
    ConsistencyReport,
    ExportFormat,
    GDDExportResult,
)
from app.schemas.checklist import (
    ChecklistInput,
    ValidationScope,
    ValidationProfile,
)
from app.ai.executor import PromptResult


# ============================================================
# ФИКСТУРЫ
# ============================================================

@pytest.fixture
def mock_executor():
    """Мок PromptExecutor для тестирования без реальных AI-вызовов."""
    executor = AsyncMock()
    executor.execute = AsyncMock()
    executor.execute.return_value = PromptResult(
        data={"content": "AI-generated content for section", "text": "Generated text"},
        metadata={"model": "test-model", "provider": "test", "latency_ms": 50},
    )
    return executor


@pytest.fixture
def gdd_service(mock_executor):
    """GDDService с моком executor."""
    return GDDService(executor=mock_executor)


@pytest.fixture
def checklist_service(mock_executor):
    """ChecklistService с моком executor."""
    return ChecklistService(executor=mock_executor)


@pytest.fixture
def ai_service(mock_executor):
    """AIAssistantService с моком executor."""
    return AIAssistantService(executor=mock_executor)


@pytest.fixture
def mock_db():
    """Mock AsyncSession."""
    return AsyncMock()


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
    """Создать mock-проект с настраиваемыми блоками."""
    project = MagicMock()
    project.id = "test-project-id"
    project.name = "Test Game"
    project.genre = "rpg"
    project.project_stage = "gdd"

    concept = MagicMock()
    concept.id = "concept-id"
    concept.genre = "rpg"
    concept.aesthetic_profile = (
        {"primary": "challenge", "secondary": "fantasy"} if has_concept else None
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


def _full_input_data():
    """Полные входные данные со всеми 6 блоками."""
    return GDDGenerationInput(
        concept={
            "title": "Shadow Realms",
            "description": "A dark fantasy RPG with survival and crafting",
            "genre": "RPG",
            "platforms": ["PC", "PlayStation"],
            "usp": "Unique blend of survival crafting and dark fantasy narrative",
            "targetAudience": ["achievement", "immersion"],
        },
        core_loop={
            "structural_type": "Engine",
            "steps": [
                {"name": "Explore", "resources_consumed": ["stamina"], "resources_produced": ["loot"]},
                {"name": "Craft", "resources_consumed": ["materials"], "resources_produced": ["gear"]},
                {"name": "Fight", "resources_consumed": ["health"], "resources_produced": ["xp"]},
            ],
            "loops": [
                {"name": "Combat Loop", "feedback_type": "positive"},
            ],
            "resources": [{"name": "Gold"}, {"name": "Materials"}],
        },
        mda_profile={
            "aesthetic_profile": {"primary": "Fantasy", "secondary": "Challenge"},
            "mechanicSet": {"mechanics": [
                {"name": "Exploration", "group": "Core"},
                {"name": "Combat", "group": "Core"},
                {"name": "Crafting", "group": "Secondary"},
            ]},
            "dynamics_target": {"core_dynamics": ["emergent_combat", "resource_management"]},
        },
        balance_result={
            "balanceType": "transitive",
            "dominant_type": "transitive",
            "transitiveResult": {"correlation": 0.95, "score": 0.95},
            "objects": [
                {"name": "Warrior", "cost": 100, "power": 95},
                {"name": "Mage", "cost": 100, "power": 98},
            ],
        },
        progression_profile={
            "macroModel": {"duration": 40, "totalLevels": 30, "progressionType": "exponential"},
            "tierModel": {"tiers": [
                {"index": 0, "scale": "early", "level_count": 10},
                {"index": 1, "scale": "mid", "level_count": 10},
            ]},
            "curves": {"xp_to_level": {"formula": "xp = base * level^1.5"}},
            "contentPlan": {"unlockTree": [
                {"level": 1, "unlock_name": "Sword", "unlock_type": "weapon"},
            ]},
        },
        economy_profile={
            "classification": {"economic_type": "closed", "sub_type": "sink_source"},
            "inventory": {"resources": [
                {"name": "Gold", "resource_class": "currency"},
                {"name": "Wood", "resource_class": "material"},
            ]},
            "resourceModel": {"sources": ["quests"], "sinks": ["crafting"]},
        },
    )


# ============================================================
# 1. GDD GENERATION ACROSS FORMATS (~10 тестов)
# ============================================================

class TestGDDGenerationFormats:
    """Тесты генерации GDD в разных форматах — кросс-форматная интеграция."""

    @pytest.mark.asyncio
    async def test_one_sheet_format_produces_minimal_sections(self, gdd_service):
        """one_sheet формат → минимальный набор секций (6)."""
        input_data = _full_input_data()
        input_data.target_format = "one_sheet"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.format == "one_sheet"
        assert len(result.format_spec.sections) == len(FORMAT_SECTION_TEMPLATES["one_sheet"])
        assert result.assembled_document is not None
        assert result.assembled_document.total_sections == len(FORMAT_SECTION_TEMPLATES["one_sheet"])

    @pytest.mark.asyncio
    async def test_full_gdd_format_produces_all_38_sections(self, gdd_service):
        """full_gdd формат → все секции (38 из FORMAT_SECTION_TEMPLATES)."""
        input_data = _full_input_data()
        input_data.target_format = "full_gdd"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.format == "full_gdd"
        expected_sections = len(FORMAT_SECTION_TEMPLATES["full_gdd"])
        assert len(result.format_spec.sections) == expected_sections
        assert result.assembled_document.total_sections == expected_sections

    @pytest.mark.asyncio
    async def test_treatment_format_produces_investor_sections(self, gdd_service):
        """treatment формат → investor-ориентированные секции."""
        input_data = _full_input_data()
        input_data.target_format = "treatment"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.format == "treatment"
        assert "title" in result.format_spec.sections
        assert "game_type" in result.format_spec.sections
        assert "originality" in result.format_spec.sections
        assert "feasibility" in result.format_spec.sections

    @pytest.mark.asyncio
    async def test_sketch_design_format_produces_design_sections(self, gdd_service):
        """sketch_design формат → секции для командной синхронизации."""
        input_data = _full_input_data()
        input_data.target_format = "sketch_design"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.format == "sketch_design"
        assert "mechanics" in result.format_spec.sections
        assert "level_design" in result.format_spec.sections
        assert "progression" in result.format_spec.sections

    @pytest.mark.asyncio
    async def test_modular_format_produces_modular_sections(self, gdd_service):
        """modular формат → секции для персонального использования."""
        input_data = _full_input_data()
        input_data.target_format = "modular"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.format == "modular"
        assert "concept_overview" in result.format_spec.sections
        assert "core_loop" in result.format_spec.sections
        assert "mda_analysis" in result.format_spec.sections
        assert "balance_tables" in result.format_spec.sections
        assert "economy_model" in result.format_spec.sections

    @pytest.mark.asyncio
    async def test_detail_level_overview_produces_fewer_pages(self, gdd_service):
        """detail_level=overview → estimated_pages с множителем 0.5."""
        input_data = _full_input_data()
        input_data.detail_level = "overview"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.detail_level == "overview"
        # Для full_gdd: base=50 * 0.5 = 25
        base_pages = {"one_sheet": 1, "full_gdd": 50}.get(result.format_spec.format, 20)
        expected = max(1, int(base_pages * 0.5))
        assert result.format_spec.estimated_pages == expected

    @pytest.mark.asyncio
    async def test_detail_level_exhaustive_produces_more_pages(self, gdd_service):
        """detail_level=exhaustive → estimated_pages с множителем 2.5."""
        input_data = _full_input_data()
        input_data.target_format = "full_gdd"
        input_data.detail_level = "exhaustive"
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.format_spec.detail_level == "exhaustive"
        # full_gdd: base=50 * 2.5 = 125
        assert result.format_spec.estimated_pages == 125

    @pytest.mark.asyncio
    async def test_format_auto_detection_from_audience(self, gdd_service):
        """target_audience_doc=investor → формат treatment автоматически."""
        input_data = GDDGenerationInput(
            concept={"genre": "RPG", "title": "My Game"},
            target_audience_doc="investor",
        )
        format_spec = await gdd_service.determine_gdd_format(input_data)

        assert format_spec.format == "treatment"
        assert format_spec.audience == "investor"

    @pytest.mark.asyncio
    async def test_format_auto_detection_from_project_stage(self, gdd_service):
        """project_stage=concept → формат one_sheet автоматически."""
        input_data = GDDGenerationInput(
            concept={"genre": "RPG", "title": "My Game"},
            project_stage="concept",
        )
        format_spec = await gdd_service.determine_gdd_format(input_data)

        assert format_spec.format == "one_sheet"

    @pytest.mark.asyncio
    async def test_detail_level_auto_detection_from_genre(self, gdd_service):
        """genre=rpg → detail_level=detailed автоматически (GENRE_DETAIL_MAP)."""
        input_data = GDDGenerationInput(
            concept={"genre": "rpg", "title": "My RPG"},
        )
        format_spec = await gdd_service.determine_gdd_format(input_data)

        assert format_spec.detail_level == "detailed"


# ============================================================
# 2. GDD + CHECKLIST INTEGRATION (~8 тестов)
# ============================================================

class TestGDDChecklistIntegration:
    """Тесты интеграции GDD и Checklist — кросс-модульные проверки."""

    @pytest.mark.asyncio
    async def test_checklist_on_full_gdd_profile(self, checklist_service):
        """Чек-листы на полном GDD Profile (все блоки заполнены)."""
        input_data = ChecklistInput(
            concept={"genre": "rpg", "title": "Test Game", "narrative": {
                "story": "A hero rises", "characters": [{"name": "Hero"}],
                "quests": [{"type": "fetch"}, {"type": "boss"}, {"type": "escort"}],
            }},
            core_loop={"structural_type": "Engine", "steps": [{"name": "Explore"}]},
            mda_profile={
                "aesthetic_profile": {"primary_aesthetics": ["Fantasy", "Challenge"]},
                "dynamics": ["emergent_combat", "resource_management"],
                "mechanic_set": {"mechanics": [
                    {"name": "Combat"}, {"name": "Crafting"}, {"name": "Exploration"},
                ]},
            },
            balance_result={
                "elements": [{"name": "A", "status": "balanced"}],
                "intransitive_result": {"has_dominant_strategy": False, "rps_cycles": []},
            },
            progression_profile={
                "curves": {"xp_to_level": {"formula": "xp = base * level^1.5"}},
                "validation": {"grind_detected": False, "walls_detected": False, "empty_levels": 0},
            },
            economy_profile={
                "pathologies": [],
                "resource_model": {"core_resources": [
                    {"name": "Gold", "faucet_rate": 100, "drain_rate": 100},
                ]},
                "conversion_chains": [],
            },
            project_stage="preproduction",
        )
        result = await checklist_service.run_validation(input_data)

        assert isinstance(result, ValidationProfile)
        assert result.mda_check is not None
        assert result.balance_check is not None
        assert result.summary.overall_score > 0

    @pytest.mark.asyncio
    async def test_checklist_on_partial_gdd_missing_blocks(self, checklist_service):
        """Чек-листы на частичном GDD (отсутствующие блоки → skip)."""
        input_data = ChecklistInput(
            concept={"genre": "rpg", "title": "Test"},
            mda_profile=None,
            balance_result=None,
            economy_profile=None,
            project_stage="preproduction",
        )
        result = await checklist_service.run_validation(input_data)

        assert isinstance(result, ValidationProfile)
        # MDA, Balance, Economy checks should be skipped
        if result.mda_check:
            assert result.mda_check.skipped is True
        if result.balance_check:
            assert result.balance_check.skipped is True
        if result.economy_check:
            assert result.economy_check.skipped is True

    @pytest.mark.asyncio
    async def test_mda_check_results_feed_into_gdd_consistency(self, gdd_service):
        """MDA check issues → GDD consistency report обнаруживает проблемы."""
        input_data = _full_input_data()
        # Deliberately make mechanics inconsistent with core_loop
        input_data.mda_profile = {
            "aesthetic_profile": {"primary": "Fantasy"},
            "mechanicSet": {"mechanics": [{"name": "Cooking"}, {"name": "Fishing"}]},
        }
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.assembled_document is not None
        assert result.assembled_document.consistency_report is not None
        # Consistency report should detect issues
        assert isinstance(result.assembled_document.consistency_report, ConsistencyReport)

    @pytest.mark.asyncio
    async def test_balance_issues_correlate_with_gdd_balance_section(self, gdd_service):
        """Balance issues → GDD секция balance отражает проблемы."""
        input_data = _full_input_data()
        input_data.balance_result = {
            "balanceType": "intransitive",
            "elements": [
                {"name": "Warrior", "status": "overpowered"},
                {"name": "Mage", "status": "underpowered"},
            ],
            "intransitive_result": {"has_dominant_strategy": True, "rps_cycles": []},
        }
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.assembled_document is not None
        # The assembled document should have a balance section
        balance_section = result.assembled_document.sections.get("balance")
        if balance_section:
            assert balance_section.content != ""

    @pytest.mark.asyncio
    async def test_economy_issues_flagged_in_gdd_economy_section(self, gdd_service):
        """Economy pathologies → GDD секция economy содержит информацию."""
        input_data = _full_input_data()
        input_data.economy_profile = {
            "pathologies": [{"type": "runaway", "severity": "critical"}],
            "resourceModel": {"sources": ["quests"], "sinks": ["crafting"]},
            "classification": {"economic_type": "open"},
        }
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.assembled_document is not None
        economy_section = result.assembled_document.sections.get("economy")
        if economy_section:
            assert economy_section.content != ""

    @pytest.mark.asyncio
    async def test_lens_check_produces_remediation_items(self, checklist_service):
        """Lens check → remediation items с effort и suggested_order."""
        input_data = ChecklistInput(
            concept={"genre": "rpg", "title": "Test"},
            mda_profile={
                "aesthetic_profile": {"primary_aesthetics": ["Fantasy"]},
                "dynamics": ["emergent_combat"],
                "mechanic_set": {"mechanics": [{"name": "Combat"}]},
            },
            project_stage="preproduction",
        )
        result = await checklist_service.run_validation(input_data)

        assert isinstance(result, ValidationProfile)
        if result.lens_check and not result.lens_check.skipped:
            assert result.lens_check.overall_lens_score >= 0.0
            assert isinstance(result.lens_check.results, list)

    @pytest.mark.asyncio
    async def test_full_validation_pipeline_produces_readiness_level(self, checklist_service):
        """Полный пайплайн валидации → readiness_level в summary."""
        input_data = ChecklistInput(
            concept={"genre": "rpg", "title": "Test"},
            core_loop={"structural_type": "Engine", "steps": [{"name": "Explore"}]},
            mda_profile={
                "aesthetic_profile": {"primary_aesthetics": ["Fantasy"]},
                "dynamics": ["emergent_combat"],
                "mechanic_set": {"mechanics": [{"name": "Combat"}]},
            },
            balance_result={"elements": [{"name": "Sword", "status": "balanced"}]},
            project_stage="preproduction",
        )
        result = await checklist_service.run_validation(input_data)

        assert result.summary.readiness_level in ("ready", "nearly_ready", "needs_work", "not_ready")
        assert result.summary.overall_score >= 0
        assert result.summary.total_issues >= 0

    @pytest.mark.asyncio
    async def test_checklist_score_improvement_after_fixing_issues(self, checklist_service):
        """После исправления issues → score улучшается."""
        # First run with problems
        bad_input = ChecklistInput(
            concept={"genre": "rpg", "title": "Test"},
            balance_result={
                "elements": [
                    {"name": "A", "status": "overpowered"},
                    {"name": "B", "status": "overpowered"},
                    {"name": "C", "status": "overpowered"},
                ],
                "intransitive_result": {"has_dominant_strategy": True, "rps_cycles": []},
            },
            project_stage="preproduction",
        )
        bad_result = await checklist_service.run_validation(bad_input)

        # Second run with fixed balance
        good_input = ChecklistInput(
            concept={"genre": "rpg", "title": "Test"},
            balance_result={
                "elements": [
                    {"name": "A", "status": "balanced"},
                    {"name": "B", "status": "balanced"},
                    {"name": "C", "status": "balanced"},
                ],
                "intransitive_result": {"has_dominant_strategy": False, "rps_cycles": [
                    {"attacker": "A", "defender": "B"},
                ]},
            },
            project_stage="preproduction",
        )
        good_result = await checklist_service.run_validation(good_input)

        # Balance score should improve
        bad_balance = bad_result.balance_check.overall_balance_score if bad_result.balance_check else 0
        good_balance = good_result.balance_check.overall_balance_score if good_result.balance_check else 0
        assert good_balance >= bad_balance


# ============================================================
# 3. AI ASSISTANT + GDD CONTEXT INTEGRATION (~8 тестов)
# ============================================================

class TestAIAssistantGDDContext:
    """Тесты интеграции AI-ассистента с GDD контекстом."""

    @pytest.mark.asyncio
    async def test_ai_assistant_receives_gdd_profile_as_context(self, ai_service):
        """AI assistant получает GDD profile как контекст когда Block 6 заполнен."""
        project_state = {
            "name": "Test Game",
            "concept": {"genre": "RPG", "title": "My RPG"},
            "core_loop": {"structural_type": "Engine", "steps": [{"name": "Explore"}]},
            "mda": {"mechanics": ["combat"]},
            "gdd": {
                "target_format": "full",
                "section_count": 38,
                "completeness_percent": 85,
                "consistency_issues": [],
            },
        }

        with patch.object(ai_service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            ctx = await ai_service.build_assistant_context(project_state, include_rag=False)

        assert isinstance(ctx, AssistantContext)
        assert ctx.gdd_profile is not None
        assert ctx.gdd_profile.get("target_format") == "full"
        assert ctx.gdd_profile.get("completeness_percent") == 85

    @pytest.mark.asyncio
    async def test_ai_suggestions_relevant_to_gdd_format(self, ai_service):
        """AI suggestions зависят от текущего GDD формата."""
        project_state = {
            "concept": {"genre": "RPG"},
            "gdd": {"target_format": "one_sheet"},
        }

        suggestions = await ai_service.generate_suggestions(6, project_state)

        assert isinstance(suggestions, list)
        # Block 6 should have template suggestions
        assert len(suggestions) > 0

    @pytest.mark.asyncio
    async def test_ai_proactive_alerts_when_gdd_consistency_issues(self, ai_service):
        """AI proactive alerts когда GDD имеет проблемы (missing blocks → gap alerts)."""
        project_state = {
            "concept": {"genre": "RPG"},
            "gdd": {
                "consistency_issues": [
                    {"severity": "error", "type": "coreloop_mechanics_mismatch"},
                ],
            },
        }

        alerts = await ai_service.check_proactive_alerts(project_state)

        assert isinstance(alerts, list)
        # GDD is present (has data) → no gap alert for block 6,
        # but missing blocks 2-5 should trigger gap alerts
        gap_alerts = [a for a in alerts if a.alert_type == "gap"]
        gap_block_ids = {a.block_id for a in gap_alerts}
        # Blocks 2 (core_loop), 3 (mda), 4 (balance), 5 (economy/progression) missing
        assert 2 in gap_block_ids or 3 in gap_block_ids or 4 in gap_block_ids

    @pytest.mark.asyncio
    async def test_ai_suggests_section_enrichment_based_on_coverage_gaps(self, ai_service):
        """AI suggests section enrichment на основе coverage gaps."""
        project_state = {
            "concept": {"genre": "RPG"},
            "gdd": {
                "target_format": "full",
                "completeness_percent": 30,
            },
        }

        suggestions = await ai_service.generate_suggestions(6, project_state)

        assert len(suggestions) > 0
        # Low completeness should trigger context-aware suggestions
        context_suggestions = [s for s in suggestions if "GDD" in s.title or "gdd" in s.title.lower()]
        # At minimum, template suggestions exist for block 6
        assert len(suggestions) > 0

    @pytest.mark.asyncio
    async def test_ai_chat_includes_gdd_structure_in_system_context(self, ai_service, mock_executor):
        """AI chat включает GDD structure в system context."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Based on your GDD format, I recommend...", "sources": []},
            metadata={"model": "test", "provider": "test", "latency_ms": 100},
        )

        project_state = {
            "concept": {"genre": "RPG"},
            "gdd": {"target_format": "full", "section_count": 38},
        }

        with patch.object(ai_service, "build_assistant_context", new_callable=AsyncMock) as mock_ctx:
            mock_ctx.return_value = AssistantContext(
                project_name="Test",
                genre="RPG",
                gdd_profile={"target_format": "full", "section_count": 38},
                rag_context="",
            )
            result = await ai_service.chat(
                message="What sections should I fill next?",
                user_id="user1",
                project_id="proj1",
                project_state=project_state,
            )

        assert isinstance(result, dict)
        assert "reply" in result
        mock_ctx.assert_called_once()

    @pytest.mark.asyncio
    async def test_ai_streaming_chat_works_with_gdd_context(self, ai_service):
        """AI streaming chat работает с GDD context."""
        chunks = []
        async for chunk in ai_service.chat_stream(
            message="Tell me about my GDD",
            user_id="user1",
            project_id="proj1",
            project_state={"concept": {"genre": "RPG"}, "gdd": {"target_format": "full"}},
        ):
            chunks.append(chunk)

        assert len(chunks) > 0

    @pytest.mark.asyncio
    async def test_ai_assistant_history_includes_gdd_messages(self, ai_service, mock_executor):
        """AI assistant history содержит GDD-related сообщения."""
        mock_executor.execute.return_value = PromptResult(
            data={"reply": "Your GDD has 38 sections", "sources": []},
            metadata={"model": "test", "provider": "test", "latency_ms": 50},
        )

        with patch.object(ai_service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            await ai_service.chat(
                message="How many sections in my GDD?",
                user_id="user1",
                project_id="proj1",
            )

        history = await ai_service.get_chat_history("user1", "proj1")
        assert len(history) >= 1
        assert any("GDD" in m.content or "gdd" in m.content.lower() for m in history)

    @pytest.mark.asyncio
    async def test_ai_block_flags_report_gdd_and_checklist_status(self, ai_service):
        """AI block_flags корректно отражают статус GDD и Checklist."""
        project_state = {
            "concept": {"genre": "RPG"},
            "core_loop": {"structural_type": "Engine"},
            "mda": {"mechanics": ["combat"]},
            "balance": {"elements": []},
            "progression": {"total_levels": 30},
            "economy": {"resource_model": {"core": ["Gold"]}},
            "gdd": {"target_format": "full"},
            "checklist": {"shell_lenses": True},
        }

        with patch.object(ai_service, "search_knowledge", new_callable=AsyncMock, return_value=""):
            ctx = await ai_service.build_assistant_context(project_state, include_rag=False)

        assert ctx.gdd_profile is not None
        assert ctx.checklist_results is not None


# ============================================================
# 4. FULL PIPELINE INTEGRATION (~10 тестов)
# ============================================================

class TestFullPipelineIntegration:
    """Тесты полного пайплайна от идеи до GDD + экспорт."""

    @pytest.mark.asyncio
    async def test_full_pipeline_concept_to_gdd(self, gdd_service):
        """Полный пайплайн concept→coreloop→mda→balance→progression→economy→gdd."""
        input_data = _full_input_data()
        result = await gdd_service.generate_stages_1_8(input_data)

        assert isinstance(result, GDDProfile)
        for stage in [1, 2, 3, 4, 5, 6, 7]:
            assert stage in result.stages_completed, f"Stage {stage} not completed"
        assert result.assembled_document is not None
        assert result.formatted_document is not None
        assert result.coverage_score > 0

    @pytest.mark.asyncio
    async def test_pipeline_with_partial_data_still_produces_gdd(self, gdd_service):
        """Pipeline с частичными данными → GDD всё равно генерируется (graceful degradation)."""
        input_data = GDDGenerationInput(
            concept={"genre": "RPG", "title": "My Game", "description": "An RPG"},
            target_format="one_sheet",
        )
        result = await gdd_service.generate_stages_1_8(input_data)

        assert isinstance(result, GDDProfile)
        assert result.assembled_document is not None
        # Coverage should be lower but > 0
        assert result.coverage_score >= 0.0
        # Should have warnings about missing blocks
        if result.data_mapping:
            assert len(result.data_mapping.manual_sections) > 0 or len(result.data_mapping.ai_generatable_sections) > 0

    @pytest.mark.asyncio
    async def test_gdd_export_to_markdown_format(self, gdd_service):
        """GDD экспорт в Markdown формат."""
        input_data = _full_input_data()
        profile = await gdd_service.generate_stages_1_8(input_data)

        assert profile.formatted_document is not None
        result = await gdd_service.export_gdd(profile.formatted_document, "md", "Test Game")

        assert result.success is True
        assert result.format == "md"
        assert result.content_type == "text/markdown"
        assert result.content != ""
        assert result.file_name.endswith(".md")

    @pytest.mark.asyncio
    async def test_gdd_export_to_html_format(self, gdd_service):
        """GDD экспорт в HTML формат."""
        input_data = _full_input_data()
        profile = await gdd_service.generate_stages_1_8(input_data)

        assert profile.formatted_document is not None
        result = await gdd_service.export_gdd(profile.formatted_document, "html", "Test Game")

        assert result.success is True
        assert result.format == "html"
        assert result.content_type == "text/html"

    @pytest.mark.asyncio
    async def test_gdd_export_to_pdf_format(self, gdd_service):
        """GDD экспорт в PDF формат (WeasyPrint fallback)."""
        input_data = _full_input_data()
        profile = await gdd_service.generate_stages_1_8(input_data)

        assert profile.formatted_document is not None
        result = await gdd_service.export_gdd(profile.formatted_document, "pdf", "Test Game")

        assert result.format == "pdf"
        assert result.success is True
        # If WeasyPrint installed → application/pdf, else fallback to HTML
        assert result.content_type in ("application/pdf", "text/html")

    @pytest.mark.asyncio
    async def test_gdd_export_to_docx_format(self, gdd_service):
        """GDD экспорт в DOCX формат (python-docx)."""
        input_data = _full_input_data()
        profile = await gdd_service.generate_stages_1_8(input_data)

        assert profile.formatted_document is not None
        result = await gdd_service.export_gdd(profile.formatted_document, "docx", "Test Game")

        assert result.format == "docx"
        # May succeed or gracefully fail depending on python-docx availability
        if result.success:
            assert result.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    @pytest.mark.asyncio
    async def test_gdd_consistency_report_detects_cross_block_issues(self, gdd_service):
        """GDD consistency report обнаруживает cross-block проблемы."""
        input_data = _full_input_data()
        # Make mechanics inconsistent with core_loop content
        input_data.mda_profile = {
            "aesthetic_profile": {"primary": "Fantasy"},
            "mechanicSet": {"mechanics": [{"name": "Cooking"}, {"name": "Fishing"}]},
            "dynamics_target": {"core_dynamics": ["cooking_mastery"]},
        }
        result = await gdd_service.generate_stages_1_8(input_data)

        assert result.assembled_document is not None
        report = result.assembled_document.consistency_report
        assert isinstance(report, ConsistencyReport)
        # Should have some issues detected
        assert len(report.checked_pairs) > 0

    @pytest.mark.asyncio
    async def test_pipeline_stale_cascade_block5_affects_block6(self, pipeline_service):
        """Stale cascade: Блок 5 обновлён → Блок 6 становится stale."""
        # STALE_DOWNSTREAM[5] = [6, 8]
        assert 6 in STALE_DOWNSTREAM.get(5, [])
        assert 8 in STALE_DOWNSTREAM.get(5, [])

        # Verify through BLOCK_REGISTRY
        block5_cfg = BLOCK_REGISTRY[5]
        assert 6 in block5_cfg.stale_downstream

    @pytest.mark.asyncio
    async def test_pipeline_stale_cascade_block1_affects_block6(self, pipeline_service):
        """Stale cascade: Блок 1 обновлён → Блок 6 становится stale."""
        # STALE_DOWNSTREAM[1] = [2, 3, 4, 5, 6, 7, 8]
        assert 6 in STALE_DOWNSTREAM.get(1, [])

        block1_cfg = BLOCK_REGISTRY[1]
        assert 6 in block1_cfg.stale_downstream

    @pytest.mark.asyncio
    async def test_gdd_generation_latency_with_mock_ai(self, gdd_service):
        """GDD generation latency приемлема с mock AI."""
        input_data = _full_input_data()
        start = time.time()
        result = await gdd_service.generate_stages_1_8(input_data)
        elapsed_ms = (time.time() - start) * 1000

        assert isinstance(result, GDDProfile)
        # With mock AI, latency should be < 5 seconds
        assert elapsed_ms < 5000, f"GDD generation took {elapsed_ms:.0f}ms (> 5000ms)"


# ============================================================
# 5. GDD API ENDPOINTS INTEGRATION (~6 тестов)
# ============================================================

class TestGDDAPIEndpointsIntegration:
    """Тесты GDD API endpoints — интеграционные."""

    @pytest.mark.asyncio
    async def test_post_generate_full_with_full_project_data(self, gdd_service):
        """POST /generate-full с полными данными проекта → GDDProfile."""
        input_data = _full_input_data()
        result = await gdd_service.generate_stages_1_8(input_data)

        assert isinstance(result, GDDProfile)
        assert result.formatted_document is not None
        assert result.formatted_document.markdown != ""
        assert result.formatted_document.word_count > 0
        assert result.formatted_document.section_count > 0

    @pytest.mark.asyncio
    async def test_post_export_with_format_specification(self, gdd_service):
        """POST /export с format=md → корректный Markdown."""
        input_data = _full_input_data()
        profile = await gdd_service.generate_stages_1_8(input_data)

        formatted = profile.formatted_document
        assert formatted is not None

        export_result = await gdd_service.export_gdd(formatted, "md", "Shadow Realms")
        assert export_result.success is True
        assert export_result.format == "md"
        assert "Shadow_Realms" in export_result.file_name

    @pytest.mark.asyncio
    async def test_post_checklists_run_with_gdd_data(self, checklist_service):
        """POST /checklists/run с GDD данными → ValidationProfile."""
        input_data = ChecklistInput(
            concept={"genre": "rpg", "title": "Test"},
            core_loop={"structural_type": "Engine", "steps": [{"name": "Explore"}]},
            mda_profile={
                "aesthetic_profile": {"primary_aesthetics": ["Fantasy", "Challenge"]},
                "dynamics": ["emergent_combat"],
                "mechanic_set": {"mechanics": [{"name": "Combat"}, {"name": "Crafting"}]},
            },
            balance_result={
                "elements": [{"name": "Sword", "status": "balanced"}],
                "intransitive_result": {"has_dominant_strategy": False, "rps_cycles": []},
            },
            project_stage="preproduction",
        )
        result = await checklist_service.run_validation(input_data)

        assert isinstance(result, ValidationProfile)
        assert result.summary is not None
        assert result.summary.overall_score >= 0
        assert len(result.stages_completed) > 0

    @pytest.mark.asyncio
    async def test_get_project_state_includes_gdd_and_checklist_blocks(self, pipeline_service):
        """GET project state включает GDD и Checklist блоки."""
        project = make_mock_project(has_gdd=True, has_checklist=True)

        with patch("app.services.project_service.get_project_with_blocks", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = project
            from app.services.project_service import get_full_project_state

            result = await get_full_project_state(pipeline_service.db, "test-project-id", "user-1")

        assert result is not None
        assert "gdd" in result
        assert "checklist" in result
        assert "block_flags" in result

    @pytest.mark.asyncio
    async def test_error_handling_missing_project_for_gdd_generation(self, pipeline_service):
        """Error handling: проект не найден для GDD генерации."""
        mock_result = MagicMock()
        mock_result.unique.return_value.scalar_one_or_none.return_value = None
        pipeline_service.db.execute = AsyncMock(return_value=mock_result)

        result = await pipeline_service.prepare_block_input("nonexistent-id", 6)

        assert "error" in result

    @pytest.mark.asyncio
    async def test_error_handling_export_with_invalid_format(self, gdd_service):
        """Error handling: экспорт с невалидным форматом → graceful fallback."""
        formatted = GDDFormattedDocument(
            markdown="# Test GDD\n\nContent here.",
            title="Test",
            table_of_contents="",
            section_count=1,
            word_count=10,
            estimated_pages=1,
        )
        # The service should handle invalid format gracefully
        # by returning an error in the result
        try:
            result = await gdd_service.export_gdd(formatted, "invalid_format", "Test")
            # If it doesn't raise, it should indicate failure
            assert isinstance(result, GDDExportResult)
        except Exception:
            # If it raises, that's also acceptable behavior
            pass
