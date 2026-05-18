"""
Gidede API Service — FastAPI Backend
Фаза 4.A.4: Подключение БД
Фаза 4.A.5: JWT авторизация
Фаза 4.A.8: Полный реестр промптов (31 PromptSpec)
Фаза 4.A.9: Redis: кэш, сессии, Pub/Sub
Фаза 4.A.10: pgvector + RAG-сервис
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.database import init_db, close_db
from app.core.redis_client import get_redis_client, close_redis_client
from app.api.v1.health import router as health_router
from app.api.v1.concept import router as concept_router
from app.api.v1.coreloop import router as coreloop_router
from app.api.v1.mda import router as mda_router
from app.api.v1.balance import router as balance_router
from app.api.v1.economy import router as economy_router
from app.api.v1.gdd import router as gdd_router
from app.api.v1.ai_assistant import router as ai_assistant_router
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.rag import router as rag_router
from app.api.v1.pipeline import router as pipeline_router

# Настройка логирования
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения."""
    # Startup
    await init_db()

    # Инициализация Redis (4.A.9)
    redis_client = await get_redis_client()
    redis_health = await redis_client.health_check()
    print(f"[Gidede] Redis: {redis_health['backend']} ({'OK' if redis_health['available'] else 'FALLBACK'})")

    # Логирование реестра промптов (4.A.8)
    from app.prompts.registry import get_registry_stats
    stats = get_registry_stats()
    print(f"[Gidede] Prompt Registry: {stats['total_prompts']} промптов загружено")

    # Инициализация RAG-сервиса (4.A.10)
    try:
        from app.core.rag_service import get_rag_service
        from app.core.config import settings
        rag = await get_rag_service()
        rag_stats = await rag.get_stats()
        rag_status = "OK" if rag_stats.get("pgvector_enabled") else "DISABLED"
        print(f"[Gidede] RAG Service: {rag_status} ({rag_stats.get('total_chunks', 0)} чанков, model={settings.EMBEDDING_MODEL})")
    except Exception as e:
        print(f"[Gidede] RAG Service: INIT FAILED ({e})")

    yield

    # Shutdown
    await close_redis_client()
    await close_db()


app = FastAPI(
    title="Gidede API",
    description="AI-powered Game Design Assistant — Backend API",
    version=settings.VERSION,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Роутеры ===
app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(projects_router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(concept_router, prefix="/api/v1/concept", tags=["Concept Generator (Block 1)"])
app.include_router(coreloop_router, prefix="/api/v1/coreloop", tags=["Core Loop Designer (Block 2)"])
app.include_router(mda_router, prefix="/api/v1/mda", tags=["MDA Lab (Block 3)"])
app.include_router(balance_router, prefix="/api/v1/balance", tags=["Balance & Simulation (Block 4)"])
app.include_router(economy_router, prefix="/api/v1/economy", tags=["Economy & Progression (Block 5)"])
app.include_router(gdd_router, prefix="/api/v1/gdd", tags=["GDD Generator (Block 6)"])
app.include_router(ai_assistant_router, prefix="/api/v1/ai", tags=["AI Assistant (Block 7)"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG Knowledge Base (4.A.10)"])
app.include_router(pipeline_router, prefix="/api/v1/pipeline", tags=["Pipeline (4.B.12)"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )
