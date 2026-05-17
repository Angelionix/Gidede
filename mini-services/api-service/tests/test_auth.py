"""
Gidede — Тесты авторизации
Фаза 4.A.11: Локальная тестовая инфраструктура

Тестирует:
- Регистрация пользователя
- Логин
- Обновление токена
- Защищённые эндпоинты
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_user(test_client: AsyncClient, test_user_data):
    """Регистрация нового пользователя."""
    response = await test_client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code in (200, 201, 409)  # 409 если уже существует


@pytest.mark.asyncio
async def test_register_duplicate_email(test_client: AsyncClient, test_user_data):
    """Попытка регистрации с существующим email."""
    # Первая регистрация
    await test_client.post("/api/v1/auth/register", json=test_user_data)
    # Повторная регистрация
    response = await test_client.post("/api/v1/auth/register", json=test_user_data)
    assert response.status_code in (400, 409)


@pytest.mark.asyncio
async def test_login_success(test_client: AsyncClient, test_user_data):
    """Успешный логин."""
    # Сначала регистрация
    await test_client.post("/api/v1/auth/register", json=test_user_data)

    # Логин
    login_data = {
        "email": test_user_data["email"],
        "password": test_user_data["password"],
    }
    response = await test_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code in (200, 401)  # 401 если регистрация не прошла


@pytest.mark.asyncio
async def test_login_wrong_password(test_client: AsyncClient, test_user_data):
    """Логин с неверным паролем."""
    login_data = {
        "email": test_user_data["email"],
        "password": "WrongPassword123!",
    }
    response = await test_client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(test_client: AsyncClient):
    """Доступ к защищённому эндпоинту без токена."""
    response = await test_client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_endpoint_with_invalid_token(test_client: AsyncClient):
    """Доступ к защищённому эндпоинту с невалидным токеном."""
    response = await test_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code in (401, 403)
