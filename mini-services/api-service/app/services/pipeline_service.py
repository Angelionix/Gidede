"""
Gidede — Сквозной пайплайн: Блок 1 → Блок 2 → Блок 3 → Блок 4 → Блок 5
Фаза 4.B.12: Автоматическая передача данных между блоками
Фаза 4.C.9:  Расширение пайплайна до Блока 5

Функционал:
1. Автоматическая передача данных: OnePager → CoreLoopInput → MDAInput → BalanceInput → ProgressionInput/EconomyInput
2. Отслеживание статуса заполненности блоков
3. Уведомления об устаревших данных через Redis Event Bus
4. Проверка «свежести» зависимых блоков
5. Вычисление прогресса проекта
6. Полный пайплайн 1→5 (4.C.9)

Потоки данных:
  Блок 1 (ConceptGenerator)
    → OnePager.aestheticProfile + OnePager.mechanicSet + OnePager.coreLoop
      → Блок 2 (CoreLoopDesigner) CoreLoopInput
        → CoreLoopProfile
          → Блок 3 (MDALab) MDAInput
            → MDAProfile
              → Блок 4 (Balance) BalanceInput
                → BalanceResult
                  → Блок 5 (Progression + Economy) ProgressionInput / EconomyInput

События (через Redis Pub/Sub):
  - concept_updated:   Блок 1 обновлён → пометить Блоки 2-8 как stale
  - core_loop_updated: Блок 2 обновлён → пометить Блоки 3-8 как stale
  - mda_updated:       Блок 3 обновлён → пометить Блоки 4-8 как stale
  - balance_updated:   Блок 4 обновлён → пометить Блоки 5, 6, 8 как stale
  - progression_updated / economy_updated: Блок 5 → пометить Блоки 6, 8 как stale
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    Project,
    ProjectConcept,
    ProjectCoreLoop,
    ProjectMDAProfile,
    ProjectBalanceResult,
    ProjectProgression,
    ProjectEconomy,
)
from app.services.project_service import compute_block_flags, compute_completion_percent

logger = logging.getLogger(__name__)


# ============================================================
# ENUMS
# ============================================================

class BlockStatus(str, Enum):
    """Статус блока в пайплайне."""
    EMPTY = "empty"          # Блок ещё не заполнялся
    IN_PROGRESS = "in_progress"  # Частично заполнен / генерируется
    COMPLETED = "completed"  # Полностью заполнен
    STALE = "stale"         # Данные устарели (зависимый блок обновился)


class PipelineEvent(str, Enum):
    """События пайплайна (Redis Pub/Sub)."""
    CONCEPT_UPDATED = "concept_updated"       # Блок 1 обновлён
    CORE_LOOP_UPDATED = "core_loop_updated"   # Блок 2 обновлён
    MDA_UPDATED = "mda_updated"               # Блок 3 обновлён
    BALANCE_UPDATED = "balance_updated"       # Блок 4 обновлён
    PROGRESSION_UPDATED = "progression_updated"  # Блок 5 (прогрессия)
    ECONOMY_UPDATED = "economy_updated"       # Блок 5 (экономика)
    GDD_UPDATED = "gdd_updated"               # Блок 6 обновлён


# ============================================================
# ЗАВИСИМОСТИ МЕЖДУ БЛОКАМИ
# ============================================================

# Какой блок от какого зависит
BLOCK_DEPENDENCIES: dict[int, list[int]] = {
    1: [],        # Блок 1 ни от кого не зависит
    2: [1],       # Блок 2 зависит от Блока 1
    3: [1, 2],    # Блок 3 зависит от Блоков 1 и 2
    4: [1, 2, 3], # Блок 4 зависит от Блоков 1, 2, 3
    5: [1, 2, 3, 4],  # Блок 5 зависит от Блоков 1-4
    6: [1, 2, 3, 4, 5],  # Блок 6 зависит от всех предыдущих
    7: [1, 2, 3],  # AI-ассистент зависит от Блоков 1-3
    8: [1, 2, 3, 4, 5, 6],  # GBE Integration
}

# Какое событие генерирует каждый блок
BLOCK_EVENTS: dict[int, PipelineEvent] = {
    1: PipelineEvent.CONCEPT_UPDATED,
    2: PipelineEvent.CORE_LOOP_UPDATED,
    3: PipelineEvent.MDA_UPDATED,
    4: PipelineEvent.BALANCE_UPDATED,
    5: PipelineEvent.PROGRESSION_UPDATED,  # или ECONOMY_UPDATED
    6: PipelineEvent.GDD_UPDATED,
}

# Какие блоки становятся stale при обновлении блока-источника
STALE_DOWNSTREAM: dict[int, list[int]] = {
    1: [2, 3, 4, 5, 6, 7, 8],  # Обновление концепции → все зависимые stale
    2: [3, 4, 5, 6, 7, 8],      # Обновление Core Loop → зависимые stale
    3: [4, 5, 6, 7, 8],          # Обновление MDA → зависимые stale
    4: [5, 6, 8],                 # Обновление баланса → зависимые stale
    5: [6, 8],                    # Обновление прогрессии → зависимые stale
    6: [8],                       # Обновление GDD → GBE stale
}


# ============================================================
# МОДЕЛИ ДАННЫХ ПАЙПЛАЙНА
# ============================================================

class BlockProgress:
    """Прогресс отдельного блока."""

    def __init__(
        self,
        block_id: int,
        name: str,
        status: BlockStatus = BlockStatus.EMPTY,
        is_filled: bool = False,
        updated_at: Optional[str] = None,
        stale_since: Optional[str] = None,
        stale_reason: Optional[str] = None,
    ):
        self.block_id = block_id
        self.name = name
        self.status = status
        self.is_filled = is_filled
        self.updated_at = updated_at
        self.stale_since = stale_since
        self.stale_reason = stale_reason

    def to_dict(self) -> dict:
        return {
            "block_id": self.block_id,
            "name": self.name,
            "status": self.status.value,
            "is_filled": self.is_filled,
            "updated_at": self.updated_at,
            "stale_since": self.stale_since,
            "stale_reason": self.stale_reason,
        }


class PipelineState:
    """Полное состояние пайплайна проекта."""

    def __init__(
        self,
        project_id: str,
        project_name: str,
        blocks: list[BlockProgress],
        completion_percent: int = 0,
        current_stage: str = "concept",
        can_proceed_to: Optional[int] = None,
        next_block: Optional[int] = None,
        notifications: Optional[list[dict]] = None,
    ):
        self.project_id = project_id
        self.project_name = project_name
        self.blocks = blocks
        self.completion_percent = completion_percent
        self.current_stage = current_stage
        self.can_proceed_to = can_proceed_to
        self.next_block = next_block
        self.notifications = notifications or []

    def to_dict(self) -> dict:
        return {
            "project_id": self.project_id,
            "project_name": self.project_name,
            "blocks": [b.to_dict() for b in self.blocks],
            "completion_percent": self.completion_percent,
            "current_stage": self.current_stage,
            "can_proceed_to": self.can_proceed_to,
            "next_block": self.next_block,
            "notifications": self.notifications,
        }


# ============================================================
# ОСНОВНОЙ СЕРВИС
# ============================================================

BLOCK_NAMES = {
    1: "Генератор концепции",
    2: "Core Loop Designer",
    3: "MDA Lab",
    4: "Баланс и симуляция",
    5: "Экономика и прогрессия",
    6: "GDD Generator",
    7: "AI-ассистент",
    8: "Интеграция GBE",
}


class PipelineService:
    """
    Сервис сквозного пайплайна между блоками.

    Отвечает за:
    1. Определение статуса каждого блока (empty/in_progress/completed/stale)
    2. Автоматическую передачу данных между блоками
    3. Уведомления об устаревших данных
    4. Вычисление прогресса и рекомендаций
    """

    def __init__(self, db: AsyncSession, redis_client=None):
        """
        Args:
            db: Асинхронная сессия SQLAlchemy
            redis_client: RedisClient для Event Bus (опционально)
        """
        self.db = db
        self.redis = redis_client

    # ============================================================
    # 1. ПОЛУЧЕНИЕ СОСТОЯНИЯ ПАЙПЛАЙНА
    # ============================================================

    async def get_pipeline_state(self, project_id: str, user_id: str) -> Optional[PipelineState]:
        """
        Получить полное состояние пайплайна для проекта.

        Включает:
        - Статус каждого блока
        - Процент заполненности
        - Рекомендации (какой блок следующий)
        - Уведомления об устаревших данных
        """
        # Загружаем проект с блоками
        from app.services.project_service import get_project_with_blocks
        project = await get_project_with_blocks(self.db, project_id, user_id)
        if not project:
            return None

        # Вычисляем базовые флаги заполненности
        flags = compute_block_flags(project)

        # Проверяем stale-статус через Redis
        stale_map = await self._get_stale_map(project_id)

        # Строим прогресс по блокам
        blocks = []
        for block_id in range(1, 9):
            flag_key = self._flag_key(block_id)
            is_filled = flags.get(flag_key, False)

            # Определяем статус
            if stale_map.get(block_id):
                status = BlockStatus.STALE
                stale_info = stale_map[block_id]
                stale_since = stale_info.get("since")
                stale_reason = stale_info.get("reason")
            elif is_filled:
                status = BlockStatus.COMPLETED
                stale_since = None
                stale_reason = None
            else:
                status = BlockStatus.EMPTY
                stale_since = None
                stale_reason = None

            # Время обновления
            updated_at = self._get_block_updated_at(project, block_id)

            blocks.append(BlockProgress(
                block_id=block_id,
                name=BLOCK_NAMES.get(block_id, f"Блок {block_id}"),
                status=status,
                is_filled=is_filled,
                updated_at=updated_at,
                stale_since=stale_since,
                stale_reason=stale_reason,
            ))

        # Процент заполненности
        completion = compute_completion_percent(flags)

        # Текущий этап
        current_stage = project.project_stage or "concept"

        # Следующий блок для заполнения
        next_block = self._determine_next_block(blocks)
        can_proceed_to = next_block

        # Уведомления
        notifications = self._generate_notifications(blocks)

        return PipelineState(
            project_id=project_id,
            project_name=project.name,
            blocks=blocks,
            completion_percent=completion,
            current_stage=current_stage,
            can_proceed_to=can_proceed_to,
            next_block=next_block,
            notifications=notifications,
        )

    # ============================================================
    # 2. ПОДГОТОВКА ВХОДНЫХ ДАННЫХ ДЛЯ БЛОКА
    # ============================================================

    async def prepare_block_input(self, project_id: str, target_block: int) -> dict:
        """
        Подготовить входные данные для блока на основе результатов предыдущих блоков.

        Блок 2 ← Блок 1 (OnePager → CoreLoopInput)
        Блок 3 ← Блок 1 + Блок 2 (OnePager + CoreLoopProfile → MDAInput)
        """
        # Загружаем проект с блоками
        stmt = (
            select(Project)
            .where(Project.id == project_id)
        )
        from sqlalchemy.orm import selectinload
        stmt = stmt.options(
            selectinload(Project.concept),
            selectinload(Project.core_loop),
            selectinload(Project.mda_profile),
        )
        result = await self.db.execute(stmt)
        project = result.unique().scalar_one_or_none()

        if not project:
            return {"error": "Проект не найден"}

        # Загружаем дополнительные связи для Блоков 4-5
        from sqlalchemy.orm import selectinload as sel
        if target_block >= 4:
            stmt = stmt.options(
                sel(Project.balance_result),
            )
        if target_block >= 5:
            stmt = stmt.options(
                sel(Project.progression),
                sel(Project.economy),
            )
            result = await self.db.execute(stmt)
            project = result.unique().scalar_one_or_none()
            if not project:
                return {"error": "Проект не найден"}

        if target_block == 2:
            return await self._prepare_core_loop_input(project)
        elif target_block == 3:
            return await self._prepare_mda_input(project)
        elif target_block == 4:
            return await self._prepare_balance_input(project)
        elif target_block == 5:
            return await self._prepare_progression_and_economy_input(project)
        else:
            return {"project_id": project_id, "block": target_block}

    async def _prepare_core_loop_input(self, project: Project) -> dict:
        """
        Подготовить входные данные для Блока 2 (Core Loop Designer)
        из результатов Блока 1 (Концепция).

        CoreLoopInput:
        - concept: OnePager
        - mechanics: список механик из mechanic_set
        - aesthetic_profile
        - genre
        """
        concept = project.concept
        if not concept or not concept.aesthetic_profile:
            return {
                "project_id": project.id,
                "concept_id": concept.id if concept else None,
                "status": "missing_concept",
                "message": "Сначала заполните Блок 1 (Генератор концепции)",
            }

        # Извлекаем механики из mechanic_set
        mechanics = []
        if concept.mechanic_set:
            for category in ["base", "combat", "progression", "spatial", "social"]:
                cat_mechanics = concept.mechanic_set.get(category, [])
                for m in cat_mechanics:
                    name = m.get("name", "") if isinstance(m, dict) else str(m)
                    if name and name not in mechanics:
                        mechanics.append(name)

        # Собираем CoreLoopInput
        core_loop_input = {
            "project_id": project.id,
            "concept_id": concept.id,
            "status": "ready",
            "genre": concept.genre or "rpg",
            "mechanics": mechanics,
            "concept_data": {
                "genre": concept.genre,
                "aesthetic_profile": concept.aesthetic_profile,
                "dynamics_profile": concept.dynamics_profile or {},
                "mechanic_set": concept.mechanic_set or {},
                "one_pager": concept.one_pager_data or {},
            },
            "aesthetic_profile": concept.aesthetic_profile,
            "core_loop_candidates": concept.core_loop_candidates or [],
            "usp": concept.usp or "",
        }

        return core_loop_input

    async def _prepare_mda_input(self, project: Project) -> dict:
        """
        Подготовить входные данные для Блока 3 (MDA Lab)
        из результатов Блоков 1 и 2.

        MDAInput:
        - aesthetic_profile (из концепции)
        - genre
        - idea
        - existing_mechanics (из Core Loop)
        - core_loop_data (из CoreLoopProfile)
        """
        concept = project.concept
        core_loop = project.core_loop

        if not concept or not concept.aesthetic_profile:
            return {
                "project_id": project.id,
                "status": "missing_concept",
                "message": "Сначала заполните Блок 1 (Генератор концепции)",
            }

        # Собираем существующие механики из Core Loop
        existing_mechanics = []
        core_loop_data = None

        if core_loop and core_loop.steps_data:
            core_loop_data = {
                "structural_type": core_loop.structural_type,
                "steps": core_loop.steps_data,
                "inner_loops": core_loop.inner_loops or [],
                "outer_loops": core_loop.outer_loops or [],
                "meta_loop": core_loop.meta_loop,
                "pathologies": core_loop.pathologies,
                "recommendations": core_loop.recommendations or [],
                "full_profile": core_loop.full_profile,
            }

            # Извлекаем механики из шагов
            for step in core_loop.steps_data:
                step_mechanics = step.get("mechanics", []) if isinstance(step, dict) else []
                for m in step_mechanics:
                    if m and m not in existing_mechanics:
                        existing_mechanics.append(m)

        # Добавляем механики из концепции
        concept_mechanics = []
        if concept.mechanic_set:
            for category in ["base", "combat", "progression", "spatial", "social"]:
                cat_mechanics = concept.mechanic_set.get(category, [])
                for m in cat_mechanics:
                    name = m.get("name", "") if isinstance(m, dict) else str(m)
                    if name and name not in existing_mechanics:
                        concept_mechanics.append(name)

        all_mechanics = existing_mechanics + concept_mechanics

        # Определяем эстетики из профиля
        aesthetic_profile = concept.aesthetic_profile or {}
        primary = aesthetic_profile.get("primary", "challenge")
        secondary = aesthetic_profile.get("secondary", "fantasy")
        tertiary = aesthetic_profile.get("tertiary", "discovery")

        mda_input = {
            "project_id": project.id,
            "concept_id": concept.id,
            "status": "ready",
            "genre": concept.genre or "rpg",
            "idea": (concept.input_data or {}).get("idea", "") if concept.input_data else "",
            "primary_aesthetic": primary,
            "secondary_aesthetic": secondary,
            "tertiary_aesthetic": tertiary,
            "existing_mechanics": all_mechanics,
            "concept_data": {
                "genre": concept.genre,
                "aesthetic_profile": concept.aesthetic_profile,
                "dynamics_profile": concept.dynamics_profile or {},
                "mechanic_set": concept.mechanic_set or {},
                "one_pager": concept.one_pager_data or {},
            },
            "core_loop_data": core_loop_data,
            "has_core_loop": core_loop is not None and core_loop.steps_data is not None,
        }

        if not core_loop or not core_loop.steps_data:
            mda_input["warning"] = (
                "Блок 2 (Core Loop) ещё не заполнен. "
                "Рекомендуется сначала спроектировать Core Loop для более точного MDA-анализа."
            )

        return mda_input

    async def _prepare_balance_input(self, project: Project) -> dict:
        """Подготовить входные данные для Блока 4 (Баланс)."""
        concept = project.concept
        core_loop = project.core_loop
        mda = project.mda_profile

        has_concept = concept is not None and concept.aesthetic_profile is not None
        has_core_loop = core_loop is not None and core_loop.steps_data is not None
        has_mda = mda is not None and mda.mechanic_set is not None

        result = {
            "project_id": project.id,
            "status": "ready",
            "has_concept": has_concept,
            "has_core_loop": has_core_loop,
            "has_mda": has_mda,
        }

        # Обогащаем данными из предыдущих блоков для полноценной балансировки
        if has_concept:
            result["genre"] = concept.genre
            result["concept_data"] = {
                "genre": concept.genre,
                "aesthetic_profile": concept.aesthetic_profile,
                "mechanic_set": concept.mechanic_set or {},
            }

        if has_core_loop:
            result["core_loop_data"] = {
                "structural_type": core_loop.structural_type,
                "steps": core_loop.steps_data,
                "pathologies": core_loop.pathologies,
            }

        if has_mda:
            result["mda_data"] = {
                "mechanic_set": mda.mechanic_set,
                "target_dynamics": mda.target_dynamics,
                "primary_aesthetic": mda.primary_aesthetic,
                "secondary_aesthetic": mda.secondary_aesthetic,
            }

        # Предупреждения о неполноте данных
        warnings = []
        if not has_concept:
            warnings.append("Блок 1 (Концепция) не заполнен — балансировка будет ограниченной")
        if not has_core_loop:
            warnings.append("Блок 2 (Core Loop) не заполнен — невозможно проанализировать циклы")
        if not has_mda:
            warnings.append("Блок 3 (MDA) не заполнен — нет данных о механиках для балансировки")
        if warnings:
            result["warnings"] = warnings

        return result

    async def _prepare_progression_and_economy_input(self, project: Project) -> dict:
        """
        Подготовить входные данные для Блока 5 (Прогрессия + Экономика)
        из результатов Блоков 1–4.

        ProgressionInput зависит от:
        - MDAProfile (механики, эстетика)
        - BalanceResult (сбалансированные элементы)

        EconomyInput зависит от:
        - CoreLoopProfile (ресурсные потоки)
        - MDAProfile (механики)
        - ProgressionProfile (связь прогрессии с экономикой)
        """
        concept = project.concept
        core_loop = project.core_loop
        mda = project.mda_profile
        balance = project.balance_result

        has_concept = concept is not None and concept.aesthetic_profile is not None
        has_core_loop = core_loop is not None and core_loop.steps_data is not None
        has_mda = mda is not None and mda.mechanic_set is not None
        has_balance = balance is not None and balance.elements is not None

        result = {
            "project_id": project.id,
            "status": "ready",
            "has_concept": has_concept,
            "has_core_loop": has_core_loop,
            "has_mda": has_mda,
            "has_balance": has_balance,
        }

        # ---- Данные для Прогрессии (алгоритм 3.5) ----
        progression_input = {}

        if has_concept:
            progression_input["genre"] = concept.genre
            progression_input["idea"] = (concept.input_data or {}).get("idea", "") if concept.input_data else ""
            progression_input["aesthetic_profile"] = concept.aesthetic_profile
            progression_input["mechanic_set"] = concept.mechanic_set or {}

        if has_core_loop:
            progression_input["core_loop_type"] = core_loop.structural_type
            progression_input["core_loop_steps"] = core_loop.steps_data
            progression_input["loop_hierarchy"] = core_loop.loop_hierarchy

        if has_mda:
            progression_input["mda_mechanics"] = mda.mechanic_set
            progression_input["target_dynamics"] = mda.target_dynamics
            progression_input["primary_aesthetic"] = mda.primary_aesthetic

        if has_balance:
            progression_input["balance_elements"] = balance.elements
            progression_input["balance_score"] = balance.overall_balance_score

        result["progression_input"] = progression_input

        # ---- Данные для Экономики (алгоритм 3.6) ----
        economy_input = {}

        if has_core_loop:
            # Из Core Loop извлекаем ресурсы и их потоки
            resources = set()
            if core_loop.steps_data:
                for step in core_loop.steps_data:
                    if isinstance(step, dict):
                        for key in ["resource_in", "resource_out", "resource"]:
                            r = step.get(key)
                            if r:
                                resources.add(r if isinstance(r, str) else str(r))
            economy_input["core_loop_resources"] = list(resources)
            economy_input["core_loop_type"] = core_loop.structural_type
            economy_input["core_loop_steps"] = core_loop.steps_data
            economy_input["inner_loops"] = core_loop.inner_loops
            economy_input["outer_loops"] = core_loop.outer_loops

        if has_mda:
            economy_input["mda_mechanics"] = mda.mechanic_set
            economy_input["machinations_model"] = mda.machinations_model

        if has_concept:
            economy_input["genre"] = concept.genre
            economy_input["mechanic_set"] = concept.mechanic_set or {}

        # Если прогрессия уже есть — связываем с экономикой
        if project.progression and project.progression.curves:
            economy_input["progression_curves"] = project.progression.curves
            economy_input["tier_model"] = project.progression.tier_model
            economy_input["total_levels"] = project.progression.total_levels

        result["economy_input"] = economy_input

        # ---- Предупреждения ----
        warnings = []
        if not has_concept:
            warnings.append("Блок 1 (Концепция) не заполнен — параметры прогрессии будут по умолчанию")
        if not has_core_loop:
            warnings.append("Блок 2 (Core Loop) не заполнен — невозможно извлечь ресурсы для экономики")
        if not has_mda:
            warnings.append("Блок 3 (MDA) не заполнен — нет механик для моделирования экономики")
        if not has_balance:
            warnings.append("Блок 4 (Баланс) не заполнен — экономика может быть несбалансированной")
        if warnings:
            result["warnings"] = warnings

        return result

    # ============================================================
    # 3. ОБНОВЛЕНИЕ СТАТУСА И УВЕДОМЛЕНИЯ
    # ============================================================

    async def notify_block_updated(
        self,
        project_id: str,
        block_id: int,
        user_id: str,
        metadata: Optional[dict] = None,
    ) -> dict:
        """
        Уведомить об обновлении данных в блоке.

        Вызывается после сохранения результатов в любом блоке.
        Действия:
        1. Публикует событие через Redis Event Bus
        2. Помечает зависимые блоки как stale
        3. Возвращает список stale-блоков
        """
        event_type = BLOCK_EVENTS.get(block_id)
        if not event_type:
            return {"status": "ignored", "message": f"Блок {block_id} не генерирует событий"}

        # Формируем данные события
        event_data = {
            "event": event_type.value,
            "block": block_id,
            "project_id": project_id,
            "user_id": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {},
        }

        # Публикуем через Redis Event Bus
        if self.redis:
            try:
                await self.redis.publish_event(project_id, event_data)
                logger.info(f"Pipeline event published: {event_type.value} for project {project_id}")
            except Exception as e:
                logger.warning(f"Failed to publish pipeline event: {e}")

        # Помечаем зависимые блоки как stale
        downstream = STALE_DOWNSTREAM.get(block_id, [])
        stale_marked = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for dep_block_id in downstream:
            reason = f"{BLOCK_NAMES.get(block_id, f'Блок {block_id}')} обновлён"
            await self._mark_block_stale(project_id, dep_block_id, reason, now_iso)
            stale_marked.append(dep_block_id)

        # Обновляем project_stage
        await self._update_project_stage(project_id, block_id)

        return {
            "status": "ok",
            "event": event_type.value,
            "stale_blocks": stale_marked,
            "notifications_count": len(stale_marked),
        }

    async def _mark_block_stale(
        self,
        project_id: str,
        block_id: int,
        reason: str,
        since: str,
    ) -> bool:
        """
        Пометить блок как stale в Redis.

        Ключ: gidede:pipeline:stale:{project_id}:{block_id}
        """
        if not self.redis:
            # Fallback: сохраняем в in-memory (доступно через redis_client)
            return True

        key = f"gidede:pipeline:stale:{project_id}:{block_id}"
        stale_data = {
            "since": since,
            "reason": reason,
            "block_id": block_id,
        }

        try:
            await self.redis.set_cache(
                f"pipeline:stale:{project_id}:{block_id}",
                stale_data,
                ttl=86400 * 7,  # 7 дней, потом stale сам снимется
            )
            return True
        except Exception as e:
            logger.warning(f"Failed to mark block {block_id} as stale: {e}")
            return False

    async def _get_stale_map(self, project_id: str) -> dict[int, dict]:
        """
        Получить карту stale-блоков для проекта.

        Returns:
            {block_id: {"since": ..., "reason": ...}}
        """
        stale_map: dict[int, dict] = {}

        if not self.redis:
            return stale_map

        for block_id in range(1, 9):
            try:
                stale_data = await self.redis.get_cache(
                    f"pipeline:stale:{project_id}:{block_id}"
                )
                if stale_data:
                    stale_map[block_id] = stale_data
            except Exception:
                pass

        return stale_map

    async def clear_stale_status(self, project_id: str, block_id: int) -> bool:
        """
        Снять stale-статус с блока (после его обновления).
        """
        if not self.redis:
            return True

        try:
            await self.redis.delete_cache(
                f"pipeline:stale:{project_id}:{block_id}"
            )
            return True
        except Exception as e:
            logger.warning(f"Failed to clear stale for block {block_id}: {e}")
            return False

    async def _update_project_stage(self, project_id: str, block_id: int) -> None:
        """Обновить project_stage проекта."""
        stage_map = {
            1: "concept",
            2: "core_loop",
            3: "mda",
            4: "balance",
            5: "progression",
            6: "gdd",
            7: "gdd",  # AI assistant не меняет stage
            8: "gdd",
        }
        stage = stage_map.get(block_id)
        if not stage:
            return

        try:
            stmt = select(Project).where(Project.id == project_id)
            result = await self.db.execute(stmt)
            project = result.scalar_one_or_none()
            if project:
                project.project_stage = stage
                project.last_algorithm_run = BLOCK_NAMES.get(block_id, f"Block {block_id}")
                await self.db.flush()
        except Exception as e:
            logger.warning(f"Failed to update project stage: {e}")

    # ============================================================
    # 4. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    # ============================================================

    def _flag_key(self, block_id: int) -> str:
        """Маппинг block_id → ключ флага в compute_block_flags()."""
        flag_map = {
            1: "has_concept",
            2: "has_core_loop",
            3: "has_mda",
            4: "has_balance",
            5: "has_progression",
            6: "has_gdd",
            7: "has_checklist",  # AI assistant → checklist для простоты
            8: "has_checklist",
        }
        return flag_map.get(block_id, "")

    def _get_block_updated_at(self, project: Project, block_id: int) -> Optional[str]:
        """Получить время последнего обновления блока."""
        block_map = {
            1: project.concept,
            2: project.core_loop,
            3: project.mda_profile,
            4: project.balance_result,
            5: project.progression,
            6: project.gdd,
            7: project.checklist,
            8: project.checklist,
        }
        block = block_map.get(block_id)
        if block and hasattr(block, "updated_at") and block.updated_at:
            return str(block.updated_at)
        return None

    def _determine_next_block(self, blocks: list[BlockProgress]) -> Optional[int]:
        """
        Определить следующий блок для заполнения.

        Логика:
        1. Первый пустой блок в цепочке 1→2→3
        2. Если все заполнены — первый stale-блок
        3. Если все в порядке — None
        """
        # Ищем первый пустой блок в порядке 1-8
        for block in blocks:
            if block.status == BlockStatus.EMPTY:
                return block.block_id

        # Если все заполнены, ищем stale
        for block in blocks:
            if block.status == BlockStatus.STALE:
                return block.block_id

        return None

    def _generate_notifications(self, blocks: list[BlockProgress]) -> list[dict]:
        """
        Сгенерировать уведомления на основе stale-блоков.

        Returns:
            Список уведомлений вида:
            [
                {
                    "type": "stale_warning",
                    "block_id": 2,
                    "block_name": "Core Loop Designer",
                    "message": "Концепция обновлена. Рекомендуется пересчитать Core Loop",
                    "severity": "warning",
                },
                ...
            ]
        """
        notifications = []

        for block in blocks:
            if block.status != BlockStatus.STALE:
                continue

            # Формируем сообщение в зависимости от блока
            if block.block_id == 2:
                message = "Концепция обновлена. Рекомендуется пересчитать Core Loop."
            elif block.block_id == 3:
                message = "Данные предыдущих блоков обновлены. Рекомендуется пересчитать MDA-профиль."
            elif block.block_id == 4:
                message = "Результаты MDA-анализа обновлены. Рекомендуется пересчитать баланс."
            elif block.block_id == 5:
                message = "Результаты баланса обновлены. Рекомендуется пересчитать прогрессию и экономику."
            elif block.block_id == 6:
                message = "Данные предыдущих блоков обновлены. Рекомендуется перегенерировать GDD."
            elif block.block_id == 7:
                message = "Контекст проекта обновлён. Рекомендуется обновить данные для AI-ассистента."
            elif block.block_id == 8:
                message = "Данные проекта обновлены. Рекомендуется обновить интеграцию с GBE."
            else:
                message = f"Данные предыдущих блоков обновлены. Рекомендуется обновить «{block.name}»."

            notifications.append({
                "type": "stale_warning",
                "block_id": block.block_id,
                "block_name": block.name,
                "message": message,
                "severity": "warning",
                "stale_since": block.stale_since,
                "stale_reason": block.stale_reason,
            })

        return notifications

    # ============================================================
    # 5. ПОЛНЫЙ ПАЙПЛАЙН (Блок 1 → 2 → 3)
    # ============================================================

    async def run_pipeline_blocks_1_2_3(
        self,
        project_id: str,
        user_id: str,
        concept_input: dict,
    ) -> dict:
        """
        Запустить полный пайплайн Блок 1 → Блок 2 → Блок 3.

        Вызывает каждый блок по очереди, передавая результаты предыдущего.

        Args:
            project_id: ID проекта
            user_id: ID пользователя
            concept_input: Входные данные для Блока 1

        Returns:
            Результат всех трёх блоков + pipeline_state
        """
        results = {
            "project_id": project_id,
            "blocks_completed": [],
            "errors": [],
        }

        # Блок 1: Генератор концепции
        try:
            from app.services.concept_service import ConceptService
            from app.ai.executor import PromptExecutor
            from app.ai.cache import PromptCache
            from app.ai.router import PromptRouter
            from app.ai.validator import PromptValidator

            cache = PromptCache()
            router_instance = PromptRouter()
            validator = PromptValidator()
            executor = PromptExecutor(
                router=router_instance,
                cache=cache,
                validator=validator,
            )
            concept_service = ConceptService(executor=executor)

            concept_result = await concept_service.generate_full(
                idea=concept_input.get("idea", ""),
                explicit_genre=concept_input.get("genre"),
                target_motivations=concept_input.get("target_audience", {}).get("primary"),
                experience_level=concept_input.get("target_audience", {}).get("experience", "midcore"),
                platforms=concept_input.get("platform"),
                constraints=concept_input.get("constraints"),
                reference_games=concept_input.get("reference_games"),
                forbidden_mechanics=concept_input.get("forbidden_mechanics"),
                project_state=None,
            )

            results["block_1"] = concept_result
            results["blocks_completed"].append(1)

            # Уведомляем об обновлении концепции
            await self.notify_block_updated(project_id, 1, user_id)

        except Exception as e:
            logger.error(f"Pipeline Block 1 failed: {e}", exc_info=True)
            results["errors"].append({
                "block": 1,
                "error": str(e),
                "message": "Ошибка генерации концепции",
            })
            return results  # Без Блока 1 остальные не работают

        # Блок 2: Core Loop Designer
        try:
            from app.services.coreloop_service import CoreLoopService

            coreloop_service = CoreLoopService(executor=executor)

            # Подготавливаем входные данные из результатов Блока 1
            coreloop_input = await self.prepare_block_input(project_id, 2)
            if coreloop_input.get("status") == "missing_concept":
                raise ValueError("Нет данных концепции для Core Loop")

            mechanics = coreloop_input.get("mechanics", [])
            concept_data = coreloop_input.get("concept_data")
            genre = coreloop_input.get("genre", "rpg")

            coreloop_result = await coreloop_service.design_full(
                mechanics=mechanics,
                concept_data=concept_data,
                genre=genre,
                project_state=None,
            )

            results["block_2"] = {
                "structural_type": coreloop_result.structural_type.model_dump() if coreloop_result.structural_type else {},
                "steps": [s.model_dump() for s in coreloop_result.steps],
                "inner_loops": coreloop_result.inner_loops,
                "outer_loops": coreloop_result.outer_loops,
                "meta_loop": coreloop_result.meta_loop,
                "pathologies": coreloop_result.pathologies.model_dump() if coreloop_result.pathologies else {},
                "recommendations": coreloop_result.recommendations,
            }
            results["blocks_completed"].append(2)

            # Уведомляем об обновлении Core Loop
            await self.notify_block_updated(project_id, 2, user_id)

        except Exception as e:
            logger.error(f"Pipeline Block 2 failed: {e}", exc_info=True)
            results["errors"].append({
                "block": 2,
                "error": str(e),
                "message": "Ошибка проектирования Core Loop",
            })

        # Блок 3: MDA Lab
        try:
            from app.services.mda_service import MDAService
            from app.schemas.concept import AestheticProfile

            mda_service = MDAService(executor=executor)

            # Подготавливаем входные данные из результатов Блоков 1 и 2
            mda_input = await self.prepare_block_input(project_id, 3)
            if mda_input.get("status") == "missing_concept":
                raise ValueError("Нет данных концепции для MDA")

            aesthetic_profile = AestheticProfile(
                primary=mda_input.get("primary_aesthetic", "challenge"),
                secondary=mda_input.get("secondary_aesthetic", "fantasy"),
                tertiary=mda_input.get("tertiary_aesthetic", "discovery"),
                rationale="Из концепции (пайплайн)",
            )

            mda_result = await mda_service.analyze_full(
                concept_id=mda_input.get("concept_id", ""),
                aesthetic_profile=aesthetic_profile,
                genre=mda_input.get("genre", "rpg"),
                idea=mda_input.get("idea", ""),
                existing_mechanics=mda_input.get("existing_mechanics"),
                max_mechanics=18,
                min_mechanics=8,
                max_iterations=3,
            )

            results["block_3"] = mda_result.model_dump() if hasattr(mda_result, "model_dump") else mda_result
            results["blocks_completed"].append(3)

            # Уведомляем об обновлении MDA
            await self.notify_block_updated(project_id, 3, user_id)

        except Exception as e:
            logger.error(f"Pipeline Block 3 failed: {e}", exc_info=True)
            results["errors"].append({
                "block": 3,
                "error": str(e),
                "message": "Ошибка MDA-анализа",
            })

        # Финальное состояние пайплайна
        pipeline_state = await self.get_pipeline_state(project_id, user_id)
        if pipeline_state:
            results["pipeline_state"] = pipeline_state.to_dict()

        return results

    # ============================================================
    # 6. ПОЛНЫЙ ПАЙПЛАЙН (Блок 1 → 2 → 3 → 4 → 5) [4.C.9]
    # ============================================================

    async def run_pipeline_blocks_1_to_5(
        self,
        project_id: str,
        user_id: str,
        concept_input: dict,
    ) -> dict:
        """
        Запустить полный пайплайн Блок 1 → Блок 2 → Блок 3 → Блок 4 → Блок 5.
        Фаза 4.C.9: Сквозной пайплайн Блоки 1–5.

        Вызывает каждый блок по очереди, передавая результаты предыдущего.
        При ошибке в любом блоке — последующие не выполняются, но уже
        выполненные результаты возвращаются.

        Args:
            project_id: ID проекта
            user_id: ID пользователя
            concept_input: Входные данные для Блока 1

        Returns:
            Результат всех блоков + pipeline_state
        """
        # Сначала запускаем Блоки 1-3 (существующий метод)
        results = await self.run_pipeline_blocks_1_2_3(
            project_id=project_id,
            user_id=user_id,
            concept_input=concept_input,
        )

        # Если Блок 1 не выполнен — дальнейший пайплайн невозможен
        if 1 not in results.get("blocks_completed", []):
            return results

        # Подготавливаем AI executor (переиспользуем, если уже создан)
        try:
            from app.ai.executor import PromptExecutor
            from app.ai.cache import PromptCache
            from app.ai.router import PromptRouter
            from app.ai.validator import PromptValidator

            cache = PromptCache()
            router_instance = PromptRouter()
            validator = PromptValidator()
            executor = PromptExecutor(
                router=router_instance,
                cache=cache,
                validator=validator,
            )
        except Exception as e:
            logger.error(f"Pipeline: failed to initialize AI executor: {e}")
            results["errors"].append({
                "block": 4,
                "error": str(e),
                "message": "Ошибка инициализации AI-сервиса",
            })
            return results

        # Блок 4: Баланс и симуляция
        try:
            from app.services.balance_service import BalanceService

            balance_service = BalanceService(executor=executor)

            # Подготавливаем входные данные
            balance_input = await self.prepare_block_input(project_id, 4)
            if balance_input.get("status") == "missing_concept":
                raise ValueError("Нет данных для балансировки — заполните предыдущие блоки")

            # Запускаем transitive-анализ (основной метод)
            balance_result = await balance_service.transitive_balance(
                elements=balance_input.get("concept_data", {}).get("mechanic_set", {}),
                genre=balance_input.get("genre"),
            )

            results["block_4"] = balance_result.model_dump() if hasattr(balance_result, "model_dump") else balance_result
            results["blocks_completed"].append(4)

            # Уведомляем об обновлении баланса
            await self.notify_block_updated(project_id, 4, user_id)

        except Exception as e:
            logger.error(f"Pipeline Block 4 failed: {e}", exc_info=True)
            results["errors"].append({
                "block": 4,
                "error": str(e),
                "message": "Ошибка балансировки",
            })
            # Блок 5 зависит от 4 — не продолжаем
            return results

        # Блок 5: Прогрессия и Экономика
        try:
            from app.services.progression_service import ProgressionService
            from app.services.economy_service import EconomyService

            # Подготавливаем входные данные для Блока 5
            block5_input = await self.prepare_block_input(project_id, 5)
            if block5_input.get("status") == "missing_concept":
                raise ValueError("Нет данных для прогрессии — заполните предыдущие блоки")

            progression_input = block5_input.get("progression_input", {})
            economy_input = block5_input.get("economy_input", {})

            # 5a: Прогрессия (алгоритм 3.5)
            progression_service = ProgressionService(executor=executor)
            progression_result = await progression_service.design_full(
                genre=progression_input.get("genre"),
                idea=progression_input.get("idea"),
                core_loop_type=progression_input.get("core_loop_type"),
                aesthetic_profile=progression_input.get("aesthetic_profile"),
            )

            results["block_5_progression"] = (
                progression_result.model_dump()
                if hasattr(progression_result, "model_dump")
                else progression_result
            )

            # 5b: Экономика (алгоритм 3.6)
            economy_service = EconomyService(executor=executor)
            economy_result = await economy_service.build_economy_model(
                core_loop_type=economy_input.get("core_loop_type"),
                genre=economy_input.get("genre"),
                core_loop_steps=economy_input.get("core_loop_steps"),
            )

            results["block_5_economy"] = (
                economy_result.model_dump()
                if hasattr(economy_result, "model_dump")
                else economy_result
            )

            results["blocks_completed"].append(5)

            # Уведомляем об обновлении прогрессии/экономики
            await self.notify_block_updated(project_id, 5, user_id)

        except Exception as e:
            logger.error(f"Pipeline Block 5 failed: {e}", exc_info=True)
            results["errors"].append({
                "block": 5,
                "error": str(e),
                "message": "Ошибка проектирования прогрессии/экономики",
            })

        # Финальное состояние пайплайна
        pipeline_state = await self.get_pipeline_state(project_id, user_id)
        if pipeline_state:
            results["pipeline_state"] = pipeline_state.to_dict()

        return results
