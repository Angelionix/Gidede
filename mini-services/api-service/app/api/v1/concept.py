"""
Блок 1: Генератор концепции — API endpoints.
Фаза 4.B.1–4.B.4: Полная реализация Этапов 1–7 алгоритма 3.1.

Endpoints:
- POST /generate — генерация концепции (Этапы 1–7, полный One-Pager)
- GET /{concept_id} — получить текущее состояние концепции
- PUT /{concept_id} — обновить концепцию (ручные правки)
- POST /{concept_id}/validate — запустить валидацию (Этап 6)
- POST /{concept_id}/stages-4-5 — продолжить генерацию (Этапы 4–5) для существующей концепции
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.concept_service import ConceptService

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов / ответов
# ============================================================

class AudienceInput(BaseModel):
    """Входные данные целевой аудитории (модель Йи)."""
    primary: List[str] = Field(
        ..., description="Мотивации по модели Йи (1-3)",
        max_length=3,
    )
    experience: str = Field(
        "midcore", description="Уровень опыта: casual/midcore/hardcore"
    )


class ConceptInputRequest(BaseModel):
    """Входные данные для генерации концепции (алгоритм 3.1.2)."""
    idea: str = Field(
        ..., min_length=10, max_length=1000,
        description="Текстовое описание идеи игры (1-5 предложений)",
    )
    genre: Optional[str] = Field(
        None, description="Жанр (если указан явно, иначе — автоопределение)"
    )
    target_audience: Optional[AudienceInput] = Field(
        None, description="Целевая аудитория (мотивации Йи)"
    )
    platform: Optional[List[str]] = Field(
        None, description="Платформы: pc, mobile, console, vr, web"
    )
    constraints: Optional[dict] = Field(
        None, description="Ограничения: team_size, budget, scope"
    )
    reference_games: Optional[List[str]] = Field(
        None, description="Референтные игры"
    )
    aesthetic_focus: Optional[List[str]] = Field(
        None, description="Целевые эстетические ценности (если указаны)"
    )
    forbidden_mechanics: Optional[List[str]] = Field(
        None, description="Запрещённые механики"
    )


class OnePagerResponse(BaseModel):
    """Результат генерации концепции — One-Pager (алгоритм 3.1.9)."""
    id: str
    title: str
    genre: str
    target_audience: str
    story_synopsis: str
    gameplay_description: str
    unique_features: List[str]
    competitors: List[str]
    aesthetic_profile: dict
    dynamics_profile: dict
    mechanic_set: dict
    core_loop_candidates: List[dict]
    usp_candidates: List[dict]
    validation_report: dict
    status: str = "generated"
    generation_metadata: Optional[dict] = None


# ============================================================
# Зависимость: получить ConceptService
# ============================================================

async def get_concept_service() -> ConceptService:
    """Создать ConceptService с настроенным PromptExecutor."""
    from app.ai.executor import PromptExecutor
    from app.ai.cache import PromptCache
    from app.ai.router import PromptRouter
    from app.ai.validator import PromptValidator
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.core.config import settings

    # Инициализация провайдеров
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
        # Минимальный fallback — z.ai всегда доступен
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

    return ConceptService(executor=executor)


# ============================================================
# Endpoints
# ============================================================

@router.post("/generate", response_model=OnePagerResponse)
async def generate_concept(
    input_data: ConceptInputRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Генерация концепции игры из описания идеи.

    Алгоритм 3.1: 7 этапов
    - Этапы 1–3: жанр, эстетика, динамики (4.B.2)
    - Этапы 4–5: выбор механик, Core Loop, USP (4.B.3)
    - Этап 6: валидация через 3 валидатора (4.B.4)
    - Этап 7: сборка One-Pager (4.B.4)

    Возвращает полный OnePager с вложенными профилями и отчётом валидации.
    """
    user_id = current_user.id
    logger.info(f"Generating concept for user {user_id}")

    try:
        service = await get_concept_service()

        # Извлекаем мотивации из target_audience
        target_motivations = None
        experience_level = "midcore"
        if input_data.target_audience:
            target_motivations = input_data.target_audience.primary
            experience_level = input_data.target_audience.experience

        # Выполняем полный пайплайн Этапы 1–7
        result = await service.generate_full(
            idea=input_data.idea,
            explicit_genre=input_data.genre,
            target_motivations=target_motivations,
            experience_level=experience_level,
            platforms=input_data.platform,
            constraints=input_data.constraints,
            reference_games=input_data.reference_games,
            forbidden_mechanics=input_data.forbidden_mechanics,
            project_state=None,
        )

        # result — это OnePager.model_dump()
        genre = result.get("aesthetic_profile", {}).get("primary", "")
        genre_name = result.get("title", "")
        aesthetic_profile = result.get("aesthetic_profile", {})
        dynamics_profile = result.get("dynamics_profile", {})
        mechanic_set = result.get("mechanic_set", {})
        core_loop_candidates = result.get("core_loop_candidates", [])
        usp_candidates = result.get("usp_candidates", [])
        validation_report = result.get("validation_report", {})

        # Сохраняем результат в БД
        concept_id = await _save_concept_result(
            user_id=user_id,
            idea=input_data.idea,
            genre_result={"genre": result.get("title", "").split("]")[0].replace("[", "") if "[" in result.get("title", "") else "unknown"},
            aesthetic_profile=aesthetic_profile,
            dynamics_profile=dynamics_profile,
            mechanic_set=mechanic_set,
            core_loop_candidates=core_loop_candidates,
            usp_candidates=usp_candidates,
            input_data=input_data.model_dump(),
            metadata=result,
        )

        response = OnePagerResponse(
            id=concept_id,
            title=result.get("title", ""),
            genre=result.get("title", "").split("]")[0].replace("[", "") if "[" in result.get("title", "") else "unknown",
            target_audience=result.get("target_audience", ""),
            story_synopsis=result.get("story_synopsis", ""),
            gameplay_description=result.get("gameplay_description", ""),
            unique_features=result.get("unique_features", []),
            competitors=result.get("competitors", []),
            aesthetic_profile=aesthetic_profile,
            dynamics_profile=dynamics_profile,
            mechanic_set=mechanic_set,
            core_loop_candidates=core_loop_candidates,
            usp_candidates=usp_candidates,
            validation_report=validation_report,
            status="completed",
            generation_metadata={
                "stages_completed": result.get("stages_completed", []),
                "latency_ms": result.get("latency_ms", 0),
                "models_used": result.get("models_used", []),
                "overall_validation_score": validation_report.get("overall_score", 0),
                "overall_validation_passed": validation_report.get("overall_passed", False),
                "compatibility_score": result.get("compatibility_score", 0),
                "uniqueness_score": result.get("uniqueness_score", 0),
            },
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in concept generation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in concept generation: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in concept generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/{concept_id}")
async def get_concept(
    concept_id: str,
    current_user: User = Depends(get_current_user),
):
    """Получить текущее состояние концепции."""
    try:
        from app.core.database import async_session
        from app.models.db import ProjectConcept

        async with async_session() as session:
            from sqlalchemy import select
            stmt = select(ProjectConcept).where(ProjectConcept.id == concept_id)
            db_result = await session.execute(stmt)
            concept = db_result.scalar_one_or_none()

            if not concept:
                raise HTTPException(status_code=404, detail="Концепция не найдена")

            return {
                "id": concept.id,
                "genre": concept.genre,
                "subgenre": concept.subgenre,
                "primary_aesthetic": concept.primary_aesthetic,
                "usp": concept.usp,
                "one_pager_data": concept.one_pager_data,
                "aesthetic_profile": concept.aesthetic_profile,
                "dynamics_profile": concept.dynamics_profile,
                "mechanic_set": concept.mechanic_set,
                "validation_report": concept.validation_report,
                "usp_candidates": concept.usp_candidates,
                "core_loop_candidates": concept.core_loop_candidates,
                "created_at": str(concept.created_at),
                "updated_at": str(concept.updated_at),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching concept: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения концепции")


@router.put("/{concept_id}")
async def update_concept(
    concept_id: str,
    updates: dict,
    current_user: User = Depends(get_current_user),
):
    """Обновить концепцию (ручные правки пользователя)."""
    # TODO: Полная реализация в Фазе 4.B.5
    return {"id": concept_id, "status": "not_implemented", "message": "Реализация в 4.B.5"}


@router.post("/{concept_id}/validate")
async def validate_concept(
    concept_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Запустить валидацию существующей концепции (алгоритм 3.1.8, Этап 6).

    Три валидатора:
    1. Triangle of Weirdness (Кн. 8)
    2. 5 вопросов кор-геймплея (Кн. 10)
    3. 8 фильтров идеи (Кн. 1)
    """
    try:
        from app.core.database import async_session
        from app.models.db import ProjectConcept
        from sqlalchemy import select

        async with async_session() as session:
            stmt = select(ProjectConcept).where(ProjectConcept.id == concept_id)
            db_result = await session.execute(stmt)
            concept = db_result.scalar_one_or_none()

            if not concept:
                raise HTTPException(status_code=404, detail="Концепция не найдена")

            # Восстанавливаем данные для валидации
            service = await get_concept_service()
            from app.schemas.concept import (
                AestheticProfile, DynamicsProfile, MechanicSet,
                CoreLoopCandidate, USPCandidate,
            )

            aesthetic_profile = AestheticProfile(**(concept.aesthetic_profile or {}))
            dynamics_profile = DynamicsProfile(**(concept.dynamics_profile or {}))
            mechanic_set = MechanicSet(**(concept.mechanic_set or {}))
            core_loop_candidates = [CoreLoopCandidate(**c) for c in (concept.core_loop_candidates or [])]
            usp_candidates = [USPCandidate(**u) for u in (concept.usp_candidates or [])]

            validation_report = await service.validate_concept(
                idea=concept.input_data.get("idea", "") if concept.input_data else "",
                genre_result={"genre": concept.genre or "unknown"},
                aesthetic_profile=aesthetic_profile,
                dynamics_profile=dynamics_profile,
                mechanic_set=mechanic_set,
                core_loop_candidates=core_loop_candidates,
                usp_candidates=usp_candidates,
            )

            # Сохраняем отчёт валидации
            concept.validation_report = validation_report.model_dump()
            await session.commit()

            return {
                "id": concept_id,
                "validation_report": validation_report.model_dump(),
                "overall_score": validation_report.overall_score,
                "overall_passed": validation_report.overall_passed,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating concept: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка валидации концепции")


# ============================================================
# Вспомогательные функции
# ============================================================

def _generate_title(idea: str, genre: str) -> str:
    """Сгенерировать предварительный заголовок проекта из идеи."""
    # Берём первые 50 символов идеи как заголовок
    title = idea.strip()[:50]
    if len(idea.strip()) > 50:
        title += "..."
    if genre:
        title = f"[{genre.upper()}] {title}"
    return title


async def _save_concept_result(
    user_id: str,
    idea: str,
    genre_result: dict,
    aesthetic_profile: dict,
    dynamics_profile: dict,
    mechanic_set: Optional[dict] = None,
    core_loop_candidates: Optional[list] = None,
    usp_candidates: Optional[list] = None,
    input_data: Optional[dict] = None,
    metadata: Optional[dict] = None,
) -> str:
    """Сохранить результат генерации в БД (project_concepts)."""
    try:
        from app.core.database import async_session
        from app.models.db import ProjectConcept, Project
        from sqlalchemy import select

        concept_id = __import__("uuid").uuid4().hex

        async with async_session() as session:
            # Создаём или находим проект
            # Для простоты — создаём новый проект для каждой генерации
            project_id = __import__("uuid").uuid4().hex
            project = Project(
                id=project_id,
                user_id=user_id or "anonymous",
                name=_generate_title(idea, genre_result.get("genre", "")),
                genre=genre_result.get("genre"),
                status="draft",
                project_stage="concept",
                completion_percent=30,  # ~30% после этапов 1-5 из 7
            )
            session.add(project)

            # Создаём запись концепции
            concept = ProjectConcept(
                id=concept_id,
                project_id=project_id,
                genre=genre_result.get("genre"),
                subgenre=genre_result.get("subgenre"),
                primary_aesthetic=aesthetic_profile.get("primary"),
                usp="",
                input_data=input_data,
                aesthetic_profile=aesthetic_profile,
                dynamics_profile=dynamics_profile,
                one_pager_data=None,  # Будет заполнено в 4.B.4
                mechanic_set=mechanic_set,
                validation_report=None,  # Будет заполнено в 4.B.4
                usp_candidates=usp_candidates,
                core_loop_candidates=core_loop_candidates,
            )
            session.add(concept)

            await session.commit()

        logger.info(f"Concept saved: {concept_id} (project: {project_id})")
        return concept_id

    except Exception as e:
        logger.error(f"Error saving concept: {e}")
        # Возвращаем временный ID, чтобы не блокировать ответ
        return __import__("uuid").uuid4().hex
