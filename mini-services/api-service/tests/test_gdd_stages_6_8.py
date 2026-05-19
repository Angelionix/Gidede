"""
Gidede — GDD Service Tests — Stages 6-8
Фаза 4.D.3: Тесты для Блока 6 — GDD Generator (алгоритм 3.7, Этапы 6–8)

Тесты:
- Stage 6: assemble_gdd — сшивка, приоритеты, покрытие, флаги
- Stage 6: validate_consistency — пары секций, ошибки, предупреждения, info
- Stage 7: format_document — markdown, оглавление, нумерация, подсчёт
- Stage 8: export_gdd — MD, HTML, PDF, DOCX, content_type, file_name
- Full Pipeline: generate_stages_1_8 — полный пайплайн 1–7
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

from app.schemas.gdd import (
    GDDFormatSpec,
    SectionMapping,
    SectionReadiness,
    GDDDataMapping,
    SectionContent,
    AutoFilledSections,
    AIEnrichedSections,
    ManualSectionSkeleton,
    ManualSectionsResult,
    GDDGenerationInput,
    GDDProfile,
    ConsistencyIssue,
    ConsistencyReport,
    GDDAssembledSection,
    GDDAssembledDocument,
    GDDFormattedDocument,
    ExportFormat,
    GDDExportResult,
)
from app.ai.executor import PromptResult
from app.services.gdd_service import (
    GDDService,
    FORMAT_SECTION_TEMPLATES,
)


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def mock_executor():
    """Мок PromptExecutor для тестирования без реальных AI-вызовов."""
    executor = AsyncMock()
    executor.execute = AsyncMock()
    return executor


@pytest.fixture
def gdd_service(mock_executor):
    """Создать GDDService с моком executor."""
    return GDDService(executor=mock_executor)


@pytest.fixture
def sample_concept():
    """Тестовый концепт игры."""
    return {
        "title": "Shadow Realms",
        "description": "A dark fantasy RPG with survival and crafting",
        "genre": "RPG",
        "platforms": ["PC", "PlayStation"],
        "usp": "Unique blend of survival crafting and dark fantasy narrative",
        "targetAudience": ["achievement", "immersion"],
    }


@pytest.fixture
def sample_core_loop():
    """Тестовый Core Loop."""
    return {
        "structural_type": "Engine",
        "steps": [
            {"name": "Explore", "resources_consumed": ["stamina"], "resources_produced": ["loot"]},
            {"name": "Craft", "resources_consumed": ["materials"], "resources_produced": ["gear"]},
            {"name": "Fight", "resources_consumed": ["health"], "resources_produced": ["xp"]},
        ],
        "loops": [
            {"name": "Combat Loop", "feedback_type": "positive"},
            {"name": "Crafting Loop", "feedback_type": "negative"},
        ],
        "resources": [
            {"name": "Gold"},
            {"name": "Materials"},
        ],
    }


@pytest.fixture
def sample_mda_profile():
    """Тестовый MDA-профиль."""
    return {
        "aesthetic_profile": {
            "primary": "Fantasy",
            "secondary": "Challenge",
        },
        "aesthetics": {
            "primary": "Fantasy",
            "secondary": "Challenge",
        },
        "mechanicSet": {
            "mechanics": [
                {"name": "Exploration", "group": "Core", "description": "Open world exploration"},
                {"name": "Combat", "group": "Core", "description": "Action combat system"},
                {"name": "Crafting", "group": "Secondary", "description": "Item crafting"},
            ],
            "base": [],
        },
        "dynamics_target": {
            "core_dynamics": ["emergent_combat", "resource_management"],
        },
    }


@pytest.fixture
def sample_balance_result():
    """Тестовый результат балансировки."""
    return {
        "balanceType": "transitive",
        "dominant_type": "transitive",
        "transitiveResult": {
            "correlation": 0.95,
            "score": 0.95,
        },
        "intransitiveResult": {
            "rpsCycles": [],
            "cycles": [],
        },
        "objects": [
            {"name": "Warrior", "cost": 100, "power": 95},
            {"name": "Mage", "cost": 100, "power": 98},
        ],
    }


@pytest.fixture
def sample_progression_profile():
    """Тестовый профиль прогрессии."""
    return {
        "macroModel": {
            "duration": 40,
            "totalLevels": 30,
            "progressionType": "exponential",
        },
        "tierModel": {
            "tiers": [
                {"index": 0, "scale": "early", "level_count": 10},
                {"index": 1, "scale": "mid", "level_count": 10},
                {"index": 2, "scale": "late", "level_count": 10},
            ],
        },
        "curves": {
            "xp_to_level": {"formula": "xp = base * level^1.5", "parameters": {"base": 100, "exponent": 1.5}},
            "difficulty": {"formula": "diff = base * tier^1.2", "parameters": {"base": 1.0, "exponent": 1.2}},
        },
        "contentPlan": {
            "unlockTree": [
                {"level": 1, "unlock_name": "Sword", "unlock_type": "weapon"},
                {"level": 5, "unlock_name": "Shield", "unlock_type": "armor"},
            ],
            "total_content_requirements": {
                "weapons": 20,
                "armor_sets": 10,
            },
        },
    }


@pytest.fixture
def sample_economy_profile():
    """Тестовый профиль экономики."""
    return {
        "classification": {
            "economic_type": "closed",
            "sub_type": "sink_source",
        },
        "inventory": {
            "resources": [
                {"name": "Gold", "resource_class": "currency", "is_consumable": True},
                {"name": "Wood", "resource_class": "material", "is_consumable": True},
                {"name": "Iron", "resource_class": "material", "is_consumable": True},
            ],
        },
        "resourceModel": {
            "sources": ["quests", "combat"],
            "sinks": ["crafting", "upgrades"],
        },
    }


@pytest.fixture
def full_input_data(
    sample_concept,
    sample_core_loop,
    sample_mda_profile,
    sample_balance_result,
    sample_progression_profile,
    sample_economy_profile,
):
    """Полные входные данные со всеми 6 блоками."""
    return GDDGenerationInput(
        concept=sample_concept,
        core_loop=sample_core_loop,
        mda_profile=sample_mda_profile,
        balance_result=sample_balance_result,
        progression_profile=sample_progression_profile,
        economy_profile=sample_economy_profile,
    )


# ============================================================
# Helper: построить GDDProfile из пайплайна 1-5
# ============================================================

async def _build_profile_stages_1_5(gdd_service, input_data):
    """Запустить пайплайн 1-5 и вернуть GDDProfile."""
    # Настраиваем mock executor для возврата данных
    gdd_service.executor.execute.return_value = PromptResult(
        data={"content": "AI-generated content for section", "text": "Generated text"},
    )
    return await gdd_service.generate_stages_1_5(input_data)


# ============================================================
# Тесты: Stage 6 — assemble_gdd (алгоритм 3.7.8)
# ============================================================

@pytest.mark.asyncio
async def test_assemble_gdd_merges_sections(gdd_service, full_input_data):
    """assemble_gdd с полными данными объединяет секции из auto_filled, ai_enriched и manual."""
    profile = await _build_profile_stages_1_5(gdd_service, full_input_data)
    result = await gdd_service.assemble_gdd(profile)

    assert isinstance(result, GDDAssembledDocument)
    assert result.total_sections > 0
    # Все секции из format_spec должны присутствовать
    for section_name in profile.format_spec.sections:
        assert section_name in result.sections


@pytest.mark.asyncio
async def test_assemble_gdd_priority_ai_enriched(gdd_service, full_input_data):
    """Приоритет: ai_enriched > auto_filled > manual."""
    profile = await _build_profile_stages_1_5(gdd_service, full_input_data)
    result = await gdd_service.assemble_gdd(profile)

    # Если секция обогащена AI, источник должен быть ai_enrich
    for section_name, section in result.sections.items():
        if profile.ai_enriched_sections:
            enriched = profile.ai_enriched_sections.enriched_sections.get(section_name)
            if enriched and enriched.content:
                assert section.source == "ai_enrich"
                break  # Хотя бы одна секция с ai_enrich


@pytest.mark.asyncio
async def test_assemble_gdd_correct_source_labels(gdd_service, full_input_data):
    """assemble_gdd устанавливает корректные метки источника."""
    profile = await _build_profile_stages_1_5(gdd_service, full_input_data)
    result = await gdd_service.assemble_gdd(profile)

    valid_sources = {"ai_enrich", "ai_generate", "auto_fill", "manual", ""}
    for section_name, section in result.sections.items():
        assert section.source in valid_sources, (
            f"Section '{section_name}' has invalid source: {section.source}"
        )


@pytest.mark.asyncio
async def test_assemble_gdd_sets_diagram_tables_formulas_flags(gdd_service, full_input_data):
    """assemble_gdd корректно устанавливает флаги has_diagram/has_tables/has_formulas."""
    profile = await _build_profile_stages_1_5(gdd_service, full_input_data)
    result = await gdd_service.assemble_gdd(profile)

    # Проверяем, что флаги установлены для секций, где они должны быть
    # core_loop должен иметь диаграмму (mapping.diagram=True)
    core_loop = result.sections.get("core_loop")
    if core_loop and core_loop.content:
        assert core_loop.has_diagram is True

    # mechanics должен иметь таблицы (mapping.tables=True)
    mechanics = result.sections.get("mechanics")
    if mechanics and mechanics.content:
        assert mechanics.has_tables is True

    # progression должен иметь формулы (mapping.formulas=True)
    progression = result.sections.get("progression")
    if progression and progression.content:
        assert progression.has_formulas is True


@pytest.mark.asyncio
async def test_assemble_gdd_calculates_coverage_score(gdd_service, full_input_data):
    """assemble_gdd корректно рассчитывает coverage_score."""
    profile = await _build_profile_stages_1_5(gdd_service, full_input_data)
    result = await gdd_service.assemble_gdd(profile)

    total = result.total_sections
    filled = result.filled_sections
    expected_coverage = round(filled / total, 3) if total > 0 else 0.0

    assert result.coverage_score == expected_coverage
    assert 0 <= result.coverage_score <= 1.0


@pytest.mark.asyncio
async def test_assemble_gdd_builds_section_order(gdd_service, full_input_data):
    """assemble_gdd строит section_order из format_spec."""
    profile = await _build_profile_stages_1_5(gdd_service, full_input_data)
    result = await gdd_service.assemble_gdd(profile)

    assert result.section_order == list(profile.format_spec.sections)
    assert len(result.section_order) == result.total_sections


@pytest.mark.asyncio
async def test_assemble_gdd_with_empty_profile(gdd_service):
    """assemble_gdd с пустым профилем (нет данных)."""
    empty_profile = GDDProfile(
        format_spec=GDDFormatSpec(
            format="one_sheet",
            sections=["title", "logline", "visual_hook"],
        ),
    )
    result = await gdd_service.assemble_gdd(empty_profile)

    assert result.total_sections == 3
    assert result.filled_sections == 0
    assert result.coverage_score == 0.0
    for section in result.sections.values():
        assert section.content == ""


# ============================================================
# Тесты: Stage 6 — validate_consistency (алгоритм 3.7.8)
# ============================================================

def test_validate_consistency_returns_consistency_report(gdd_service):
    """validate_consistency возвращает ConsistencyReport."""
    assembled = {
        "core_loop": GDDAssembledSection(
            section_name="core_loop", content="Core loop content", source="auto_fill",
        ),
        "mechanics": GDDAssembledSection(
            section_name="mechanics", content="Mechanics content", source="auto_fill",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    assert isinstance(result, ConsistencyReport)
    assert isinstance(result.issues, list)
    assert isinstance(result.checked_pairs, list)


def test_validate_consistency_detects_core_loop_mechanics_mismatch_error(gdd_service):
    """validate_consistency обнаруживает ошибку: mechanics без core_loop."""
    assembled = {
        "mechanics": GDDAssembledSection(
            section_name="mechanics",
            content="**Exploration** **Combat** **Crafting**",
            source="ai_generate",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    error_issues = [i for i in result.issues if i.severity == "error"]
    assert len(error_issues) > 0
    assert any(i.issue_type == "coreloop_mechanics_mismatch" for i in error_issues)


def test_validate_consistency_detects_data_gap_info(gdd_service):
    """validate_consistency обнаруживает data_gap (info) при частичном заполнении."""
    assembled = {
        "core_loop": GDDAssembledSection(
            section_name="core_loop", content="Core loop steps", source="auto_fill",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    info_issues = [i for i in result.issues if i.severity == "info"]
    assert len(info_issues) > 0
    assert any(i.issue_type == "data_gap" for i in info_issues)


def test_validate_consistency_detects_narrative_mechanics_warning(gdd_service):
    """validate_consistency обнаруживает narrative_mechanics_mismatch (warning)."""
    assembled = {
        "story": GDDAssembledSection(
            section_name="story",
            content="A world of peace, harmony and friendship",
            source="ai_generate",
        ),
        "lore": GDDAssembledSection(
            section_name="lore",
            content="Calm and peaceful lore",
            source="ai_generate",
        ),
        "mechanics": GDDAssembledSection(
            section_name="mechanics",
            content="**Combat** **Attack** **Damage** systems",
            source="auto_fill",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    warning_issues = [i for i in result.issues if i.severity == "warning"]
    narrative_warnings = [
        i for i in warning_issues
        if i.issue_type == "narrative_mechanics_mismatch"
    ]
    assert len(narrative_warnings) > 0


def test_validate_consistency_is_valid_when_no_errors(gdd_service):
    """validate_consistency: is_valid=True когда нет ошибок."""
    assembled = {
        "core_loop": GDDAssembledSection(
            section_name="core_loop",
            content="**Exploration** **Combat** cycle",
            source="auto_fill",
        ),
        "mechanics": GDDAssembledSection(
            section_name="mechanics",
            content="**Exploration** and **Combat** mechanics",
            source="auto_fill",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    # Не должно быть ошибок уровня error
    if result.error_count == 0:
        assert result.is_valid is True


def test_validate_consistency_is_valid_false_when_errors(gdd_service):
    """validate_consistency: is_valid=False когда есть ошибки."""
    assembled = {
        "mechanics": GDDAssembledSection(
            section_name="mechanics",
            content="**Exploration** **Combat** mechanics",
            source="ai_generate",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    assert result.error_count > 0
    assert result.is_valid is False


def test_validate_consistency_checks_all_pairs(gdd_service):
    """validate_consistency проверяет все пары секций."""
    assembled = {
        "core_loop": GDDAssembledSection(
            section_name="core_loop", content="Core loop", source="auto_fill",
        ),
        "mechanics": GDDAssembledSection(
            section_name="mechanics", content="Mechanics", source="auto_fill",
        ),
        "progression": GDDAssembledSection(
            section_name="progression", content="Progression", source="auto_fill",
        ),
        "balance": GDDAssembledSection(
            section_name="balance", content="Balance", source="auto_fill",
        ),
        "economy": GDDAssembledSection(
            section_name="economy", content="Economy", source="auto_fill",
        ),
        "monetization": GDDAssembledSection(
            section_name="monetization", content="Monetization", source="ai_generate",
        ),
        "story": GDDAssembledSection(
            section_name="story", content="Story", source="ai_generate",
        ),
    }
    input_data = GDDGenerationInput()
    result = gdd_service.validate_consistency(assembled, input_data)

    # Должны быть проверены все основные пары
    assert "core_loop::mechanics" in result.checked_pairs
    assert "progression::balance" in result.checked_pairs
    assert "economy::monetization" in result.checked_pairs
    assert "narrative::mechanics" in result.checked_pairs
    assert "ludonarrative_dissonance" in result.checked_pairs


# ============================================================
# Тесты: Stage 7 — format_document (алгоритм 3.7.9)
# ============================================================

def test_format_document_generates_markdown_with_title(gdd_service, sample_concept):
    """format_document генерирует markdown с заголовком."""
    assembled = GDDAssembledDocument(
        sections={
            "title": GDDAssembledSection(
                section_name="title", content="Shadow Realms", source="auto_fill",
            ),
            "overview": GDDAssembledSection(
                section_name="overview", content="A dark fantasy RPG", source="auto_fill",
            ),
        },
        section_order=["title", "overview"],
        total_sections=2,
        filled_sections=2,
        coverage_score=1.0,
    )
    format_spec = GDDFormatSpec(format="one_sheet", sections=["title", "overview"])
    input_data = GDDGenerationInput(concept=sample_concept)

    result = gdd_service.format_document(assembled, format_spec, input_data)

    assert isinstance(result, GDDFormattedDocument)
    assert result.title == "Shadow Realms"
    assert f"# {result.title}" in result.markdown


def test_format_document_includes_table_of_contents(gdd_service, sample_concept):
    """format_document включает оглавление."""
    assembled = GDDAssembledDocument(
        sections={
            "title": GDDAssembledSection(
                section_name="title", content="Shadow Realms", source="auto_fill",
            ),
            "overview": GDDAssembledSection(
                section_name="overview", content="A dark fantasy RPG", source="auto_fill",
            ),
        },
        section_order=["title", "overview"],
        total_sections=2,
        filled_sections=2,
        coverage_score=1.0,
    )
    format_spec = GDDFormatSpec(format="one_sheet", sections=["title", "overview"])
    input_data = GDDGenerationInput(concept=sample_concept)

    result = gdd_service.format_document(assembled, format_spec, input_data)

    assert "Оглавление" in result.table_of_contents
    assert "Оглавление" in result.markdown


def test_format_document_numbers_sections(gdd_service, sample_concept):
    """format_document нумерует секции."""
    assembled = GDDAssembledDocument(
        sections={
            "title": GDDAssembledSection(
                section_name="title", content="Shadow Realms", source="auto_fill",
            ),
            "overview": GDDAssembledSection(
                section_name="overview", content="A dark fantasy RPG", source="auto_fill",
            ),
            "core_loop": GDDAssembledSection(
                section_name="core_loop", content="Explore → Fight → Craft", source="auto_fill",
            ),
        },
        section_order=["title", "overview", "core_loop"],
        total_sections=3,
        filled_sections=3,
        coverage_score=1.0,
    )
    format_spec = GDDFormatSpec(format="full_gdd", sections=["title", "overview", "core_loop"])
    input_data = GDDGenerationInput(concept=sample_concept)

    result = gdd_service.format_document(assembled, format_spec, input_data)

    # Проверяем нумерацию: "## 1.", "## 2.", "## 3."
    assert "## 1." in result.markdown
    assert "## 2." in result.markdown
    assert "## 3." in result.markdown


def test_format_document_calculates_word_count(gdd_service, sample_concept):
    """format_document подсчитывает word_count."""
    assembled = GDDAssembledDocument(
        sections={
            "title": GDDAssembledSection(
                section_name="title",
                content="Shadow Realms: A Dark Fantasy Game Design Document",
                source="auto_fill",
            ),
        },
        section_order=["title"],
        total_sections=1,
        filled_sections=1,
        coverage_score=1.0,
    )
    format_spec = GDDFormatSpec(format="one_sheet", sections=["title"])
    input_data = GDDGenerationInput(concept=sample_concept)

    result = gdd_service.format_document(assembled, format_spec, input_data)

    assert result.word_count > 0
    # word_count должен соответствовать количеству слов в markdown
    assert result.word_count == len(result.markdown.split())


def test_format_document_calculates_estimated_pages(gdd_service, sample_concept):
    """format_document рассчитывает estimated_pages (250 слов/страница)."""
    # Создаём документ с достаточным количеством слов
    long_content = " ".join(["word"] * 600)
    assembled = GDDAssembledDocument(
        sections={
            "title": GDDAssembledSection(
                section_name="title", content="Shadow Realms", source="auto_fill",
            ),
            "overview": GDDAssembledSection(
                section_name="overview", content=long_content, source="auto_fill",
            ),
        },
        section_order=["title", "overview"],
        total_sections=2,
        filled_sections=2,
        coverage_score=1.0,
    )
    format_spec = GDDFormatSpec(format="full_gdd", sections=["title", "overview"])
    input_data = GDDGenerationInput(concept=sample_concept)

    result = gdd_service.format_document(assembled, format_spec, input_data)

    # estimated_pages = max(1, word_count // 250)
    expected_pages = max(1, result.word_count // 250)
    assert result.estimated_pages == expected_pages


def test_format_document_with_empty_assembled(gdd_service):
    """format_document с пустым assembled документом."""
    assembled = GDDAssembledDocument(
        sections={},
        section_order=[],
        total_sections=0,
        filled_sections=0,
        coverage_score=0.0,
    )
    format_spec = GDDFormatSpec(format="one_sheet", sections=[])
    input_data = GDDGenerationInput()

    result = gdd_service.format_document(assembled, format_spec, input_data)

    assert isinstance(result, GDDFormattedDocument)
    assert result.section_count == 0
    assert result.word_count > 0  # Есть как минимум заголовок


def test_format_document_section_count_matches(gdd_service, sample_concept):
    """format_document: section_count соответствует числу секций."""
    assembled = GDDAssembledDocument(
        sections={
            "title": GDDAssembledSection(
                section_name="title", content="Shadow Realms", source="auto_fill",
            ),
            "overview": GDDAssembledSection(
                section_name="overview", content="RPG game", source="auto_fill",
            ),
            "core_loop": GDDAssembledSection(
                section_name="core_loop", content="Loop", source="auto_fill",
            ),
        },
        section_order=["title", "overview", "core_loop"],
        total_sections=3,
        filled_sections=3,
        coverage_score=1.0,
    )
    format_spec = GDDFormatSpec(format="full_gdd", sections=["title", "overview", "core_loop"])
    input_data = GDDGenerationInput(concept=sample_concept)

    result = gdd_service.format_document(assembled, format_spec, input_data)

    assert result.section_count == 3


# ============================================================
# Тесты: Stage 8 — export_gdd
# ============================================================

@pytest.mark.asyncio
async def test_export_gdd_md_format(gdd_service):
    """export_gdd MD формат возвращает text/markdown."""
    formatted = GDDFormattedDocument(
        markdown="# Test GDD\n\nSome content here.",
        title="Test Game",
        table_of_contents="## Оглавление\n\n1. [Test](#test)",
        section_count=1,
        word_count=10,
        estimated_pages=1,
    )
    result = await gdd_service.export_gdd(formatted, "md", "Test Game")

    assert result.success is True
    assert result.format == "md"
    assert result.content_type == "text/markdown"
    assert result.content != ""
    assert result.file_name.endswith(".md")


@pytest.mark.asyncio
async def test_export_gdd_html_format(gdd_service):
    """export_gdd HTML формат возвращает HTML с CSS."""
    formatted = GDDFormattedDocument(
        markdown="# Test GDD\n\nSome content here.",
        title="Test Game",
        table_of_contents="## Оглавление",
        section_count=1,
        word_count=10,
        estimated_pages=1,
    )
    result = await gdd_service.export_gdd(formatted, "html", "Test Game")

    assert result.success is True
    assert result.format == "html"
    assert result.content_type == "text/html"
    assert "<html" in result.content or "<!DOCTYPE" in result.content
    assert "style" in result.content.lower()


@pytest.mark.asyncio
async def test_export_gdd_pdf_format(gdd_service):
    """export_gdd PDF формат (fallback на HTML если WeasyPrint не установлен)."""
    formatted = GDDFormattedDocument(
        markdown="# Test GDD\n\nSome content.",
        title="Test Game",
        table_of_contents="## Оглавление",
        section_count=1,
        word_count=10,
        estimated_pages=1,
    )
    result = await gdd_service.export_gdd(formatted, "pdf", "Test Game")

    assert result.format == "pdf"
    assert result.success is True
    # Если WeasyPrint не установлен, fallback на HTML
    if result.content:
        assert result.content_type == "text/html"
    else:
        assert result.content_type == "application/pdf"
        assert result.file_path != ""


@pytest.mark.asyncio
async def test_export_gdd_docx_format(gdd_service):
    """export_gdd DOCX формат (graceful fail если python-docx не установлен)."""
    formatted = GDDFormattedDocument(
        markdown="# Test GDD\n\nSome content.",
        title="Test Game",
        table_of_contents="## Оглавление",
        section_count=1,
        word_count=10,
        estimated_pages=1,
    )
    result = await gdd_service.export_gdd(formatted, "docx", "Test Game")

    assert result.format == "docx"
    # Может быть success=True (python-docx установлен) или success=False (не установлен)
    if result.success:
        assert result.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert result.file_path != ""
    else:
        assert result.error_message != ""


@pytest.mark.asyncio
async def test_export_gdd_sets_correct_content_type(gdd_service):
    """export_gdd устанавливает корректный content_type для каждого формата."""
    formatted = GDDFormattedDocument(
        markdown="# Test",
        title="Test",
        table_of_contents="",
        section_count=1,
        word_count=5,
        estimated_pages=1,
    )

    md_result = await gdd_service.export_gdd(formatted, "md", "Test")
    assert md_result.content_type == "text/markdown"

    html_result = await gdd_service.export_gdd(formatted, "html", "Test")
    assert html_result.content_type == "text/html"


@pytest.mark.asyncio
async def test_export_gdd_sets_file_name(gdd_service):
    """export_gdd устанавливает file_name."""
    formatted = GDDFormattedDocument(
        markdown="# Test GDD",
        title="Test Game",
        table_of_contents="",
        section_count=1,
        word_count=5,
        estimated_pages=1,
    )

    md_result = await gdd_service.export_gdd(formatted, "md", "My Game")
    assert md_result.file_name == "My_Game.md"

    html_result = await gdd_service.export_gdd(formatted, "html", "My Game")
    assert html_result.file_name == "My_Game.html"


@pytest.mark.asyncio
async def test_export_gdd_handles_empty_document(gdd_service):
    """export_gdd обрабатывает пустой документ."""
    formatted = GDDFormattedDocument(
        markdown="",
        title="",
        table_of_contents="",
        section_count=0,
        word_count=0,
        estimated_pages=1,
    )
    result = await gdd_service.export_gdd(formatted, "md", "Empty")

    assert result.success is True
    assert result.size_bytes >= 0


# ============================================================
# Тесты: Full Pipeline 1-8 (generate_stages_1_8)
# ============================================================

@pytest.mark.asyncio
async def test_generate_stages_1_8_completes(gdd_service, full_input_data):
    """generate_stages_1_8 завершает этапы 1-7."""
    gdd_service.executor.execute.return_value = PromptResult(
        data={"content": "AI-generated content", "text": "Generated text"},
    )
    result = await gdd_service.generate_stages_1_8(full_input_data)

    assert isinstance(result, GDDProfile)
    for stage in [1, 2, 3, 4, 5, 6, 7]:
        assert stage in result.stages_completed, f"Stage {stage} not completed"


@pytest.mark.asyncio
async def test_generate_stages_1_8_high_coverage(gdd_service, full_input_data):
    """generate_stages_1_8 с полными данными имеет высокий coverage."""
    gdd_service.executor.execute.return_value = PromptResult(
        data={"content": "AI-generated content", "text": "Generated text"},
    )
    result = await gdd_service.generate_stages_1_8(full_input_data)

    assert result.coverage_score > 0
    # С полными данными покрытие должно быть значительным
    assert result.assembled_document is not None
    assert result.assembled_document.filled_sections > 0


@pytest.mark.asyncio
async def test_generate_stages_1_8_populated_assembled_document(gdd_service, full_input_data):
    """generate_stages_1_8 заполняет assembled_document."""
    gdd_service.executor.execute.return_value = PromptResult(
        data={"content": "AI-generated content", "text": "Generated text"},
    )
    result = await gdd_service.generate_stages_1_8(full_input_data)

    assert result.assembled_document is not None
    assert isinstance(result.assembled_document, GDDAssembledDocument)
    assert result.assembled_document.total_sections > 0
    assert isinstance(result.assembled_document.consistency_report, ConsistencyReport)
    assert len(result.assembled_document.section_order) > 0


@pytest.mark.asyncio
async def test_generate_stages_1_8_populated_formatted_document(gdd_service, full_input_data):
    """generate_stages_1_8 заполняет formatted_document."""
    gdd_service.executor.execute.return_value = PromptResult(
        data={"content": "AI-generated content", "text": "Generated text"},
    )
    result = await gdd_service.generate_stages_1_8(full_input_data)

    assert result.formatted_document is not None
    assert isinstance(result.formatted_document, GDDFormattedDocument)
    assert result.formatted_document.markdown != ""
    assert result.formatted_document.word_count > 0
    assert result.formatted_document.section_count > 0
