"""
Tests for Concept API endpoints (Block 1).
Covers: POST /generate, GET /{concept_id}, PUT /{concept_id}, POST /{concept_id}/validate

Strategy:
- Override get_current_user via app.dependency_overrides (no real DB user needed)
- Patch get_concept_service with AsyncMock(return_value=mock_svc) so that
  `await get_concept_service()` returns our mock_svc directly
- Patch _save_concept_result at module level (it also uses async_session internally)
- Patch app.core.database.async_session for endpoints that use the DB directly
  (GET /{concept_id}, POST /{concept_id}/validate)
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch


# ============================================================
# Helpers
# ============================================================

def _mock_concept_result():
    """Dict mimicking ConceptService.generate_full() output."""
    return {
        "title": "[RPG] Postapocalyptic survival",
        "target_audience": "midcore gamers",
        "story_synopsis": "A survivor navigates a ruined world.",
        "gameplay_description": "Explore, craft, and fight to survive.",
        "unique_features": ["dynamic weather", "base building"],
        "competitors": ["Fallout", "Stalker"],
        "aesthetic_profile": {
            "primary": "challenge",
            "secondary": "fantasy",
            "tertiary": "discovery",
            "rationale": "derived from Yee motivations",
        },
        "dynamics_profile": {
            "core_dynamics": ["survival", "exploration"],
            "supporting_dynamics": ["crafting", "resource management"],
            "emergence_potential": "moderate",
            "rationale": "based on aesthetics",
        },
        "mechanic_set": {
            "base": [{"name": "Enemies", "group": "Base", "description": "Combat encounters"}],
            "combat": [],
            "progression": [],
            "spatial": [],
            "social": [],
            "total_count": 1,
        },
        "core_loop_candidates": [{"name": "Explore-Gather-Craft", "steps": []}],
        "usp_candidates": [{"usp": "Dynamic ecosystem affects survival", "uniqueness_score": 0.85}],
        "validation_report": {"overall_score": 0.78, "overall_passed": True, "validators": []},
        "stages_completed": [1, 2, 3, 4, 5, 6, 7],
        "latency_ms": 1200,
        "models_used": ["CLASSIFY_GENRE", "SUGGEST_DYNAMICS"],
        "compatibility_score": 0.82,
        "uniqueness_score": 0.85,
    }


VALID_CONCEPT_INPUT = {
    "idea": "A postapocalyptic RPG with survival and crafting mechanics",
    "genre": "rpg",
    "target_audience": {
        "primary": ["challenge", "immersion"],
        "experience": "midcore",
    },
    "platform": ["pc"],
}


def _make_mock_async_session(scalar_result=None):
    """Build a mock async_session context-manager factory.

    Returns (mock_factory, mock_session) so callers can inspect session calls.
    """
    mock_session = AsyncMock()
    mock_db_result = MagicMock()
    mock_db_result.scalar_one_or_none.return_value = scalar_result
    mock_session.execute = AsyncMock(return_value=mock_db_result)
    mock_session.commit = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_factory, mock_session


# ============================================================
# Fixtures
# ============================================================

@pytest_asyncio.fixture
async def auth_client(test_app, test_client):
    """HTTP client with mocked authentication — bypasses real DB user lookup."""
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
# Tests — POST /generate
# ============================================================

class TestGenerateConcept:
    """POST /api/v1/concept/generate"""

    @pytest.mark.asyncio
    async def test_generate_success(self, auth_client):
        """Authenticated user generates a concept successfully."""
        mock_svc = AsyncMock()
        mock_svc.generate_full = AsyncMock(return_value=_mock_concept_result())
        mock_get_svc = AsyncMock(return_value=mock_svc)
        mock_save = AsyncMock(return_value="concept-id-123")

        with patch("app.api.v1.concept.get_concept_service", mock_get_svc), \
             patch("app.api.v1.concept._save_concept_result", mock_save):
            resp = await auth_client.post(
                "/api/v1/concept/generate",
                json=VALID_CONCEPT_INPUT,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "concept-id-123"
        assert data["status"] == "completed"
        assert "aesthetic_profile" in data
        assert "dynamics_profile" in data
        assert "validation_report" in data
        assert "generation_metadata" in data
        mock_svc.generate_full.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_generate_unauthorized(self, test_client):
        """Unauthenticated request is rejected (401/403)."""
        resp = await test_client.post(
            "/api/v1/concept/generate",
            json=VALID_CONCEPT_INPUT,
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_generate_missing_idea(self, auth_client):
        """Missing required 'idea' field returns 422."""
        resp = await auth_client.post(
            "/api/v1/concept/generate",
            json={"genre": "rpg"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_idea_too_short(self, auth_client):
        """Idea shorter than 10 chars returns 422."""
        resp = await auth_client.post(
            "/api/v1/concept/generate",
            json={"idea": "short"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_value_error_returns_400(self, auth_client):
        """ValueError from service → 400."""
        mock_svc = AsyncMock()
        mock_svc.generate_full = AsyncMock(side_effect=ValueError("Bad genre"))
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.concept.get_concept_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/concept/generate",
                json=VALID_CONCEPT_INPUT,
            )

        assert resp.status_code == 400
        assert "Bad genre" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_generate_runtime_error_returns_503(self, auth_client):
        """RuntimeError from service → 503."""
        mock_svc = AsyncMock()
        mock_svc.generate_full = AsyncMock(side_effect=RuntimeError("AI unavailable"))
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.concept.get_concept_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/concept/generate",
                json=VALID_CONCEPT_INPUT,
            )

        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_generate_unexpected_error_returns_500(self, auth_client):
        """Unexpected exception → 500."""
        mock_svc = AsyncMock()
        mock_svc.generate_full = AsyncMock(side_effect=Exception("Boom"))
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.concept.get_concept_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/concept/generate",
                json=VALID_CONCEPT_INPUT,
            )

        assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_generate_with_all_optional_fields(self, auth_client):
        """Generate with all optional fields succeeds."""
        mock_svc = AsyncMock()
        mock_svc.generate_full = AsyncMock(return_value=_mock_concept_result())
        mock_get_svc = AsyncMock(return_value=mock_svc)
        mock_save = AsyncMock(return_value="concept-id-456")

        full_input = {
            **VALID_CONCEPT_INPUT,
            "constraints": {"team_size": 5, "budget": "small"},
            "reference_games": ["Fallout 4", "Stalker"],
            "aesthetic_focus": ["challenge", "narrative"],
            "forbidden_mechanics": ["pay_to_win"],
        }

        with patch("app.api.v1.concept.get_concept_service", mock_get_svc), \
             patch("app.api.v1.concept._save_concept_result", mock_save):
            resp = await auth_client.post(
                "/api/v1/concept/generate",
                json=full_input,
            )

        assert resp.status_code == 200
        assert resp.json()["id"] == "concept-id-456"


# ============================================================
# Tests — GET /{concept_id}
# ============================================================

class TestGetConcept:
    """GET /api/v1/concept/{concept_id}"""

    @pytest.mark.asyncio
    async def test_get_concept_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.get("/api/v1/concept/nonexistent-id")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_get_concept_not_found(self, auth_client):
        """Nonexistent concept_id returns 404."""
        mock_factory, _ = _make_mock_async_session(scalar_result=None)

        with patch("app.core.database.async_session", mock_factory):
            resp = await auth_client.get("/api/v1/concept/nonexistent-id")

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_concept_success(self, auth_client):
        """Existing concept returns its data."""
        mock_concept = MagicMock()
        mock_concept.id = "concept-123"
        mock_concept.genre = "RPG"
        mock_concept.subgenre = "Action RPG"
        mock_concept.primary_aesthetic = "challenge"
        mock_concept.usp = "unique selling point"
        mock_concept.one_pager_data = {"title": "Test"}
        mock_concept.aesthetic_profile = {"primary": "challenge"}
        mock_concept.dynamics_profile = {"core_dynamics": ["survival"]}
        mock_concept.mechanic_set = {"base": []}
        mock_concept.validation_report = {"overall_score": 0.8}
        mock_concept.usp_candidates = [{"usp": "test"}]
        mock_concept.core_loop_candidates = [{"name": "loop1"}]
        mock_concept.created_at = "2024-01-01T00:00:00"
        mock_concept.updated_at = "2024-01-01T00:00:00"

        mock_factory, _ = _make_mock_async_session(scalar_result=mock_concept)

        with patch("app.core.database.async_session", mock_factory):
            resp = await auth_client.get("/api/v1/concept/concept-123")

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "concept-123"
        assert data["genre"] == "RPG"
        assert "aesthetic_profile" in data

    @pytest.mark.asyncio
    async def test_get_concept_db_error_returns_500(self, auth_client):
        """DB error during fetch returns 500."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=Exception("DB connection lost"))
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch("app.core.database.async_session", mock_factory):
            resp = await auth_client.get("/api/v1/concept/some-id")

        assert resp.status_code == 500


# ============================================================
# Tests — PUT /{concept_id}
# ============================================================

class TestUpdateConcept:
    """PUT /api/v1/concept/{concept_id}"""

    @pytest.mark.asyncio
    async def test_update_concept_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.put(
            "/api/v1/concept/some-id",
            json={"title": "Updated"},
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_update_concept_not_implemented(self, auth_client):
        """PUT endpoint is a stub returning not_implemented."""
        resp = await auth_client.put(
            "/api/v1/concept/some-id",
            json={"title": "Updated"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "not_implemented"


# ============================================================
# Tests — POST /{concept_id}/validate
# ============================================================

class TestValidateConcept:
    """POST /api/v1/concept/{concept_id}/validate"""

    @pytest.mark.asyncio
    async def test_validate_concept_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post("/api/v1/concept/some-id/validate")
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_validate_concept_not_found(self, auth_client):
        """Validation of nonexistent concept returns 404."""
        mock_factory, _ = _make_mock_async_session(scalar_result=None)

        with patch("app.core.database.async_session", mock_factory):
            resp = await auth_client.post(
                "/api/v1/concept/nonexistent-id/validate"
            )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_validate_concept_success(self, auth_client):
        """Successful validation returns report."""
        # Mock concept from DB — provide valid data for Pydantic schema constructors
        mock_concept = MagicMock()
        mock_concept.id = "concept-123"
        mock_concept.genre = "RPG"
        mock_concept.input_data = {"idea": "Test idea for validation"}
        mock_concept.aesthetic_profile = {"primary": "challenge"}
        mock_concept.dynamics_profile = {}
        mock_concept.mechanic_set = {}
        mock_concept.core_loop_candidates = []
        mock_concept.usp_candidates = []

        mock_factory, _ = _make_mock_async_session(scalar_result=mock_concept)

        # Mock validation report from service
        mock_report = MagicMock()
        mock_report.overall_score = 0.85
        mock_report.overall_passed = True
        mock_report.model_dump.return_value = {
            "overall_score": 0.85,
            "overall_passed": True,
            "validators": [],
        }

        mock_svc = AsyncMock()
        mock_svc.validate_concept = AsyncMock(return_value=mock_report)
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.core.database.async_session", mock_factory), \
             patch("app.api.v1.concept.get_concept_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/concept/concept-123/validate"
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "concept-123"
        assert data["overall_score"] == 0.85
        assert data["overall_passed"] is True

    @pytest.mark.asyncio
    async def test_validate_concept_service_error_returns_500(self, auth_client):
        """Error during validation returns 500."""
        mock_concept = MagicMock()
        mock_concept.id = "concept-123"
        mock_concept.genre = "RPG"
        mock_concept.input_data = {"idea": "Test idea"}
        mock_concept.aesthetic_profile = {"primary": "challenge"}
        mock_concept.dynamics_profile = {}
        mock_concept.mechanic_set = {}
        mock_concept.core_loop_candidates = []
        mock_concept.usp_candidates = []

        mock_factory, _ = _make_mock_async_session(scalar_result=mock_concept)

        mock_svc = AsyncMock()
        mock_svc.validate_concept = AsyncMock(side_effect=Exception("Validation crash"))
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.core.database.async_session", mock_factory), \
             patch("app.api.v1.concept.get_concept_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/concept/concept-123/validate"
            )

        assert resp.status_code == 500
