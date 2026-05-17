"""
Health check endpoint.
Фаза 4.A.6–4.A.7: Обновлён для отображения статуса AI-провайдеров и проектов.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

from app.core.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    """Ответ health check."""
    status: str
    version: str
    timestamp: datetime
    services: dict


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Проверка состояния API-сервиса."""
    # Быстрая проверка AI-провайдеров
    ai_status = "not_configured"
    try:
        from app.ai.providers.zai_provider import ZAIProvider
        from app.ai.providers.ollama_provider import OllamaProvider
        from app.ai.providers.openai_provider import OpenAIProvider
        from app.ai.providers.anthropic_provider import AnthropicProvider

        providers = [ZAIProvider(), OllamaProvider(), OpenAIProvider(), AnthropicProvider()]
        available = [p.name for p in providers if p.is_available]
        if available:
            ai_status = f"ok ({', '.join(available)})"
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        timestamp=datetime.utcnow(),
        services={
            "api": "ok",
            "database": "ok" if settings.DATABASE_URL else "not_configured",
            "redis": "not_configured",
            "ai_service": ai_status,
        },
    )


@router.get("/health/detailed")
async def health_detailed():
    """Детальная проверка состояния всех компонентов."""
    # AI провайдеры
    ai_providers = {}
    try:
        from app.ai.providers.zai_provider import ZAIProvider
        from app.ai.providers.ollama_provider import OllamaProvider
        from app.ai.providers.openai_provider import OpenAIProvider
        from app.ai.providers.anthropic_provider import AnthropicProvider
        from app.ai.router import PromptRouter

        providers = [ZAIProvider(), OllamaProvider(), OpenAIProvider(), AnthropicProvider()]
        for p in providers:
            ai_providers[p.name] = {
                "available": p.is_available,
                "priority": p.config.priority,
                "models": p.get_available_models()[:3],
            }

        available_providers = [p for p in providers if p.is_available]
        routing_info = PromptRouter(available_providers or providers).get_routing_info()
    except Exception as e:
        routing_info = {"error": str(e)}

    return {
        "status": "ok",
        "version": settings.VERSION,
        "components": {
            "api": {"status": "ok", "port": settings.PORT},
            "database": {
                "status": "ok",
                "url_type": "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite",
            },
            "redis": {"status": "not_configured", "note": "Настроить в 4.A.9"},
            "ai_service": {
                "status": "ok" if ai_providers else "not_configured",
                "providers": ai_providers,
                "routing": routing_info,
            },
            "prompt_registry": {"status": "stub", "note": "Полная реализация в 4.A.8"},
        },
        "features": {
            "auth": "ok",
            "projects_crud": "ok",
            "ai_providers": list(ai_providers.keys()),
        },
        "blocks": {
            "block_1_concept": "skeleton",
            "block_2_coreloop": "skeleton",
            "block_3_mda": "skeleton",
            "block_4_balance": "skeleton",
            "block_5_economy": "skeleton",
            "block_6_gdd": "skeleton",
            "block_7_ai_assistant": "active",
            "block_8_gbe_bridge": "not_started",
        },
    }
