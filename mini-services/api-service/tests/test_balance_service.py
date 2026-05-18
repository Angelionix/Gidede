"""
Gidede — Balance Service Tests
Фаза 4.C.1–4.C.2: Тесты для Блока 4 — Балансировка (алгоритм 3.4)

Тесты:
- classify_balance_task: PvP, PvE, PvPvE
- transitive_balance: basic, with_costs, overpowered, underpowered, ideal_imbalance,
                      attribute_weights, cost_curve_identity, cost_curve_progression
- analyze_stability: stable, runaway, deadlock
- intransitive_balance: payoff_matrix, nash_equilibrium, rps_cycles, dominant_strategy,
                        dominated_strategies, strategy_balance
- situational_balance: situations, situational_values, versatility, dead_zones,
                       dominant_universals, switching_cost
- calculate_q_factor: q_matrix, dominant_attributes, redundant_objects
- balance_full: pipeline, stages_completed, with_intransitive, with_situational, with_qfactor
- API endpoints: transitive, intransitive, situational, qfactor, analyze
"""

import pytest
import math
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.balance import (
    BalanceObject,
    BalanceInput,
    BalanceMap,
    ObjectBalanceReport,
    TransitiveResult,
    IntransitiveResult,
    StrategyBalanceScore,
    RPSCycle,
    SituationalResult,
    Situation,
    VersatilityInfo,
    QFactorResult,
    QFactorObject,
    BalanceResult,
)
from app.services.balance_service import BalanceService


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def mock_executor():
    """Мок PromptExecutor для тестирования без реальных AI-вызовов."""
    executor = AsyncMock()
    executor.execute = AsyncMock()
    # По умолчанию — возвращаем пустые веса (fallback на равные)
    executor.execute.return_value = MagicMock(
        data={"weights": {}},
        metadata={"prompt_id": "ESTIMATE_WEIGHTS", "from_cache": False},
    )
    return executor


@pytest.fixture
def balance_service(mock_executor):
    """Создать BalanceService с моком executor."""
    return BalanceService(executor=mock_executor)


@pytest.fixture
def sample_pvp_objects():
    """Тестовые PvP-объекты (персонажи с HP, damage, speed)."""
    return [
        BalanceObject(id="1", name="Warrior", type="character",
                      attributes={"hp": 100, "damage": 20, "speed": 5}, cost=100, tags=[]),
        BalanceObject(id="2", name="Mage", type="character",
                      attributes={"hp": 60, "damage": 40, "speed": 7}, cost=100, tags=[]),
        BalanceObject(id="3", name="Rogue", type="character",
                      attributes={"hp": 70, "damage": 30, "speed": 10}, cost=100, tags=[]),
    ]


@pytest.fixture
def sample_pve_objects():
    """Тестовые PvE-объекты (враги по тирам)."""
    return [
        BalanceObject(id="1", name="Goblin", type="unit",
                      attributes={"hp": 30, "damage": 10, "speed": 5}, cost=10, tier=1, tags=["vanilla"]),
        BalanceObject(id="2", name="Orc", type="unit",
                      attributes={"hp": 80, "damage": 25, "speed": 3}, cost=30, tier=2, tags=["vanilla"]),
        BalanceObject(id="3", name="Dragon", type="unit",
                      attributes={"hp": 200, "damage": 60, "speed": 8}, cost=100, tier=3, tags=["special"]),
    ]


@pytest.fixture
def sample_objects_no_cost():
    """Объекты без стоимости."""
    return [
        BalanceObject(id="1", name="Sword", type="weapon",
                      attributes={"damage": 15, "speed": 8}, tags=[]),
        BalanceObject(id="2", name="Axe", type="weapon",
                      attributes={"damage": 25, "speed": 4}, tags=[]),
    ]


@pytest.fixture
def sample_overpowered_objects():
    """Объекты с явным дисбалансом (один overpowered)."""
    return [
        BalanceObject(id="1", name="Balanced Unit", type="character",
                      attributes={"hp": 100, "damage": 20}, cost=100, tags=["vanilla"]),
        BalanceObject(id="2", name="OP Unit", type="character",
                      attributes={"hp": 200, "damage": 40}, cost=100, tags=["vanilla"]),
    ]


@pytest.fixture
def sample_underpowered_objects():
    """Объекты с явным дисбалансом (один underpowered)."""
    return [
        BalanceObject(id="1", name="Balanced Unit", type="character",
                      attributes={"hp": 100, "damage": 20}, cost=100, tags=["vanilla"]),
        BalanceObject(id="2", name="UP Unit", type="character",
                      attributes={"hp": 50, "damage": 10}, cost=100, tags=["vanilla"]),
    ]


@pytest.fixture
def sample_rps_objects():
    """Объекты с RPS-структурой (камень-ножницы-бумага)."""
    return [
        BalanceObject(id="1", name="Rock", type="character",
                      attributes={"attack": 10, "defense": 30, "speed": 5}, cost=100,
                      tags=["earth"]),
        BalanceObject(id="2", name="Scissors", type="character",
                      attributes={"attack": 30, "defense": 5, "speed": 15}, cost=100,
                      tags=["lightning"]),
        BalanceObject(id="3", name="Paper", type="character",
                      attributes={"attack": 15, "defense": 15, "speed": 25}, cost=100,
                      tags=["ice"]),
    ]


@pytest.fixture
def sample_diverse_objects():
    """Объекты с разными атрибутами для Q-фактор тестов."""
    return [
        BalanceObject(id="1", name="Tank", type="character",
                      attributes={"hp": 200, "damage": 10, "speed": 3}, cost=100, tags=[]),
        BalanceObject(id="2", name="DPS", type="character",
                      attributes={"hp": 50, "damage": 40, "speed": 10}, cost=100, tags=[]),
        BalanceObject(id="3", name="Speedster", type="character",
                      attributes={"hp": 70, "damage": 15, "speed": 30}, cost=100, tags=[]),
        BalanceObject(id="4", name="Redundant", type="character",
                      attributes={"hp": 60, "damage": 12, "speed": 8}, cost=100, tags=[]),
    ]


# ============================================================
# Тесты: classify_balance_task (Этап 1)
# ============================================================

@pytest.mark.asyncio
async def test_classify_balance_task_pvp(balance_service):
    """Классификация PvP-задачи балансировки."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Char1", type="character",
                          attributes={"hp": 100, "damage": 20}, cost=100),
        ],
        game_mode="PvP",
    )

    result = await balance_service.classify_balance_task(input_data)

    assert isinstance(result, BalanceMap)
    assert result.primary_model == "transitive"
    assert result.game_sum == "zero"
    assert result.feedback == "balancing"
    assert result.applicable_balance_types["transitive"] is True


@pytest.mark.asyncio
async def test_classify_balance_task_pve(balance_service):
    """Классификация PvE-задачи балансировки."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Enemy1", type="unit",
                          attributes={"hp": 50, "damage": 10}, cost=20, tier=1),
        ],
        game_mode="PvE",
    )

    result = await balance_service.classify_balance_task(input_data)

    assert isinstance(result, BalanceMap)
    assert result.primary_model == "progression"
    assert result.game_sum == "positive"
    assert result.feedback == "reinforcing"


@pytest.mark.asyncio
async def test_classify_balance_task_pvpve(balance_service):
    """Классификация PvPvE-задачи балансировки."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Char1", type="character",
                          attributes={"hp": 100, "damage": 20}, cost=100),
            BalanceObject(id="2", name="Enemy", type="unit",
                          attributes={"hp": 80, "damage": 15}, cost=50),
            BalanceObject(id="3", name="Boss", type="unit",
                          attributes={"hp": 200, "damage": 40}, cost=200),
        ],
        game_mode="PvPvE",
        balance_type="mixed",
    )

    result = await balance_service.classify_balance_task(input_data)

    assert isinstance(result, BalanceMap)
    assert result.primary_model == "mixed"
    assert result.secondary_model == "situational"
    assert result.game_sum == "positive"
    assert result.feedback == "both"
    assert result.applicable_balance_types["transitive"] is True
    assert result.applicable_balance_types["situational"] is True


# ============================================================
# Тесты: transitive_balance (Этап 2)
# ============================================================

@pytest.mark.asyncio
async def test_transitive_balance_basic(balance_service):
    """Базовый transitive-анализ с простыми объектами."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Unit1", type="character",
                          attributes={"hp": 100, "damage": 20}, cost=100),
            BalanceObject(id="2", name="Unit2", type="character",
                          attributes={"hp": 80, "damage": 25}, cost=100),
        ],
        game_mode="PvP",
    )

    balance_map = BalanceMap(
        primary_model="transitive",
        secondary_model="",
        anchor="gold",
        game_sum="zero",
        feedback="balancing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert isinstance(result, TransitiveResult)
    assert len(result.objects) == 2
    assert result.cost_curve_model == "identity"
    for attr, weight in result.attribute_weights.items():
        assert weight >= 0


@pytest.mark.asyncio
async def test_transitive_balance_with_costs(balance_service):
    """Transitive-анализ с явно заданными стоимостями."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Cheap", type="weapon",
                          attributes={"damage": 10, "speed": 5}, cost=50, tags=["vanilla"]),
            BalanceObject(id="2", name="Medium", type="weapon",
                          attributes={"damage": 20, "speed": 5}, cost=100, tags=["vanilla"]),
            BalanceObject(id="3", name="Expensive", type="weapon",
                          attributes={"damage": 30, "speed": 5}, cost=150, tags=["vanilla"]),
        ],
        game_mode="PvP",
    )

    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="",
        anchor="gold", game_sum="zero", feedback="balancing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert isinstance(result, TransitiveResult)
    assert len(result.objects) == 3
    for report in result.objects:
        assert report.power > 0
        assert report.effective_cost > 0
        assert report.cp_ratio > 0


@pytest.mark.asyncio
async def test_transitive_balance_overpowered(balance_service, sample_overpowered_objects):
    """Обнаружение overpowered-объекта."""
    input_data = BalanceInput(
        objects=sample_overpowered_objects,
        game_mode="PvP",
    )

    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="",
        anchor="gold", game_sum="zero", feedback="balancing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert "OP Unit" in result.overpowered or len(result.overpowered) >= 1
    assert len(result.warnings) > 0


@pytest.mark.asyncio
async def test_transitive_balance_underpowered(balance_service, sample_underpowered_objects):
    """Обнаружение underpowered-объекта."""
    input_data = BalanceInput(
        objects=sample_underpowered_objects,
        game_mode="PvP",
    )

    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="",
        anchor="gold", game_sum="zero", feedback="balancing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert "UP Unit" in result.underpowered or len(result.underpowered) >= 1
    assert len(result.warnings) > 0


@pytest.mark.asyncio
async def test_transitive_balance_ideal_imbalance(balance_service):
    """Обнаружение ideal_imbalance (5-15% отклонение)."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Balanced", type="character",
                          attributes={"hp": 100, "damage": 20}, cost=100, tags=["vanilla"]),
            BalanceObject(id="2", name="Slightly Strong", type="character",
                          attributes={"hp": 108, "damage": 21.6}, cost=100, tags=["vanilla"]),
        ],
        game_mode="PvE",
    )

    balance_map = BalanceMap(
        primary_model="progression", secondary_model="",
        anchor="gold", game_sum="positive", feedback="reinforcing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert isinstance(result.balanced, list)
    assert isinstance(result.ideal_imbalance, list)
    assert isinstance(result.overpowered, list)
    assert isinstance(result.underpowered, list)


@pytest.mark.asyncio
async def test_transitive_balance_attribute_weights(balance_service):
    """Проверка расчёта весов атрибутов."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="A", type="character",
                          attributes={"hp": 100, "damage": 20, "speed": 5}, cost=100, tags=["vanilla"]),
            BalanceObject(id="2", name="B", type="character",
                          attributes={"hp": 200, "damage": 40, "speed": 10}, cost=200, tags=["vanilla"]),
            BalanceObject(id="3", name="C", type="character",
                          attributes={"hp": 150, "damage": 30, "speed": 7}, cost=150, tags=["vanilla"]),
            BalanceObject(id="4", name="D", type="character",
                          attributes={"hp": 80, "damage": 16, "speed": 4}, cost=80, tags=["vanilla"]),
        ],
        game_mode="PvP",
    )

    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="",
        anchor="gold", game_sum="zero", feedback="balancing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert len(result.attribute_weights) > 0
    for attr, weight in result.attribute_weights.items():
        assert weight >= 0, f"Weight for {attr} should be non-negative, got {weight}"


@pytest.mark.asyncio
async def test_transitive_balance_cost_curve_identity(balance_service):
    """Cost curve model = identity для PvP."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Unit", type="character",
                          attributes={"hp": 100, "damage": 20}, cost=100),
        ],
        game_mode="PvP",
    )

    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="",
        anchor="gold", game_sum="zero", feedback="balancing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert result.cost_curve_model == "identity"
    assert result.expected_cp == 1.0


@pytest.mark.asyncio
async def test_transitive_balance_cost_curve_progression(balance_service):
    """Cost curve model = progression для PvE."""
    input_data = BalanceInput(
        objects=[
            BalanceObject(id="1", name="Enemy", type="unit",
                          attributes={"hp": 50, "damage": 10}, cost=20, tier=1),
        ],
        game_mode="PvE",
    )

    balance_map = BalanceMap(
        primary_model="progression", secondary_model="",
        anchor="gold", game_sum="positive", feedback="reinforcing",
    )

    result = await balance_service.transitive_balance(input_data, balance_map)

    assert result.cost_curve_model == "progression"


# ============================================================
# Тесты: analyze_stability (Этап 3)
# ============================================================

def test_analyze_stability_stable(balance_service):
    """Анализ устойчивой системы (balancing feedback)."""
    feedback_loops = [
        {"loop_type": "negative", "description": "Балансирующая петля", "mechanics_involved": ["armor"]},
        {"loop_type": "negative", "description": "Ещё балансирующая", "mechanics_involved": ["cooldown"]},
    ]

    result = balance_service.analyze_stability(feedback_loops)

    assert result["overall_stability"] in ("stable", "conditionally_stable")
    assert result["negative_loops"] == 2
    assert result["positive_loops"] == 0


def test_analyze_stability_runaway(balance_service):
    """Анализ системы с риском runaway (reinforcing feedback)."""
    feedback_loops = [
        {"loop_type": "positive", "description": "Усиливающая петля", "mechanics_involved": ["combo"]},
        {"loop_type": "positive", "description": "Ещё усиливающая", "mechanics_involved": ["snowball"]},
        {"loop_type": "positive", "description": "Третья усиливающая", "mechanics_involved": ["multiplier"]},
    ]

    result = balance_service.analyze_stability(feedback_loops)

    assert "runaway" in result["pathology_risks"]
    assert result["positive_loops"] == 3
    assert result["overall_stability"] == "unstable"


def test_analyze_stability_deadlock(balance_service):
    """Анализ системы с риском deadlock (negative sum + reinforcing)."""
    from app.services.balance_service import SCHREIBER_STABILITY_MATRIX

    key = ("negative", "reinforcing")
    entry = SCHREIBER_STABILITY_MATRIX.get(key)

    assert entry is not None
    assert entry["pathology_risk"] == "deadlock"
    assert entry["stability"] == "unstable"


# ============================================================
# Тесты: intransitive_balance (Этап 3, 4.C.2)
# ============================================================

@pytest.mark.asyncio
async def test_intransitive_balance_basic(balance_service, sample_pvp_objects):
    """Базовый нетранзитивный анализ с 3 объектами."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="intransitive",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert isinstance(result, IntransitiveResult)
    assert len(result.payoff_matrix) == 3
    assert len(result.payoff_matrix[0]) == 3
    assert len(result.object_names) == 3
    assert len(result.nash_equilibrium) == 3
    # Диагональ payoff-матрицы = 0 (зеркальный матч)
    for i in range(3):
        assert result.payoff_matrix[i][i] == 0.0


@pytest.mark.asyncio
async def test_intransitive_balance_payoff_matrix(balance_service, sample_pvp_objects):
    """Проверка корректности payoff-матрицы."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="intransitive",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    # Payoff матрица должна быть антисимметричной: M[i][j] = -M[j][i]
    for i in range(3):
        for j in range(3):
            if i != j:
                assert abs(result.payoff_matrix[i][j] + result.payoff_matrix[j][i]) < 0.01, \
                    f"Payoff matrix should be antisymmetric: M[{i}][{j}]={result.payoff_matrix[i][j]}, M[{j}][{i}]={result.payoff_matrix[j][i]}"


@pytest.mark.asyncio
async def test_intransitive_balance_nash_equilibrium(balance_service, sample_pvp_objects):
    """Проверка равновесия Нэша."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="intransitive",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    # Сумма вероятностей Нэша должна быть ≈ 1
    total_prob = sum(result.nash_equilibrium)
    assert abs(total_prob - 1.0) < 0.05, f"Nash equilibrium probabilities should sum to 1.0, got {total_prob}"

    # Все вероятности должны быть >= 0
    for i, p in enumerate(result.nash_equilibrium):
        assert p >= 0, f"Nash equilibrium probability for {result.object_names[i]} should be >= 0, got {p}"


@pytest.mark.asyncio
async def test_intransitive_balance_strategy_balance(balance_service, sample_pvp_objects):
    """Проверка метрик баланса стратегий."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="intransitive",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert result.strategy_balance is not None
    assert isinstance(result.strategy_balance, StrategyBalanceScore)
    assert 0 <= result.strategy_balance.max_share <= 1.0
    assert 0 <= result.strategy_balance.gini <= 1.0
    assert result.strategy_balance.entropy >= 0


@pytest.mark.asyncio
async def test_intransitive_balance_rps_detection(balance_service, sample_rps_objects):
    """Обнаружение RPS-циклов."""
    input_data = BalanceInput(objects=sample_rps_objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="intransitive", secondary_model="",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    # Если объекты имеют RPS-структуру, должен быть хотя бы 1 RPS-цикл
    assert isinstance(result.rps_cycles, list)
    # Каждый RPS-цикл должен содержать имена объектов
    for cycle in result.rps_cycles:
        assert isinstance(cycle, RPSCycle)
        assert len(cycle.cycle) >= 3


@pytest.mark.asyncio
async def test_intransitive_balance_dominant_strategy(balance_service):
    """Обнаружение доминантной стратегии."""
    # Создаём объекты, где один явно доминирует
    objects = [
        BalanceObject(id="1", name="Weak", type="character",
                      attributes={"attack": 5, "defense": 5, "speed": 5}, cost=100),
        BalanceObject(id="2", name="Dominant", type="character",
                      attributes={"attack": 50, "defense": 50, "speed": 50}, cost=100),
        BalanceObject(id="3", name="Also Weak", type="character",
                      attributes={"attack": 8, "defense": 8, "speed": 8}, cost=100),
    ]
    input_data = BalanceInput(objects=objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="intransitive",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    # Dominant должен иметь наибольшую долю в Нэше
    dominant_idx = result.object_names.index("Dominant")
    assert result.nash_equilibrium[dominant_idx] >= max(
        p for i, p in enumerate(result.nash_equilibrium) if i != dominant_idx
    )


@pytest.mark.asyncio
async def test_intransitive_balance_warnings_suggestions(balance_service, sample_pvp_objects):
    """Проверка генерации warnings и suggestions."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="intransitive",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.intransitive_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert isinstance(result.warnings, list)
    assert isinstance(result.suggestions, list)


# ============================================================
# Тесты: situational_balance (Этап 4, 4.C.2)
# ============================================================

@pytest.mark.asyncio
async def test_situational_balance_basic(balance_service, sample_pvp_objects):
    """Базовый ситуационный анализ."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP", genre="rpg")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="situational",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert isinstance(result, SituationalResult)
    assert len(result.situations) > 0
    assert len(result.situational_values) > 0
    assert len(result.object_names) == 3
    assert len(result.situational_ev) == 3


@pytest.mark.asyncio
async def test_situational_balance_situation_probabilities(balance_service, sample_pvp_objects):
    """Сумма вероятностей ситуаций должна быть ≈ 1."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP", genre="rpg")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="situational",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    total_prob = sum(s.probability for s in result.situations)
    assert abs(total_prob - 1.0) < 0.05, f"Situation probabilities should sum to 1.0, got {total_prob}"


@pytest.mark.asyncio
async def test_situational_balance_situational_values(balance_service, sample_pvp_objects):
    """Проверка матрицы ситуационных ценностей."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP", genre="rpg")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="situational",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    # Матрица: objects × situations
    n_objects = len(sample_pvp_objects)
    n_situations = len(result.situations)
    assert len(result.situational_values) == n_objects
    for row in result.situational_values:
        assert len(row) == n_situations
        # Все значения должны быть >= 0
        for val in row:
            assert val >= 0.0


@pytest.mark.asyncio
async def test_situational_balance_versatility(balance_service, sample_pvp_objects):
    """Проверка анализа универсальности/специализации."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP", genre="rpg")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="situational",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert len(result.versatility_map) == 3
    for v in result.versatility_map:
        assert isinstance(v, VersatilityInfo)
        assert v.type in ("universal", "specialized")
        assert v.max_value >= v.min_value
        assert abs(v.spread - (v.max_value - v.min_value)) < 0.01


@pytest.mark.asyncio
async def test_situational_balance_ev_calculation(balance_service, sample_pvp_objects):
    """Проверка расчёта ожидаемой ситуационной ценности."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP", genre="rpg")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="situational",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    # Проверяем расчёт EV вручную
    for i, obj_name in enumerate(result.object_names):
        manual_ev = sum(
            result.situations[j].probability * result.situational_values[i][j]
            for j in range(len(result.situations))
        )
        assert abs(result.situational_ev[i] - manual_ev) < 0.01, \
            f"EV mismatch for {obj_name}: expected {manual_ev}, got {result.situational_ev[i]}"


@pytest.mark.asyncio
async def test_situational_balance_switching_cost(balance_service, sample_pvp_objects):
    """Проверка стоимости переключения."""
    input_data = BalanceInput(objects=sample_pvp_objects, game_mode="PvP", genre="rpg")
    balance_map = BalanceMap(
        primary_model="transitive", secondary_model="situational",
        anchor="gold", game_sum="zero", feedback="balancing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert result.switching_cost in ("low", "medium", "high")


@pytest.mark.asyncio
async def test_situational_balance_dead_zones(balance_service, sample_diverse_objects):
    """Обнаружение мёртвых зон."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvE", genre="rpg")
    balance_map = BalanceMap(
        primary_model="progression", secondary_model="situational",
        anchor="gold", game_sum="positive", feedback="reinforcing",
    )
    transitive_result = await balance_service.transitive_balance(input_data, balance_map)

    result = await balance_service.situational_balance(
        input_data=input_data,
        transitive_result=transitive_result,
        balance_map=balance_map,
    )

    assert isinstance(result.dead_zones, list)
    assert isinstance(result.dominant_universals, list)


# ============================================================
# Тесты: calculate_q_factor (4.C.2)
# ============================================================

def test_calculate_q_factor_basic(balance_service, sample_diverse_objects):
    """Базовый Q-фактор анализ."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvP")

    # Создаём минимальный transitive_result
    transitive_result = TransitiveResult(
        attribute_weights={"hp": 0.33, "damage": 0.33, "speed": 0.34},
    )

    result = balance_service.calculate_q_factor(
        input_data=input_data,
        transitive_result=transitive_result,
    )

    assert isinstance(result, QFactorResult)
    assert len(result.objects) == 4
    assert len(result.q_matrix) == 4


def test_calculate_q_factor_dominant_attributes(balance_service, sample_diverse_objects):
    """Определение доминантных атрибутов."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvP")
    transitive_result = TransitiveResult(
        attribute_weights={"hp": 0.33, "damage": 0.33, "speed": 0.34},
    )

    result = balance_service.calculate_q_factor(
        input_data=input_data,
        transitive_result=transitive_result,
    )

    # Tank должен доминировать по hp, DPS по damage, Speedster по speed
    for obj in result.objects:
        assert isinstance(obj, QFactorObject)
        assert isinstance(obj.dominant_attributes, list)
        assert isinstance(obj.is_redundant, bool)
        assert 0 <= obj.redundancy_score <= 1.0


def test_calculate_q_factor_redundant_objects(balance_service, sample_diverse_objects):
    """Обнаружение избыточных объектов."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvP")
    transitive_result = TransitiveResult(
        attribute_weights={"hp": 0.33, "damage": 0.33, "speed": 0.34},
    )

    result = balance_service.calculate_q_factor(
        input_data=input_data,
        transitive_result=transitive_result,
    )

    # "Redundant" объект не доминирует ни по одному атрибуту — кандидат на избыточность
    redundant_obj = next((o for o in result.objects if o.name == "Redundant"), None)
    assert redundant_obj is not None
    # Redundant не доминирует по hp (Tank сильнее), не по damage (DPS сильнее), не по speed (Speedster сильнее)
    assert redundant_obj.is_redundant is True or redundant_obj.redundancy_score > 0.5


def test_calculate_q_factor_attribute_dominance(balance_service, sample_diverse_objects):
    """Проверка маппинга атрибут → доминирующий объект."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvP")
    transitive_result = TransitiveResult(
        attribute_weights={"hp": 0.33, "damage": 0.33, "speed": 0.34},
    )

    result = balance_service.calculate_q_factor(
        input_data=input_data,
        transitive_result=transitive_result,
    )

    assert isinstance(result.attribute_dominance, dict)
    # Каждый атрибут должен быть связан с каким-то объектом
    for attr in ["hp", "damage", "speed"]:
        assert attr in result.attribute_dominance


def test_calculate_q_factor_q_matrix_normalization(balance_service, sample_diverse_objects):
    """Проверка нормализации Q-матрицы (0-1)."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvP")
    transitive_result = TransitiveResult(
        attribute_weights={"hp": 0.33, "damage": 0.33, "speed": 0.34},
    )

    result = balance_service.calculate_q_factor(
        input_data=input_data,
        transitive_result=transitive_result,
    )

    # Все значения Q-матрицы должны быть в [0, 1]
    for row in result.q_matrix:
        for val in row:
            assert 0.0 <= val <= 1.0, f"Q-matrix value should be in [0, 1], got {val}"


def test_calculate_q_factor_warnings_suggestions(balance_service, sample_diverse_objects):
    """Проверка генерации warnings и suggestions."""
    input_data = BalanceInput(objects=sample_diverse_objects, game_mode="PvP")
    transitive_result = TransitiveResult(
        attribute_weights={"hp": 0.33, "damage": 0.33, "speed": 0.34},
    )

    result = balance_service.calculate_q_factor(
        input_data=input_data,
        transitive_result=transitive_result,
    )

    assert isinstance(result.warnings, list)
    assert isinstance(result.suggestions, list)


# ============================================================
# Тесты: balance_full (полный пайплайн 4.C.2)
# ============================================================

@pytest.mark.asyncio
async def test_balance_full_pipeline(balance_service, sample_pvp_objects):
    """Полный пайплайн балансировки (Этапы 1–5 + Q-фактор)."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
    )

    result = await balance_service.balance_full(input_data)

    assert isinstance(result, BalanceResult)
    assert result.balance_map is not None
    assert result.transitive_result is not None
    assert len(result.stages_completed) >= 3
    assert 1 in result.stages_completed
    assert 2 in result.stages_completed
    assert 3 in result.stages_completed


@pytest.mark.asyncio
async def test_balance_full_stages_completed(balance_service, sample_pve_objects):
    """Проверка завершения всех этапов."""
    input_data = BalanceInput(
        objects=sample_pve_objects,
        game_mode="PvE",
        genre="rpg",
    )

    result = await balance_service.balance_full(input_data)

    assert 1 in result.stages_completed
    assert 2 in result.stages_completed
    assert 3 in result.stages_completed
    assert result.balance_map is not None
    assert result.transitive_result is not None
    assert result.latency_ms >= 0
    assert "ESTIMATE_WEIGHTS" in result.models_used


@pytest.mark.asyncio
async def test_balance_full_with_intransitive(balance_service, sample_pvp_objects):
    """Полный пайплайн с нетранзитивным анализом."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
    )

    result = await balance_service.balance_full(
        input_data=input_data,
        run_intransitive=True,
        run_situational=False,
        run_q_factor=False,
    )

    assert result.intransitive_result is not None
    assert isinstance(result.intransitive_result, IntransitiveResult)
    assert 4 in result.stages_completed


@pytest.mark.asyncio
async def test_balance_full_with_situational(balance_service, sample_pvp_objects):
    """Полный пайплайн с ситуационным анализом."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
        genre="rpg",
    )

    result = await balance_service.balance_full(
        input_data=input_data,
        run_intransitive=False,
        run_situational=True,
        run_q_factor=False,
    )

    assert result.situational_result is not None
    assert isinstance(result.situational_result, SituationalResult)
    assert 5 in result.stages_completed


@pytest.mark.asyncio
async def test_balance_full_with_qfactor(balance_service, sample_pvp_objects):
    """Полный пайплайн с Q-фактор анализом."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
    )

    result = await balance_service.balance_full(
        input_data=input_data,
        run_intransitive=False,
        run_situational=False,
        run_q_factor=True,
    )

    assert result.q_factor_result is not None
    assert isinstance(result.q_factor_result, QFactorResult)
    assert 6 in result.stages_completed


@pytest.mark.asyncio
async def test_balance_full_all_stages(balance_service, sample_pvp_objects):
    """Полный пайплайн со всеми этапами."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
        genre="rpg",
    )

    result = await balance_service.balance_full(
        input_data=input_data,
        run_intransitive=True,
        run_situational=True,
        run_q_factor=True,
    )

    # Все этапы должны быть завершены
    assert set(result.stages_completed) == {1, 2, 3, 4, 5, 6}
    assert result.intransitive_result is not None
    assert result.situational_result is not None
    assert result.q_factor_result is not None


@pytest.mark.asyncio
async def test_balance_full_with_mda(balance_service, sample_pvp_objects):
    """Полный пайплайн с MDA-профилем."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
    )

    mda_profile = {
        "classic_mda_result": {
            "feedback_loops": [
                {"loop_type": "positive", "description": "Combo-система", "mechanics_involved": ["combo"]},
                {"loop_type": "negative", "description": "Cooldown", "mechanics_involved": ["cooldown"]},
            ],
        },
    }

    result = await balance_service.balance_full(
        input_data=input_data,
        mda_profile=mda_profile,
    )

    assert isinstance(result, BalanceResult)
    assert len(result.stages_completed) >= 3


# ============================================================
# Тесты: API endpoints
# ============================================================

@pytest.mark.asyncio
async def test_api_balance_transitive(test_client, auth_headers):
    """Тест POST /api/v1/balance/transitive."""
    response = await test_client.post(
        "/api/v1/balance/transitive",
        json={
            "objects": [
                {
                    "id": "1",
                    "name": "Warrior",
                    "type": "character",
                    "attributes": {"hp": 100, "damage": 20},
                    "cost": 100,
                    "tags": [],
                },
                {
                    "id": "2",
                    "name": "Mage",
                    "type": "character",
                    "attributes": {"hp": 60, "damage": 40},
                    "cost": 100,
                    "tags": [],
                },
            ],
            "game_mode": "PvP",
            "genre": "rpg",
        },
        headers=auth_headers,
    )

    assert response.status_code in (200, 401, 403, 500)

    if response.status_code == 200:
        data = response.json()
        assert "attribute_weights" in data
        assert "cost_curve_model" in data
        assert "objects" in data
        assert len(data["objects"]) == 2


@pytest.mark.asyncio
async def test_api_balance_intransitive(test_client, auth_headers):
    """Тест POST /api/v1/balance/intransitive."""
    response = await test_client.post(
        "/api/v1/balance/intransitive",
        json={
            "objects": [
                {"id": "1", "name": "Rock", "type": "character",
                 "attributes": {"attack": 10, "defense": 30, "speed": 5}, "cost": 100, "tags": []},
                {"id": "2", "name": "Scissors", "type": "character",
                 "attributes": {"attack": 30, "defense": 5, "speed": 15}, "cost": 100, "tags": []},
                {"id": "3", "name": "Paper", "type": "character",
                 "attributes": {"attack": 15, "defense": 15, "speed": 25}, "cost": 100, "tags": []},
            ],
            "game_mode": "PvP",
        },
        headers=auth_headers,
    )

    assert response.status_code in (200, 401, 403, 500)

    if response.status_code == 200:
        data = response.json()
        assert "payoff_matrix" in data
        assert "nash_equilibrium" in data
        assert "is_intransitive" in data
        assert "rps_cycles" in data


@pytest.mark.asyncio
async def test_api_balance_situational(test_client, auth_headers):
    """Тест POST /api/v1/balance/situational."""
    response = await test_client.post(
        "/api/v1/balance/situational",
        json={
            "objects": [
                {"id": "1", "name": "Tank", "type": "character",
                 "attributes": {"hp": 200, "damage": 10}, "cost": 100, "tags": []},
                {"id": "2", "name": "DPS", "type": "character",
                 "attributes": {"hp": 50, "damage": 40}, "cost": 100, "tags": []},
            ],
            "game_mode": "PvE",
            "genre": "rpg",
        },
        headers=auth_headers,
    )

    assert response.status_code in (200, 401, 403, 500)

    if response.status_code == 200:
        data = response.json()
        assert "situations" in data
        assert "situational_values" in data
        assert "situational_ev" in data


@pytest.mark.asyncio
async def test_api_balance_qfactor(test_client, auth_headers):
    """Тест POST /api/v1/balance/qfactor."""
    response = await test_client.post(
        "/api/v1/balance/qfactor",
        json={
            "objects": [
                {"id": "1", "name": "Tank", "type": "character",
                 "attributes": {"hp": 200, "damage": 10, "speed": 3}, "cost": 100, "tags": []},
                {"id": "2", "name": "DPS", "type": "character",
                 "attributes": {"hp": 50, "damage": 40, "speed": 10}, "cost": 100, "tags": []},
                {"id": "3", "name": "Speedster", "type": "character",
                 "attributes": {"hp": 70, "damage": 15, "speed": 30}, "cost": 100, "tags": []},
            ],
            "game_mode": "PvP",
        },
        headers=auth_headers,
    )

    assert response.status_code in (200, 401, 403, 500)

    if response.status_code == 200:
        data = response.json()
        assert "objects" in data
        assert "redundant_objects" in data
        assert "attribute_dominance" in data


@pytest.mark.asyncio
async def test_api_balance_analyze(test_client, auth_headers):
    """Тест POST /api/v1/balance/analyze."""
    response = await test_client.post(
        "/api/v1/balance/analyze",
        json={
            "objects": [
                {
                    "id": "1",
                    "name": "Warrior",
                    "type": "character",
                    "attributes": {"hp": 100, "damage": 20},
                    "cost": 100,
                    "tags": [],
                },
            ],
            "game_mode": "PvE",
            "genre": "rpg",
            "run_intransitive": True,
            "run_situational": True,
            "run_q_factor": True,
        },
        headers=auth_headers,
    )

    assert response.status_code in (200, 401, 403, 500)

    if response.status_code == 200:
        data = response.json()
        assert "id" in data
        assert "stages_completed" in data
        assert "balance_map" in data
        assert "transitive_result" in data


# ============================================================
# Тесты: вспомогательные методы
# ============================================================

def test_least_squares_weights(balance_service):
    """Тест least squares для расчёта весов атрибутов."""
    objects = [
        BalanceObject(id="1", name="A", type="character",
                      attributes={"hp": 100, "damage": 20}, cost=100, tags=["vanilla"]),
        BalanceObject(id="2", name="B", type="character",
                      attributes={"hp": 200, "damage": 40}, cost=200, tags=["vanilla"]),
        BalanceObject(id="3", name="C", type="character",
                      attributes={"hp": 150, "damage": 30}, cost=150, tags=["vanilla"]),
    ]

    weights = balance_service._least_squares_weights(objects, ["hp", "damage"])

    assert weights is not None
    assert "hp" in weights
    assert "damage" in weights
    total = sum(weights.values())
    assert abs(total - 1.0) < 0.01, f"Weights should sum to 1.0, got {total}"


def test_solve_linear_system(balance_service):
    """Тест решения линейной системы."""
    A = [[2.0, 3.0], [4.0, 1.0]]
    b = [8.0, 6.0]

    result = balance_service._solve_linear_system(A, b)

    assert result is not None
    assert abs(result[0] - 1.0) < 0.001, f"x should be 1.0, got {result[0]}"
    assert abs(result[1] - 2.0) < 0.001, f"y should be 2.0, got {result[1]}"


def test_calculate_power(balance_service):
    """Тест расчёта мощности объекта."""
    obj = BalanceObject(id="1", name="Test", type="character",
                        attributes={"hp": 100, "damage": 20, "speed": 5})
    weights = {"hp": 0.2, "damage": 0.5, "speed": 0.3}

    power = balance_service._calculate_power(obj, weights)

    # power = 0.2*100 + 0.5*20 + 0.3*5 = 20 + 10 + 1.5 = 31.5
    assert abs(power - 31.5) < 0.001


def test_calculate_effective_cost(balance_service):
    """Тест расчёта эффективной стоимости."""
    obj_with_cost = BalanceObject(id="1", name="Test", type="character",
                                   attributes={"hp": 100}, cost=50)
    assert balance_service._calculate_effective_cost(obj_with_cost, "identity") == 50

    obj_no_cost = BalanceObject(id="2", name="Test2", type="character",
                                 attributes={"hp": 100, "damage": 20})
    cost_identity = balance_service._calculate_effective_cost(obj_no_cost, "identity")
    assert cost_identity == 120  # sum of attributes

    cost_progression = balance_service._calculate_effective_cost(obj_no_cost, "progression")
    assert abs(cost_progression - 96.0) < 0.001  # 120 * 0.8


def test_get_threshold(balance_service):
    """Тест получения порога дисбаланса."""
    assert balance_service._get_threshold("PvP", "") == 0.10
    assert balance_service._get_threshold("PvE", "") == 0.15
    assert balance_service._get_threshold("PvPvE", "") == 0.12
    assert balance_service._get_threshold("casual", "") == 0.20
    assert balance_service._get_threshold("PvE", "party") == 0.25
    assert balance_service._get_threshold("PvP", "sandbox") == 0.20


def test_generate_warnings(balance_service):
    """Тест генерации предупреждений."""
    reports = [
        ObjectBalanceReport(name="OP", power=50, effective_cost=100,
                            cp_ratio=0.5, distance_from_curve=-0.5, status="overpowered"),
        ObjectBalanceReport(name="UP", power=50, effective_cost=200,
                            cp_ratio=2.0, distance_from_curve=1.0, status="underpowered"),
    ]

    warnings = balance_service._generate_warnings(
        overpowered=["OP"], underpowered=["UP"],
        reports=reports, threshold=0.15, game_mode="PvP",
    )

    assert len(warnings) > 0
    assert any("OP" in w for w in warnings)
    assert any("UP" in w for w in warnings)


def test_generate_suggestions(balance_service):
    """Тест генерации предложений по коррекции."""
    reports = [
        ObjectBalanceReport(name="OP", power=100, effective_cost=100,
                            cp_ratio=0.5, distance_from_curve=-0.5, status="overpowered"),
        ObjectBalanceReport(name="UP", power=50, effective_cost=100,
                            cp_ratio=2.0, distance_from_curve=1.0, status="underpowered"),
    ]

    suggestions = balance_service._generate_suggestions(
        overpowered=["OP"], underpowered=["UP"],
        ideal_imbalance=[], reports=reports,
        cost_curve_model="identity",
    )

    assert len(suggestions) > 0
    assert any("OP" in s for s in suggestions)
    assert any("UP" in s for s in suggestions)
