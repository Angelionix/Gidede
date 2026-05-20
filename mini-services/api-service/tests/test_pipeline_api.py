"""
Tests for Pipeline API endpoints.
Covers:
  GET  /state/{project_id}
  GET  /prepare-input/{project_id}/{block_id}
  POST /notify-updated
  POST /run-pipeline/{project_id}
  POST /run-full-pipeline/{project_id}
  DELETE /stale/{project_id}/{block_id}

Strategy:
- Override get_current_user via app.dependency_overrides (no real DB user needed)
- Patch get_pipeline_service with AsyncMock(return_value=mock_svc) so that
  `await get_pipeline_service(db)` returns our mock_svc directly
- Pipeline endpoints use get_db (overridden by conftest test_app) and
  get_pipeline_service (patched), so no async_session patching needed
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch


# ============================================================
# Helpers
# ============================================================

def _mock_pipeline_service():
    """Return a fully-mocked PipelineService with sensible defaults."""
    svc = AsyncMock()

    # get_pipeline_state returns an object with .to_dict()
    state_mock = MagicMock()
    state_mock.to_dict.return_value = {
        "project_id": "test-proj-1",
        "project_name": "Test Game",
        "blocks": [
            {"block_id": i, "status": "completed" if i <= 2 else "empty"}
            for i in range(1, 9)
        ],
        "completion_percent": 25,
        "current_stage": "concept",
        "can_proceed_to": 3,
        "next_block": 3,
        "notifications": [],
    }
    svc.get_pipeline_state = AsyncMock(return_value=state_mock)

    svc.prepare_block_input = AsyncMock(return_value={
        "project_id": "test-proj-1",
        "status": "ready",
        "genre": "rpg",
        "mechanics": ["Enemies", "Health"],
    })

    svc.notify_block_updated = AsyncMock(return_value={
        "stale_blocks": [3, 4, 5],
        "notifications": ["Block 3 is now stale"],
    })

    svc.run_pipeline_blocks_1_2_3 = AsyncMock(return_value={
        "project_id": "test-proj-1",
        "status": "completed",
        "blocks_completed": [1, 2, 3],
    })

    svc.run_pipeline_blocks_1_to_5 = AsyncMock(return_value={
        "project_id": "test-proj-1",
        "status": "completed",
        "blocks_completed": [1, 2, 3, 4, 5],
    })

    svc.clear_stale_status = AsyncMock(return_value=True)

    return svc


VALID_PIPELINE_INPUT = {
    "idea": "A postapocalyptic RPG with survival and crafting mechanics",
    "genre": "rpg",
}

VALID_NOTIFY_INPUT = {
    "project_id": "test-proj-1",
    "block_id": 1,
}


# ============================================================
# Fixtures
# ============================================================

@pytest_asyncio.fixture
async def auth_client(test_app, test_client):
    """HTTP client with mocked authentication."""
    from app.core.auth_middleware import get_current_user
    from app.models.db import User

    mock_user = MagicMock(spec=User)
    mock_user.id = "test-user-123"
    mock_user.email = "test@example.com"
    mock_user.is_active = True
    mock_user.plan = "free"

    async def _override():
        return mock_user

    test_app.dependency_overrides[get_current_user] = _override
    yield test_client
    test_app.dependency_overrides.pop(get_current_user, None)


# ============================================================
# Tests — GET /state/{project_id}
# ============================================================

class TestGetPipelineState:
    """GET /api/v1/pipeline/state/{project_id}"""

    @pytest.mark.asyncio
    async def test_get_state_success(self, auth_client):
        """Authenticated user retrieves pipeline state."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.get("/api/v1/pipeline/state/test-proj-1")

        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == "test-proj-1"
        assert data["completion_percent"] == 25
        assert len(data["blocks"]) == 8

    @pytest.mark.asyncio
    async def test_get_state_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.get("/api/v1/pipeline/state/test-proj-1")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_state_project_not_found(self, auth_client):
        """When project does not exist, returns 404."""
        mock_svc = _mock_pipeline_service()
        mock_svc.get_pipeline_state = AsyncMock(return_value=None)
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.get("/api/v1/pipeline/state/missing-proj")

        assert resp.status_code == 404


# ============================================================
# Tests — GET /prepare-input/{project_id}/{block_id}
# ============================================================

class TestPrepareBlockInput:
    """GET /api/v1/pipeline/prepare-input/{project_id}/{block_id}"""

    @pytest.mark.asyncio
    async def test_prepare_input_success(self, auth_client):
        """Successfully prepare input for block 2."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.get(
                "/api/v1/pipeline/prepare-input/test-proj-1/2"
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"

    @pytest.mark.asyncio
    async def test_prepare_input_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.get(
            "/api/v1/pipeline/prepare-input/test-proj-1/2"
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_prepare_input_invalid_block_id(self, auth_client):
        """Block ID outside 2-8 range returns 400."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.get(
                "/api/v1/pipeline/prepare-input/test-proj-1/1"
            )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_prepare_input_missing_concept(self, auth_client):
        """When concept is missing, returns 422."""
        mock_svc = _mock_pipeline_service()
        mock_svc.prepare_block_input = AsyncMock(return_value={
            "error": None,
            "status": "missing_concept",
            "message": "Fill Block 1 first",
        })
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.get(
                "/api/v1/pipeline/prepare-input/test-proj-1/3"
            )

        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_prepare_input_project_not_found(self, auth_client):
        """When project not found, returns 404."""
        mock_svc = _mock_pipeline_service()
        mock_svc.prepare_block_input = AsyncMock(return_value={
            "error": "Project not found",
        })
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.get(
                "/api/v1/pipeline/prepare-input/missing-proj/2"
            )

        assert resp.status_code == 404


# ============================================================
# Tests — POST /notify-updated
# ============================================================

class TestNotifyUpdated:
    """POST /api/v1/pipeline/notify-updated"""

    @pytest.mark.asyncio
    async def test_notify_updated_success(self, auth_client):
        """Successfully notify about block update."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/notify-updated",
                json=VALID_NOTIFY_INPUT,
            )

        assert resp.status_code == 200
        assert "stale_blocks" in resp.json()

    @pytest.mark.asyncio
    async def test_notify_updated_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post(
            "/api/v1/pipeline/notify-updated",
            json=VALID_NOTIFY_INPUT,
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_notify_updated_invalid_block_id(self, auth_client):
        """block_id outside 1-8 range returns 422 (Pydantic validation)."""
        resp = await auth_client.post(
            "/api/v1/pipeline/notify-updated",
            json={"project_id": "p1", "block_id": 99},
        )
        assert resp.status_code == 422


# ============================================================
# Tests — POST /run-pipeline/{project_id}
# ============================================================

class TestRunPipeline:
    """POST /api/v1/pipeline/run-pipeline/{project_id}"""

    @pytest.mark.asyncio
    async def test_run_pipeline_success(self, auth_client):
        """Successfully run pipeline blocks 1-2-3."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"
        mock_svc.run_pipeline_blocks_1_2_3.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_run_pipeline_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post(
            "/api/v1/pipeline/run-pipeline/test-proj-1",
            json=VALID_PIPELINE_INPUT,
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_run_pipeline_missing_idea(self, auth_client):
        """Missing required 'idea' field returns 422."""
        resp = await auth_client.post(
            "/api/v1/pipeline/run-pipeline/test-proj-1",
            json={"genre": "rpg"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_run_pipeline_value_error(self, auth_client):
        """ValueError from service → 400."""
        mock_svc = _mock_pipeline_service()
        mock_svc.run_pipeline_blocks_1_2_3 = AsyncMock(
            side_effect=ValueError("Bad input")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_run_pipeline_runtime_error(self, auth_client):
        """RuntimeError from service → 503."""
        mock_svc = _mock_pipeline_service()
        mock_svc.run_pipeline_blocks_1_2_3 = AsyncMock(
            side_effect=RuntimeError("AI down")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_run_pipeline_unexpected_error(self, auth_client):
        """Unexpected exception → 500."""
        mock_svc = _mock_pipeline_service()
        mock_svc.run_pipeline_blocks_1_2_3 = AsyncMock(
            side_effect=Exception("Unexpected")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 500


# ============================================================
# Tests — POST /run-full-pipeline/{project_id}
# ============================================================

class TestRunFullPipeline:
    """POST /api/v1/pipeline/run-full-pipeline/{project_id}"""

    @pytest.mark.asyncio
    async def test_run_full_pipeline_success(self, auth_client):
        """Successfully run full pipeline blocks 1-5."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-full-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"
        mock_svc.run_pipeline_blocks_1_to_5.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_run_full_pipeline_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post(
            "/api/v1/pipeline/run-full-pipeline/test-proj-1",
            json=VALID_PIPELINE_INPUT,
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_run_full_pipeline_runtime_error(self, auth_client):
        """RuntimeError from service → 503."""
        mock_svc = _mock_pipeline_service()
        mock_svc.run_pipeline_blocks_1_to_5 = AsyncMock(
            side_effect=RuntimeError("AI unavailable")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-full-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_run_full_pipeline_value_error(self, auth_client):
        """ValueError from service → 400."""
        mock_svc = _mock_pipeline_service()
        mock_svc.run_pipeline_blocks_1_to_5 = AsyncMock(
            side_effect=ValueError("Invalid data")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/pipeline/run-full-pipeline/test-proj-1",
                json=VALID_PIPELINE_INPUT,
            )

        assert resp.status_code == 400


# ============================================================
# Tests — DELETE /stale/{project_id}/{block_id}
# ============================================================

class TestClearStaleStatus:
    """DELETE /api/v1/pipeline/stale/{project_id}/{block_id}"""

    @pytest.mark.asyncio
    async def test_clear_stale_success(self, auth_client):
        """Successfully clear stale status."""
        mock_svc = _mock_pipeline_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.delete(
                "/api/v1/pipeline/stale/test-proj-1/3"
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["block_id"] == 3

    @pytest.mark.asyncio
    async def test_clear_stale_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.delete("/api/v1/pipeline/stale/test-proj-1/3")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_clear_stale_failure_returns_500(self, auth_client):
        """When clear_stale_status returns False, returns 500."""
        mock_svc = _mock_pipeline_service()
        mock_svc.clear_stale_status = AsyncMock(return_value=False)
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.pipeline.get_pipeline_service", mock_get_svc):
            resp = await auth_client.delete(
                "/api/v1/pipeline/stale/test-proj-1/3"
            )

        assert resp.status_code == 500
