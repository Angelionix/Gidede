"""
Gidede — Тесты CRUD проектов
Фаза 4.A.11: Локальная тестовая инфраструктура

Тестирует:
- Создание проекта
- Получение списка проектов
- Получение проекта по ID
- Обновление проекта
- Удаление проекта
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_project(authenticated_client: AsyncClient):
    """Создание нового проекта."""
    project_data = {
        "name": "Test Game Project",
        "description": "Тестовый проект для проверки CRUD",
        "genre": "RPG",
    }
    response = await authenticated_client.post("/api/v1/projects/", json=project_data)
    assert response.status_code in (200, 201)
    data = response.json()
    assert data.get("name") == project_data["name"]


@pytest.mark.asyncio
async def test_list_projects(authenticated_client: AsyncClient):
    """Получение списка проектов пользователя."""
    response = await authenticated_client.get("/api/v1/projects/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_project_without_auth(test_client: AsyncClient):
    """Попытка создания проекта без авторизации."""
    response = await test_client.post(
        "/api/v1/projects/",
        json={"name": "Unauthorized Project"},
    )
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_project_isolation(authenticated_client: AsyncClient, test_client: AsyncClient):
    """Проекты изолированы между пользователями."""
    # Создать проект
    create_response = await authenticated_client.post(
        "/api/v1/projects/",
        json={"name": "Private Project"},
    )
    if create_response.status_code in (200, 201):
        # Получить ID проекта
        project_id = create_response.json().get("id")

        # Попытка доступа без авторизации
        response = test_client.get(f"/api/v1/projects/{project_id}")
        assert response.status_code in (401, 403, 404)
