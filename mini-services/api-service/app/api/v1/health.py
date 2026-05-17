"""Health check endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

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
    return HealthResponse(
        status="ok",
        version="0.1.0",
        timestamp=datetime.utcnow(),
        services={
            "api": "ok",
            "postgres": "not_configured",
            "redis": "not_configured",
            "ai_service": "not_configured",
        },
    )


@router.get("/health/detailed")
async def health_detailed():
    """Детальная проверка состояния всех компонентов."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "components": {
            "api": {"status": "ok", "port": 3030},
            "postgres": {"status": "not_configured", "note": "Настроить в 4.A.4"},
            "redis": {"status": "not_configured", "note": "Настроить в 4.A.9"},
            "ai_service": {"status": "not_configured", "note": "Настроить в 4.A.7"},
            "prompt_registry": {"status": "not_configured", "note": "Настроить в 4.A.8"},
        },
        "blocks": {
            "block_1_concept": "skeleton",
            "block_2_coreloop": "skeleton",
            "block_3_mda": "skeleton",
            "block_4_balance": "skeleton",
            "block_5_economy": "skeleton",
            "block_6_gdd": "skeleton",
            "block_7_ai_assistant": "skeleton",
            "block_8_gbe_bridge": "not_started",
        },
    }
