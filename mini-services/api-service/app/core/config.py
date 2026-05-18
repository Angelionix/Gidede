"""Конфигурация API-сервиса Gidede."""

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


def _read_version() -> str:
    """Читает версию из файла VERSION в корне монорепозитория."""
    version_file = Path(__file__).resolve().parent.parent.parent.parent.parent / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "0.2.0"


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Приложение
    APP_NAME: str = "Gidede API"
    VERSION: str = _read_version()
    DEBUG: bool = False
    PORT: int = 3030

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # AI API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # z.ai (основной провайдер)
    ZAI_API_KEY: str = ""
    ZAI_BASE_URL: str = "https://api.z.ai/v1"

    # Ollama (локальные/облачные модели)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_API_KEY: str = ""
    OLLAMA_DEFAULT_MODEL: str = "llama3"
    OLLAMA_CLOUD_MODE: bool = False
    OLLAMA_TIMEOUT: int = 120

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Database
    DATABASE_URL: str = "postgresql://gidede:gidede_dev@localhost:5432/gidede"

    # JWT Auth (Фаза 4.A.5)
    # TD-017: В production JWT_SECRET_KEY ОБЯЗАТЕЛЬНО задавать через env-переменную.
    # Значение по умолчанию — только для локальной разработки!
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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
    AI_DEFAULT_PROVIDER: str = "auto"  # auto/zai/ollama/openai/anthropic
    AI_CACHE_ENABLED: bool = True
    AI_CACHE_DEFAULT_TTL: int = 600

    # RAG / Embedding Configuration (4.A.10)
    EMBEDDING_PROVIDER: str = "openai"  # openai/zai/local
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    EMBEDDING_API_KEY: str = ""  # Если пусто — используется OPENAI_API_KEY
    EMBEDDING_BASE_URL: str = ""  # Кастомный URL (для z.ai)
    RAG_CHUNK_SIZE_TOKENS: int = 500
    RAG_CHUNK_OVERLAP_TOKENS: int = 50
    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    RAG_ENABLED: bool = True


settings = Settings()
