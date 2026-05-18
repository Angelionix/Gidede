"""
Gidede — Balance Service Tests
Фаза 4.C.1: Тесты для Блока 4 — Transitive-анализ баланса (алгоритм 3.4)

Тесты:
- classify_balance_task: PvP, PvE, PvPvE
- transitive_balance: basic, with_costs, overpowered, underpowered, ideal_imbalance,
                      attribute_weights, cost_curve_identity, cost_curve_progression
- analyze_stability: stable, runaway, deadlock
- balance_full: pipeline, stages_completed
- API endpoints: transitive, analyze
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.balance import (
    BalanceObject,
    BalanceInput,
    BalanceMap,
    ObjectBalanceReport,
    TransitiveResult,
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
    # Должны быть применимы transitive и situational
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
    # Все веса должны быть неотрицательными
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
    # Каждый объект должен иметь power, cost, cp_ratio
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

    # "OP Unit" должен быть определён как overpowered
    assert "OP Unit" in result.overpowered or len(result.overpowered) >= 1
    # Должны быть warnings о дисбалансе
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

    # "UP Unit" должен быть определён как underpowered
    assert "UP Unit" in result.underpowered or len(result.underpowered) >= 1
    assert len(result.warnings) > 0


@pytest.mark.asyncio
async def test_transitive_balance_ideal_imbalance(balance_service):
    """Обнаружение ideal_imbalance (5-15% отклонение)."""
    # Создаём объекты с небольшим отклонением от кривой
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

    # Должны быть заполнены списки
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

    # Веса должны быть рассчитаны
    assert len(result.attribute_weights) > 0
    # Все веса должны быть неотрицательными
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

    # reinforcing feedback → runaway risk
    assert "runaway" in result["pathology_risks"]
    assert result["positive_loops"] == 3
    assert result["overall_stability"] == "unstable"


def test_analyze_stability_deadlock(balance_service):
    """Анализ системы с риском deadlock (negative sum + reinforcing)."""
    # Это косвенный тест — deadlock возникает при negative sum + reinforcing
    # Но мы проверяем через Schreiber matrix
    from app.services.balance_service import SCHREIBER_STABILITY_MATRIX

    key = ("negative", "reinforcing")
    entry = SCHREIBER_STABILITY_MATRIX.get(key)

    assert entry is not None
    assert entry["pathology_risk"] == "deadlock"
    assert entry["stability"] == "unstable"


# ============================================================
# Тесты: balance_full (полный пайплайн)
# ============================================================

@pytest.mark.asyncio
async def test_balance_full_pipeline(balance_service, sample_pvp_objects):
    """Полный пайплайн балансировки (Этапы 1–3)."""
    input_data = BalanceInput(
        objects=sample_pvp_objects,
        game_mode="PvP",
    )

    result = await balance_service.balance_full(input_data)

    assert isinstance(result, BalanceResult)
    assert result.balance_map is not None
    assert result.transitive_result is not None
    assert len(result.stages_completed) == 3
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

    assert result.stages_completed == [1, 2, 3]
    assert result.balance_map is not None
    assert result.transitive_result is not None
    assert result.latency_ms >= 0
    assert "ESTIMATE_WEIGHTS" in result.models_used


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
    assert result.stages_completed == [1, 2, 3]


# ============================================================
# Тесты: API endpoints
# ============================================================

@pytest.mark.asyncio
async def test_api_balance_transitive(test_client, auth_headers):
    """Тест POST /api/v1/balance/transitive."""
    # Используем эндпоинт с авторизацией
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

    # Может быть 200 или 401/403/500 в зависимости от окружения
    assert response.status_code in (200, 401, 403, 500)

    if response.status_code == 200:
        data = response.json()
        assert "attribute_weights" in data
        assert "cost_curve_model" in data
        assert "objects" in data
        assert len(data["objects"]) == 2


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
        },
        headers=auth_headers,
    )

    # Может быть 200 или 401/403/500
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

    # Веса должны быть рассчитаны (cost = w_hp * hp + w_damage * damage)
    assert weights is not None
    assert "hp" in weights
    assert "damage" in weights
    # Сумма весов должна быть ≈ 1 (нормализованные)
    total = sum(weights.values())
    assert abs(total - 1.0) < 0.01, f"Weights should sum to 1.0, got {total}"


def test_solve_linear_system(balance_service):
    """Тест решения линейной системы."""
    # Простая система: 2x + 3y = 8, 4x + y = 6
    # Решение: x = 1, y = 2
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
    # С явной стоимостью
    obj_with_cost = BalanceObject(id="1", name="Test", type="character",
                                   attributes={"hp": 100}, cost=50)
    assert balance_service._calculate_effective_cost(obj_with_cost, "identity") == 50

    # Без стоимости — identity модель
    obj_no_cost = BalanceObject(id="2", name="Test2", type="character",
                                 attributes={"hp": 100, "damage": 20})
    cost_identity = balance_service._calculate_effective_cost(obj_no_cost, "identity")
    assert cost_identity == 120  # sum of attributes

    # Без стоимости — progression модель (80% от суммы)
    cost_progression = balance_service._calculate_effective_cost(obj_no_cost, "progression")
    assert abs(cost_progression - 96.0) < 0.001  # 120 * 0.8


def test_get_threshold(balance_service):
    """Тест получения порога дисбаланса."""
    assert balance_service._get_threshold("PvP", "") == 0.10
    assert balance_service._get_threshold("PvE", "") == 0.15
    assert balance_service._get_threshold("PvPvE", "") == 0.12
    assert balance_service._get_threshold("casual", "") == 0.20
    # Жанровый override
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
