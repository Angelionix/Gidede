"""Конфигурация API-сервиса Gidede."""

import os
from pathlib import Path
from typing import List


def _read_version() -> str:
    """Читает версию из файла VERSION в корне монорепозитория."""
    version_file = Path(__file__).resolve().parent.parent.parent.parent.parent / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "0.2.0"


class Settings:
    """Настройки приложения из переменных окружения."""

    # Приложение
    APP_NAME: str = "Gidede API"
    VERSION: str = _read_version()
    DEBUG: bool = os.getenv("NODE_ENV", "development") == "development"
    PORT: int = int(os.getenv("API_SERVICE_PORT", "3030"))

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # AI API Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # z.ai (основной провайдер)
    ZAI_API_KEY: str = os.getenv("ZAI_API_KEY", "")
    ZAI_BASE_URL: str = os.getenv("ZAI_BASE_URL", "https://api.z.ai/v1")

    # Ollama (локальные/облачные модели)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_API_KEY: str = os.getenv("OLLAMA_API_KEY", "")
    OLLAMA_DEFAULT_MODEL: str = os.getenv("OLLAMA_DEFAULT_MODEL", "llama3")
    OLLAMA_CLOUD_MODE: bool = os.getenv("OLLAMA_CLOUD_MODE", "false").lower() == "true"
    OLLAMA_TIMEOUT: int = int(os.getenv("OLLAMA_TIMEOUT", "120"))

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # Database
    DATABASE_URL: str = os.getenv("POSTGRES_URL", "postgresql://gidede:gidede_dev@localhost:5432/gidede")

    # JWT Auth (Фаза 4.A.5)
    # TD-017: В production JWT_SECRET_KEY ОБЯЗАТЕЛЬНО задавать через env-переменную.
    # Значение по умолчанию — только для локальной разработки!
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Автоматическая генерация dev-ключа при отсутствии env-переменной
    @property
    def jwt_secret(self) -> str:
        """Возвращает JWT secret с автоматической генерацией для dev-окружения."""
        if self.JWT_SECRET_KEY:
            return self.JWT_SECRET_KEY
        if self.DEBUG:
            import hashlib
            dev_key = hashlib.sha256(b"gidede_dev_secret_key_2026").hexdigest()
            import warnings
            warnings.warn(
                "JWT_SECRET_KEY не задан через env-переменную! "
                "Используется автоматически сгенерированный dev-ключ. "
                "В production ОБЯЗАТЕЛЬНО установите JWT_SECRET_KEY.",
                stacklevel=2,
            )
            return dev_key
        raise RuntimeError(
            "JWT_SECRET_KEY не задан! В production-окружении "
            "обязательно установите переменную JWT_SECRET_KEY."
        )

    # AI Rate Limits
    FREE_AI_CALLS_LIMIT: int = 50     # Лимит AI-вызовов для free плана (в день)
    PRO_AI_CALLS_LIMIT: int = 500     # Лимит AI-вызовов для pro плана (в день)

    # AI Service Configuration
    AI_DEFAULT_PROVIDER: str = os.getenv("AI_DEFAULT_PROVIDER", "auto")  # auto/zai/ollama/openai/anthropic
    AI_CACHE_ENABLED: bool = os.getenv("AI_CACHE_ENABLED", "true").lower() == "true"
    AI_CACHE_DEFAULT_TTL: int = int(os.getenv("AI_CACHE_DEFAULT_TTL", "600"))

    # RAG / Embedding Configuration (4.A.10)
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "openai")  # openai/zai/local
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    EMBEDDING_DIMENSIONS: int = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
    EMBEDDING_API_KEY: str = os.getenv("EMBEDDING_API_KEY", "")  # Если пусто — используется OPENAI_API_KEY
    EMBEDDING_BASE_URL: str = os.getenv("EMBEDDING_BASE_URL", "")  # Кастомный URL (для z.ai)
    RAG_CHUNK_SIZE_TOKENS: int = int(os.getenv("RAG_CHUNK_SIZE_TOKENS", "500"))
    RAG_CHUNK_OVERLAP_TOKENS: int = int(os.getenv("RAG_CHUNK_OVERLAP_TOKENS", "50"))
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))
    RAG_SIMILARITY_THRESHOLD: float = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.7"))
    RAG_ENABLED: bool = os.getenv("RAG_ENABLED", "true").lower() == "true"


settings = Settings()
