"""
Блок 8: GBE Bridge — API endpoints (Фаза 4.E.1).
Интеграция Gidede ↔ GDCombine/GBE через API Bridge (Вариант D).

Endpoints:
- POST /sync-to — Экспорт Project State в GBE (syncProjectToGBE)
- POST /sync-from — Импорт из GBE в Project State (syncProjectFromGBE)
- POST /webhook — Обработка вебхуков от GBE (handleWebhook)
- GET /status — Статус проекта в GBE
- POST /test-connection — Проверка подключения к GBE
- GET /sync-history — История синхронизаций
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.gbe_bridge_service import (
    GBEBridgeService,
    GBEWebhookPayload,
    GBESyncResult,
    GBEWebhookResult,
    GBEConnectionStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов
# ============================================================

class SyncToRequest(BaseModel):
    """Запрос на экспорт Project State в GBE."""
    project_state: dict[str, Any] = Field(
        ...,
        description="Полный Project State Gidede (concept, core_loop, mda_profile, balance_result, progression_profile, economy_profile)",
    )
    base_url: Optional[str] = Field(
        None,
        description="URL GBE-инстанса (переопределяет дефолтный)",
    )
    api_key: Optional[str] = Field(
        None,
        description="API-ключ GBE (переопределяет дефолтный)",
    )


class SyncFromRequest(BaseModel):
    """Запрос на импорт данных из GBE."""
    gbe_data: dict[str, Any] = Field(
        ...,
        description="Данные из GBE (blueprint, mda_model, balance_report, progression_model, economy_model)",
    )
    base_url: Optional[str] = Field(
        None,
        description="URL GBE-инстанса (переопределяет дефолтный)",
    )
    api_key: Optional[str] = Field(
        None,
        description="API-ключ GBE (переопределяет дефолтный)",
    )


class WebhookRequest(BaseModel):
    """Запрос на обработку вебхука от GBE."""
    event_type: str = Field(
        ...,
        description="Тип события: blueprint.updated/diagram.changed/sync.requested/lint.completed",
    )
    project_id: str = Field(
        ...,
        description="ID проекта в GBE",
    )
    component: str = Field(
        "",
        description="Изменённый компонент: blueprint/mda/diagram/balance/progression/economy",
    )
    changed_fields: list[str] = Field(
        default_factory=list,
        description="Список изменённых полей",
    )
    data: Optional[dict[str, Any]] = Field(
        None,
        description="Данные изменения (опционально)",
    )


class TestConnectionRequest(BaseModel):
    """Запрос на проверку подключения к GBE."""
    base_url: Optional[str] = Field(
        None,
        description="URL GBE-инстанса для проверки",
    )
    api_key: Optional[str] = Field(
        None,
        description="API-ключ для проверки",
    )


# ============================================================
# Зависимость: получить GBEBridgeService
# ============================================================

def get_gbe_service(
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> GBEBridgeService:
    """Создать GBEBridgeService с опциональными настройками."""
    from app.core.config import settings

    url = base_url or getattr(settings, "GBE_BASE_URL", "https://gbe.example.com/api/v1")
    key = api_key or getattr(settings, "GBE_API_KEY", "")

    return GBEBridgeService(base_url=url, api_key=key)


# ============================================================
# Endpoints
# ============================================================

@router.post("/sync-to")
async def sync_to_gbe(
    request: SyncToRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Экспорт Project State в GBE (syncProjectToGBE).

    Выполняет маппинг Gidede-моделей в GBE-формат и синхронизирует:
    - Gidede OnePager → GBE Blueprint
    - Gidede MDAProfile → GBE MDAModel
    - Gidede Machinations → GBE Diagram
    - Gidede BalanceResult → GBE BalanceReport
    - Gidede ProgressionProfile → GBE ProgressionModel
    - Gidede EconomyProfile → GBE EconomyModel

    Текущий режим: mock (данные не отправляются реально).
    """
    logger.info(f"GBE sync-to requested by user {current_user.id}")

    try:
        service = get_gbe_service(
            base_url=request.base_url,
            api_key=request.api_key,
        )
        result = await service.sync_to_gbe(request.project_state)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GBE sync-to: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in GBE sync-to: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/sync-from")
async def sync_from_gbe(
    request: SyncFromRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Импорт данных из GBE в Project State (syncProjectFromGBE).

    Выполняет обратный маппинг GBE-моделей в Gidede-формат:
    - GBE Blueprint → Gidede concept
    - GBE MDAModel → Gidede mda_profile
    - GBE BalanceReport → Gidede balance_result
    - GBE ProgressionModel → Gidede progression_profile
    - GBE EconomyModel → Gidede economy_profile

    Текущий режим: mock (данные не получаются реально).
    """
    logger.info(f"GBE sync-from requested by user {current_user.id}")

    try:
        service = get_gbe_service(
            base_url=request.base_url,
            api_key=request.api_key,
        )
        result = await service.sync_from_gbe(request.gbe_data)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GBE sync-from: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in GBE sync-from: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/webhook")
async def handle_webhook(
    request: WebhookRequest,
):
    """
    Обработка вебхука от GBE.

    Поддерживаемые события:
    - blueprint.updated: проект обновлён в GBE
    - diagram.changed: Machinations-диаграмма изменена
    - sync.requested: GBE запрашивает синхронизацию
    - lint.completed: линтер GBE завершил проверку

    Примечание: вебхук не требует авторизации (GBE вызывает этот endpoint).
    В production нужна верификация подписи webhook.
    """
    logger.info(
        f"GBE webhook received: event={request.event_type}, "
        f"project={request.project_id}",
    )

    try:
        payload = GBEWebhookPayload(
            event_type=request.event_type,
            project_id=request.project_id,
            component=request.component,
            changed_fields=request.changed_fields,
            data=request.data,
        )

        service = get_gbe_service()
        result = await service.handle_webhook(payload)
        return result.model_dump()

    except Exception as e:
        logger.error(f"Error handling GBE webhook: {e}", exc_info=True)
        return GBEWebhookResult(
            acknowledged=False,
            event_type=request.event_type,
            action_taken="errored",
            message=f"Error processing webhook: {str(e)}",
        ).model_dump()


@router.get("/status/{project_id}")
async def get_project_status(
    project_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Получение статуса проекта в GBE.

    Возвращает текущий статус синхронизации и компонентов.
    Текущий режим: mock.
    """
    logger.info(f"GBE project status requested: {project_id}")

    try:
        service = get_gbe_service()
        result = await service.get_project_status(project_id)
        return result

    except Exception as e:
        logger.error(f"Error getting GBE project status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/test-connection")
async def test_connection(
    request: TestConnectionRequest = None,
    current_user: User = Depends(get_current_user),
):
    """
    Проверка подключения к GBE.

    Проверяет доступность GDCombine API и валидность API-ключа.
    Текущий режим: mock (всегда подключено).
    """
    logger.info(f"GBE test-connection requested by user {current_user.id}")

    try:
        service = get_gbe_service(
            base_url=request.base_url if request else None,
            api_key=request.api_key if request else None,
        )
        result = await service.test_connection()
        return result.model_dump()

    except Exception as e:
        logger.error(f"Error testing GBE connection: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/sync-history")
async def get_sync_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
):
    """
    История синхронизаций с GBE.

    Возвращает список последних операций синхронизации.
    """
    logger.info(f"GBE sync-history requested by user {current_user.id}")

    try:
        service = get_gbe_service()
        result = service.get_sync_history(limit=limit)
        return {
            "history": result,
            "total": len(result),
            "limit": limit,
        }

    except Exception as e:
        logger.error(f"Error getting GBE sync history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
