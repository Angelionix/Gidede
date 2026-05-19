"""
Блок 7: AI-ассистент — API endpoints
Фаза 4.D.6–4.D.7: Полный AI-ассистент с контекстом, чатом, подсказками

Endpoints:
- POST /chat           — чат с AI-ассистентом
- POST /chat/stream    — SSE streaming чат
- GET  /suggestions    — контекстные подсказки для блока
- GET  /alerts         — проактивные уведомления
- GET  /history        — история чата
- POST /history/clear  — очистить историю
- GET  /status         — статус AI-сервиса
- POST /test           — тест AI-подключения
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.core.auth_middleware import get_current_active_user
from app.models.db import User

router = APIRouter()


# ============================================================
# Request/Response schemas
# ============================================================

class ChatMessage(BaseModel):
    """Сообщение чата с AI-ассистентом."""
    message: str
    project_id: Optional[str] = None
    context: Optional[dict] = None  # Project State


class ChatResponse(BaseModel):
    """Ответ AI-ассистента."""
    reply: str
    model_used: str = ""
    provider: str = ""
    sources: list[dict] = []
    suggestions: list[str] = []
    latency_ms: int = 0
    from_cache: bool = False


class SuggestionResponse(BaseModel):
    """Контекстные подсказки для блока."""
    block_id: int
    suggestions: list[dict]


class AlertResponse(BaseModel):
    """Проактивные уведомления."""
    alerts: list[dict]
    total: int


class HistoryResponse(BaseModel):
    """История чата."""
    messages: list[dict]
    total: int


class AIStatusResponse(BaseModel):
    """Статус AI-сервиса."""
    available: bool
    providers: dict
    routing_info: dict


# ============================================================
# Helper: create AIAssistantService instance
# ============================================================

async def _get_assistant_service():
    """Создать экземпляр AIAssistantService с доступными провайдерами."""
    from app.ai import PromptExecutor, PromptRouter, PromptCache, PromptValidator
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider
    from app.services.ai_assistant_service import AIAssistantService

    providers = [
        ZAIProvider(),
        OllamaProvider(),
        OpenAIProvider(),
        AnthropicProvider(),
    ]

    available_providers = [p for p in providers if p.is_available]

    if not available_providers:
        # Fallback: используем все провайдеры (они вернут ошибку при вызове)
        available_providers = providers

    router_instance = PromptRouter(available_providers)
    cache = PromptCache()
    validator = PromptValidator()
    executor = PromptExecutor(available_providers, router_instance, cache, validator)

    return AIAssistantService(executor)


# ============================================================
# Endpoints
# ============================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    data: ChatMessage,
    current_user: User = Depends(get_current_active_user),
):
    """
    Чат с AI-ассистентом Gidede.

    Полный пайплайн:
    1. Сборка контекста из Project State
    2. RAG-поиск по базе знаний
    3. Вызов AI через PromptExecutor
    4. Сохранение в историю чата

    Использует AIAssistantService для управления контекстом,
    памятью сессии и RAG.
    """
    service = await _get_assistant_service()

    result = await service.chat(
        message=data.message,
        user_id=current_user.id,
        project_id=data.project_id,
        project_state=data.context,
        user_plan=current_user.plan,
    )

    return ChatResponse(
        reply=result["reply"],
        model_used=result.get("model_used", ""),
        provider=result.get("provider", ""),
        sources=result.get("sources", []),
        suggestions=result.get("suggestions", []),
        latency_ms=result.get("latency_ms", 0),
        from_cache=result.get("from_cache", False),
    )


@router.post("/chat/stream")
async def chat_stream(
    data: ChatMessage,
    current_user: User = Depends(get_current_active_user),
):
    """
    SSE streaming чат с AI-ассистентом.

    Возвращает Server-Sent Events с токенами по мере генерации.
    Формат каждого события:
    - {"type": "message", "content": "...", "sources": [...], "suggestions": [...]}
    - {"type": "done", "latency_ms": 123, "model_used": "...", "provider": "..."}
    """
    service = await _get_assistant_service()

    async def event_generator():
        async for chunk in service.chat_stream(
            message=data.message,
            user_id=current_user.id,
            project_id=data.project_id,
            project_state=data.context,
            user_plan=current_user.plan,
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/suggestions", response_model=SuggestionResponse)
async def get_suggestions(
    block_id: int = Query(..., ge=1, le=8, description="ID блока (1-8)"),
    project_id: Optional[str] = Query(None, description="ID проекта"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Контекстные подсказки для конкретного блока.

    Возвращает список рекомендаций, основанных на:
    - Типичных задачах данного блока
    - Текущем состоянии проекта
    - Выявленных проблемах
    """
    service = await _get_assistant_service()

    # Получаем Project State если указан проект
    project_state = None
    if project_id:
        try:
            from app.core.database import async_session
            from app.models.db import Project
            from sqlalchemy import select

            async with async_session() as session:
                result = await session.execute(
                    select(Project).where(Project.id == project_id)
                )
                project = result.scalar_one_or_none()
                if project and project.state:
                    project_state = project.state
        except Exception:
            pass

    suggestions = await service.generate_suggestions(
        block_id=block_id,
        project_state=project_state,
    )

    return SuggestionResponse(
        block_id=block_id,
        suggestions=[
            {
                "title": s.title,
                "description": s.description,
                "action": s.action,
                "priority": s.priority,
                "data": s.data,
            }
            for s in suggestions
        ],
    )


@router.get("/alerts", response_model=AlertResponse)
async def get_proactive_alerts(
    project_id: Optional[str] = Query(None, description="ID проекта"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Проактивные уведомления AI-ассистента.

    Анализирует текущее состояние проекта и выявляет:
    - Runaway в экономике
    - Deadlock/stall
    - Лудонарративный диссонанс
    - Пробелы в данных (gaps)
    - Дисбаланс
    """
    service = await _get_assistant_service()

    project_state = None
    if project_id:
        try:
            from app.core.database import async_session
            from app.models.db import Project
            from sqlalchemy import select

            async with async_session() as session:
                result = await session.execute(
                    select(Project).where(Project.id == project_id)
                )
                project = result.scalar_one_or_none()
                if project and project.state:
                    project_state = project.state
        except Exception:
            pass

    alerts = await service.check_proactive_alerts(project_state)

    return AlertResponse(
        alerts=[
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "block_id": a.block_id,
                "title": a.title,
                "description": a.description,
                "suggestion": a.suggestion,
                "timestamp": a.timestamp,
            }
            for a in alerts
        ],
        total=len(alerts),
    )


@router.get("/history", response_model=HistoryResponse)
async def get_chat_history(
    project_id: Optional[str] = Query(None, description="ID проекта"),
    limit: int = Query(50, ge=1, le=200, description="Макс. сообщений"),
    current_user: User = Depends(get_current_active_user),
):
    """
    История чата с AI-ассистентом.

    Возвращает последние сообщения из текущей сессии.
    """
    service = await _get_assistant_service()

    messages = await service.get_chat_history(
        user_id=current_user.id,
        project_id=project_id,
        limit=limit,
    )

    return HistoryResponse(
        messages=[
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp,
                "metadata": m.metadata,
            }
            for m in messages
        ],
        total=len(messages),
    )


@router.post("/history/clear")
async def clear_chat_history(
    project_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
):
    """Очистить историю чата."""
    service = await _get_assistant_service()
    await service.manage_session(
        user_id=current_user.id,
        project_id=project_id,
        action="clear",
    )
    return {"status": "cleared"}


@router.get("/status", response_model=AIStatusResponse)
async def get_ai_status():
    """
    Статус AI-сервиса — какие провайдеры доступны.
    Публичный эндпоинт (не требует авторизации).
    """
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider
    from app.ai.router import PromptRouter

    providers = [
        ZAIProvider(),
        OllamaProvider(),
        OpenAIProvider(),
        AnthropicProvider(),
    ]

    provider_status = {}
    for p in providers:
        provider_status[p.name] = {
            "available": p.is_available,
            "models": p.get_available_models()[:5],
            "priority": p.config.priority,
        }

    available_count = sum(1 for p in providers if p.is_available)
    router_instance = PromptRouter([p for p in providers if p.is_available] or providers)

    return AIStatusResponse(
        available=available_count > 0,
        providers=provider_status,
        routing_info=router_instance.get_routing_info(),
    )


@router.post("/test", response_model=ChatResponse)
async def test_ai_connection(
    current_user: User = Depends(get_current_active_user),
):
    """
    Тестовый вызов AI — проверка подключения провайдеров.
    Вызывает CLASSIFY_GENRE с тестовым входом.
    """
    from app.ai import PromptExecutor, PromptRouter, PromptCache, PromptValidator
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider

    providers = [
        ZAIProvider(),
        OllamaProvider(),
        OpenAIProvider(),
        AnthropicProvider(),
    ]

    available_providers = [p for p in providers if p.is_available]

    if not available_providers:
        return ChatResponse(
            reply="Нет доступных AI-провайдеров. Настройте переменные окружения: "
                  "ZAI_API_KEY, OLLAMA_BASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY",
        )

    router_instance = PromptRouter(available_providers)
    cache = PromptCache()
    validator = PromptValidator()
    executor = PromptExecutor(available_providers, router_instance, cache, validator)

    try:
        result = await executor.execute(
            prompt_id="CLASSIFY_GENRE",
            inputs={"idea": "Игра про алхимика, который варит зелья и исследует подземелья"},
            user_plan=current_user.plan,
        )

        import json
        reply = json.dumps(result.data, ensure_ascii=False, indent=2) if not isinstance(result.data, str) else result.data

        return ChatResponse(
            reply=f"AI-сервис работает!\n\nПровайдер: {result.metadata.get('provider')}\n"
                  f"Модель: {result.metadata.get('model')}\n"
                  f"Латентность: {result.metadata.get('latency_ms')}ms\n\n"
                  f"Результат:\n{reply}",
            model_used=result.metadata.get("model", ""),
            provider=result.metadata.get("provider", ""),
            latency_ms=result.metadata.get("latency_ms", 0),
        )
    except Exception as e:
        return ChatResponse(
            reply=f"Ошибка AI-сервиса: {str(e)}",
            model_used="error",
            provider="error",
        )
