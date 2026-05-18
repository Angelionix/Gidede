"""API v1 — все роутеры."""

from .health import router as health_router
from .concept import router as concept_router
from .coreloop import router as coreloop_router
from .mda import router as mda_router
from .balance import router as balance_router
from .progression import router as progression_router
from .economy import router as economy_router
from .gdd import router as gdd_router
from .ai_assistant import router as ai_assistant_router

__all__ = [
    "health_router",
    "concept_router",
    "coreloop_router",
    "mda_router",
    "balance_router",
    "progression_router",
    "economy_router",
    "gdd_router",
    "ai_assistant_router",
]
