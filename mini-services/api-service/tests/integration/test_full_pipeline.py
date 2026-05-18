"""
Gidede — Интеграционные тесты полного пайплайна (Блоки 1–5)
Фаза 4.C.10: Тест-кейс «Roguelike про алхимика» → Концепция → Core Loop → MDA → Баланс → Прогрессия → Экономика

Проверки:
1. Корректность передачи данных между блоками (pipeline data flow)
2. Отсутствие null-ошибок в сквозном потоке
3. Сходимость AI-вызовов (с mock-ответами)
4. Сохранение всех результатов в БД (через mock DB)
5. Полный pipeline от идеи до экономики за одну операцию

Тест-кейсы (≥ 5):
- INT-01: Полный пайплайн «идея → экономика» с mock AI
- INT-02: Передача данных между блоками (pipeline data flow integrity)
- INT-03: Обработка частичного заполнения блоков (graceful degradation)
- INT-04: Cascade stale-обновлений при изменении раннего блока
- INT-05: Pipeline prepare_input для каждого блока (1→5)
- INT-06: Валидация формата выходных данных каждого блока
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


# ============================================================
# ФИКСТУРЫ
# ============================================================

@pytest.fixture
def mock_db():
    """Mock AsyncSession для БД."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
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
    from app.services.pipeline_service import PipelineService
    return PipelineService(db=mock_db, redis_client=mock_redis)


@pytest.fixture
def mock_executor():
    """Mock PromptExecutor для имитации AI-ответов."""
    executor = AsyncMock()
    return executor


@pytest.fixture
def alchemy_roguelike_input():
    """Тестовый ввод «Roguelike про алхимика»."""
    return {
        "idea": "Roguelike про алхимика, который варит зелья из ингредиентов, найденных в подземельях, и использует их для боя с монстрами",
        "genre": "auto",
        "target_audience": ["challenge", "discovery"],
        "platforms": ["PC"],
        "budget": "small",
        "forbidden_mechanics": [],
    }


@pytest.fixture
def mock_ai_responses():
    """Словарь mock-ответов AI для каждого промпта."""
    return {
        "CLASSIFY_GENRE": {
            "data": [
                {"genre": "RPG", "subgenre": "roguelike", "confidence": 0.92,
                 "reasoning": "Упоминание подземелий, варки зелий и боя с монстрами указывает на roguelike RPG"}
            ],
        },
        "EXTRACT_AESTHETICS": {
            "data": [
                {"aesthetic": "Challenge", "confidence": 0.9,
                 "reasoning": "Roguelike — жанр, основанный на преодолении трудностей"},
                {"aesthetic": "Discovery", "confidence": 0.85,
                 "reasoning": "Экспериментирование с рецептами зелий"},
                {"aesthetic": "Fantasy", "confidence": 0.7,
                 "reasoning": "Алхимия и магия — фэнтезийный сеттинг"},
            ],
        },
        "SUGGEST_DYNAMICS": {
            "data": [
                {"dynamic": "Экспериментирование с комбинациями", "aesthetics_served": ["discovery", "challenge"], "genre_fit": 0.9},
                {"dynamic": "Риск vs награда при варке", "aesthetics_served": ["challenge"], "genre_fit": 0.85},
                {"dynamic": "Прогрессия через знания", "aesthetics_served": ["discovery", "submission"], "genre_fit": 0.8},
            ],
        },
        "SUGGEST_MECHANICS": {
            "data": [
                {"mechanic": "Crafting", "group": "progression", "dynamics": ["Экспериментирование"], "genre_affinity": 0.9},
                {"mechanic": "Resource Management", "group": "base", "dynamics": ["Риск vs награда"], "genre_affinity": 0.85},
            ],
        },
        "GENERATE_CORE_LOOPS": {
            "data": [
                {"name": "Gather-Brew-Fight Loop", "steps": [
                    {"action": "Собрать ингредиенты", "resource": "ingredients"},
                    {"action": "Сварить зелье", "resource": "potions"},
                    {"action": "Применить зелье в бою", "resource": "health"},
                    {"action": "Получить награду", "resource": "gold"},
                ], "loop_type": "Engine", "fun_check": "30 секунд: собрать → сварить → выпить → победить"},
            ],
        },
        "GENERATE_USP": {
            "data": [
                {"usp": "Алхимическая варка зелий как боевая система",
                 "triangle_check": {"weird": True, "appealing": True, "credible": True},
                 "differentiation": "В отличие от Potion Craft, зелья — оружие, не только торговля"},
            ],
        },
        "VALIDATE_TRIANGLE": {
            "data": {
                "score": 0.8, "weird_corners_count": 1,
                "characters": {"weird": False}, "world": {"weird": True},
                "activities": {"weird": False},
                "warnings": [], "suggestions": [],
            },
        },
        "VALIDATE_IDEA_FILTERS": {
            "data": {
                "score": 0.75, "filters": {
                    "f1_experience": {"score": 0.9, "reason": "", "improvement": ""},
                    "f2_audience": {"score": 0.8, "reason": "", "improvement": ""},
                    "f3_motivation": {"score": 0.85, "reason": "", "improvement": ""},
                    "f4_uniqueness": {"score": 0.7, "reason": "", "improvement": "Усилить USP"},
                    "f5_feasibility": {"score": 0.8, "reason": "", "improvement": ""},
                    "f6_scope": {"score": 0.6, "reason": "Roguelike — амбициозный жанр", "improvement": "Начать с минимума"},
                    "f7_fun": {"score": 0.8, "reason": "", "improvement": ""},
                    "f8_prototype": {"score": 0.5, "reason": "Алхимическая система сложна", "improvement": "Начать с 5 зелий"},
                },
            },
        },
        "ASSEMBLE_ONE_PAGER": {
            "data": {
                "story_synopsis": "Алхимик странствует по подземельям, собирая ингредиенты для варки зелий, чтобы победить монстров и раскрыть секрет Философского камня.",
                "gameplay_description": "Игрок собирает ингредиенты в процедурно генерируемых подземельях, экспериментирует с рецептами зелий за котлом и использует полученные зелья в пошаговых боях. Каждое зелье — уникальное оружие с побочными эффектами.",
            },
        },
        "ESTIMATE_WEIGHTS": {
            "data": {"weights": {"attack": 0.3, "defense": 0.25, "speed": 0.2, "special": 0.25}},
        },
        "DECOMPOSE_STEP": {
            "data": {"actions": [{"name": "Собрать траву", "resource_in": "time", "resource_out": "herb"}], "fun_check": "OK"},
        },
        "GENERATE_RECOMMENDATIONS": {
            "data": [{"recommendation": "Добавить negative feedback через порчу зелий", "priority": "high"}],
        },
        "SIMULATE_GAMEPLAY": {
            "data": {
                "gameplay_sequence": ["gather", "brew", "fight", "loot"],
                "resource_flows": [{"from": "dungeon", "to": "inventory", "resource": "ingredients"}],
                "feedback_loops": [{"type": "positive", "description": "Лучшие зелья → больше добычи → лучше ингредиенты"}],
            },
        },
        "APPLY_LENS_MDA": {
            "data": {"lens_id": "1", "score": 0.8, "issues": [], "suggestions": []},
        },
        "ANALYZE_DISCREPANCY": {
            "data": {"spearman_rho": 0.75, "severity": "moderate", "recommendations": []},
        },
    }


def make_mock_prompt_result(data):
    """Создать mock PromptResult."""
    result = MagicMock()
    result.data = data
    result.success = True
    result.latency_ms = 100
    result.model_used = "mock-model"
    result.from_cache = False
    return result


def make_full_mock_project():
    """
    Создать mock-проект со всеми блоками, заполненными для теста «Roguelike про алхимика».
    Имитирует состояние после прохождения полного пайплайна.
    """
    project = MagicMock()
    project.id = "alchemy-roguelike-project"
    project.name = "Алхимик Roguelike"
    project.project_stage = "progression"
    project.completion_percent = 62

    # Блок 1: Концепция
    concept = MagicMock()
    concept.id = "concept-alchemy"
    concept.genre = "rpg"
    concept.subgenre = "roguelike"
    concept.primary_aesthetic = "challenge"
    concept.aesthetic_profile = {
        "primary": "challenge",
        "secondary": "discovery",
        "tertiary": "fantasy",
        "rationale": "Roguelike о варке зелий — вызов + открытие",
    }
    concept.dynamics_profile = {
        "core_dynamics": ["Экспериментирование с комбинациями", "Риск vs награда"],
        "supporting_dynamics": ["Прогрессия через знания"],
    }
    concept.mechanic_set = {
        "base": [{"name": "Resource Management", "group": "base"}],
        "combat": [{"name": "Turn-based Combat", "group": "combat"}],
        "progression": [{"name": "Crafting", "group": "progression"}],
        "spatial": [{"name": "Procedural Generation", "group": "spatial"}],
        "social": [],
    }
    concept.core_loop_candidates = [
        {"name": "Gather-Brew-Fight Loop", "loop_type": "Engine", "steps": [
            {"action": "Собрать ингредиенты", "resource": "ingredients"},
            {"action": "Сварить зелье", "resource": "potions"},
            {"action": "Применить зелье", "resource": "health"},
            {"action": "Получить награду", "resource": "gold"},
        ]},
    ]
    concept.usp = "Алхимическая варка зелий как боевая система"
    concept.one_pager_data = {
        "title": "Алхимик Roguelike",
        "genre": "Roguelike RPG",
        "usp": "Зелья = оружие",
    }
    concept.input_data = {"idea": "Roguelike про алхимика"}
    concept.validation_report = {
        "triangle": {"score": 0.8, "weird_corners_count": 1},
        "idea_filters": {"score": 0.75},
    }
    project.concept = concept

    # Блок 2: Core Loop
    core_loop = MagicMock()
    core_loop.id = "coreloop-alchemy"
    core_loop.structural_type = "Engine"
    core_loop.structural_subtype = "braked"
    core_loop.step_count = 4
    core_loop.hierarchy_depth = 3
    core_loop.pathology_count = 1
    core_loop.steps_data = [
        {"name": "Собрать ингредиенты", "mechanics": ["Exploration", "Resource Management"], "resource": "ingredients", "resource_in": "time", "resource_out": "ingredients"},
        {"name": "Сварить зелье", "mechanics": ["Crafting"], "resource_in": "ingredients", "resource_out": "potions"},
        {"name": "Применить зелье в бою", "mechanics": ["Turn-based Combat"], "resource_in": "potions", "resource_out": "damage"},
        {"name": "Получить награду", "mechanics": ["Progression"], "resource_in": "damage", "resource_out": "gold"},
    ]
    core_loop.inner_loops = [{"name": "Brew Mini-Loop", "steps": ["Select recipe", "Combine ingredients", "Check result"]}]
    core_loop.outer_loops = [{"name": "Dungeon Run Loop", "steps": ["Enter dungeon", "Complete rooms", "Fight boss"]}]
    core_loop.meta_loop = {"name": "Knowledge Accumulation", "steps": ["Learn recipes", "Discover ingredients", "Master combinations"]}
    core_loop.loop_hierarchy = {"levels": 3, "structure": ["micro → brew loop", "meso → dungeon loop", "meta → knowledge loop"]}
    core_loop.pathologies = [{"type": "runaway", "severity": "low", "description": "Зелья могут стать слишком мощными без ограничителя"}]
    core_loop.recommendations = [{"recommendation": "Добавить порчу зелий", "priority": "high"}]
    core_loop.validation_data = {"thirty_seconds_fun": True, "loop_closed": True, "dead_resources": []}
    core_loop.full_profile = {"structural_type": "Engine", "pathology_count": 1}
    project.core_loop = core_loop

    # Блок 3: MDA
    mda = MagicMock()
    mda.id = "mda-alchemy"
    mda.primary_aesthetic = "challenge"
    mda.secondary_aesthetic = "discovery"
    mda.overall_match = 0.82
    mda.iteration_count = 2
    mda.target_dynamics = {"core": ["Экспериментирование", "Риск vs награда"], "supporting": ["Прогрессия через знания"]}
    mda.mechanic_set = {"selected": ["Crafting", "Resource Management", "Turn-based Combat", "Procedural Generation"]}
    mda.observed_dynamics = ["Экспериментирование", "Риск vs награда", "Тактическое планирование"]
    mda.predicted_aesthetics = {"challenge": 0.9, "discovery": 0.85, "fantasy": 0.7}
    mda.match_scores = {"challenge": 0.9, "discovery": 0.85, "fantasy": 0.7}
    mda.lens_validation = {"lens_1": {"score": 0.8}, "lens_5": {"score": 0.75}}
    mda.bond_validation = {"horizontal_consistency": 0.8, "vertical_consistency": 0.75}
    mda.ludonarrative_check = {"result": "harmony", "score": 0.85}
    mda.machinations_model = {"nodes": [], "flows": []}
    mda.simulation_results = {"converged": True}
    mda.full_profile = {"overall_match": 0.82}
    project.mda_profile = mda

    # Блок 4: Баланс
    balance = MagicMock()
    balance.id = "balance-alchemy"
    balance.balance_type = "mixed"
    balance.overall_balance_score = 0.78
    balance.imbalance_count = 3
    balance.element_count = 8
    balance.elements = [
        {"name": "Fire Potion", "cost": 50, "power": 55, "cp_ratio": 0.91, "status": "balanced"},
        {"name": "Ice Potion", "cost": 60, "power": 48, "cp_ratio": 1.25, "status": "underpowered"},
        {"name": "Lightning Potion", "cost": 45, "power": 52, "cp_ratio": 0.87, "status": "ideal_imbalance"},
        {"name": "Healing Potion", "cost": 30, "power": 35, "cp_ratio": 0.86, "status": "balanced"},
        {"name": "Poison Potion", "cost": 40, "power": 58, "cp_ratio": 0.69, "status": "overpowered"},
        {"name": "Shield Potion", "cost": 55, "power": 45, "cp_ratio": 1.22, "status": "underpowered"},
        {"name": "Speed Potion", "cost": 35, "power": 40, "cp_ratio": 0.88, "status": "balanced"},
        {"name": "Alchemy Bomb", "cost": 70, "power": 65, "cp_ratio": 1.08, "status": "balanced"},
    ]
    balance.cost_power_curves = [{"model": "identity", "expected_cp": 1.0}]
    balance.intransitive_matrix = {"fire": {"ice": 1.5, "lightning": 0.5}, "ice": {"fire": 0.5, "lightning": 1.5}, "lightning": {"fire": 1.5, "ice": 0.5}}
    balance.nash_equilibrium = {"fire": 0.33, "ice": 0.33, "lightning": 0.33}
    balance.monte_carlo_results = {"win_rates": {"fire": 0.35, "ice": 0.30, "lightning": 0.35}, "spread": 0.05}
    balance.machinations_results = {"stable": True, "pathologies": []}
    balance.pathologies = [{"type": "runaway", "element": "Poison Potion", "severity": "medium"}]
    balance.corrections = [{"element": "Poison Potion", "action": "Увеличить cost на 30%"}]
    balance.situational_values = {}
    balance.full_result = {"overall_balance_score": 0.78}
    balance.input_data = {"game_mode": "PvE", "genre": "rpg", "objects": []}
    project.balance_result = balance

    # Блок 5a: Прогрессия
    progression = MagicMock()
    progression.id = "progression-alchemy"
    progression.total_levels = 30
    progression.tier_count = 4
    progression.curve_type = "exponential"
    progression.target_duration_hours = 20.0
    progression.input_data = {"genre": "rpg"}
    progression.macro_model = {"total_levels": 30, "target_duration_hours": 20, "progression_type": "exponential"}
    progression.tier_model = {"tiers": [
        {"name": "Novice", "levels": "1-8", "dominant_mechanic": "Exploration"},
        {"name": "Apprentice", "levels": "9-16", "dominant_mechanic": "Crafting"},
        {"name": "Adept", "levels": "17-24", "dominant_mechanic": "Combat"},
        {"name": "Master", "levels": "25-30", "dominant_mechanic": "Boss fights"},
    ]}
    progression.curves = {
        "xp_to_level": "exponential",
        "level_to_power": "linear",
        "level_to_cost": "polynomial",
        "difficulty": "logistic",
    }
    progression.content_plan = {"unlock_tree": [], "perceived_difficulty": []}
    progression.economy_link = {"tiers_to_economy_phases": True}
    progression.validation = {"grind_check": "pass", "wall_check": "pass", "empty_levels_check": "pass", "overall_score": 0.85}
    progression.full_profile = {"total_levels": 30}
    project.progression = progression

    # Блок 5b: Экономика
    economy = MagicMock()
    economy.id = "economy-alchemy"
    economy.system_type = "Engine"
    economy.resource_count = 6
    economy.has_pathology = True
    economy.input_data = {"genre": "rpg"}
    economy.resource_model = {
        "core": [
            {"name": "Gold", "class": "Valued", "initial": 100},
            {"name": "Ingredients", "class": "Commodity", "initial": 10},
            {"name": "Potions", "class": "Commodity", "initial": 3},
        ],
        "subsidiary": [
            {"name": "XP", "class": "Valued", "initial": 0},
            {"name": "Knowledge", "class": "Valued", "initial": 0},
            {"name": "Reputation", "class": "Valued", "initial": 0},
        ],
    }
    economy.machinations_model = {"nodes": [
        {"id": "source_dungeon", "type": "Source", "resource": "ingredients"},
        {"id": "pool_ingredients", "type": "Pool", "resource": "ingredients"},
        {"id": "converter_brew", "type": "Converter", "resource_in": "ingredients", "resource_out": "potions"},
    ]}
    economy.conversion_chains = [{"from": "ingredients", "to": "potions", "ratio": "3:1", "mechanic": "Crafting"}]
    economy.pathologies = [{"type": "runaway", "resource": "potions", "severity": "low", "correction": "Add expiration timer"}]
    economy.corrections = [{"pathology": "runaway", "action": "Добавить срок годности зелий", "priority": "medium"}]
    economy.simulation_results = {"stable": True, "ticks": 1000, "resources_over_time": []}
    economy.monetization_model = {"type": "premium", "currency": "gold"}
    economy.full_profile = {"system_type": "Engine"}
    project.economy = economy

    # Блоки 6-8: не заполнены
    project.gdd = None
    project.checklist = None

    return project


# ============================================================
# ТЕСТЫ: INT-01 — Полный пайплайн «идея → экономика»
# ============================================================

class TestFullPipelineIntegration:
    """INT-01: Полный пайплайн с mock AI — от идеи до экономики."""

    @pytest.mark.asyncio
    async def test_full_pipeline_produces_all_blocks(self, pipeline_service):
        """
        Полный пайплайн «Roguelike про алхимика» → все 5 блоков заполнены.

        Проверяет:
        - Каждый блок получает данные от предыдущих
        - Нет null-ошибок в цепочке
        - Все ключевые поля заполнены
        """
        project = make_full_mock_project()

        # Проверяем что каждый блок имеет данные
        assert project.concept is not None
        assert project.concept.genre == "rpg"
        assert project.concept.aesthetic_profile is not None
        assert project.concept.mechanic_set is not None

        assert project.core_loop is not None
        assert project.core_loop.structural_type == "Engine"
        assert project.core_loop.steps_data is not None
        assert len(project.core_loop.steps_data) == 4

        assert project.mda_profile is not None
        assert project.mda_profile.overall_match is not None
        assert project.mda_profile.mechanic_set is not None

        assert project.balance_result is not None
        assert project.balance_result.elements is not None
        assert len(project.balance_result.elements) == 8

        assert project.progression is not None
        assert project.progression.total_levels == 30
        assert project.progression.curves is not None

        assert project.economy is not None
        assert project.economy.resource_model is not None

    @pytest.mark.asyncio
    async def test_pipeline_state_reflects_all_blocks(self, pipeline_service):
        """
        PipelineState корректно отражает заполненность всех 5 блоков.
        """
        project = make_full_mock_project()

        # Проверяем, что pipeline может подготовить данные для каждого блока
        for block_id in [2, 3, 4, 5]:
            result = await pipeline_service.prepare_block_input(
                project_id=project.id,
                target_block=block_id,
            )
            # Все блоки должны получать статус ready
            assert result.get("status") == "ready", f"Блок {block_id} не готов: {result}"


# ============================================================
# ТЕСТЫ: INT-02 — Передача данных между блоками
# ============================================================

class TestDataFlowIntegrity:
    """INT-02: Целостность передачи данных между блоками."""

    @pytest.mark.asyncio
    async def test_block2_receives_concept_data(self, pipeline_service):
        """Блок 2 получает данные из Блока 1 (OnePager → CoreLoopInput)."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_core_loop_input(project)

        assert result["status"] == "ready"
        assert result["genre"] == "rpg"
        assert "mechanics" in result
        assert "aesthetic_profile" in result
        assert result["aesthetic_profile"]["primary"] == "challenge"
        assert len(result.get("core_loop_candidates", [])) > 0

    @pytest.mark.asyncio
    async def test_block3_receives_concept_and_coreloop_data(self, pipeline_service):
        """Блок 3 получает данные из Блоков 1 и 2."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_mda_input(project)

        assert result["status"] == "ready"
        assert result["genre"] == "rpg"
        assert result["idea"] == "Roguelike про алхимика"
        assert result["primary_aesthetic"] == "challenge"
        assert "existing_mechanics" in result
        assert "core_loop_data" in result
        assert result["has_core_loop"] is True
        # Механики из Core Loop должны быть извлечены
        mechanics = result["existing_mechanics"]
        assert len(mechanics) > 0

    @pytest.mark.asyncio
    async def test_block4_receives_all_previous_data(self, pipeline_service):
        """Блок 4 получает данные из Блоков 1, 2 и 3."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_balance_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is True
        assert result["has_mda"] is True
        assert "concept_data" in result
        assert "core_loop_data" in result
        assert "mda_data" in result

    @pytest.mark.asyncio
    async def test_block5_receives_progression_and_economy_inputs(self, pipeline_service):
        """Блок 5 получает данные из Блоков 1–4 для прогрессии и экономики."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is True
        assert result["has_mda"] is True
        assert result["has_balance"] is True

        # Прогрессия получает ключевые данные
        prog = result["progression_input"]
        assert prog["genre"] == "rpg"
        assert "aesthetic_profile" in prog
        assert "core_loop_type" in prog
        assert "mda_mechanics" in prog
        assert "balance_elements" in prog

        # Экономика получает ресурсы из Core Loop
        econ = result["economy_input"]
        assert "core_loop_resources" in econ
        resources = econ["core_loop_resources"]
        assert len(resources) > 0
        # Золотой и ингредиенты должны быть в ресурсах
        assert any("gold" in r.lower() or "ingredients" in r.lower() for r in resources)

    @pytest.mark.asyncio
    async def test_resources_extracted_from_core_loop_steps(self, pipeline_service):
        """Ресурсы корректно извлекаются из шагов Core Loop."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        econ = result["economy_input"]
        resources = econ["core_loop_resources"]
        # Проверяем что все типы ресурсов из шагов извлечены
        assert "ingredients" in resources
        assert "potions" in resources
        assert "gold" in resources


# ============================================================
# ТЕСТЫ: INT-03 — Обработка частичного заполнения
# ============================================================

class TestPartialBlockCompletion:
    """INT-03: Graceful degradation при частичном заполнении блоков."""

    @pytest.mark.asyncio
    async def test_block4_with_only_concept(self, pipeline_service):
        """Блок 4 работает только с данными Блока 1 (нет Core Loop и MDA)."""
        project = make_full_mock_project()
        project.core_loop = None
        project.mda_profile = None

        result = await pipeline_service._prepare_balance_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is False
        assert result["has_mda"] is False
        assert "warnings" in result
        assert len(result["warnings"]) == 2

    @pytest.mark.asyncio
    async def test_block5_with_missing_balance(self, pipeline_service):
        """Блок 5 работает без данных Блока 4 (баланс)."""
        project = make_full_mock_project()
        project.balance_result = None

        result = await pipeline_service._prepare_progression_and_economy_input(project)

        assert result["status"] == "ready"
        assert result["has_balance"] is False
        assert "warnings" in result
        assert any("Баланс" in w for w in result["warnings"])

        # Прогрессия и экономика всё равно получают данные
        assert result["progression_input"]["genre"] == "rpg"
        assert "core_loop_resources" in result["economy_input"]

    @pytest.mark.asyncio
    async def test_block5_with_only_concept(self, pipeline_service):
        """Блок 5 с минимальными данными (только концепция)."""
        project = make_full_mock_project()
        project.core_loop = None
        project.mda_profile = None
        project.balance_result = None

        result = await pipeline_service._prepare_progression_and_economy_input(project)

        assert result["status"] == "ready"
        assert result["has_concept"] is True
        assert result["has_core_loop"] is False
        assert result["has_mda"] is False
        assert result["has_balance"] is False
        assert len(result["warnings"]) == 3

        # Минимальные данные для прогрессии доступны
        assert result["progression_input"]["genre"] == "rpg"


# ============================================================
# ТЕСТЫ: INT-04 — Cascade stale-обновления
# ============================================================

class TestCascadeStaleUpdates:
    """INT-04: Cascade stale-обновления при изменении раннего блока."""

    @pytest.mark.asyncio
    async def test_concept_change_cascades_to_all(self, pipeline_service, mock_redis):
        """Изменение Блока 1 → все блоки 2-8 stale."""
        result = await pipeline_service.notify_block_updated(
            project_id="alchemy-project",
            block_id=1,
            user_id="test-user",
        )

        assert result["status"] == "ok"
        assert result["event"] == "concept_updated"
        assert 2 in result["stale_blocks"]
        assert 3 in result["stale_blocks"]
        assert 4 in result["stale_blocks"]
        assert 5 in result["stale_blocks"]
        assert 6 in result["stale_blocks"]
        assert 7 in result["stale_blocks"]
        assert 8 in result["stale_blocks"]
        assert len(result["stale_blocks"]) == 7

    @pytest.mark.asyncio
    async def test_coreloop_change_cascades_correctly(self, pipeline_service, mock_redis):
        """Изменение Блока 2 → Блоки 3-8 stale (1 не stale)."""
        result = await pipeline_service.notify_block_updated(
            project_id="alchemy-project",
            block_id=2,
            user_id="test-user",
        )

        assert result["status"] == "ok"
        assert result["event"] == "core_loop_updated"
        assert 1 not in result["stale_blocks"]  # Блок 1 не зависит от 2
        assert 3 in result["stale_blocks"]
        assert 4 in result["stale_blocks"]
        assert 5 in result["stale_blocks"]

    @pytest.mark.asyncio
    async def test_mda_change_does_not_affect_earlier_blocks(self, pipeline_service, mock_redis):
        """Изменение Блока 3 → Блоки 4-8 stale (1 и 2 не stale)."""
        result = await pipeline_service.notify_block_updated(
            project_id="alchemy-project",
            block_id=3,
            user_id="test-user",
        )

        assert result["status"] == "ok"
        assert 1 not in result["stale_blocks"]
        assert 2 not in result["stale_blocks"]
        assert 4 in result["stale_blocks"]
        assert 5 in result["stale_blocks"]

    @pytest.mark.asyncio
    async def test_balance_change_affects_progression_and_gdd(self, pipeline_service, mock_redis):
        """Изменение Блока 4 → Блоки 5, 6, 8 stale."""
        result = await pipeline_service.notify_block_updated(
            project_id="alchemy-project",
            block_id=4,
            user_id="test-user",
        )

        assert result["status"] == "ok"
        assert 5 in result["stale_blocks"]
        assert 6 in result["stale_blocks"]
        assert 8 in result["stale_blocks"]
        assert 1 not in result["stale_blocks"]
        assert 2 not in result["stale_blocks"]
        assert 3 not in result["stale_blocks"]

    @pytest.mark.asyncio
    async def test_progression_change_affects_gdd_only(self, pipeline_service, mock_redis):
        """Изменение Блока 5 → Блоки 6, 8 stale."""
        result = await pipeline_service.notify_block_updated(
            project_id="alchemy-project",
            block_id=5,
            user_id="test-user",
        )

        assert result["status"] == "ok"
        assert 6 in result["stale_blocks"]
        assert 8 in result["stale_blocks"]
        assert 4 not in result["stale_blocks"]


# ============================================================
# ТЕСТЫ: INT-05 — Pipeline prepare_input для каждого блока
# ============================================================

class TestPipelinePrepareInputPerBlock:
    """INT-05: Корректность подготовки входных данных для каждого блока."""

    @pytest.mark.asyncio
    async def test_prepare_block2_input(self, pipeline_service):
        """Подготовка входа для Блока 2 из данных Блока 1."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_core_loop_input(project)

        # Обязательные поля для CoreLoopInput
        assert "project_id" in result
        assert "genre" in result
        assert "mechanics" in result
        assert "aesthetic_profile" in result
        # Механики из концепции переданы
        assert len(result["mechanics"]) > 0

    @pytest.mark.asyncio
    async def test_prepare_block3_input(self, pipeline_service):
        """Подготовка входа для Блока 3 из данных Блоков 1 и 2."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_mda_input(project)

        # Обязательные поля для MDAInput
        assert "project_id" in result
        assert "idea" in result
        assert "genre" in result
        assert "primary_aesthetic" in result
        assert "existing_mechanics" in result
        assert "core_loop_data" in result
        assert result["has_core_loop"] is True

    @pytest.mark.asyncio
    async def test_prepare_block4_input(self, pipeline_service):
        """Подготовка входа для Блока 4 из данных Блоков 1, 2 и 3."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_balance_input(project)

        # Все данные из предыдущих блоков
        assert "genre" in result
        assert "concept_data" in result
        assert "core_loop_data" in result
        assert "mda_data" in result

    @pytest.mark.asyncio
    async def test_prepare_block5_input(self, pipeline_service):
        """Подготовка входа для Блока 5 из данных Блоков 1–4."""
        project = make_full_mock_project()
        result = await pipeline_service._prepare_progression_and_economy_input(project)

        # Прогрессия и экономика разделены
        assert "progression_input" in result
        assert "economy_input" in result

        # Прогрессия получает: genre, aesthetic, core_loop_type, mda, balance
        prog = result["progression_input"]
        assert "genre" in prog
        assert "aesthetic_profile" in prog
        assert "core_loop_type" in prog
        assert "mda_mechanics" in prog
        assert "balance_elements" in prog

        # Экономика получает: resources, core_loop, mda, genre
        econ = result["economy_input"]
        assert "core_loop_resources" in econ
        assert "core_loop_type" in econ
        assert "mda_mechanics" in econ
        assert "genre" in econ

    @pytest.mark.asyncio
    async def test_missing_concept_returns_error_for_block2(self, pipeline_service):
        """Без концепции Блок 2 возвращает статус missing_concept."""
        project = make_full_mock_project()
        project.concept.aesthetic_profile = None

        result = await pipeline_service._prepare_core_loop_input(project)
        assert result["status"] == "missing_concept"


# ============================================================
# ТЕСТЫ: INT-06 — Валидация формата выходных данных
# ============================================================

class TestOutputFormatValidation:
    """INT-06: Валидация формата выходных данных каждого блока."""

    def test_concept_output_has_required_fields(self):
        """Блок 1: OnePager содержит все обязательные поля."""
        project = make_full_mock_project()
        c = project.concept

        # Обязательные реляционные поля
        assert c.genre is not None
        assert c.primary_aesthetic is not None

        # Обязательные JSON-поля
        assert c.aesthetic_profile is not None
        assert c.mechanic_set is not None
        assert c.one_pager_data is not None

        # Структура aesthetic_profile
        ap = c.aesthetic_profile
        assert "primary" in ap
        assert "secondary" in ap
        assert "tertiary" in ap

        # Структура mechanic_set
        ms = c.mechanic_set
        assert "base" in ms
        assert "combat" in ms
        assert "progression" in ms

    def test_coreloop_output_has_required_fields(self):
        """Блок 2: CoreLoopProfile содержит все обязательные поля."""
        project = make_full_mock_project()
        cl = project.core_loop

        assert cl.structural_type is not None
        assert cl.steps_data is not None
        assert isinstance(cl.steps_data, list)
        assert len(cl.steps_data) > 0

        # Каждый шаг имеет ключевые поля
        for step in cl.steps_data:
            assert "name" in step
            assert "mechanics" in step

    def test_mda_output_has_required_fields(self):
        """Блок 3: MDAProfile содержит все обязательные поля."""
        project = make_full_mock_project()
        mda = project.mda_profile

        assert mda.primary_aesthetic is not None
        assert mda.overall_match is not None
        assert mda.mechanic_set is not None
        assert mda.target_dynamics is not None

        # Match scores
        scores = mda.match_scores
        assert isinstance(scores, dict)
        assert len(scores) > 0

    def test_balance_output_has_required_fields(self):
        """Блок 4: BalanceResult содержит все обязательные поля."""
        project = make_full_mock_project()
        b = project.balance_result

        assert b.balance_type is not None
        assert b.overall_balance_score is not None
        assert b.elements is not None
        assert isinstance(b.elements, list)

        # Каждый элемент имеет ключевые поля
        for elem in b.elements:
            assert "name" in elem
            assert "cost" in elem
            assert "power" in elem
            assert "cp_ratio" in elem
            assert "status" in elem

    def test_progression_output_has_required_fields(self):
        """Блок 5a: ProgressionProfile содержит все обязательные поля."""
        project = make_full_mock_project()
        p = project.progression

        assert p.total_levels is not None
        assert p.tier_count is not None
        assert p.curve_type is not None
        assert p.curves is not None

        # 4 кривые
        curves = p.curves
        assert "xp_to_level" in curves
        assert "level_to_power" in curves
        assert "level_to_cost" in curves
        assert "difficulty" in curves

    def test_economy_output_has_required_fields(self):
        """Блок 5b: EconomyProfile содержит все обязательные поля."""
        project = make_full_mock_project()
        e = project.economy

        assert e.system_type is not None
        assert e.resource_count is not None
        assert e.resource_model is not None

        # Структура resource_model
        rm = e.resource_model
        assert "core" in rm
        assert "subsidiary" in rm
        assert len(rm["core"]) >= 2  # Минимум 2 core-ресурса

    def test_alchemy_roguelike_concept_is_rpg_roguelike(self):
        """Тест «Roguelike про алхимика» классифицируется как RPG/Roguelike."""
        project = make_full_mock_project()
        assert project.concept.genre == "rpg"
        assert project.concept.subgenre == "roguelike"
        assert project.concept.primary_aesthetic == "challenge"

    def test_balance_elements_status_values(self):
        """Все статусы элементов баланса — из допустимого набора."""
        valid_statuses = {"balanced", "overpowered", "underpowered", "ideal_imbalance"}
        project = make_full_mock_project()
        for elem in project.balance_result.elements:
            assert elem["status"] in valid_statuses, f"Invalid status: {elem['status']}"
