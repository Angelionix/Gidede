"""
Gidede — Alembic env.py
Фаза 4.A.4: Настройка миграций для Project State
"""

from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, pool, create_engine

from alembic import context

# Импорт всех моделей для autogenerate
from app.core.database import Base
from app.models.db import (  # noqa: F401 — импорт нужен для регистрации моделей в Base.metadata
    User, RefreshToken, Project,
    ProjectConcept, ProjectCoreLoop, ProjectMDAProfile,
    ProjectBalanceResult, ProjectProgression, ProjectEconomy,
    ProjectGDD, ProjectChecklist, MechanicDB, PromptLog,
)

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Получаем URL из DATABASE_URL, конвертируем async → sync для Alembic
raw_url = os.getenv("DATABASE_URL", "")

if not raw_url:
    sync_url = "sqlite:///./gidede_dev.db"
elif raw_url.startswith("file:"):
    path = raw_url[5:]
    sync_url = f"sqlite:///{path}"
elif raw_url.startswith("sqlite"):
    # sqlite+aiosqlite:/// → sqlite:///
    sync_url = raw_url.replace("sqlite+aiosqlite:///", "sqlite:///", 1)
elif raw_url.startswith("postgresql+asyncpg://"):
    sync_url = raw_url.replace("postgresql+asyncpg://", "postgresql://", 1)
elif raw_url.startswith("postgres://"):
    sync_url = raw_url.replace("postgres://", "postgresql://", 1)
else:
    sync_url = raw_url

config.set_main_option("sqlalchemy.url", sync_url)

# MetaData для autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using sync engine."""
    url = config.get_main_option("sqlalchemy.url")

    # Создаём sync engine напрямую
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(url)

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()

    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
