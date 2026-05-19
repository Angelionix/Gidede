"""
Блок 6: GDD Generator — API endpoints.
Фаза 4.D.1–4.D.3: Полная реализация алгоритма 3.7 (Этапы 1–8).

Endpoints:
- POST /format — Этап 1: Определение формата GDD (алгоритм 3.7.3)
- POST /map — Этап 2: Маппинг Project State → секции GDD (алгоритм 3.7.4)
- POST /auto-fill — Этап 3: Автозаполнение секций (алгоритм 3.7.5)
- POST /generate — Полный пайплайн Этапов 1–5
- POST /generate-full — Полный пайплайн Этапов 1–7
- POST /export — Этап 8: Экспорт GDD в PDF/DOCX/MD/HTML
- POST /checklist — Заглушка: Запуск чек-листов валидации (алгоритм 3.8)
"""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.gdd_service import GDDService
from app.schemas.gdd import (
    GDDGenerationInput,
    GDDFormatSpec,
    GDDDataMapping,
    AutoFilledSections,
    GDDProfile,
    GDDAssembledDocument,
    GDDFormattedDocument,
    ExportFormat,
    GDDExportResult,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов
# ============================================================

class GDDFormatRequest(BaseModel):
    """Входные данные для определения формата GDD (Этап 1)."""
    concept: Optional[dict] = Field(
        None, description="Концепт игры (из Блока 1)",
    )
    core_loop: Optional[dict] = Field(
        None, description="Профиль Core Loop (из Блока 2)",
    )
    mda_profile: Optional[dict] = Field(
        None, description="MDA-профиль (из Блока 3)",
    )
    balance_result: Optional[dict] = Field(
        None, description="Результат балансировки (из Блока 4)",
    )
    progression_profile: Optional[dict] = Field(
        None, description="Профиль прогрессии (из Блока 5)",
    )
    economy_profile: Optional[dict] = Field(
        None, description="Профиль экономики (из Блока 5)",
    )
    target_format: Optional[str] = Field(
        None,
        description="Целевой формат GDD: one_sheet/ten_pager/treatment/sketch_design/full_gdd/concept_doc/narrative_bible/modular",
    )
    target_audience_doc: Optional[str] = Field(
        None,
        description="Целевая аудитория документа: investor/team_sync/production/personal/educational",
    )
    detail_level: Optional[str] = Field(
        None,
        description="Уровень детализации: overview/standard/detailed/exhaustive",
    )
    custom_sections: Optional[list[str]] = Field(
        None, description="Дополнительные секции",
    )
    excluded_sections: Optional[list[str]] = Field(
        None, description="Исключённые секции",
    )
    language: str = Field("ru", description="Язык документа: ru/en")
    project_stage: Optional[str] = Field(
        None,
        description="Стадия проекта: concept/prototype/preproduction/production/live_ops",
    )


class GDDMapRequest(GDDFormatRequest):
    """Входные данные для маппинга Project State → секции GDD (Этап 2)."""
    # Наследует все поля от GDDFormatRequest
    pass


class GDDAutoFillRequest(GDDFormatRequest):
    """Входные данные для автозаполнения секций (Этап 3)."""
    # Наследует все поля от GDDFormatRequest
    pass


class GDDGenerateRequest(GDDFormatRequest):
    """Входные данные для полного пайплайна генерации GDD (Этапы 1–5)."""
    # Наследует все поля от GDDFormatRequest
    pass


class ChecklistInput(BaseModel):
    """Входные данные для чек-листов (алгоритм 3.8)."""
    concept_id: str
    checklist_types: list = ["mda", "balance", "narrative", "economy", "schell"]


class GDDExportInput(BaseModel):
    """Входные данные для экспорта GDD."""
    gdd_profile: Optional[dict] = None
    format: str = "pdf"  # pdf | docx | md | html


# ============================================================
# Зависимость: получить GDDService
# ============================================================

async def get_gdd_service() -> GDDService:
    """Создать GDDService с настроенным PromptExecutor."""
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

    return GDDService(executor=executor)


def _request_to_input(request: GDDFormatRequest) -> GDDGenerationInput:
    """Конвертировать request модель в GDDGenerationInput."""
    return GDDGenerationInput(
        concept=request.concept,
        core_loop=request.core_loop if hasattr(request, 'core_loop') else None,
        mda_profile=request.mda_profile if hasattr(request, 'mda_profile') else None,
        balance_result=request.balance_result,
        progression_profile=request.progression_profile,
        economy_profile=request.economy_profile,
        target_format=request.target_format,
        target_audience_doc=request.target_audience_doc,
        detail_level=request.detail_level,
        custom_sections=request.custom_sections,
        excluded_sections=request.excluded_sections,
        language=request.language,
        project_stage=request.project_stage,
    )


# ============================================================
# Endpoints
# ============================================================

@router.post("/format")
async def determine_format(
    input_data: GDDFormatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 1: Определение формата GDD (алгоритм 3.7.3).

    Определяет:
    - Формат GDD (one_sheet, ten_pager, treatment, sketch_design, full_gdd, concept_doc, narrative_bible, modular)
    - Уровень детализации (overview, standard, detailed, exhaustive)
    - Список секций для формата
    - Оценку количества страниц
    """
    logger.info(f"GDD format determination for user {current_user.id}")

    try:
        service = await get_gdd_service()
        gdd_input = _request_to_input(input_data)
        result = await service.determine_gdd_format(gdd_input)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GDD format: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in GDD format: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/map")
async def map_sections(
    input_data: GDDMapRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 2: Маппинг Project State → секции GDD (алгоритм 3.7.4).

    Выполняет:
    - Фильтрацию маппингов по активным секциям формата
    - Проверку готовности каждой секции
    - Расчёт coverage_score
    """
    logger.info(f"GDD section mapping for user {current_user.id}")

    try:
        service = await get_gdd_service()
        gdd_input = _request_to_input(input_data)

        # Сначала определяем формат (Этап 1)
        format_spec = await service.determine_gdd_format(gdd_input)

        # Затем маппим (Этап 2)
        result = await service.map_project_to_sections(format_spec, gdd_input)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GDD mapping: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in GDD mapping: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/auto-fill")
async def generate_auto_sections(
    input_data: GDDAutoFillRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 3: Автозаполнение секций GDD (алгоритм 3.7.5).

    Выполняет:
    - Определение формата (Этап 1)
    - Маппинг секций (Этап 2)
    - Автозаполнение секций из Project State (Этап 3)
    """
    logger.info(f"GDD auto-fill for user {current_user.id}")

    try:
        service = await get_gdd_service()
        gdd_input = _request_to_input(input_data)

        # Этап 1: Формат
        format_spec = await service.determine_gdd_format(gdd_input)

        # Этап 2: Маппинг
        data_mapping = await service.map_project_to_sections(format_spec, gdd_input)

        # Этап 3: Автозаполнение
        result = await service.generate_auto_sections(data_mapping, gdd_input)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GDD auto-fill: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in GDD auto-fill: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/generate")
async def generate_gdd(
    input_data: GDDGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Полный пайплайн генерации GDD — Этапы 1–5 (алгоритм 3.7).

    Выполняет:
    1. Определение формата GDD → GDDFormatSpec
    2. Маппинг Project State → секции GDD → GDDDataMapping
    3. Автозаполнение секций → AutoFilledSections
    4. AI-генерация и обогащение → AIEnrichedSections
    5. Ручные секции с подсказками → ManualSectionsResult

    Возвращает GDDProfile с результатами всех пяти этапов.
    """
    logger.info(f"GDD generation (stages 1-5) for user {current_user.id}")

    try:
        service = await get_gdd_service()
        gdd_input = _request_to_input(input_data)

        result = await service.generate_stages_1_5(gdd_input)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GDD generation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in GDD generation: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in GDD generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/generate-full")
async def generate_full_gdd(
    input_data: GDDGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Полный пайплайн генерации GDD — Этапы 1–7 (алгоритм 3.7).

    Выполняет:
    1–5: Стандартный пайплайн (format → map → auto_fill → ai → manual)
    6: Сшивка и валидация документа
    7: Форматирование в Markdown

    Для экспорта (Этап 8) используйте /export.

    Возвращает GDDProfile с результатами всех семи этапов.
    """
    logger.info(f"GDD full generation (stages 1-7) for user {current_user.id}")

    try:
        service = await get_gdd_service()
        gdd_input = _request_to_input(input_data)

        result = await service.generate_stages_1_8(gdd_input)
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in GDD full generation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in GDD full generation: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in GDD full generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/checklist")
async def run_checklist(
    input_data: ChecklistInput,
    current_user: User = Depends(get_current_user),
):
    """
    Запуск чек-листов валидации (алгоритм 3.8).

    Типы:
    - mda: MDA-чек
    - balance: Баланс-чек (12 типов)
    - narrative: Нарратив-чек (лудонарративный диссонанс)
    - economy: Экономика-чек
    - schell: Линзы Шелла (113)
    """
    # TODO: Реализация в Фазе 4.D.2
    return {"status": "stub", "checklists": {}, "message": "Checklists will be implemented in Phase 4.D.2"}


@router.post("/export")
async def export_gdd(
    input_data: GDDExportInput,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 8: Экспорт GDD в PDF/DOCX/MD/HTML.

    Принимает GDDProfile (прямой или из запроса), собирает и форматирует
    документ при необходимости, затем экспортирует в выбранный формат.

    Для PDF/DOCX возвращает FileResponse.
    Для MD/HTML возвращает содержимое напрямую.
    """
    logger.info(f"GDD export (format={input_data.format}) for user {current_user.id}")

    try:
        service = await get_gdd_service()

        # Восстанавливаем GDDProfile из dict
        profile = None
        if input_data.gdd_profile:
            try:
                profile = GDDProfile(**input_data.gdd_profile)
            except Exception as e:
                logger.warning(f"Failed to parse gdd_profile: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Некорректный GDDProfile: {str(e)}",
                )

        # Если профиль не предоставлен — нужна генерация
        if not profile:
            raise HTTPException(
                status_code=400,
                detail="Необходимо предоставить gdd_profile. Используйте /generate-full для генерации.",
            )

        # Если профиль не содержит formatted_document — запускаем assemble + format
        if not profile.formatted_document:
            if not profile.assembled_document:
                assembled = await service.assemble_gdd(profile)
                profile.assembled_document = assembled

            # Восстанавливаем input_data для форматирования
            gdd_input = GDDGenerationInput(
                concept=None,
                target_format=profile.format_spec.format,
                target_audience_doc=profile.format_spec.audience,
                detail_level=profile.format_spec.detail_level,
            )

            formatted = service.format_document(
                profile.assembled_document,
                profile.format_spec,
                gdd_input,
            )
            profile.formatted_document = formatted

        # Определяем название проекта
        project_title = "GDD"
        if profile.formatted_document and profile.formatted_document.title:
            project_title = profile.formatted_document.title

        # Экспортируем
        export_format: ExportFormat = input_data.format  # type: ignore
        result = await service.export_gdd(
            profile.formatted_document,
            export_format,
            project_title=project_title,
        )

        if not result.success:
            raise HTTPException(status_code=500, detail=result.error_message)

        # Для PDF/DOCX — отдаём файл
        if result.file_path and export_format in ("pdf", "docx"):
            return FileResponse(
                path=result.file_path,
                filename=result.file_name,
                media_type=result.content_type,
            )

        # Для MD/HTML — отдаём контент напрямую
        return {
            "format": result.format,
            "content": result.content,
            "file_name": result.file_name,
            "content_type": result.content_type,
            "size_bytes": result.size_bytes,
            "success": result.success,
            "error_message": result.error_message,
        }

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error in GDD export: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in GDD export: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
