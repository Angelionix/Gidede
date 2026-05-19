"""
Блок 6: Чек-листы валидации — API endpoints.
Фаза 4.D.4: Полная реализация алгоритма 3.8 (Этапы 1–7).

Endpoints:
- POST /run — Полный пайплайн валидации (алгоритм 3.8, все 7 этапов)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.checklist_service import ChecklistService
from app.schemas.checklist import (
    ChecklistInput,
    ValidationProfile,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов
# ============================================================

class ChecklistRunRequest(BaseModel):
    """Запрос на запуск чек-листов валидации (алгоритм 3.8)."""
    concept: Optional[dict] = Field(
        None,
        description="Концепт игры (из Блока 1): жанр, эстетика, платформа, ЦА",
    )
    core_loop: Optional[dict] = Field(
        None,
        description="Профиль Core Loop (из Блока 2): структурный тип, петли, ресурсы",
    )
    mda_profile: Optional[dict] = Field(
        None,
        description="MDA-профиль (из Блока 3): механики, динамики, эстетика",
    )
    balance_result: Optional[dict] = Field(
        None,
        description="Результат балансировки (из Блока 4): кривые cost-power",
    )
    progression_profile: Optional[dict] = Field(
        None,
        description="Профиль прогрессии (из Блока 5): кривые, тиры, контент-план",
    )
    economy_profile: Optional[dict] = Field(
        None,
        description="Профиль экономики (из Блока 5): ресурсы, Machinations, патологии",
    )
    gdd_profile: Optional[dict] = Field(
        None,
        description="Профиль GDD (из алгоритма 3.7, опционально)",
    )
    checklist_types: Optional[list[str]] = Field(
        None,
        description="Какие чек-листы запустить: mda/balance/narrative/economy/lenses. "
                    "Если не указаны — определяются по стадии проекта.",
    )
    focus_areas: Optional[list[str]] = Field(
        None,
        description="Фокусные области: core_loop/mechanics/balance/progression/economy/narrative/overall",
    )
    severity_threshold: str = Field(
        "warning",
        description="Минимальный уровень серьёзности: critical/warning/info",
    )
    max_issues: int = Field(
        100,
        description="Максимальное количество проблем в отчёте",
    )
    project_stage: Optional[str] = Field(
        None,
        description="Стадия проекта: concept/prototype/preproduction/production/live_ops",
    )
    previous_validation: Optional[dict] = Field(
        None,
        description="Результаты предыдущей валидации (для трекинга прогресса)",
    )


# ============================================================
# Зависимость: получить ChecklistService
# ============================================================

async def get_checklist_service() -> ChecklistService:
    """Создать ChecklistService с настроенным PromptExecutor."""
    from app.ai.executor import PromptExecutor
    from app.ai.cache import PromptCache
    from app.ai.router import PromptRouter
    from app.ai.validator import PromptValidator
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.core.config import settings

    providers = []

    try:
        if settings.OPENAI_API_KEY:
            providers.append(OpenAIProvider(api_key=settings.OPENAI_API_KEY))
    except Exception:
        pass

    try:
        if settings.ANTHROPIC_API_KEY:
            providers.append(AnthropicProvider(api_key=settings.ANTHROPIC_API_KEY))
    except Exception:
        pass

    try:
        providers.append(ZAIProvider())
    except Exception:
        pass

    try:
        if settings.OLLAMA_BASE_URL:
            providers.append(OllamaProvider(base_url=settings.OLLAMA_BASE_URL))
    except Exception:
        pass

    if not providers:
        try:
            providers.append(ZAIProvider())
        except Exception as e:
            logger.error(f"No AI providers available: {e}")

    cache = PromptCache()
    router_instance = PromptRouter(providers=providers)
    validator = PromptValidator()
    executor = PromptExecutor(
        providers=providers,
        router=router_instance,
        cache=cache,
        validator=validator,
    )

    return ChecklistService(executor=executor)


def _request_to_input(request: ChecklistRunRequest) -> ChecklistInput:
    """Конвертировать request модель в ChecklistInput."""
    return ChecklistInput(
        concept=request.concept,
        core_loop=request.core_loop,
        mda_profile=request.mda_profile,
        balance_result=request.balance_result,
        progression_profile=request.progression_profile,
        economy_profile=request.economy_profile,
        gdd_profile=request.gdd_profile,
        checklist_types=request.checklist_types,
        focus_areas=request.focus_areas,
        severity_threshold=request.severity_threshold,
        max_issues=request.max_issues,
        project_stage=request.project_stage,
        previous_validation=request.previous_validation,
    )


# ============================================================
# Endpoints
# ============================================================

@router.post("/run")
async def run_checklists(
    input_data: ChecklistRunRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Запуск чек-листов валидации геймдизайна (алгоритм 3.8, все 7 этапов).

    Этапы:
    1. Определение области валидации → ValidationScope
    2. MDA-чек (механика→динамика→эстетика полнота)
    3. Баланс-чек (12 типов баланса)
    4. Нарратив-чек (диссонанс, агентивность, структура)
    5. Экономика-чек (патологии, faucet/drain)
    6. Линзы Шелла (адаптивная выборка из 113)
    7. Агрегация, приоритизация, план ремедиации

    Возвращает ValidationProfile с результатами всех этапов.
    """
    logger.info(f"Checklist validation for user {current_user.id}")

    try:
        service = await get_checklist_service()
        checklist_input = _request_to_input(input_data)
        result = await service.run_validation(checklist_input)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in checklists: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in checklists: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in checklists: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
