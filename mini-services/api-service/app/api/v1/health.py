"""
Health check endpoint.
Фаза 4.A.6–4.A.7: Обновлён для отображения статуса AI-провайдеров и проектов.
Фаза 4.E.7: Расширенный мониторинг — uptime, Redis, /health/metrics, /health/detailed.
"""

from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.core.config import settings

router = APIRouter()

# Глобальное время старта
_START_TIME = time.time()

# Попытка импорта psutil
try:
    import psutil

    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


class HealthResponse(BaseModel):
    """Ответ health check."""

    status: str
    version: str
    timestamp: datetime
    uptime_seconds: float = 0.0
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

    # Проверка Redis
    redis_status = "not_configured"
    try:
        from app.core.redis_client import get_redis_client

        redis_client = await get_redis_client()
        redis_health = await redis_client.health_check()
        if redis_health.get("available"):
            redis_status = "ok"
        else:
            redis_status = f"fallback ({redis_health.get('backend', 'unknown')})"
    except Exception:
        redis_status = "not_configured"

    uptime = time.time() - _START_TIME

    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        timestamp=datetime.utcnow(),
        uptime_seconds=round(uptime, 2),
        services={
            "api": "ok",
            "database": "ok" if settings.DATABASE_URL else "not_configured",
            "redis": redis_status,
            "ai_service": ai_status,
        },
    )


@router.get("/health/metrics")
async def health_metrics():
    """
    Метрики системы для мониторинга (CPU, memory, проекты).

    Фаза 4.E.7: Мониторинг ресурсов.
    """
    uptime = time.time() - _START_TIME

    metrics = {
        "status": "ok",
        "version": settings.VERSION,
        "uptime_seconds": round(uptime, 2),
    }

    # CPU и Memory через psutil
    if PSUTIL_AVAILABLE:
        metrics["cpu"] = {
            "percent": psutil.cpu_percent(interval=0.1),
            "count": psutil.cpu_count(),
        }
        mem = psutil.virtual_memory()
        metrics["memory"] = {
            "total_mb": round(mem.total / (1024 * 1024), 1),
            "available_mb": round(mem.available / (1024 * 1024), 1),
            "used_mb": round(mem.used / (1024 * 1024), 1),
            "percent": mem.percent,
        }
    else:
        metrics["cpu"] = {"note": "psutil not installed"}
        metrics["memory"] = {"note": "psutil not installed"}

    # Количество проектов
    try:
        from app.core.database import get_session

        async with get_session() as session:
            result = await session.execute(
                __import__("sqlalchemy").text("SELECT COUNT(*) FROM projects")
            )
            project_count = result.scalar() or 0
            metrics["projects_total"] = project_count
    except Exception:
        metrics["projects_total"] = "unavailable"

    return metrics


@router.get("/health/detailed")
async def health_detailed():
    """Детальная проверка состояния всех компонентов."""
    # AI провайдеры
    ai_providers = {}
    routing_info = {}
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

    # Redis info
    redis_info = {"status": "not_configured"}
    try:
        from app.core.redis_client import get_redis_client

        redis_client = await get_redis_client()
        redis_health = await redis_client.health_check()
        redis_info = {
            "status": "ok" if redis_health.get("available") else "fallback",
            "backend": redis_health.get("backend", "unknown"),
            "available": redis_health.get("available", False),
        }
    except Exception as e:
        redis_info = {"status": "error", "error": str(e)}

    # Prompt registry stats
    registry_stats = {}
    try:
        from app.prompts.registry import get_registry_stats

        registry_stats = get_registry_stats()
    except Exception as e:
        registry_stats = {"status": "error", "error": str(e)}

    # RAG info
    rag_info = {"status": "not_configured"}
    try:
        from app.core.rag_service import get_rag_service

        rag = await get_rag_service()
        rag_info = await rag.get_stats()
    except Exception as e:
        rag_info = {"status": "error", "error": str(e)}

    # Rate limits
    rate_limits = {
        "free_daily_limit": settings.FREE_AI_CALLS_LIMIT,
        "pro_daily_limit": settings.PRO_AI_CALLS_LIMIT,
    }

    uptime = time.time() - _START_TIME

    return {
        "status": "ok",
        "version": settings.VERSION,
        "uptime_seconds": round(uptime, 2),
        "components": {
            "api": {"status": "ok", "port": settings.PORT},
            "database": {
                "status": "ok",
                "url_type": "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite",
            },
            "redis": redis_info,
            "ai_service": {
                "status": "ok" if ai_providers else "not_configured",
                "providers": ai_providers,
                "routing": routing_info,
            },
            "prompt_registry": registry_stats,
            "rag_service": rag_info,
        },
        "features": {
            "auth": "ok",
            "projects_crud": "ok",
            "ai_providers": list(ai_providers.keys()),
        },
        "rate_limits": rate_limits,
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
