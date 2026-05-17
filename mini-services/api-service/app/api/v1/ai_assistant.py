"""
Блок 7: AI-ассистент — API endpoints
Фаза 4.A.7: Интеграция с AI-сервисом (z.ai + Ollama + OpenAI + Anthropic)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.auth_middleware import get_current_active_user
from app.models.db import User

router = APIRouter()


class ChatMessage(BaseModel):
    """Сообщение чата с AI-ассистентом."""
    message: str
    project_id: Optional[str] = None
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    """Ответ AI-ассистента."""
    reply: str
    model_used: str = ""
    provider: str = ""
    sources: list[dict] = []
    suggestions: list[str] = []
    latency_ms: int = 0
    from_cache: bool = False


class AIStatusResponse(BaseModel):
    """Статус AI-сервиса."""
    available: bool
    providers: dict
    routing_info: dict


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    data: ChatMessage,
    current_user: User = Depends(get_current_active_user),
):
    """
    Чат с AI-ассистентом Gidede.
    Использует PromptExecutor с автоматической маршрутизацией по провайдерам.
    """
    from app.ai import PromptExecutor, PromptRouter, PromptCache, PromptValidator
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider

    # Инициализация провайдеров
    providers = [
        ZAIProvider(),
        OllamaProvider(),
        OpenAIProvider(),
        AnthropicProvider(),
    ]

    # Фильтруем доступные провайдеры
    available_providers = [p for p in providers if p.is_available]

    if not available_providers:
        return ChatResponse(
            reply="AI-сервис временно недоступен. Ни один AI-провайдер не подключён. "
                  "Настройте z.ai, Ollama, OpenAI или Anthropic в переменных окружения.",
            model_used="none",
            provider="none",
        )

    # Создаём компоненты AI-сервиса
    router_instance = PromptRouter(available_providers)
    cache = PromptCache()
    validator = PromptValidator()
    executor = PromptExecutor(available_providers, router_instance, cache, validator)

    # Вызываем AI через единый интерфейс
    try:
        result = await executor.execute(
            prompt_id="AI_CHAT",
            inputs={"message": data.message},
            project_state=data.context,
            user_plan=current_user.plan,
        )

        # Извлекаем текстовый ответ
        if isinstance(result.data, dict):
            reply = result.data.get("reply", result.data.get("content", str(result.data)))
        elif isinstance(result.data, str):
            reply = result.data
        else:
            reply = str(result.data)

        return ChatResponse(
            reply=reply,
            model_used=result.metadata.get("model", ""),
            provider=result.metadata.get("provider", ""),
            latency_ms=result.metadata.get("latency_ms", 0),
            from_cache=result.metadata.get("from_cache", False),
        )

    except Exception as e:
        return ChatResponse(
            reply=f"Ошибка AI-сервиса: {str(e)}. Проверьте настройки провайдеров.",
            model_used="error",
            provider="error",
        )


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
            "models": p.get_available_models()[:5],  # Топ-5 моделей
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
            reply=f"✅ AI-сервис работает!\n\nПровайдер: {result.metadata.get('provider')}\n"
                  f"Модель: {result.metadata.get('model')}\n"
                  f"Латентность: {result.metadata.get('latency_ms')}ms\n\n"
                  f"Результат:\n{reply}",
            model_used=result.metadata.get("model", ""),
            provider=result.metadata.get("provider", ""),
            latency_ms=result.metadata.get("latency_ms", 0),
        )
    except Exception as e:
        return ChatResponse(
            reply=f"❌ Ошибка AI-сервиса: {str(e)}",
            model_used="error",
            provider="error",
        )
