"""
Gidede — GBE Bridge Service (GDCombine API Integration)
Фаза 4.E.1: Блок 8 — GDCombine/GBE API Bridge (алгоритм 3.10, Блок 8)

Mock-реализация API Bridge для интеграции с GDCombine/GBE.
Реальные вызовы будут подключены после стабилизации API GBE.

Вариант D (API-мост): Gidede ↔ GDCombine через REST API.
Маппинг данных: Gidede Project State ↔ GBE Blueprint format.

Методы:
- sync_to_gbe() — экспорт Project State в формат GBE Blueprint
- sync_from_gbe() — импорт Blueprint GBE в Project State
- handle_webhook() — обработка вебхуков от GBE
- get_project_status() — получение статуса проекта из GBE
- test_connection() — проверка подключения к GBE

Маппинг моделей:
- Gidede OnePager → GBE Blueprint
- Gidede MDAProfile → GBE MDAModel
- Gidede Machinations → GBE Diagram
- Gidede BalanceResult → GBE BalanceReport
- Gidede ProgressionProfile → GBE ProgressionModel
- Gidede EconomyProfile → GBE EconomyModel

Зависимости: ожидается GDCombine REST API (Фаза 4.E, реальная интеграция после стабилизации GBE)
"""

import time
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================
# Модели маппинга Gidede → GBE
# ============================================================

class GBEBlueprint(BaseModel):
    """GBE Blueprint — базовая модель проекта в GDCombine."""
    blueprint_id: str = Field(default_factory=lambda: f"bp-{uuid.uuid4().hex[:8]}")
    blueprint_type: str = Field("game_project", description="Тип Blueprint")
    name: str = Field("", description="Название проекта")
    genre: str = Field("", description="Жанр игры")
    description: str = Field("", description="Описание/логлайн")
    target_audience: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    team_size: str = Field("small", description="Размер команды: solo/small/medium/large")
    version: str = Field("1.0.0")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GBEMDAModel(BaseModel):
    """GBE MDAModel — MDA-анализ в формате GBE."""
    model_id: str = Field(default_factory=lambda: f"mda-{uuid.uuid4().hex[:8]}")
    mechanics: list[str] = Field(default_factory=list, description="Механики")
    dynamics: list[str] = Field(default_factory=list, description="Динамики")
    aesthetics: list[str] = Field(default_factory=list, description="Эстетики (8 типов Hunicke)")
    feedback_loops: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Петли обратной связи: [{type, from_node, to_node, label}]",
    )
    bond_matrix: Optional[dict[str, Any]] = Field(
        None,
        description="Матрица 4×3 Бонда: {rows, cols, values}",
    )
    lens_scores: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Оценки линз Шелла: [{lens_id, score, notes}]",
    )


class GBEDiagram(BaseModel):
    """GBE Diagram — Machinations-диаграмма в формате GBE."""
    diagram_id: str = Field(default_factory=lambda: f"dia-{uuid.uuid4().hex[:8]}")
    diagram_type: str = Field("machinations", description="Тип диаграммы: machinations/flowchart/hierarchy")
    nodes: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Узлы: [{id, type, label, resources, x, y}]",
    )
    connections: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Связи: [{id, from_node, to_node, resource_flow, label}]",
    )
    simulation_results: Optional[dict[str, Any]] = Field(
        None,
        description="Результаты симуляции: {ticks, resources_over_time, pathologies}",
    )


class GBEBalanceReport(BaseModel):
    """GBE BalanceReport — отчёт балансировки в формате GBE."""
    report_id: str = Field(default_factory=lambda: f"bal-{uuid.uuid4().hex[:8]}")
    balance_type: str = Field("transitive", description="Тип: transitive/intransitive/situational/monte_carlo")
    elements: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Элементы: [{name, cost, power, ratio, status}]",
    )
    payoff_matrix: Optional[list[list[float]]] = Field(None, description="Payoff-матрица")
    dominant_strategies: list[str] = Field(default_factory=list)
    nash_equilibria: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class GBEProgressionModel(BaseModel):
    """GBE ProgressionModel — модель прогрессии в формате GBE."""
    model_id: str = Field(default_factory=lambda: f"prog-{uuid.uuid4().hex[:8]}")
    total_levels: int = Field(0)
    curve_type: str = Field("linear", description="Тип кривой: linear/exponential/logistic/step/polynomial")
    tiers: list[dict[str, Any]] = Field(default_factory=list)
    curves: list[dict[str, Any]] = Field(default_factory=list)
    content_plan: Optional[dict[str, Any]] = Field(None)


class GBEEconomyModel(BaseModel):
    """GBE EconomyModel — модель экономики в формате GBE."""
    model_id: str = Field(default_factory=lambda: f"eco-{uuid.uuid4().hex[:8]}")
    economy_type: str = Field("engine", description="Тип: engine/economy/ecology")
    resources: list[dict[str, Any]] = Field(default_factory=list)
    machinations_diagram: Optional[GBEDiagram] = Field(None)
    faucet_drain_ratios: dict[str, float] = Field(default_factory=dict)
    pathologies: list[dict[str, Any]] = Field(default_factory=list)
    conversion_graph: Optional[dict[str, Any]] = Field(None)


class GBESyncResult(BaseModel):
    """Результат синхронизации Gidede ↔ GBE."""
    sync_id: str = Field(default_factory=lambda: f"sync-{uuid.uuid4().hex[:8]}")
    direction: str = Field("to_gbe", description="Направление: to_gbe/from_gbe")
    status: str = Field("synced", description="Статус: synced/synced_with_warnings/failed")
    components_synced: list[str] = Field(default_factory=list, description="Синхронизированные компоненты")
    components_skipped: list[str] = Field(default_factory=list, description="Пропущенные компоненты")
    warnings: list[str] = Field(default_factory=list)
    conflicts: list[dict[str, Any]] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    latency_ms: int = Field(0, description="Время выполнения (мс)")


class GBEWebhookPayload(BaseModel):
    """Пайлоад вебхука от GBE."""
    event_type: str = Field("", description="Тип события: blueprint.updated/diagram.changed/sync.requested")
    project_id: str = Field("", description="ID проекта в GBE")
    component: str = Field("", description="Изменённый компонент: blueprint/mda/diagram/balance/progression/economy")
    changed_fields: list[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: Optional[dict[str, Any]] = Field(None, description="Данные изменения")


class GBEWebhookResult(BaseModel):
    """Результат обработки вебхука."""
    acknowledged: bool = Field(True)
    event_type: str = Field("")
    action_taken: str = Field("", description="Действие: ignored/queued/processed/errored")
    message: str = Field("")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GBEConnectionStatus(BaseModel):
    """Статус подключения к GBE."""
    connected: bool = Field(False)
    base_url: str = Field("")
    is_mock: bool = Field(True)
    gbe_version: Optional[str] = Field(None)
    latency_ms: int = Field(0)
    message: str = Field("")


# ============================================================
# GBE Bridge Service
# ============================================================

class GBEBridgeService:
    """
    Блок 8: API Bridge для интеграции с GDCombine/GBE (Фаза 4.E.1).

    Реализация Варианта D: двусторонний API-мост для обмена данными.
    Текущий режим — mock (заглушки с маппингом данных).
    Реальный API GDCombine будет подключён после стабилизации GBE.

    Маппинг моделей:
    - Gidede OnePager → GBE Blueprint
    - Gidede MDAProfile → GBE MDAModel
    - Gidede Machinations → GBE Diagram
    - Gidede BalanceResult → GBE BalanceReport
    - Gidede ProgressionProfile → GBE ProgressionModel
    - Gidede EconomyProfile → GBE EconomyModel

    API Endpoints (4.E.1):
    - POST /api/v1/gbe/sync-to — syncProjectToGBE()
    - POST /api/v1/gbe/sync-from — syncProjectFromGBE()
    - POST /api/v1/gbe/webhook — handleWebhook()
    - GET  /api/v1/gbe/status — getProjectStatus()
    - POST /api/v1/gbe/test-connection — testConnection()
    """

    def __init__(self, base_url: str = "https://gbe.example.com/api/v1", api_key: str = ""):
        """
        Инициализация сервиса.

        Args:
            base_url: базовый URL GDCombine API
            api_key: API-ключ для авторизации
        """
        self.base_url = base_url
        self.api_key = api_key
        self._is_mock = True  # Флаг mock-режима
        self._sync_history: list[dict[str, Any]] = []  # История синхронизаций (mock)

    # ========================================================
    # Маппинг Gidede → GBE
    # ========================================================

    def map_concept_to_blueprint(self, concept: dict[str, Any]) -> GBEBlueprint:
        """
        Маппинг: Gidede OnePager → GBE Blueprint.

        Преобразует данные концепции из Блока 1 в формат Blueprint GBE.
        Поля маппинга:
        - concept.title → blueprint.name
        - concept.genre → blueprint.genre
        - concept.logline → blueprint.description
        - concept.target_audience → blueprint.target_audience
        - concept.platforms → blueprint.platforms
        - concept.budget → blueprint.team_size
        """
        return GBEBlueprint(
            name=concept.get("title", concept.get("name", "Untitled Project")),
            genre=concept.get("genre", "unknown"),
            description=concept.get("logline", concept.get("idea", "")),
            target_audience=concept.get("target_audience", []),
            platforms=concept.get("platforms", []),
            team_size=concept.get("budget", concept.get("team_size", "small")),
        )

    def map_mda_to_gbe_model(self, mda_profile: dict[str, Any]) -> GBEMDAModel:
        """
        Маппинг: Gidede MDAProfile → GBE MDAModel.

        Преобразует данные MDA-профиля из Блока 3 в формат GBE.
        Поля маппинга:
        - mda.mechanics → mda_model.mechanics
        - mda.dynamics → mda_model.dynamics
        - mda.aesthetics → mda_model.aesthetics
        - mda.feedback_loops → mda_model.feedback_loops
        - mda.bond_matrix → mda_model.bond_matrix
        - mda.lens_scores → mda_model.lens_scores
        """
        return GBEMDAModel(
            mechanics=mda_profile.get("mechanics", []),
            dynamics=mda_profile.get("dynamics", []),
            aesthetics=mda_profile.get("aesthetics", []),
            feedback_loops=mda_profile.get("feedback_loops", []),
            bond_matrix=mda_profile.get("bond_matrix"),
            lens_scores=mda_profile.get("lens_scores", []),
        )

    def map_machinations_to_gbe_diagram(
        self,
        machinations: dict[str, Any],
    ) -> GBEDiagram:
        """
        Маппинг: Gidede Machinations → GBE Diagram.

        Преобразует данные Machinations-модели из Блока 5 в формат GBE.
        Поля маппинга:
        - machinations.nodes → diagram.nodes
        - machinations.connections → diagram.connections
        - machinations.simulation_results → diagram.simulation_results
        """
        return GBEDiagram(
            nodes=machinations.get("nodes", []),
            connections=machinations.get("connections", machinations.get("flows", [])),
            simulation_results=machinations.get("simulation_results"),
        )

    def map_balance_to_gbe_report(
        self,
        balance_result: dict[str, Any],
    ) -> GBEBalanceReport:
        """
        Маппинг: Gidede BalanceResult → GBE BalanceReport.

        Преобразует данные балансировки из Блока 4 в формат GBE.
        """
        return GBEBalanceReport(
            balance_type=balance_result.get("balance_type", "transitive"),
            elements=balance_result.get("elements", []),
            payoff_matrix=balance_result.get("payoff_matrix"),
            dominant_strategies=balance_result.get("dominant_strategies", []),
            nash_equilibria=balance_result.get("nash_equilibria", []),
            recommendations=balance_result.get("recommendations", []),
        )

    def map_progression_to_gbe_model(
        self,
        progression_profile: dict[str, Any],
    ) -> GBEProgressionModel:
        """
        Маппинг: Gidede ProgressionProfile → GBE ProgressionModel.
        """
        return GBEProgressionModel(
            total_levels=progression_profile.get("total_levels", 0),
            curve_type=progression_profile.get("curve_type", "linear"),
            tiers=progression_profile.get("tiers", []),
            curves=progression_profile.get("curves", []),
            content_plan=progression_profile.get("content_plan"),
        )

    def map_economy_to_gbe_model(
        self,
        economy_profile: dict[str, Any],
    ) -> GBEEconomyModel:
        """
        Маппинг: Gidede EconomyProfile → GBE EconomyModel.
        """
        machinations_diagram = None
        if economy_profile.get("machinations_model"):
            machinations_diagram = self.map_machinations_to_gbe_diagram(
                economy_profile["machinations_model"],
            )

        return GBEEconomyModel(
            economy_type=economy_profile.get("economy_type", "engine"),
            resources=economy_profile.get("resources", []),
            machinations_diagram=machinations_diagram,
            faucet_drain_ratios=economy_profile.get("faucet_drain_ratios", {}),
            pathologies=economy_profile.get("pathologies", []),
            conversion_graph=economy_profile.get("conversion_graph"),
        )

    # ========================================================
    # Обратный маппинг GBE → Gidede
    # ========================================================

    def map_blueprint_to_concept(self, blueprint: dict[str, Any]) -> dict[str, Any]:
        """
        Обратный маппинг: GBE Blueprint → Gidede ConceptInput.

        Преобразует данные Blueprint из GBE в формат концепции Gidede.
        """
        return {
            "title": blueprint.get("name", ""),
            "genre": blueprint.get("genre", "unknown"),
            "idea": blueprint.get("description", ""),
            "logline": blueprint.get("description", ""),
            "target_audience": blueprint.get("target_audience", []),
            "platforms": blueprint.get("platforms", []),
            "budget": blueprint.get("team_size", "small"),
        }

    def map_gbe_mda_to_profile(self, mda_model: dict[str, Any]) -> dict[str, Any]:
        """
        Обратный маппинг: GBE MDAModel → Gidede MDAProfile.
        """
        return {
            "mechanics": mda_model.get("mechanics", []),
            "dynamics": mda_model.get("dynamics", []),
            "aesthetics": mda_model.get("aesthetics", []),
            "feedback_loops": mda_model.get("feedback_loops", []),
            "bond_matrix": mda_model.get("bond_matrix"),
            "lens_scores": mda_model.get("lens_scores", []),
        }

    def map_gbe_balance_to_result(self, report: dict[str, Any]) -> dict[str, Any]:
        """
        Обратный маппинг: GBE BalanceReport → Gidede BalanceResult.
        """
        return {
            "balance_type": report.get("balance_type", "transitive"),
            "elements": report.get("elements", []),
            "payoff_matrix": report.get("payoff_matrix"),
            "dominant_strategies": report.get("dominant_strategies", []),
            "nash_equilibria": report.get("nash_equilibria", []),
            "recommendations": report.get("recommendations", []),
        }

    # ========================================================
    # syncProjectToGBE — Экспорт Project State в GBE
    # ========================================================

    async def sync_to_gbe(self, project_state: dict[str, Any]) -> GBESyncResult:
        """
        Экспорт Project State в формат GBE Blueprint (syncProjectToGBE).

        Преобразует данные Gidede в формат GBE и отправляет в GDCombine.
        Mock: сохраняет в историю синхронизаций, не отправляет реально.

        Маппинг компонентов:
        - concept → GBE Blueprint (название, жанр, описание)
        - mda_profile → GBE MDAModel (механики, динамики, эстетики)
        - economy_profile.machinations → GBE Diagram (узлы, связи)
        - balance_result → GBE BalanceReport (элементы, матрицы)
        - progression_profile → GBE ProgressionModel (кривые, тиры)
        - economy_profile → GBE EconomyModel (ресурсы, патологии)

        Args:
            project_state: полный Project State Gidede
                           (ключи: concept, core_loop, mda_profile,
                            balance_result, progression_profile, economy_profile)

        Returns:
            GBESyncResult с результатами синхронизации
        """
        start = time.time()
        components_synced: list[str] = []
        components_skipped: list[str] = []
        warnings: list[str] = []

        # Маппинг каждого компонента
        mapped_data: dict[str, Any] = {}

        # 1. Concept → Blueprint
        concept = project_state.get("concept")
        if concept and isinstance(concept, dict):
            mapped_data["blueprint"] = self.map_concept_to_blueprint(concept)
            components_synced.append("concept")
        else:
            components_skipped.append("concept")
            warnings.append("Concept data is missing or empty — Blueprint not created")

        # 2. Core Loop → (встроен в Blueprint)
        core_loop = project_state.get("core_loop")
        if core_loop and isinstance(core_loop, dict):
            if "blueprint" in mapped_data:
                mapped_data["blueprint"].genre = core_loop.get(
                    "structural_type",
                    mapped_data["blueprint"].genre,
                )
            components_synced.append("core_loop")
        else:
            components_skipped.append("core_loop")

        # 3. MDA → MDAModel
        mda_profile = project_state.get("mda_profile")
        if mda_profile and isinstance(mda_profile, dict):
            mapped_data["mda_model"] = self.map_mda_to_gbe_model(mda_profile)
            components_synced.append("mda_profile")
        else:
            components_skipped.append("mda_profile")

        # 4. Balance → BalanceReport
        balance_result = project_state.get("balance_result")
        if balance_result and isinstance(balance_result, dict):
            mapped_data["balance_report"] = self.map_balance_to_gbe_report(balance_result)
            components_synced.append("balance_result")
        else:
            components_skipped.append("balance_result")

        # 5. Progression → ProgressionModel
        progression_profile = project_state.get("progression_profile")
        if progression_profile and isinstance(progression_profile, dict):
            mapped_data["progression_model"] = self.map_progression_to_gbe_model(
                progression_profile,
            )
            components_synced.append("progression_profile")
        else:
            components_skipped.append("progression_profile")

        # 6. Economy → EconomyModel
        economy_profile = project_state.get("economy_profile")
        if economy_profile and isinstance(economy_profile, dict):
            mapped_data["economy_model"] = self.map_economy_to_gbe_model(economy_profile)
            components_synced.append("economy_profile")
        else:
            components_skipped.append("economy_profile")
            warnings.append("Economy profile missing — Machinations diagram not synced")

        latency_ms = int((time.time() - start) * 1000)

        result = GBESyncResult(
            direction="to_gbe",
            status="synced" if not warnings else "synced_with_warnings",
            components_synced=components_synced,
            components_skipped=components_skipped,
            warnings=warnings,
            latency_ms=latency_ms,
        )

        # Сохраняем в историю (mock)
        self._sync_history.append({
            "sync_id": result.sync_id,
            "direction": "to_gbe",
            "components_synced": components_synced,
            "timestamp": result.timestamp,
            "mapped_data_summary": {
                k: v.model_dump() if isinstance(v, BaseModel) else str(v)
                for k, v in mapped_data.items()
            },
        })

        logger.info(
            f"[GBE Bridge] sync_to_gbe: sync_id={result.sync_id}, "
            f"synced={len(components_synced)}, skipped={len(components_skipped)}, "
            f"warnings={len(warnings)} ({latency_ms}ms)",
        )

        # TODO: Replace with real GDCombine API call:
        # async with httpx.AsyncClient() as client:
        #     response = await client.post(
        #         f"{self.base_url}/projects/{project_id}/sync",
        #         json=mapped_data,
        #         headers={"Authorization": f"Bearer {self.api_key}"},
        #     )
        #     response.raise_for_status()

        return result

    # ========================================================
    # syncProjectFromGBE — Импорт из GBE в Project State
    # ========================================================

    async def sync_from_gbe(self, gbe_data: dict[str, Any]) -> GBESyncResult:
        """
        Импорт данных из GBE в формат Project State Gidede (syncProjectFromGBE).

        Преобразует данные Blueprint из GBE в формат Gidede Project State.
        Mock: применяет обратный маппинг, не получает данные реально.

        Обратный маппинг:
        - GBE Blueprint → Gidede concept
        - GBE MDAModel → Gidede mda_profile
        - GBE BalanceReport → Gidede balance_result
        - GBE ProgressionModel → Gidede progression_profile
        - GBE EconomyModel → Gidede economy_profile

        Args:
            gbe_data: данные из GBE (ключи: blueprint, mda_model,
                      balance_report, progression_model, economy_model)

        Returns:
            GBESyncResult с результатами синхронизации
        """
        start = time.time()
        components_synced: list[str] = []
        components_skipped: list[str] = []
        warnings: list[str] = []
        project_state_updates: dict[str, Any] = {}

        # 1. Blueprint → Concept
        blueprint = gbe_data.get("blueprint")
        if blueprint and isinstance(blueprint, dict):
            project_state_updates["concept"] = self.map_blueprint_to_concept(blueprint)
            components_synced.append("concept")
        else:
            components_skipped.append("concept")
            warnings.append("No blueprint data in GBE import")

        # 2. MDAModel → MDA Profile
        mda_model = gbe_data.get("mda_model")
        if mda_model and isinstance(mda_model, dict):
            project_state_updates["mda_profile"] = self.map_gbe_mda_to_profile(mda_model)
            components_synced.append("mda_profile")
        else:
            components_skipped.append("mda_profile")

        # 3. BalanceReport → Balance Result
        balance_report = gbe_data.get("balance_report")
        if balance_report and isinstance(balance_report, dict):
            project_state_updates["balance_result"] = self.map_gbe_balance_to_result(
                balance_report,
            )
            components_synced.append("balance_result")
        else:
            components_skipped.append("balance_result")

        # 4. ProgressionModel → Progression Profile
        prog_model = gbe_data.get("progression_model")
        if prog_model and isinstance(prog_model, dict):
            project_state_updates["progression_profile"] = prog_model
            components_synced.append("progression_profile")
        else:
            components_skipped.append("progression_profile")

        # 5. EconomyModel → Economy Profile
        eco_model = gbe_data.get("economy_model")
        if eco_model and isinstance(eco_model, dict):
            project_state_updates["economy_profile"] = eco_model
            components_synced.append("economy_profile")
        else:
            components_skipped.append("economy_profile")

        latency_ms = int((time.time() - start) * 1000)

        result = GBESyncResult(
            direction="from_gbe",
            status="synced" if not warnings else "synced_with_warnings",
            components_synced=components_synced,
            components_skipped=components_skipped,
            warnings=warnings,
            latency_ms=latency_ms,
        )

        # Сохраняем в историю (mock)
        self._sync_history.append({
            "sync_id": result.sync_id,
            "direction": "from_gbe",
            "components_synced": components_synced,
            "timestamp": result.timestamp,
            "project_state_updates": project_state_updates,
        })

        logger.info(
            f"[GBE Bridge] sync_from_gbe: sync_id={result.sync_id}, "
            f"synced={len(components_synced)}, skipped={len(components_skipped)}, "
            f"warnings={len(warnings)} ({latency_ms}ms)",
        )

        return result

    # ========================================================
    # handleWebhook — Обработка вебхуков от GBE
    # ========================================================

    async def handle_webhook(self, payload: GBEWebhookPayload) -> GBEWebhookResult:
        """
        Обработка вебхука от GDCombine/GBE.

        Поддерживаемые события:
        - blueprint.updated: проект обновлён в GBE → пометить stale
        - diagram.changed: Machinations-диаграмма изменена → пересчитать экономику
        - sync.requested: GBE запрашивает синхронизацию → запустить sync_to_gbe
        - lint.completed: линтер GBE завершил проверку → обновить checklist

        Args:
            payload: данные вебхука от GBE

        Returns:
            GBEWebhookResult с результатом обработки
        """
        start = time.time()

        event_type = payload.event_type
        component = payload.component

        # Определяем действие по типу события
        action_taken = "ignored"
        message = ""

        if event_type == "blueprint.updated":
            action_taken = "queued"
            message = (
                f"Blueprint updated in GBE (component: {component}). "
                f"Project marked as stale for next sync."
            )
            logger.info(
                f"[GBE Bridge] Webhook: blueprint.updated for project {payload.project_id}",
            )

        elif event_type == "diagram.changed":
            action_taken = "queued"
            message = (
                f"Diagram changed in GBE (component: {component}). "
                f"Economy recalculation queued."
            )
            logger.info(
                f"[GBE Bridge] Webhook: diagram.changed for project {payload.project_id}",
            )

        elif event_type == "sync.requested":
            action_taken = "queued"
            message = (
                f"Sync requested by GBE for project {payload.project_id}. "
                f"Will sync on next cycle."
            )
            logger.info(
                f"[GBE Bridge] Webhook: sync.requested for project {payload.project_id}",
            )

        elif event_type == "lint.completed":
            action_taken = "processed"
            message = (
                f"Lint completed in GBE for project {payload.project_id}. "
                f"Results available for review."
            )
            logger.info(
                f"[GBE Bridge] Webhook: lint.completed for project {payload.project_id}",
            )

        else:
            action_taken = "ignored"
            message = f"Unknown event type: {event_type}. Webhook ignored."
            logger.warning(
                f"[GBE Bridge] Webhook: unknown event_type={event_type}",
            )

        latency_ms = int((time.time() - start) * 1000)

        result = GBEWebhookResult(
            acknowledged=True,
            event_type=event_type,
            action_taken=action_taken,
            message=message,
        )

        logger.info(
            f"[GBE Bridge] handle_webhook: event={event_type}, "
            f"action={action_taken} ({latency_ms}ms)",
        )

        return result

    # ========================================================
    # get_project_status — Статус проекта в GBE
    # ========================================================

    async def get_project_status(self, project_id: str) -> dict:
        """
        Получение статуса проекта из GBE.

        Mock: возвращает предсказуемый статус.

        Args:
            project_id: идентификатор проекта в GBE

        Returns:
            dict с ключами: project_id, status, last_sync, components,
                           pending_changes, errors
        """
        start = time.time()
        now = datetime.now(timezone.utc).isoformat()

        result = {
            "project_id": project_id,
            "status": "active",
            "last_sync": now,
            "gbe_version": "2.2.0",
            "is_mock": self._is_mock,
            "components": {
                "concept": "synced",
                "core_loop": "synced",
                "mda_profile": "synced",
                "balance": "synced",
                "progression": "synced",
                "economy": "synced",
                "gdd": "synced",
            },
            "pending_changes": 0,
            "sync_history_count": len(self._sync_history),
            "errors": [],
        }

        logger.info(
            f"[GBE Bridge] get_project_status: project_id={project_id}, "
            f"status=active ({int((time.time() - start) * 1000)}ms)",
        )

        return result

    # ========================================================
    # test_connection — Проверка подключения к GBE
    # ========================================================

    async def test_connection(self) -> GBEConnectionStatus:
        """
        Проверка подключения к GDCombine/GBE.

        Mock: всегда возвращает успешное подключение в mock-режиме.
        Реальная проверка: GET /api/v1/health с API-ключом.

        Returns:
            GBEConnectionStatus с результатами проверки
        """
        start = time.time()

        if self._is_mock:
            result = GBEConnectionStatus(
                connected=True,
                base_url=self.base_url,
                is_mock=True,
                gbe_version="2.2.0 (mock)",
                latency_ms=int((time.time() - start) * 1000),
                message="Connected to GBE (MOCK mode). Real API not yet connected.",
            )
        else:
            # TODO: Real connection check
            # async with httpx.AsyncClient() as client:
            #     response = await client.get(
            #         f"{self.base_url}/health",
            #         headers={"Authorization": f"Bearer {self.api_key}"},
            #         timeout=5.0,
            #     )
            #     response.raise_for_status()
            result = GBEConnectionStatus(
                connected=False,
                base_url=self.base_url,
                is_mock=False,
                latency_ms=int((time.time() - start) * 1000),
                message="Real GBE connection not implemented yet.",
            )

        logger.info(f"[GBE Bridge] test_connection: {result.message}")

        return result

    # ========================================================
    # get_sync_history — История синхронизаций
    # ========================================================

    def get_sync_history(self, limit: int = 10) -> list[dict[str, Any]]:
        """
        Получить историю синхронизаций (mock).

        Args:
            limit: максимальное количество записей

        Returns:
            Список записей синхронизаций
        """
        return self._sync_history[-limit:]

    # ========================================================
    # Legacy methods (обратная совместимость)
    # ========================================================

    async def import_gdd(self, gdd_profile: dict) -> dict:
        """
        Импорт GDD-профиля в GDCombine (legacy).

        Рекомендуется использовать sync_to_gbe() вместо этого метода.
        Оставлен для обратной совместимости.
        """
        sync_result = await self.sync_to_gbe(gdd_profile)
        return sync_result.model_dump()

    async def export_to_gbe(self, gdd_profile: dict) -> dict:
        """
        Экспорт GDD-профиля в формат GBE (legacy).

        Рекомендуется использовать sync_to_gbe() вместо этого метода.
        Оставлен для обратной совместимости.
        """
        sync_result = await self.sync_to_gbe(gdd_profile)
        return {
            "export_id": sync_result.sync_id,
            "format": "gbe_v2",
            "status": sync_result.status,
            "document_url": f"https://gbe.example.com/documents/{sync_result.sync_id}",
            "components_exported": sync_result.components_synced,
            "validation": {
                "valid": len(sync_result.warnings) == 0,
                "issues": sync_result.warnings,
            },
            "timestamp": sync_result.timestamp,
        }

    async def sync_changes(self, project_id: str, changes: dict) -> dict:
        """
        Синхронизация изменений с GBE (legacy).

        Рекомендуется использовать sync_to_gbe() или sync_from_gbe().
        Оставлен для обратной совместимости.
        """
        sync_result = await self.sync_to_gbe(changes)
        return sync_result.model_dump()
