"""
Gidede API Load Tests — Locust scenarios
Фаза 4.E.7: Нагрузочное тестирование и мониторинг

Запуск:
    locust -f load_tests/locustfile_api.py --host=http://localhost:3030

Scenarios:
    - GidedeAPIUser: 100 concurrent — базовые API-эндпоинты
    - GidedeAIStressUser: 10 concurrent — AI-вызовы (стресс)
    - GidedeDBStressUser: DB-стресс (массовое создание проектов)
"""

import json
import logging
import time
import uuid

from locust import HttpUser, task, between, events, tag

logger = logging.getLogger("gidede_load_tests")


# ---------------------------------------------------------------------------
# Event listeners
# ---------------------------------------------------------------------------

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Логирование медленных запросов (> 2s)."""
    if response_time > 2000:
        logger.warning(
            "SLOW REQUEST: %s %s — %.0fms%s",
            request_type,
            name,
            response_time,
            f" (exception: {exception})" if exception else "",
        )


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Вызывается при старте теста."""
    logger.info("=" * 60)
    logger.info("Gidede Load Test STARTED")
    logger.info("Target host: %s", environment.host)
    logger.info("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Вызывается при остановке теста."""
    logger.info("=" * 60)
    logger.info("Gidede Load Test STOPPED")
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# Helper: get or create auth token
# ---------------------------------------------------------------------------

def _get_auth_token(client) -> str | None:
    """Попытка получить JWT-токен через тестового пользователя."""
    test_email = f"loadtest_{uuid.uuid4().hex[:8]}@gidede.test"
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": test_email,
            "password": "LoadTest123!",
            "username": f"lt_{uuid.uuid4().hex[:8]}",
        },
        name="/api/v1/auth/register",
        catch_response=True,
    )
    if resp and resp.status_code in (200, 201):
        try:
            data = resp.json()
            return data.get("access_token") or data.get("token")
        except Exception:
            pass
    # Fallback: try login
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": "LoadTest123!"},
        name="/api/v1/auth/login",
        catch_response=True,
    )
    if resp and resp.status_code == 200:
        try:
            return resp.json().get("access_token") or resp.json().get("token")
        except Exception:
            pass
    return None


# ---------------------------------------------------------------------------
# User 1: GidedeAPIUser — 100 concurrent, базовые эндпоинты
# ---------------------------------------------------------------------------

class GidedeAPIUser(HttpUser):
    """Базовый пользователь API — health, projects, blocks, pipeline, GBE."""

    weight = 10
    wait_time = between(0.5, 2.0)
    host = "http://localhost:3030"

    def on_start(self):
        """Инициализация: получить токен."""
        self.token = _get_auth_token(self.client)
        if self.token:
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @task(5)
    @tag("health")
    def health_check(self):
        """GET /api/v1/health"""
        self.client.get("/api/v1/health", name="/api/v1/health")

    @task(3)
    @tag("projects")
    def list_projects(self):
        """GET /api/v1/projects"""
        self.client.get("/api/v1/projects", name="/api/v1/projects")

    @task(2)
    @tag("projects")
    def create_project(self):
        """POST /api/v1/projects — создать тестовый проект."""
        self.client.post(
            "/api/v1/projects",
            json={
                "name": f"LoadTest Project {uuid.uuid4().hex[:6]}",
                "description": "Created by Locust load test",
                "genre": "rpg",
                "platform": "pc",
            },
            name="/api/v1/projects [POST]",
        )

    @task(2)
    @tag("blocks")
    def concept_block(self):
        """POST /api/v1/concept/generate — Block 1 Concept Generator."""
        self.client.post(
            "/api/v1/concept/generate",
            json={
                "genre": "strategy",
                "platform": "mobile",
                "target_audience": "casual",
                "core_mechanic": "resource_management",
            },
            name="/api/v1/concept/generate",
            catch_response=True,
        )

    @task(1)
    @tag("blocks")
    def coreloop_block(self):
        """POST /api/v1/coreloop/generate — Block 2 Core Loop."""
        self.client.post(
            "/api/v1/coreloop/generate",
            json={
                "concept_summary": "A turn-based strategy game with resource management",
                "genre": "strategy",
            },
            name="/api/v1/coreloop/generate",
            catch_response=True,
        )

    @task(1)
    @tag("blocks")
    def mda_block(self):
        """POST /api/v1/mda/analyze — Block 3 MDA."""
        self.client.post(
            "/api/v1/mda/analyze",
            json={
                "mechanics": ["exploration", "resource_management", "combat"],
                "dynamics": ["emergent_strategy", "risk_reward"],
                "aesthetics": ["challenge", "discovery"],
            },
            name="/api/v1/mda/analyze",
            catch_response=True,
        )

    @task(1)
    @tag("pipeline")
    def pipeline_status(self):
        """GET /api/v1/pipeline/status — статус пайплайна."""
        self.client.get("/api/v1/pipeline/status", name="/api/v1/pipeline/status")

    @task(1)
    @tag("gbe")
    def gbe_status(self):
        """GET /api/v1/gbe/status — статус GBE Bridge."""
        self.client.get("/api/v1/gbe/status", name="/api/v1/gbe/status")


# ---------------------------------------------------------------------------
# User 2: GidedeAIStressUser — 10 concurrent AI-вызовов
# ---------------------------------------------------------------------------

class GidedeAIStressUser(HttpUser):
    """Стресс-тестирование AI-эндпоинтов."""

    weight = 1
    wait_time = between(2.0, 5.0)
    host = "http://localhost:3030"

    AI_ENDPOINTS = [
        {
            "url": "/api/v1/concept/generate",
            "payload": {
                "genre": "rpg",
                "platform": "pc",
                "target_audience": "hardcore",
                "core_mechanic": "exploration",
            },
        },
        {
            "url": "/api/v1/coreloop/generate",
            "payload": {
                "concept_summary": "An open-world RPG with deep crafting",
                "genre": "rpg",
            },
        },
        {
            "url": "/api/v1/mda/analyze",
            "payload": {
                "mechanics": ["crafting", "exploration", "combat"],
                "dynamics": ["emergent_gameplay"],
                "aesthetics": ["sensation", "fellowship"],
            },
        },
        {
            "url": "/api/v1/balance/analyze",
            "payload": {
                "objects": [
                    {"name": "warrior", "type": "class", "attack": 10, "defense": 8},
                    {"name": "mage", "type": "class", "attack": 12, "defense": 4},
                ],
                "analysis_type": "transitive",
            },
        },
        {
            "url": "/api/v1/gdd/generate",
            "payload": {
                "project_id": "00000000-0000-0000-0000-000000000001",
                "sections": ["concept", "coreloop"],
                "format": "markdown",
            },
        },
    ]

    def on_start(self):
        """Инициализация: получить токен."""
        self.token = _get_auth_token(self.client)
        if self.token:
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @task
    @tag("ai")
    def call_ai_endpoint(self):
        """Вызов случайного AI-эндпоинта."""
        import random
        endpoint = random.choice(self.AI_ENDPOINTS)
        self.client.post(
            endpoint["url"],
            json=endpoint["payload"],
            name=endpoint["url"],
            catch_response=True,
            timeout=60,
        )


# ---------------------------------------------------------------------------
# User 3: GidedeDBStressUser — DB-стресс (массовое создание проектов)
# ---------------------------------------------------------------------------

class GidedeDBStressUser(HttpUser):
    """Стресс-тестирование БД — массовое создание/чтение проектов."""

    weight = 2
    wait_time = between(0.1, 0.5)
    host = "http://localhost:3030"

    BULK_SIZE = 10  # количество проектов за одну итерацию

    def on_start(self):
        """Инициализация: получить токен."""
        self.token = _get_auth_token(self.client)
        if self.token:
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @task(3)
    @tag("db", "bulk_create")
    def bulk_create_projects(self):
        """Массовое создание проектов."""
        for i in range(self.BULK_SIZE):
            self.client.post(
                "/api/v1/projects",
                json={
                    "name": f"DB-Stress-{uuid.uuid4().hex[:8]}-{i}",
                    "description": "DB stress test project",
                    "genre": "action",
                    "platform": "pc",
                },
                name="/api/v1/projects [POST bulk]",
            )

    @task(5)
    @tag("db", "list")
    def list_projects_heavy(self):
        """Частое чтение списка проектов."""
        self.client.get(
            "/api/v1/projects",
            name="/api/v1/projects [GET heavy]",
        )

    @task(2)
    @tag("db", "health")
    def health_detailed(self):
        """Детальная проверка здоровья (включает БД)."""
        self.client.get(
            "/api/v1/health/detailed",
            name="/api/v1/health/detailed",
        )
