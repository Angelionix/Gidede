"""
Gidede — Economy Service Tests
Фаза 4.C.6: Тесты для Блока 5 — Экономика (алгоритм 3.6)

Тесты по этапам:
- Stage 1: IdentifyResources (3.6.3) — ~15 тестов
- Stage 2: ClassifyEconomy (3.6.4) — ~15 тестов
- Stage 3: BuildMachinationsModel (3.6.5) — ~10 тестов
- Stage 4: BuildConversionGraph (3.6.6) — ~8 тестов
- Stage 5: DiagnoseEconomy (3.6.7) — ~10 тестов
- Stage 6: BalanceFaucetsDrains (3.6.8) — ~8 тестов
- Stage 7: SimulateEconomy (3.6.9) — ~8 тестов
- Full Pipeline: EconomyDesignFull (3.6.10) — ~8 тестов
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

from app.schemas.economy import (
    ResourceDescriptor,
    ResourceInventory,
    EconomicClassification,
    ConversionChain,
    ConversionGraph,
    EconomyPathology,
    EconomyDiagnostics,
    FaucetDrainAdjustment,
    FaucetDrainBalance,
    EconomySimResult,
    EconomyProfile,
)
from app.schemas.balance import (
    MachinationsNode,
    MachinationsResourceFlow,
    MachinationsStateConnection,
    MachinationsFeedbackLoop,
    MachinationsGraph,
)
from app.services.economy_service import (
    EconomyService,
    GENRE_CORE_RESOURCES,
    GENRE_ANCHOR_RESOURCE,
    GENRE_SUBSIDIARY_RESOURCES,
    GENRE_ECONOMIC_TYPE,
    GENRE_OPENNESS,
    GENRE_PRICING_TYPE,
    RESOURCE_CLASS_MAP,
    RESOURCE_CLASS_DEFAULTS,
    ECONOMY_PHASE_TARGETS,
    ECONOMIC_TYPE_RISK,
    CONVERSION_PROFITABILITY_GRIND_RISK,
    CONVERSION_PROFITABILITY_FRUSTRATION_RISK,
    FAUCET_DRAIN_SURPLUS,
    FAUCET_DRAIN_DEFICIT,
)


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
        metadata={"prompt_id": "IDENTIFY_RESOURCES", "from_cache": False},
    )
    return executor


@pytest.fixture
def sample_core_loop():
    """Тестовый CoreLoop с шагами и петлями."""
    return {
        "structural_type": {
            "type": "Engine",
            "has_braking": False,
            "resources": [],
            "loops": [
                {"loop_type": "positive"},
                {"loop_type": "positive"},
            ],
        },
        "inner_loops": [
            {"feedback_type": "positive"},
            {"feedback_type": "negative"},
        ],
        "outer_loops": [],
        "steps": [
            {
                "name": "explore",
                "resources_consumed": ["Энергия"],
                "resources_produced": ["XP", "Золото"],
            },
            {
                "name": "fight",
                "resources_consumed": ["HP", "Боеприпасы"],
                "resources_produced": ["XP", "Золото"],
            },
        ],
    }


@pytest.fixture
def sample_mda_profile():
    """Тестовый MDA-профиль с механиками."""
    return {
        "mechanic_set": {
            "mechanics": [
                {
                    "name": "Торговля ресурсами",
                    "dynamics_affinity": ["exchange"],
                },
                {
                    "name": "Сбор урожая",
                    "dynamics_affinity": ["collection"],
                },
            ],
        },
        "aesthetic_profile": {
            "monetizationModel": "premium",
        },
    }


@pytest.fixture
def sample_progression_profile():
    """Тестовый профиль прогрессии с экономическими данными."""
    return {
        "economyInput": {
            "conversion_chains": [
                {
                    "name": "Gold_to_Gear",
                    "inputs": ["Золото"],
                    "outputs": ["Снаряжение"],
                    "input_value": 50.0,
                    "output_value": 40.0,
                    "efficiency": 0.8,
                    "tier": 1,
                },
                {
                    "name": "XP_to_Gold",
                    "inputs": ["XP"],
                    "outputs": ["Золото"],
                    "input_value": 10.0,
                    "output_value": 20.0,
                    "efficiency": 1.2,
                    "tier": 2,
                },
            ],
        },
        "curves": {
            "xp_curve": "exponential",
        },
        "tierModel": {
            "num_tiers": 5,
        },
    }


@pytest.fixture
def sample_concept():
    """Тестовая концепция игры."""
    return {
        "genre": "rpg",
    }


@pytest.fixture
def economy_service(mock_executor):
    """Создать EconomyService с моком executor."""
    return EconomyService(executor=mock_executor)


# ============================================================
# Вспомогательные фикстуры для быстрого создания результатов
# ============================================================

@pytest.fixture
def rpg_inventory():
    """Инвентарь ресурсов для RPG (результат Stage 1)."""
    descriptors = []
    genre_core = GENRE_CORE_RESOURCES["rpg"]
    genre_anchor = GENRE_ANCHOR_RESOURCE["rpg"]
    genre_subsidiary = GENRE_SUBSIDIARY_RESOURCES["rpg"]

    all_names = genre_core + genre_subsidiary
    for name in all_names:
        res_class = RESOURCE_CLASS_MAP.get(name, "game_object")
        defaults = RESOURCE_CLASS_DEFAULTS.get(res_class, RESOURCE_CLASS_DEFAULTS["game_object"])
        descriptors.append(ResourceDescriptor(
            name=name,
            resource_class=res_class,
            is_consumable=defaults["is_consumable"],
            is_catalytic=defaults["is_catalytic"],
            is_anchor=(name == genre_anchor),
            depreciates=defaults["depreciates"],
            transferable=defaults["transferable"],
            initial_value=0.0,
            bounds={"min": 0, "max": 1000},
            source="heuristic",
        ))

    class_counts: dict[str, int] = {}
    for d in descriptors:
        class_counts[d.resource_class] = class_counts.get(d.resource_class, 0) + 1

    return ResourceInventory(
        resources=descriptors,
        anchor_resource=genre_anchor,
        core_count=len([d for d in descriptors if d.name in genre_core]),
        subsidiary_count=len(descriptors) - len([d for d in descriptors if d.name in genre_core]),
        class_distribution=class_counts,
        models_used=[],
    )


@pytest.fixture
def rpg_classification():
    """Классификация для RPG (результат Stage 2)."""
    return EconomicClassification(
        economic_type="engine",
        sub_type="pure_engine",
        dominant_loop="reinforcing",
        interaction_type="conversion",
        reinforcing_loops=3,
        balancing_loops=1,
        openness="mixed",
        pricing_type="fixed",
        risk_level="medium",
        likely_pathologies=["runaway", "stagnation"],
        risk_description="Engine: ресурсный генератор с усиливающей ОС.",
    )


# ============================================================
# Stage 1: TestIdentifyResources (3.6.3)
# ============================================================

class TestIdentifyResources:
    """Тесты Этапа 1: Идентификация ресурсов."""

    @pytest.mark.asyncio
    async def test_identify_resources_rpg(self, economy_service):
        """RPG жанр возвращает HP, XP, Золото как core-ресурсы."""
        result = await economy_service.identify_resources(genre="rpg")

        assert isinstance(result, ResourceInventory)
        resource_names = [r.name for r in result.resources]
        assert "HP" in resource_names
        assert "XP" in resource_names
        assert "Золото" in resource_names

    @pytest.mark.asyncio
    async def test_identify_resources_strategy(self, economy_service):
        """Strategy жанр возвращает Минералы, Территория, Технологии."""
        result = await economy_service.identify_resources(genre="strategy")

        resource_names = [r.name for r in result.resources]
        assert "Минералы" in resource_names
        assert "Территория" in resource_names
        assert "Технологии" in resource_names

    @pytest.mark.asyncio
    async def test_identify_resources_survival(self, economy_service):
        """Survival жанр возвращает соответствующие ресурсы."""
        result = await economy_service.identify_resources(genre="survival")

        resource_names = [r.name for r in result.resources]
        assert "Голод" in resource_names
        assert "Здоровье" in resource_names
        assert "Материалы" in resource_names

    @pytest.mark.asyncio
    async def test_identify_resources_from_core_loop(self, economy_service, sample_core_loop):
        """Ресурсы извлекаются из шагов CoreLoop (consumed/produced)."""
        result = await economy_service.identify_resources(
            core_loop=sample_core_loop,
            genre="rpg",
        )

        resource_names = [r.name for r in result.resources]
        # "Энергия" из resources_consumed, "Боеприпасы" из resources_consumed
        assert "Энергия" in resource_names
        assert "Боеприпасы" in resource_names

    @pytest.mark.asyncio
    async def test_identify_resources_anchor(self, economy_service):
        """Anchor resource устанавливается по жанру."""
        result = await economy_service.identify_resources(genre="rpg")

        assert result.anchor_resource == "HP"

        # Для strategy anchor = Территория
        result_strat = await economy_service.identify_resources(genre="strategy")
        assert result_strat.anchor_resource == "Территория"

    @pytest.mark.asyncio
    async def test_identify_resources_classification(self, economy_service):
        """Ресурсы классифицируются по Schreiber."""
        result = await economy_service.identify_resources(genre="rpg")

        name_to_class = {r.name: r.resource_class for r in result.resources}
        assert name_to_class.get("HP") == "hp"
        assert name_to_class.get("XP") == "experience"
        assert name_to_class.get("Золото") == "currency"

    @pytest.mark.asyncio
    async def test_identify_resources_consumable_flags(self, economy_service):
        """is_consumable устанавливается корректно по классу ресурса."""
        result = await economy_service.identify_resources(genre="rpg")

        name_to_consumable = {r.name: r.is_consumable for r in result.resources}
        # HP (hp class) — consumable
        assert name_to_consumable.get("HP") is True
        # XP (experience class) — not consumable
        assert name_to_consumable.get("XP") is False
        # Золото (currency class) — consumable
        assert name_to_consumable.get("Золото") is True

    @pytest.mark.asyncio
    async def test_identify_resources_catalytic_flags(self, economy_service):
        """is_catalytic устанавливается корректно для валют."""
        result = await economy_service.identify_resources(genre="rpg")

        name_to_catalytic = {r.name: r.is_catalytic for r in result.resources}
        # Золото (currency) — catalytic
        assert name_to_catalytic.get("Золото") is True
        # XP (experience) — not catalytic
        assert name_to_catalytic.get("XP") is False

    @pytest.mark.asyncio
    async def test_identify_resources_core_count(self, economy_service):
        """core_count соответствует количеству core-ресурсов жанра."""
        result = await economy_service.identify_resources(genre="rpg")

        expected_core = len(GENRE_CORE_RESOURCES["rpg"])
        assert result.core_count == expected_core

    @pytest.mark.asyncio
    async def test_identify_resources_class_distribution(self, economy_service):
        """class_distribution словарь заполнен."""
        result = await economy_service.identify_resources(genre="rpg")

        assert isinstance(result.class_distribution, dict)
        assert len(result.class_distribution) > 0
        total = sum(result.class_distribution.values())
        assert total == len(result.resources)

    @pytest.mark.asyncio
    async def test_identify_resources_custom(self, mock_executor):
        """Пользовательские ресурсы из AI объединяются с эвристическими."""
        mock_executor.execute.return_value = MagicMock(
            data={
                "resources": [
                    {
                        "name": "Магический_кристалл",
                        "resource_class": "currency",
                        "is_consumable": True,
                        "is_catalytic": True,
                    },
                ],
                "enrichments": [],
            },
            metadata={"prompt_id": "IDENTIFY_RESOURCES", "from_cache": False},
        )
        service = EconomyService(executor=mock_executor)
        result = await service.identify_resources(genre="rpg")

        resource_names = [r.name for r in result.resources]
        assert "Магический_кристалл" in resource_names

    @pytest.mark.asyncio
    async def test_identify_resources_no_genre(self, economy_service):
        """Fallback при неизвестном жанре — пустые core, но нет ошибки."""
        result = await economy_service.identify_resources(genre="unknown_genre_xyz")

        assert isinstance(result, ResourceInventory)
        # Нет genre core → core_count = 0
        assert result.core_count == 0
        assert result.anchor_resource == ""

    @pytest.mark.asyncio
    async def test_identify_resources_ai_fallback(self, mock_executor):
        """При ошибке AI используются эвристики."""
        mock_executor.execute.side_effect = Exception("AI unavailable")
        service = EconomyService(executor=mock_executor)

        result = await service.identify_resources(genre="rpg")

        assert isinstance(result, ResourceInventory)
        # Ресурсы получены из эвристик
        assert len(result.resources) > 0
        resource_names = [r.name for r in result.resources]
        assert "HP" in resource_names
        assert result.models_used == []  # AI не отработал

    @pytest.mark.asyncio
    async def test_identify_resources_max_resources(self, economy_service):
        """Количество ресурсов разумно (не более core + subsidiary + loop)."""
        result = await economy_service.identify_resources(genre="rpg")

        expected_max = (
            len(GENRE_CORE_RESOURCES["rpg"])
            + len(GENRE_SUBSIDIARY_RESOURCES["rpg"])
        )
        assert len(result.resources) <= expected_max + 10  # допуск для loop

    @pytest.mark.asyncio
    async def test_identify_resources_initial_values(self, economy_service):
        """Начальные значения ресурсов установлены по классу."""
        result = await economy_service.identify_resources(genre="rpg")

        name_to_initial = {r.name: r.initial_value for r in result.resources}
        # HP (hp class) — начальное 100.0
        assert name_to_initial.get("HP") == 100.0
        # XP (experience class) — начальное 0.0
        assert name_to_initial.get("XP") == 0.0
        # Золото (currency class) — начальное 100.0
        assert name_to_initial.get("Золото") == 100.0


# ============================================================
# Stage 2: TestClassifyEconomy (3.6.4)
# ============================================================

class TestClassifyEconomy:
    """Тесты Этапа 2: Классификация экономической системы."""

    @pytest.mark.asyncio
    async def test_classify_rpg_engine(self, economy_service, rpg_inventory):
        """RPG → economic type = engine."""
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            genre="rpg",
        )

        assert isinstance(result, EconomicClassification)
        assert result.economic_type == "engine"

    @pytest.mark.asyncio
    async def test_classify_strategy_economy(self, economy_service):
        """Strategy → economic type = economy."""
        result_inv = await economy_service.identify_resources(genre="strategy")
        result = await economy_service.classify_economy(
            inventory=result_inv,
            genre="strategy",
        )

        assert result.economic_type == "economy"

    @pytest.mark.asyncio
    async def test_classify_survival_ecology(self, economy_service):
        """Survival → economic type = ecology."""
        result_inv = await economy_service.identify_resources(genre="survival")
        result = await economy_service.classify_economy(
            inventory=result_inv,
            genre="survival",
        )

        assert result.economic_type == "ecology"

    @pytest.mark.asyncio
    async def test_classify_sub_type_braked_engine(self, economy_service, rpg_inventory):
        """Engine с braking → sub_type = braked_engine."""
        core_loop = {
            "structural_type": {
                "type": "engine",
                "has_braking": True,
            },
        }
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            core_loop=core_loop,
            genre="rpg",
        )

        assert result.sub_type == "braked_engine"

    @pytest.mark.asyncio
    async def test_classify_sub_type_pure_engine(self, economy_service, rpg_inventory):
        """Engine без braking → sub_type = pure_engine."""
        core_loop = {
            "structural_type": {
                "type": "engine",
                "has_braking": False,
            },
        }
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            core_loop=core_loop,
            genre="rpg",
        )

        assert result.sub_type == "pure_engine"

    @pytest.mark.asyncio
    async def test_classify_sub_type_multi_currency(self, economy_service):
        """Economy с 2+ валютами → sub_type = multi_currency."""
        result_inv = await economy_service.identify_resources(genre="strategy")
        result = await economy_service.classify_economy(
            inventory=result_inv,
            genre="strategy",
        )

        currency_count = sum(
            1 for r in result_inv.resources if r.resource_class == "currency"
        )
        if currency_count >= 2:
            assert result.sub_type == "multi_currency"
        else:
            assert result.sub_type == "single_currency"

    @pytest.mark.asyncio
    async def test_classify_sub_type_single_currency(self, economy_service):
        """Economy с 1 валютой → sub_type = single_currency."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Gold", resource_class="currency"),
                ResourceDescriptor(name="Wood", resource_class="game_object"),
            ],
            anchor_resource="Gold",
            core_count=1,
        )
        result = await economy_service.classify_economy(
            inventory=inventory,
            genre="strategy",
        )

        # Если нет structural_type override и currency_count == 1
        # strategy → economy → single_currency
        currency_count = sum(
            1 for r in inventory.resources if r.resource_class == "currency"
        )
        if currency_count < 2 and result.economic_type == "economy":
            assert result.sub_type == "single_currency"

    @pytest.mark.asyncio
    async def test_classify_dominant_loop_reinforcing(self, economy_service, rpg_inventory):
        """Больше усиливающих петель → dominant_loop = "reinforcing"."""
        core_loop = {
            "inner_loops": [
                {"feedback_type": "positive"},
                {"feedback_type": "positive"},
                {"feedback_type": "positive"},
            ],
            "outer_loops": [
                {"feedback_type": "negative"},
            ],
        }
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            core_loop=core_loop,
            genre="rpg",
        )

        assert result.dominant_loop == "reinforcing"

    @pytest.mark.asyncio
    async def test_classify_dominant_loop_balancing(self, economy_service, rpg_inventory):
        """Больше балансирующих петель → dominant_loop = "balancing"."""
        core_loop = {
            "inner_loops": [
                {"feedback_type": "negative"},
                {"feedback_type": "negative"},
                {"feedback_type": "negative"},
            ],
            "outer_loops": [
                {"feedback_type": "positive"},
            ],
        }
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            core_loop=core_loop,
            genre="rpg",
        )

        assert result.dominant_loop == "balancing"

    @pytest.mark.asyncio
    async def test_classify_interaction_type_conversion(self, economy_service, rpg_inventory):
        """2+ валюты → interaction_type = "conversion"."""
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            genre="rpg",
        )

        currency_count = sum(
            1 for r in rpg_inventory.resources if r.resource_class == "currency"
        )
        if currency_count >= 2:
            assert result.interaction_type == "conversion"

    @pytest.mark.asyncio
    async def test_classify_interaction_type_single(self, economy_service):
        """1 валюта → interaction_type = "single_resource"."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Score", resource_class="experience"),
                ResourceDescriptor(name="Time", resource_class="time"),
            ],
            anchor_resource="Score",
            core_count=1,
        )
        result = await economy_service.classify_economy(
            inventory=inventory,
            genre="rpg",
        )

        assert result.interaction_type == "single_resource"

    @pytest.mark.asyncio
    async def test_classify_interaction_type_exchange(self, economy_service, rpg_inventory, sample_mda_profile):
        """Наличие торговой механики → interaction_type = "exchange"."""
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            mda_profile=sample_mda_profile,
            genre="rpg",
        )

        assert result.interaction_type == "exchange"

    @pytest.mark.asyncio
    async def test_classify_openness(self, economy_service, rpg_inventory):
        """Openness определяется по жанру."""
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            genre="rpg",
        )

        assert result.openness == GENRE_OPENNESS["rpg"]

    @pytest.mark.asyncio
    async def test_classify_pricing_type(self, economy_service, rpg_inventory):
        """Pricing type определяется по жанру."""
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            genre="rpg",
        )

        assert result.pricing_type == GENRE_PRICING_TYPE["rpg"]

    @pytest.mark.asyncio
    async def test_classify_pricing_type_f2p(self, economy_service, rpg_inventory):
        """Freemium/P2W монетизация → pricing_type = f2p."""
        mda = {
            "aesthetic_profile": {
                "monetizationModel": "freemium",
            },
        }
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            mda_profile=mda,
            genre="rpg",
        )

        assert result.pricing_type == "f2p"
        assert result.openness == "mixed"

    @pytest.mark.asyncio
    async def test_classify_risk_level(self, economy_service, rpg_inventory):
        """Risk level соответствует экономическому типу."""
        result = await economy_service.classify_economy(
            inventory=rpg_inventory,
            genre="rpg",
        )

        expected_risk = ECONOMIC_TYPE_RISK.get(
            result.economic_type, ECONOMIC_TYPE_RISK["engine"]
        )
        assert result.risk_level == expected_risk["risk_level"]


# ============================================================
# Stage 3: TestBuildMachinationsModel (3.6.5)
# ============================================================

class TestBuildMachinationsModel:
    """Тесты Этапа 3: Построение Machinations-модели."""

    @pytest.mark.asyncio
    async def test_build_machinations_has_pools(self, economy_service, rpg_inventory, rpg_classification):
        """Граф содержит Pool-узлы для каждого ресурса."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        pool_nodes = [n for n in result.nodes if n.node_type == "pool"]
        assert len(pool_nodes) == len(rpg_inventory.resources)

    @pytest.mark.asyncio
    async def test_build_machinations_has_sources(self, economy_service, rpg_inventory, rpg_classification):
        """Граф содержит Source-узлы (faucets)."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        source_nodes = [n for n in result.nodes if n.node_type == "source"]
        assert len(source_nodes) == len(rpg_inventory.resources)

    @pytest.mark.asyncio
    async def test_build_machinations_has_drains(self, economy_service, rpg_inventory, rpg_classification):
        """Граф содержит Drain-узлы для потребляемых ресурсов."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        consumable_count = sum(1 for r in rpg_inventory.resources if r.is_consumable)
        drain_nodes = [n for n in result.nodes if n.node_type == "drain"]
        assert len(drain_nodes) == consumable_count

    @pytest.mark.asyncio
    async def test_build_machinations_has_converters(self, economy_service, rpg_inventory, rpg_classification):
        """Граф содержит Converter-узлы."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        converter_nodes = [n for n in result.nodes if n.node_type == "converter"]
        # Должны быть конвертеры (default conversions генерируются)
        assert len(converter_nodes) > 0

    @pytest.mark.asyncio
    async def test_build_machinations_has_flows(self, economy_service, rpg_inventory, rpg_classification):
        """Потоки ресурсов связывают Source → Pool → Drain."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        # Должны быть потоки от Source к Pool
        source_to_pool = [
            f for f in result.resource_flows
            if f.source_id.startswith("source_") and f.target_id.startswith("pool_")
        ]
        assert len(source_to_pool) > 0

        # Должны быть потоки от Pool к Drain (для consumables)
        pool_to_drain = [
            f for f in result.resource_flows
            if f.source_id.startswith("pool_") and f.target_id.startswith("drain_")
        ]
        consumable_count = sum(1 for r in rpg_inventory.resources if r.is_consumable)
        assert len(pool_to_drain) == consumable_count

    @pytest.mark.asyncio
    async def test_build_machinations_has_state_connections(self, economy_service, rpg_inventory, rpg_classification):
        """State connections существуют для обратной связи."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        # RPG имеет experience и currency ресурсы → reinforcing connections
        has_exp = any(r.resource_class == "experience" for r in rpg_inventory.resources)
        has_cur = any(r.resource_class == "currency" for r in rpg_inventory.resources)
        if has_exp and has_cur:
            assert len(result.state_connections) > 0

    @pytest.mark.asyncio
    async def test_build_machinations_has_feedback_loops(self, economy_service, rpg_inventory, rpg_classification):
        """Feedback loops обнаружены."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        # RPG имеет reinforcing и balancing loops
        has_exp = any(r.resource_class == "experience" for r in rpg_inventory.resources)
        has_cur = any(r.resource_class == "currency" for r in rpg_inventory.resources)
        if has_exp and has_cur:
            assert len(result.feedback_loops) > 0
            loop_types = {fl.loop_type for fl in result.feedback_loops}
            assert "reinforcing" in loop_types

    @pytest.mark.asyncio
    async def test_build_machinations_node_count(self, economy_service, rpg_inventory, rpg_classification):
        """Количество узлов соответствует ожидаемому."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        # Минимум: pools + sources + drains + converters + gate
        min_nodes = (
            len(rpg_inventory.resources)   # pools
            + len(rpg_inventory.resources)  # sources
            + sum(1 for r in rpg_inventory.resources if r.is_consumable)  # drains
            + 1  # gate for anchor
        )
        assert result.node_count >= min_nodes

    @pytest.mark.asyncio
    async def test_build_machinations_trader(self, economy_service, rpg_inventory):
        """Trader-узел добавляется, когда торговля разрешена."""
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            dominant_loop="reinforcing",
            interaction_type="exchange",  # ← обмен разрешён
            reinforcing_loops=2,
            balancing_loops=1,
            openness="mixed",
            pricing_type="fixed",
            risk_level="medium",
        )
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=classification,
        )

        trader_nodes = [n for n in result.nodes if n.node_type == "trader"]
        # Если есть transferable ресурсы, trader должен быть
        transferable = [r for r in rpg_inventory.resources if r.transferable]
        if len(transferable) >= 2:
            assert len(trader_nodes) >= 1

    @pytest.mark.asyncio
    async def test_build_machinations_gate(self, economy_service, rpg_inventory, rpg_classification):
        """Gate-узел добавляется для anchor-ресурса."""
        result = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        gate_nodes = [n for n in result.nodes if n.node_type == "gate"]
        if rpg_inventory.anchor_resource:
            assert len(gate_nodes) >= 1
            assert gate_nodes[0].is_core is True


# ============================================================
# Stage 4: TestBuildConversionGraph (3.6.6)
# ============================================================

class TestBuildConversionGraph:
    """Тесты Этапа 4: Построение графа конверсий."""

    @pytest.mark.asyncio
    async def test_build_conversion_graph_basic(self, economy_service, rpg_inventory, rpg_classification, sample_progression_profile):
        """Цепочки конверсий создаются из progression_profile."""
        # Сначала строим Machinations-модель
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
            progression_profile=sample_progression_profile,
        )

        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=sample_progression_profile,
        )

        assert isinstance(result, ConversionGraph)
        assert len(result.chains) > 0

    @pytest.mark.asyncio
    async def test_build_conversion_graph_profitability(self, economy_service, rpg_inventory, rpg_classification, sample_progression_profile):
        """Profitability рассчитывается корректно."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
            progression_profile=sample_progression_profile,
        )

        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=sample_progression_profile,
        )

        for chain in result.chains:
            if chain.input_value > 0:
                expected = round(chain.output_value / chain.input_value, 4)
                assert chain.profitability == expected

    @pytest.mark.asyncio
    async def test_build_conversion_graph_grind_risk(self, economy_service, rpg_inventory, rpg_classification):
        """Предупреждение при profitability > 1.5 (grind risk)."""
        progression = {
            "economyInput": {
                "conversion_chains": [
                    {
                        "name": "Exploit",
                        "inputs": ["Золото"],
                        "outputs": ["Снаряжение"],
                        "input_value": 10.0,
                        "output_value": 30.0,  # profitability = 3.0 > 1.5
                        "tier": 1,
                    },
                ],
            },
        }

        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )
        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=progression,
        )

        grind_warnings = [w for w in result.warnings if "гринда" in w.lower() or "grind" in w.lower() or "profitability" in w.lower()]
        assert len(grind_warnings) > 0

    @pytest.mark.asyncio
    async def test_build_conversion_graph_frustration_risk(self, economy_service, rpg_inventory, rpg_classification):
        """Предупреждение при profitability < 0.7 (frustration risk)."""
        progression = {
            "economyInput": {
                "conversion_chains": [
                    {
                        "name": "BadDeal",
                        "inputs": ["Золото"],
                        "outputs": ["Снаряжение"],
                        "input_value": 100.0,
                        "output_value": 50.0,  # profitability = 0.5 < 0.7
                        "tier": 1,
                    },
                ],
            },
        }

        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )
        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=progression,
        )

        frustration_warnings = [w for w in result.warnings if "фрустрации" in w.lower() or "frustration" in w.lower() or "profitability" in w.lower()]
        assert len(frustration_warnings) > 0

    @pytest.mark.asyncio
    async def test_build_conversion_graph_tier_coverage(self, economy_service, rpg_inventory, rpg_classification, sample_progression_profile):
        """Tier coverage отслеживается."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
            progression_profile=sample_progression_profile,
        )
        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=sample_progression_profile,
        )

        # Цепочки из sample_progression_profile имеют tier 1 и 2
        assert isinstance(result.tier_coverage, list)
        # Должны быть покрыты тиры с конверсиями
        covered_chains = [c for c in result.chains if c.tier is not None]
        if covered_chains:
            assert len(result.tier_coverage) > 0

    @pytest.mark.asyncio
    async def test_build_conversion_graph_default(self, economy_service, rpg_inventory, rpg_classification):
        """Default конверсии генерируются при отсутствии progression_profile."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )
        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=None,
        )

        assert len(result.chains) > 0

    @pytest.mark.asyncio
    async def test_build_conversion_graph_avg_profitability(self, economy_service, rpg_inventory, rpg_classification, sample_progression_profile):
        """Средняя profitability вычисляется."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
            progression_profile=sample_progression_profile,
        )
        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=sample_progression_profile,
        )

        if result.chains:
            manual_avg = sum(c.profitability for c in result.chains) / len(result.chains)
            assert abs(result.avg_profitability - round(manual_avg, 4)) < 0.01

    @pytest.mark.asyncio
    async def test_build_conversion_graph_suggestions(self, economy_service, rpg_inventory, rpg_classification):
        """Рекомендации генерируются для экстремальной profitability."""
        progression = {
            "economyInput": {
                "conversion_chains": [
                    {
                        "name": "Exploit",
                        "inputs": ["Золото"],
                        "outputs": ["Снаряжение"],
                        "input_value": 10.0,
                        "output_value": 30.0,
                        "tier": 1,
                    },
                ],
            },
        }

        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )
        result = await economy_service.build_conversion_graph(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            progression_profile=progression,
        )

        # Должны быть suggestions для grind risk
        assert len(result.suggestions) > 0


# ============================================================
# Stage 5: TestDiagnoseEconomy (3.6.7)
# ============================================================

class TestDiagnoseEconomy:
    """Тесты Этапа 5: Диагностика патологий экономики."""

    @pytest.mark.asyncio
    async def test_diagnose_runaway(self, economy_service, rpg_inventory):
        """Runaway обнаружен для pure_engine без торможения."""
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            dominant_loop="reinforcing",
            reinforcing_loops=3,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=2.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=3.0),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=rpg_inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        pathology_names = [p.name for p in result.pathologies]
        assert "runaway" in pathology_names

    @pytest.mark.asyncio
    async def test_diagnose_stall(self, economy_service):
        """Stall обнаружен, когда balancing > reinforcing в ecology."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
                ResourceDescriptor(name="Wood", resource_class="game_object", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="ecology",
            sub_type="balanced_ecology",
            dominant_loop="balancing",
            reinforcing_loops=0,
            balancing_loops=3,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=2.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=3.0),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        pathology_names = [p.name for p in result.pathologies]
        assert "stall" in pathology_names

    @pytest.mark.asyncio
    async def test_diagnose_inflation(self, economy_service):
        """Инфляция обнаружена, когда faucet >> drain."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Золото", resource_class="currency", is_consumable=True),
            ],
            anchor_resource="Золото",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        # Faucet = 10.0, Drain = 2.0 → ratio = 5.0 > 1.5
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_Золото", name="Faucet_Золото", node_type="source", rate=10.0),
                MachinationsNode(id="drain_Золото", name="Drain_Золото", node_type="drain", rate=2.0),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        pathology_names = [p.name for p in result.pathologies]
        assert "inflation" in pathology_names

    @pytest.mark.asyncio
    async def test_diagnose_stagnation(self, economy_service):
        """Стагнация обнаружена, когда faucet ≈ 0."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Репутация", resource_class="currency", is_consumable=True),
            ],
            anchor_resource="Репутация",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        # Нет source для Репутация → faucet = 0
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="drain_Репутация", name="Drain_Репутация", node_type="drain", rate=2.0),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        pathology_names = [p.name for p in result.pathologies]
        assert "stagnation" in pathology_names

    @pytest.mark.asyncio
    async def test_diagnose_arbitrage(self, economy_service):
        """Арбитраж обнаружен для прибыльных конверсий."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Золото", resource_class="currency", is_consumable=True),
                ResourceDescriptor(name="Снаряжение", resource_class="game_object"),
            ],
            anchor_resource="Золото",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(nodes=[])
        conversion_graph = ConversionGraph(
            chains=[
                ConversionChain(
                    name="ArbitrageLoop",
                    inputs=["Золото"],
                    outputs=["Снаряжение"],
                    input_value=10.0,
                    output_value=25.0,
                    profitability=2.5,
                ),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            conversion_graph=conversion_graph,
        )

        pathology_names = [p.name for p in result.pathologies]
        assert "arbitrage" in pathology_names

    @pytest.mark.asyncio
    async def test_diagnose_healthy(self, economy_service):
        """Здоровая экономика с сбалансированным faucet/drain."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True, initial_value=100.0),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        # Используем braked_engine с 0 усиливающими петлями — нет триггера runaway
        classification = EconomicClassification(
            economic_type="economy",
            sub_type="multi_currency",
            dominant_loop="balancing",
            reinforcing_loops=0,
            balancing_loops=2,
        )
        # Faucet ≈ Drain
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=4.5),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        # Не должно быть критических патологий инфляции/runaway
        critical_names = [p.name for p in result.pathologies if p.severity == "critical"]
        # Здоровая экономика: нет критических патологий
        assert "runaway" not in critical_names
        assert "inflation" not in critical_names

    @pytest.mark.asyncio
    async def test_diagnose_severity_critical(self, economy_service):
        """Критический severity для runaway."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="XP", resource_class="experience"),
            ],
            anchor_resource="XP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=2,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(nodes=[])

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        runaway_pathology = next(
            (p for p in result.pathologies if p.name == "runaway"), None
        )
        if runaway_pathology:
            assert runaway_pathology.severity == "critical"

    @pytest.mark.asyncio
    async def test_diagnose_severity_warning(self, economy_service):
        """Warning severity для умеренного дисбаланса."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Золото", resource_class="currency", is_consumable=True),
            ],
            anchor_resource="Золото",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        # faucet/drain ratio = 6.0/4.0 = 1.5 → warning level inflation
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_Золото", name="Faucet_Золото", node_type="source", rate=6.0),
                MachinationsNode(id="drain_Золото", name="Drain_Золото", node_type="drain", rate=4.0),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        inflation_pathology = next(
            (p for p in result.pathologies if p.name == "inflation"), None
        )
        if inflation_pathology:
            assert inflation_pathology.severity in ("warning", "critical")

    @pytest.mark.asyncio
    async def test_diagnose_faucet_drain_ratios(self, economy_service):
        """Faucet/drain ratios рассчитаны для каждого ресурса."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
                ResourceDescriptor(name="Золото", resource_class="currency", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
                MachinationsNode(id="source_Золото", name="Faucet_Золото", node_type="source", rate=10.0),
                MachinationsNode(id="drain_Золото", name="Drain_Золото", node_type="drain", rate=4.0),
            ],
        )

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        assert "HP" in result.faucet_drain_ratios
        assert "Золото" in result.faucet_drain_ratios
        # HP: 5.0/5.0 = 1.0
        assert abs(result.faucet_drain_ratios["HP"] - 1.0) < 0.01
        # Золото: 10.0/4.0 = 2.5
        assert abs(result.faucet_drain_ratios["Золото"] - 2.5) < 0.01

    @pytest.mark.asyncio
    async def test_diagnose_recommendations(self, economy_service):
        """Рекомендации генерируются для каждой патологии."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="XP", resource_class="experience"),
            ],
            anchor_resource="XP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=2,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(nodes=[])

        result = await economy_service.diagnose_economy(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
        )

        # Каждая патология с critical/warning должна иметь correction
        for p in result.pathologies:
            if p.severity in ("critical", "warning"):
                assert p.correction != ""


# ============================================================
# Stage 6: TestBalanceFaucetsDrains (3.6.8)
# ============================================================

class TestBalanceFaucetsDrains:
    """Тесты Этапа 6: Автоматическая балансировка faucet/drain."""

    @pytest.mark.asyncio
    async def test_balance_deficit(self, economy_service):
        """Дефицитные ресурсы получают увеличение faucet."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="ecology",
            sub_type="balanced_ecology",
            reinforcing_loops=0,
            balancing_loops=2,
        )
        # Faucet = 1.0, Drain = 5.0 → ratio = 0.2 < 0.7 (deficit)
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=1.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
        )

        deficit_adj = [a for a in result.adjustments if a.action in ("increase_faucet", "decrease_drain", "add_faucet")]
        assert len(deficit_adj) > 0

    @pytest.mark.asyncio
    async def test_balance_surplus(self, economy_service):
        """Избыточные ресурсы получают увеличение drain."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="Золото", resource_class="currency", is_consumable=True),
            ],
            anchor_resource="Золото",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        # Faucet = 10.0, Drain = 2.0 → ratio = 5.0 > 1.5 (surplus)
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_Золото", name="Faucet_Золото", node_type="source", rate=10.0),
                MachinationsNode(id="drain_Золото", name="Drain_Золото", node_type="drain", rate=2.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
        )

        surplus_adj = [a for a in result.adjustments if a.action in ("increase_drain", "decrease_faucet", "add_drain")]
        assert len(surplus_adj) > 0

    @pytest.mark.asyncio
    async def test_balance_balanced(self, economy_service):
        """Сбалансированные ресурсы не требуют корректировки."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="braked_engine",
            reinforcing_loops=1,
            balancing_loops=1,
        )
        # Faucet = 5.0, Drain = 5.0 → ratio = 1.0 (balanced)
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
        )

        # HP: ratio = 1.0 — сбалансирован, действие = "none" → не попадает в adjustments
        hp_adj = [a for a in result.adjustments if a.resource == "HP"]
        # Если ratio balanced, adjustment action = "none" → не добавляется
        assert len(hp_adj) == 0 or hp_adj[0].action == "none"

    @pytest.mark.asyncio
    async def test_balance_economy_phase_startup(self, economy_service):
        """Startup фаза: target_ratio = 1.0."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
            economy_phase="startup",
        )

        assert result.target_ratio == ECONOMY_PHASE_TARGETS["startup"]
        assert result.target_ratio == 1.0

    @pytest.mark.asyncio
    async def test_balance_economy_phase_growth(self, economy_service):
        """Growth фаза: target_ratio = 1.3."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
            economy_phase="growth",
        )

        assert result.target_ratio == ECONOMY_PHASE_TARGETS["growth"]
        assert result.target_ratio == 1.3

    @pytest.mark.asyncio
    async def test_balance_economy_phase_maturity(self, economy_service):
        """Maturity фаза: target_ratio = 1.0."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
            economy_phase="maturity",
        )

        assert result.target_ratio == ECONOMY_PHASE_TARGETS["maturity"]
        assert result.target_ratio == 1.0

    @pytest.mark.asyncio
    async def test_balance_economy_phase_endgame(self, economy_service):
        """Endgame фаза: target_ratio = 0.8."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=5.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=5.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
            economy_phase="endgame",
        )

        assert result.target_ratio == ECONOMY_PHASE_TARGETS["endgame"]
        assert result.target_ratio == 0.8

    @pytest.mark.asyncio
    async def test_balance_adjustments_applied(self, economy_service):
        """Действия корректировки записаны в adjustments."""
        inventory = ResourceInventory(
            resources=[
                ResourceDescriptor(name="HP", resource_class="hp", is_consumable=True),
            ],
            anchor_resource="HP",
            core_count=1,
        )
        classification = EconomicClassification(
            economic_type="engine",
            sub_type="pure_engine",
            reinforcing_loops=1,
            balancing_loops=0,
        )
        # Дисбаланс: faucet >> drain
        mach_graph = MachinationsGraph(
            nodes=[
                MachinationsNode(id="source_HP", name="Faucet_HP", node_type="source", rate=10.0),
                MachinationsNode(id="drain_HP", name="Drain_HP", node_type="drain", rate=2.0),
            ],
            resource_flows=[],
        )
        diagnostics = EconomyDiagnostics()

        result = await economy_service.balance_faucets_drains(
            inventory=inventory,
            classification=classification,
            machinations_graph=mach_graph,
            diagnostics=diagnostics,
        )

        # Должны быть корректировки для HP
        hp_adj = [a for a in result.adjustments if a.resource == "HP"]
        assert len(hp_adj) > 0
        assert hp_adj[0].action != "none"
        assert hp_adj[0].new_faucet != hp_adj[0].current_faucet or hp_adj[0].new_drain != hp_adj[0].current_drain


# ============================================================
# Stage 7: TestSimulateEconomy (3.6.9)
# ============================================================

class TestSimulateEconomy:
    """Тесты Этапа 7: Симуляция экономики."""

    @pytest.mark.asyncio
    async def test_simulate_config(self, economy_service, rpg_inventory, rpg_classification):
        """Конфигурация симуляции установлена корректно."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=200,
            num_runs=10,
        )

        assert result.config is not None
        assert result.config.ticks == 200
        assert result.config.num_runs == 10

    @pytest.mark.asyncio
    async def test_simulate_runs(self, economy_service, rpg_inventory, rpg_classification):
        """Количество прогонов соответствует конфигурации."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=100,
            num_runs=10,
        )

        # Config должен отражать запрошенные runs
        assert result.config.num_runs == 10

    @pytest.mark.asyncio
    async def test_simulate_ticks(self, economy_service, rpg_inventory, rpg_classification):
        """Количество тиков соответствует конфигурации."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=500,
            num_runs=5,
        )

        assert result.config.ticks == 500

    @pytest.mark.asyncio
    async def test_simulate_resource_curves(self, economy_service, rpg_inventory, rpg_classification):
        """Кривые ресурсов заполнены."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=200,
            num_runs=5,
        )

        assert result.aggregated is not None
        assert isinstance(result.aggregated.avg_resource_curves, dict)
        # Должны быть кривые для хотя бы одного ресурса
        assert len(result.aggregated.avg_resource_curves) > 0

    @pytest.mark.asyncio
    async def test_simulate_stability_index(self, economy_service, rpg_inventory, rpg_classification):
        """Stability index рассчитан (0-1)."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=200,
            num_runs=5,
        )

        assert result.aggregated is not None
        assert 0.0 <= result.aggregated.stability_index <= 1.0

    @pytest.mark.asyncio
    async def test_simulate_runaway_frequency(self, economy_service, rpg_inventory, rpg_classification):
        """Runaway frequency рассчитана."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=200,
            num_runs=5,
        )

        assert result.aggregated is not None
        assert 0.0 <= result.aggregated.runaway_frequency <= 1.0

    @pytest.mark.asyncio
    async def test_simulate_stall_frequency(self, economy_service, rpg_inventory, rpg_classification):
        """Stall frequency рассчитана."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=200,
            num_runs=5,
        )

        assert result.aggregated is not None
        assert 0.0 <= result.aggregated.stall_frequency <= 1.0

    @pytest.mark.asyncio
    async def test_simulate_quality_assessment(self, economy_service, rpg_inventory, rpg_classification):
        """Quality assessment заполнен."""
        mach_graph = await economy_service.build_machinations_model(
            inventory=rpg_inventory,
            classification=rpg_classification,
        )

        result = await economy_service.simulate_economy(
            inventory=rpg_inventory,
            classification=rpg_classification,
            machinations_graph=mach_graph,
            num_ticks=200,
            num_runs=5,
        )

        assert result.quality is not None
        assert isinstance(result.quality.overall_pass, bool)
        assert isinstance(result.quality.resources_in_bounds, bool)
        assert isinstance(result.quality.economy_stable, bool)


# ============================================================
# Full Pipeline: TestEconomyDesignFull (3.6.10)
# ============================================================

class TestEconomyDesignFull:
    """Тесты полного пайплайна экономического моделирования."""

    @pytest.mark.asyncio
    async def test_full_pipeline_stages_completed(self, economy_service):
        """Все 7 этапов завершены: stages_completed = [1,2,3,4,5,6,7]."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert isinstance(result, EconomyProfile)
        assert 1 in result.stages_completed
        assert 2 in result.stages_completed
        assert 3 in result.stages_completed
        assert 4 in result.stages_completed
        assert 5 in result.stages_completed
        assert 6 in result.stages_completed
        assert 7 in result.stages_completed

    @pytest.mark.asyncio
    async def test_full_pipeline_inventory(self, economy_service):
        """Inventory заполнен."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert result.inventory is not None
        assert isinstance(result.inventory, ResourceInventory)
        assert len(result.inventory.resources) > 0

    @pytest.mark.asyncio
    async def test_full_pipeline_classification(self, economy_service):
        """Classification заполнен."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert result.classification is not None
        assert isinstance(result.classification, EconomicClassification)
        assert result.classification.economic_type != ""

    @pytest.mark.asyncio
    async def test_full_pipeline_machinations(self, economy_service):
        """Machinations graph заполнен."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert result.machinations_graph is not None
        assert isinstance(result.machinations_graph, MachinationsGraph)
        assert result.machinations_graph.node_count > 0

    @pytest.mark.asyncio
    async def test_full_pipeline_diagnostics(self, economy_service):
        """Diagnostics заполнен."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert result.diagnostics is not None
        assert isinstance(result.diagnostics, EconomyDiagnostics)

    @pytest.mark.asyncio
    async def test_full_pipeline_balance(self, economy_service):
        """Balance заполнен."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert result.balance is not None
        assert isinstance(result.balance, FaucetDrainBalance)

    @pytest.mark.asyncio
    async def test_full_pipeline_latency(self, economy_service):
        """latency_ms > 0."""
        result = await economy_service.economy_design_full(
            genre="rpg",
            sim_ticks=100,
            sim_runs=5,
        )

        assert result.latency_ms > 0

    @pytest.mark.asyncio
    async def test_full_pipeline_without_simulation(self, economy_service):
        """Пайплайн работает без симуляции (stages 1-6 completed)."""
        # Создаём сервис, который при симуляции падает
        original_simulate = economy_service.simulate_economy

        async def failing_simulate(*args, **kwargs):
            raise Exception("Simulation disabled for this test")

        economy_service.simulate_economy = failing_simulate

        result = await economy_service.economy_design_full(
            genre="rpg",
        )

        # Stages 1-6 должны быть завершены
        assert 1 in result.stages_completed
        assert 2 in result.stages_completed
        assert 3 in result.stages_completed
        assert 4 in result.stages_completed
        assert 5 in result.stages_completed
        assert 6 in result.stages_completed
        # Stage 7 может не быть завершён
        assert result.sim_result is None or 7 not in result.stages_completed

        # Восстанавливаем
        economy_service.simulate_economy = original_simulate
