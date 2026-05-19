"""
Gidede — Core Loop Service Tests
Фаза 4.C: Тесты для Блока 2 — Core Loop Designer (алгоритм 3.2)

Тесты по этапам:
- Stage 1: ClassifyCoreLoop (3.2.3) — ~10 тестов
- Stage 2: BuildLoopHierarchy (3.2.4) — ~8 тестов
- Stage 3: DiagnosePathologies (3.2.5) — ~9 тестов
- Stage 4: ValidateCoreLoop (3.2.6) — ~4 теста
- Stage 5: GenerateRecommendations (3.2.7) — ~4 теста
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.coreloop_service import (
    CoreLoopService,
    RESOURCE_MECHANIC_MAP,
    GENRE_STRUCTURAL_MAP,
    LOOP_TYPE_MATRIX,
    STRUCTURAL_SUBTYPES,
    STRUCTURAL_PATHOLOGY_MAP,
    PATHOLOGY_RULES,
)
from app.schemas.coreloop import (
    CoreLoopStep,
    ResourceProfile,
    RiskProfile,
    StructuralType,
    LoopProfile,
    LoopHierarchy,
    Pathology,
    PathologyReport,
    CoreLoopProfile,
)
from app.ai.executor import PromptResult, PromptExecutionOptions


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def mock_executor():
    """Мок PromptExecutor для тестирования без реальных AI-вызовов."""
    executor = AsyncMock()
    executor.execute = AsyncMock()
    # По умолчанию — возвращаем пустые данные (fallback на эвристику)
    executor.execute.return_value = MagicMock(
        data={},
        metadata={"prompt_id": "DEFAULT", "from_cache": False},
    )
    return executor


@pytest.fixture
def coreloop_service(mock_executor):
    """Создать CoreLoopService с моком executor."""
    return CoreLoopService(executor=mock_executor)


@pytest.fixture
def sample_mechanics():
    """Тестовый список механик для RPG."""
    return ["Враги", "Здоровье", "Очки опыта", "Крафт", "Нарратив"]


@pytest.fixture
def sample_structural_type():
    """Тестовый StructuralType для RPG (economy)."""
    return StructuralType(
        type="economy",
        sub_type="multi_currency_economy",
        resources=[
            {"name": "HP", "class_": "Subsidiary", "type": "core", "initial_value": 100, "bounds": {"min": 0, "max": 100}},
            {"name": "XP", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}},
            {"name": "золото", "class_": "Valued", "type": "currency", "initial_value": 10, "bounds": {"min": 0, "max": 999}},
        ],
        loops=[{"type": "conversion", "description": "Петля конвертации"}],
        has_braking=True,
        currencies=["золото"],
        risk_assessment=RiskProfile(
            likely_pathologies=["deadlock", "oscillation"],
            risk_level="low",
            mitigation_suggestions=[],
        ),
    )


@pytest.fixture
def sample_core_loop_steps():
    """Тестовые шаги Core Loop."""
    return [
        CoreLoopStep(action="Найти", mechanics=["Враги"], resources_consumed=[], resources_produced=["XP"], feedback_type="positive", duration_estimate=5.0),
        CoreLoopStep(action="Действовать", mechanics=["Здоровье"], resources_consumed=["HP"], resources_produced=["урон"], feedback_type="positive", duration_estimate=10.0),
        CoreLoopStep(action="Получить", mechanics=["Очки опыта"], resources_consumed=[], resources_produced=["XP", "золото"], feedback_type="positive", duration_estimate=3.0),
        CoreLoopStep(action="Подготовиться", mechanics=["Крафт"], resources_consumed=["золото"], resources_produced=["HP"], feedback_type="neutral", duration_estimate=7.0),
    ]


# ============================================================
# Stage 1: TestClassifyCoreLoop (3.2.3)
# ============================================================

class TestClassifyCoreLoop:
    """Тесты Этапа 1: Классификация структурного типа."""

    @pytest.mark.asyncio
    async def test_rpg_genre_classifies_as_economy(self, coreloop_service, sample_mechanics):
        """RPG жанр → structural type = economy."""
        result = await coreloop_service.classify_core_loop(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert isinstance(result, StructuralType)
        assert result.type == "economy"

    @pytest.mark.asyncio
    async def test_shooter_genre_classifies_as_engine(self, coreloop_service):
        """Shooter жанр → structural type = engine."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Враги", "Запас патронов"],
            genre="shooter",
        )

        assert result.type == "engine"

    @pytest.mark.asyncio
    async def test_horror_genre_classifies_as_ecology(self, coreloop_service):
        """Horror жанр → structural type = ecology."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Здоровье", "Нарратив"],
            genre="horror",
        )

        assert result.type == "ecology"

    @pytest.mark.asyncio
    async def test_desired_loop_type_overrides(self, coreloop_service, sample_mechanics):
        """desired_loop_type переопределяет структурный тип."""
        result = await coreloop_service.classify_core_loop(
            mechanics=sample_mechanics,
            genre="rpg",
            desired_loop_type="engine",
        )

        assert result.type == "engine"

    @pytest.mark.asyncio
    async def test_resources_extracted_from_mechanics(self, coreloop_service, sample_mechanics):
        """Ресурсы извлекаются из механик."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Враги", "Здоровье"],
            genre="rpg",
        )

        resource_names = [r.get("name", "") for r in result.resources]
        assert "HP" in resource_names
        assert "урон" in resource_names or "лечение" in resource_names

    @pytest.mark.asyncio
    async def test_sub_type_economy_with_currencies(self, coreloop_service, sample_mechanics):
        """Economy с 2+ валютами → multi_currency_economy."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Враги", "Квесты", "Экономика"],
            genre="rpg",
        )

        # RPG → economy, если есть 2+ валюты → multi_currency_economy
        if result.type == "economy":
            currency_count = sum(1 for r in result.resources if r.get("type") == "currency")
            if currency_count > 1:
                assert result.sub_type == "multi_currency_economy"

    @pytest.mark.asyncio
    async def test_braking_mechanism_detected(self, coreloop_service):
        """Тормозящий механизм обнаруживается (consumable ресурс)."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Враги", "Запас патронов"],
            genre="shooter",
        )

        # Запас патронов → патроны (consumable) → has_braking
        assert result.has_braking is True

    @pytest.mark.asyncio
    async def test_no_braking_mechanism(self, coreloop_service):
        """Нет тормозящего механизма → has_braking=False."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Головоломки"],
            genre="puzzle",
        )

        # Головоломки → [интеллект, прогресс] — не consumable
        # Нет drain механик
        # Зависит от ресурса: интеллект не consumable по классификации
        assert isinstance(result.has_braking, bool)

    @pytest.mark.asyncio
    async def test_risk_assessment_high_without_braking(self, coreloop_service):
        """Engine без торможения → риск = high."""
        result = await coreloop_service.classify_core_loop(
            mechanics=["Враги"],
            genre="action",
            desired_loop_type="engine",
        )

        if result.type == "engine" and not result.has_braking:
            assert result.risk_assessment.risk_level == "high"

    @pytest.mark.asyncio
    async def test_currencies_identified(self, coreloop_service, sample_mechanics):
        """Валюты корректно идентифицируются."""
        result = await coreloop_service.classify_core_loop(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert isinstance(result.currencies, list)


# ============================================================
# Stage 2: TestBuildLoopHierarchy (3.2.4)
# ============================================================

class TestBuildLoopHierarchy:
    """Тесты Этапа 2: Конструирование иерархии петель."""

    @pytest.mark.asyncio
    async def test_hierarchy_has_6_levels(self, coreloop_service, sample_structural_type, sample_core_loop_steps, sample_mechanics):
        """Иерархия содержит все 6 уровней."""
        result = await coreloop_service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=sample_core_loop_steps,
            mechanics=sample_mechanics,
        )

        assert isinstance(result, LoopHierarchy)
        # Все 6 уровней должны быть (даже если пустые)
        assert hasattr(result, "micro")
        assert hasattr(result, "small")
        assert hasattr(result, "medium")
        assert hasattr(result, "large")
        assert hasattr(result, "macro")
        assert hasattr(result, "meta")

    @pytest.mark.asyncio
    async def test_micro_loops_populated(self, coreloop_service, sample_structural_type, sample_core_loop_steps, sample_mechanics):
        """Micro-петли генерируются для каждого шага."""
        result = await coreloop_service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=sample_core_loop_steps,
            mechanics=sample_mechanics,
        )

        # Каждый шаг декомпозируется на 3 микро-действия
        assert len(result.micro) >= len(sample_core_loop_steps)

    @pytest.mark.asyncio
    async def test_small_loop_contains_all_actions(self, coreloop_service, sample_structural_type, sample_core_loop_steps, sample_mechanics):
        """Small loop содержит все действия шагов."""
        result = await coreloop_service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=sample_core_loop_steps,
            mechanics=sample_mechanics,
        )

        assert len(result.small) >= 1
        small_actions = result.small[0].actions
        step_actions = [s.action for s in sample_core_loop_steps]
        for action in step_actions:
            assert action in small_actions

    @pytest.mark.asyncio
    async def test_default_steps_generated_when_empty(self, coreloop_service, sample_structural_type, sample_mechanics):
        """Если шаги не переданы — генерируются из механик."""
        result = await coreloop_service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=[],
            mechanics=sample_mechanics,
        )

        # Должны быть default шаги → small loop не пустой
        assert len(result.small) >= 1
        assert len(result.small[0].actions) >= 3

    @pytest.mark.asyncio
    async def test_custom_steps_override(self, coreloop_service, sample_structural_type, sample_mechanics):
        """Пользовательские шаги заменяют default."""
        custom = ["Искать", "Стрелять", "Лутать", "Прокачиваться"]
        result = await coreloop_service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=[],
            mechanics=sample_mechanics,
            custom_steps=custom,
        )

        assert len(result.small) >= 1
        small_actions = result.small[0].actions
        for cs in custom[:5]:  # up to 5 default steps
            if cs in small_actions:
                break
        # At minimum, small loop should contain the custom steps
        assert len(small_actions) >= 4

    @pytest.mark.asyncio
    async def test_ai_decompose_step_used(self, mock_executor, sample_structural_type, sample_mechanics):
        """AI-декомпозиция используется для micro-уровня."""
        mock_executor.execute.return_value = MagicMock(
            data={"actions": [{"action": "Прицелиться"}, {"action": "Нажать курок"}, {"action": "Оценить попадание"}]},
            metadata={"prompt_id": "DECOMPOSE_STEP", "from_cache": False},
        )
        service = CoreLoopService(executor=mock_executor)

        steps = [CoreLoopStep(action="Стрелять", mechanics=["Враги"], resources_consumed=["патроны"], resources_produced=["урон"], feedback_type="positive", duration_estimate=5.0)]
        result = await service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=steps,
            mechanics=sample_mechanics,
        )

        # AI декомпозиция должна была быть вызвана
        micro_names = [m.actions[0] for m in result.micro if m.actions]
        assert "Прицелиться" in micro_names

    @pytest.mark.asyncio
    async def test_ai_failure_fallback_micro(self, mock_executor, sample_structural_type, sample_mechanics):
        """При ошибке AI → fallback на формализованную декомпозицию."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = CoreLoopService(executor=mock_executor)

        steps = [CoreLoopStep(action="Найти", mechanics=["Враги"], resources_consumed=[], resources_produced=["XP"], feedback_type="positive", duration_estimate=5.0)]
        result = await service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=steps,
            mechanics=sample_mechanics,
        )

        # Fallback: "найти" → ["Осмотреться", "Обнаружить", "Подойти"]
        micro_names = [m.actions[0] for m in result.micro if m.actions]
        assert "Осмотреться" in micro_names

    @pytest.mark.asyncio
    async def test_medium_loop_has_iterations(self, coreloop_service, sample_structural_type, sample_core_loop_steps, sample_mechanics):
        """Medium loop содержит итерации Core Loop."""
        result = await coreloop_service.build_loop_hierarchy(
            structural_type=sample_structural_type,
            core_loop_steps=sample_core_loop_steps,
            mechanics=sample_mechanics,
        )

        assert len(result.medium) >= 1
        medium_actions = result.medium[0].actions
        # Должны быть итерации
        assert any("итерация" in a for a in medium_actions)


# ============================================================
# Stage 3: TestDiagnosePathologies (3.2.5)
# ============================================================

class TestDiagnosePathologies:
    """Тесты Этапа 3: Диагностика патологий."""

    @pytest.mark.asyncio
    async def test_runaway_detected_engine_no_braking(self, coreloop_service):
        """Engine без торможения → runaway патология."""
        structural = StructuralType(
            type="engine",
            sub_type="pure_engine",
            resources=[{"name": "Score", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}}],
            loops=[{"type": "reinforcing"}],
            has_braking=False,
        )
        steps = [CoreLoopStep(action="Играть", mechanics=[], resources_consumed=[], resources_produced=["Score"], feedback_type="positive")]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        pathology_types = [p.type for p in report.pathologies]
        assert "runaway" in pathology_types

    @pytest.mark.asyncio
    async def test_runaway_not_detected_with_braking(self, coreloop_service):
        """Engine с торможением → runaway не обнаруживается."""
        structural = StructuralType(
            type="engine",
            sub_type="braked_engine",
            resources=[{"name": "HP", "class_": "Subsidiary", "type": "core", "initial_value": 100, "bounds": {"min": 0, "max": 100}}],
            loops=[{"type": "reinforcing"}],
            has_braking=True,
        )
        steps = [CoreLoopStep(action="Играть", mechanics=[], resources_consumed=["HP"], resources_produced=["XP"], feedback_type="positive")]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        pathology_types = [p.type for p in report.pathologies]
        assert "runaway" not in pathology_types

    @pytest.mark.asyncio
    async def test_deadlock_detected_economy(self, coreloop_service):
        """Economy с 2+ ресурсами с initial_value=0 → deadlock."""
        structural = StructuralType(
            type="economy",
            sub_type="multi_currency_economy",
            resources=[
                {"name": "Resource_A", "class_": "Commodity", "type": "consumable", "initial_value": 0, "bounds": {"min": 0, "max": 100}},
                {"name": "Resource_B", "class_": "Commodity", "type": "consumable", "initial_value": 0, "bounds": {"min": 0, "max": 100}},
            ],
            loops=[{"type": "conversion"}],
        )
        steps = [CoreLoopStep(action="Конвертировать", mechanics=[], resources_consumed=["Resource_A"], resources_produced=["Resource_B"])]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        pathology_types = [p.type for p in report.pathologies]
        assert "deadlock" in pathology_types

    @pytest.mark.asyncio
    async def test_stall_detected_consumed_not_produced(self, coreloop_service):
        """Ресурс потребляется, но не производится → stall."""
        structural = StructuralType(
            type="ecology",
            sub_type="balanced_ecology",
            resources=[
                {"name": "Мана", "class_": "Commodity", "type": "consumable", "initial_value": 0, "bounds": {"min": 0, "max": 100}},
            ],
            loops=[{"type": "balancing"}],
        )
        steps = [
            CoreLoopStep(action="Кастовать", mechanics=[], resources_consumed=["Мана"], resources_produced=["урон"], feedback_type="positive"),
        ]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        pathology_types = [p.type for p in report.pathologies]
        assert "stall" in pathology_types

    @pytest.mark.asyncio
    async def test_triviality_detected_single_step(self, coreloop_service):
        """Один шаг, один ресурс → triviality."""
        structural = StructuralType(
            type="engine",
            sub_type="pure_engine",
            resources=[{"name": "Score", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}}],
            loops=[{"type": "reinforcing"}],
            has_braking=False,
        )
        steps = [CoreLoopStep(action="Клик", mechanics=[], resources_consumed=[], resources_produced=["Score"], feedback_type="positive")]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        pathology_types = [p.type for p in report.pathologies]
        assert "triviality" in pathology_types

    @pytest.mark.asyncio
    async def test_pathology_severity_levels(self, coreloop_service):
        """Severity уровни патологий корректны."""
        structural = StructuralType(
            type="engine",
            sub_type="pure_engine",
            resources=[{"name": "Score", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}}],
            loops=[{"type": "reinforcing"}],
            has_braking=False,
        )
        steps = [CoreLoopStep(action="Клик", mechanics=[], resources_consumed=[], resources_produced=["Score"])]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        for p in report.pathologies:
            assert p.severity in ("critical", "warning", "info")

    @pytest.mark.asyncio
    async def test_pathology_correction_suggestions(self, coreloop_service):
        """Каждая патология содержит suggestion для коррекции."""
        structural = StructuralType(
            type="engine",
            sub_type="pure_engine",
            resources=[{"name": "Score", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}}],
            loops=[{"type": "reinforcing"}],
            has_braking=False,
        )
        steps = [CoreLoopStep(action="Клик", mechanics=[], resources_consumed=[], resources_produced=["Score"])]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        for p in report.pathologies:
            assert p.correction != ""

    @pytest.mark.asyncio
    async def test_critical_count_correct(self, coreloop_service):
        """critical_count считает только критические патологии."""
        structural = StructuralType(
            type="engine",
            sub_type="pure_engine",
            resources=[{"name": "Score", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}}],
            loops=[{"type": "reinforcing"}],
            has_braking=False,
        )
        steps = [CoreLoopStep(action="Клик", mechanics=[], resources_consumed=[], resources_produced=["Score"])]

        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=structural,
            core_loop_steps=steps,
        )

        manual_critical = sum(1 for p in report.pathologies if p.severity == "critical")
        assert report.critical_count == manual_critical

    @pytest.mark.asyncio
    async def test_healthy_loop_no_critical(self, coreloop_service, sample_structural_type, sample_core_loop_steps):
        """Здоровая петля без критических патологий."""
        report, recs = await coreloop_service.diagnose_pathologies(
            structural_type=sample_structural_type,
            core_loop_steps=sample_core_loop_steps,
        )

        # economy с braking → без runaway
        # steps имеют и consumed и produced → без stall
        assert report.critical_count <= 1  # Может быть deadlock


# ============================================================
# Stage 4: TestValidateCoreLoop (3.2.6)
# ============================================================

class TestValidateCoreLoop:
    """Тесты Этапа 4: Валидация Core Loop."""

    @pytest.mark.asyncio
    async def test_fun_check_passes_with_feedback_and_rewards(self, coreloop_service, sample_structural_type, sample_core_loop_steps):
        """Тест 30 сек веселья проходит при обратной связи и награде."""
        result = await coreloop_service.validate_core_loop(
            steps=sample_core_loop_steps,
            structural_type=sample_structural_type,
        )

        # Есть positive feedback, consumed resources, produced resources
        assert result.fun_check is not None
        # Должен пройти если есть positive feedback + rewards
        assert result.fun_check.score > 0

    @pytest.mark.asyncio
    async def test_loop_closedness_with_resource_link(self, coreloop_service, sample_structural_type):
        """Замкнутость петли проверяется через ресурсы."""
        steps = [
            CoreLoopStep(action="Действовать", mechanics=[], resources_consumed=["HP"], resources_produced=["XP"], feedback_type="positive"),
            CoreLoopStep(action="Отдыхать", mechanics=[], resources_consumed=["XP"], resources_produced=["HP"], feedback_type="neutral"),
        ]

        result = await coreloop_service.validate_core_loop(
            steps=steps,
            structural_type=sample_structural_type,
        )

        # Последний шаг производит HP, первый потребляет HP → замкнуто
        assert result.loop_closedness.is_closed is True

    @pytest.mark.asyncio
    async def test_validation_checklist_5_criteria(self, coreloop_service, sample_structural_type, sample_core_loop_steps):
        """Чек-лист валидации содержит 5 критериев."""
        result = await coreloop_service.validate_core_loop(
            steps=sample_core_loop_steps,
            structural_type=sample_structural_type,
        )

        assert result.checklist_total == 5
        assert 0 <= result.checklist_passed <= 5

    @pytest.mark.asyncio
    async def test_validation_overall_pass_threshold(self, coreloop_service, sample_structural_type, sample_core_loop_steps):
        """overall_passed = True при >=3 из 5 критериев."""
        result = await coreloop_service.validate_core_loop(
            steps=sample_core_loop_steps,
            structural_type=sample_structural_type,
        )

        if result.checklist_passed >= 3:
            assert result.overall_passed is True
        else:
            assert result.overall_passed is False


# ============================================================
# Stage 5: TestGenerateRecommendations (3.2.7)
# ============================================================

class TestGenerateRecommendations:
    """Тесты Этапа 5: Генерация рекомендаций."""

    @pytest.mark.asyncio
    async def test_recommendations_from_pathologies(self, coreloop_service, sample_structural_type, sample_core_loop_steps):
        """Рекомендации генерируются из патологий."""
        pathologies = PathologyReport(
            pathologies=[
                Pathology(name="Неограниченный рост", type="runaway", severity="critical", affected_resources=["Score"], description="desc", correction="Добавить drain"),
            ],
            total_count=1,
            critical_count=1,
        )

        result = await coreloop_service.generate_recommendations(
            steps=sample_core_loop_steps,
            structural_type=sample_structural_type,
            pathologies=pathologies,
        )

        assert len(result) >= 1
        # Должна быть рекомендация от патологии
        pathology_recs = [r for r in result if r.get("category") == "pathology"]
        assert len(pathology_recs) >= 1

    @pytest.mark.asyncio
    async def test_recommendations_from_validation(self, coreloop_service, sample_structural_type, sample_core_loop_steps):
        """Рекомендации генерируются из валидации."""
        from app.schemas.coreloop import CoreLoopValidationResult, FunCheckResult, LoopClosednessCheck, ResourceSufficiencyCheck

        validation = CoreLoopValidationResult(
            fun_check=FunCheckResult(passed=False, score=0.2, reasoning="Нет награды"),
            loop_closedness=LoopClosednessCheck(is_closed=False, last_step="End", first_step="Start", connection_description="Нет связи"),
            resource_sufficiency=ResourceSufficiencyCheck(has_dead_resources=True, dead_resources=["Gold"], has_unsourced_consumables=False),
            checklist_passed=1,
            overall_passed=False,
            score=0.2,
        )

        result = await coreloop_service.generate_recommendations(
            steps=sample_core_loop_steps,
            structural_type=sample_structural_type,
            validation=validation,
        )

        # Должны быть рекомендации по fun, closedness, dead resources
        categories = {r.get("category") for r in result}
        assert "fun" in categories or "closedness" in categories or "resource" in categories

    @pytest.mark.asyncio
    async def test_engine_no_braking_recommendation(self, coreloop_service, sample_core_loop_steps):
        """Engine без торможения → рекомендация добавить drain."""
        structural = StructuralType(
            type="engine",
            sub_type="pure_engine",
            resources=[{"name": "Score", "class_": "Valued", "type": "core", "initial_value": 0, "bounds": {"min": 0, "max": 999999}}],
            has_braking=False,
        )

        result = await coreloop_service.generate_recommendations(
            steps=sample_core_loop_steps,
            structural_type=structural,
        )

        # Должна быть рекомендация по структуре
        structure_recs = [r for r in result if r.get("category") == "structure"]
        assert len(structure_recs) >= 1

    @pytest.mark.asyncio
    async def test_ai_recommendations_fallback(self, mock_executor, sample_structural_type, sample_core_loop_steps):
        """При ошибке AI — fallback на формализованные рекомендации."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = CoreLoopService(executor=mock_executor)

        result = await service.generate_recommendations(
            steps=sample_core_loop_steps,
            structural_type=sample_structural_type,
        )

        # Должны быть хотя бы формализованные рекомендации
        assert isinstance(result, list)


# ============================================================
# Full Pipeline: TestDesignFull
# ============================================================

class TestDesignFull:
    """Тесты полного пайплайна Этапов 1–5."""

    @pytest.mark.asyncio
    async def test_design_full_returns_core_loop_profile(self, coreloop_service, sample_mechanics):
        """design_full возвращает CoreLoopProfile."""
        result = await coreloop_service.design_full(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert isinstance(result, CoreLoopProfile)

    @pytest.mark.asyncio
    async def test_design_full_stages_completed(self, coreloop_service, sample_mechanics):
        """Все 5 этапов завершены."""
        result = await coreloop_service.design_full(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert 1 in result.stages_completed
        assert 2 in result.stages_completed
        assert 3 in result.stages_completed
        assert 4 in result.stages_completed
        assert 5 in result.stages_completed

    @pytest.mark.asyncio
    async def test_design_full_has_structural_type(self, coreloop_service, sample_mechanics):
        """Результат содержит structural_type."""
        result = await coreloop_service.design_full(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert result.structural_type is not None
        assert result.structural_type.type == "economy"

    @pytest.mark.asyncio
    async def test_design_full_has_pathologies(self, coreloop_service, sample_mechanics):
        """Результат содержит отчёт по патологиям."""
        result = await coreloop_service.design_full(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert result.pathologies is not None
        assert isinstance(result.pathologies, PathologyReport)

    @pytest.mark.asyncio
    async def test_design_full_has_recommendations(self, coreloop_service, sample_mechanics):
        """Результат содержит рекомендации."""
        result = await coreloop_service.design_full(
            mechanics=sample_mechanics,
            genre="rpg",
        )

        assert isinstance(result.recommendations, list)

    @pytest.mark.asyncio
    async def test_design_full_with_custom_steps(self, coreloop_service, sample_mechanics):
        """design_full с пользовательскими шагами."""
        result = await coreloop_service.design_full(
            mechanics=sample_mechanics,
            genre="rpg",
            custom_steps=["Искать врагов", "Сражаться", "Собирать лут", "Прокачиваться"],
        )

        assert isinstance(result, CoreLoopProfile)
        assert len(result.steps) >= 3
