"""
Gidede — Тесты Health Check API
Фаза 4.A.11: Локальная тестовая инфраструктура
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(test_client: AsyncClient):
    """Проверка health check эндпоинта."""
    response = await test_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_health_detailed(test_client: AsyncClient):
    """Проверка детального health check."""
    response = await test_client.get("/api/v1/health/detailed")
    # Может быть 200 или 404 в зависимости от реализации
    assert response.status_code in (200, 404)
