"""
Gidede — Backend Test Configuration (conftest.py)
Фаза 4.A.11: Локальная тестовая инфраструктура

Общие фикстуры для pytest:
- test_app: FastAPI TestClient (async)
- test_db: in-memory SQLite для тестов
- test_client: httpx AsyncClient
- mock_ai_provider: мок AI-провайдера
- sample_project_state: тестовый Project State
"""

import asyncio
import os
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

# Установить тестовое окружение ДО импорта приложения
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_gidede.db"
os.environ["REDIS_URL"] = "redis://localhost:6379"
os.environ["RAG_ENABLED"] = "false"
os.environ["AI_DEFAULT_PROVIDER"] = "auto"
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["ANTHROPIC_API_KEY"] = "test-key"
os.environ["ZAI_API_KEY"] = "test-key"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


# ============================================================
# Event Loop
# ============================================================

@pytest.fixture(scope="session")
def event_loop():
    """Создать event loop для всех тестов."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ============================================================
# Database Fixtures
# ============================================================

@pytest_asyncio.fixture(scope="function")
async def test_db():
    """Создать тестовую БД (SQLite in-memory) для каждого теста."""
    from app.core.database import Base, engine, async_session
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    # In-memory SQLite для изоляции тестов
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    test_session_factory = async_sessionmaker(
        test_engine,
        expire_on_commit=False,
    )

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield test_session_factory

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_db):
    """Получить сессию БД для теста."""
    async with test_db() as session:
        yield session


# ============================================================
# FastAPI App Fixtures
# ============================================================

@pytest_asyncio.fixture
async def test_app(test_db):
    """Создать тестовое FastAPI приложение."""
    from app.core.database import Base
    from main import app
    from app.core.database import async_session

    # Override DB session
    async def override_get_db():
        async with test_db() as session:
            yield session

    from app.core.database import get_db
    app.dependency_overrides[get_db] = override_get_db

    yield app

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_client(test_app):
    """Создать async HTTP-клиент для тестирования API."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ============================================================
# Auth Fixtures
# ============================================================

@pytest.fixture
def test_user_data():
    """Данные для регистрации тестового пользователя."""
    return {
        "email": "test@gidede.com",
        "password": "TestPassword123!",
        "name": "Test User",
    }


@pytest.fixture
def auth_headers():
    """Заголовки авторизации с JWT-токеном."""
    from app.core.security import create_access_token
    token = create_access_token(user_id="test_user_id")
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def authenticated_client(test_client, db_session):
    """HTTP-клиент с авторизованным пользователем."""
    from app.models.db import User
    from app.core.security import get_password_hash
    from app.core.security import create_access_token

    # Создать тестового пользователя
    user = User(
        id="test_user_id",
        email="test@gidede.com",
        name="Test User",
        hashed_password=get_password_hash("TestPassword123!"),
        plan="free",
    )
    db_session.add(user)
    await db_session.commit()

    # Получить токен
    token = create_access_token(user_id="test_user_id")
    test_client.headers.update({"Authorization": f"Bearer {token}"})

    return test_client


# ============================================================
# AI Mock Fixtures
# ============================================================

@pytest.fixture
def mock_ai_response():
    """Мок ответа AI-провайдера."""
    from app.ai.providers.base import AIResponse
    return AIResponse(
        content='{"genre": "RPG", "subgenre": "Action RPG", "confidence": 0.95}',
        model="test-model",
        provider="test",
        tokens_input=100,
        tokens_output=50,
        cost_usd=0.001,
    )


@pytest.fixture
def mock_ai_provider():
    """Мок AI-провайдера для тестирования без реальных вызовов."""
    provider = AsyncMock()
    provider.name = "test"
    provider.is_available = True
    provider.config = MagicMock(priority=1)
    provider.get_available_models.return_value = ["test-model"]
    return provider


# ============================================================
# Sample Data Fixtures
# ============================================================

@pytest.fixture
def sample_concept_input():
    """Тестовый ввод для генерации концепции."""
    return {
        "idea": "Постапокалиптическая RPG с выживанием и крафтом",
        "genre": "auto",
        "target_audience": ["achievement", "immersion"],
        "platforms": ["PC"],
        "budget": "small",
        "forbidden_mechanics": [],
    }


@pytest.fixture
def sample_project_state():
    """Тестовый Project State."""
    return {
        "name": "Test Game",
        "concept": {
            "genre": "RPG",
            "primary_aesthetic": "Fantasy",
        },
        "core_loop": {
            "structural_type": "Engine",
        },
        "mda": {
            "mechanics": ["exploration", "combat", "crafting"],
        },
        "progression": {
            "total_levels": 30,
        },
    }


@pytest.fixture
def sample_knowledge_chunks():
    """Тестовые чанки базы знаний."""
    return [
        {
            "source_type": "bible",
            "source_name": "bible_2_3_mda_framework",
            "chunk_index": 0,
            "title": "MDA Framework",
            "content": "MDA Framework — формальный подход к анализу игр, предложенный Робином Хюникой, Марком ЛеБланом и Робертом Зубеком. MDA расшифровывается как Mechanics-Dynamics-Aesthetics.",
            "token_count": 35,
        },
        {
            "source_type": "bible",
            "source_name": "bible_2_5_balance",
            "chunk_index": 0,
            "title": "Баланс в играх",
            "content": "Баланс — это состояние игры, при котором все стратегии, элементы и механики находятся в равновесии. Transitive-баланс основан на cost-power соотношении.",
            "token_count": 30,
        },
    ]
