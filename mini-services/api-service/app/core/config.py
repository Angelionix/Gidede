"""Конфигурация API-сервиса Gidede."""

import os
from typing import List


class Settings:
    """Настройки приложения из переменных окружения."""

    # Приложение
    APP_NAME: str = "Gidede API"
    VERSION: str = "0.2.0"
    DEBUG: bool = os.getenv("NODE_ENV", "development") == "development"
    PORT: int = int(os.getenv("API_SERVICE_PORT", "3030"))

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # AI API
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # Database
    DATABASE_URL: str = os.getenv("POSTGRES_URL", "postgresql://gidede:gidede_dev@localhost:5432/gidede")

    # JWT Auth (Фаза 4.A.5)
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "gidede_dev_secret_key_change_in_production_2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # AI Rate Limits
    FREE_AI_CALLS_LIMIT: int = 50     # Лимит AI-вызовов для free плана (в день)
    PRO_AI_CALLS_LIMIT: int = 500     # Лимит AI-вызовов для pro плана (в день)


settings = Settings()
