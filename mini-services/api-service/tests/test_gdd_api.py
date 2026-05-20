"""
Tests for GDD API endpoints (Block 6).
Covers:
  POST /format       — Этап 1: determine GDD format
  POST /map          — Этап 2: map Project State → sections
  POST /auto-fill    — Этап 3: auto-fill sections
  POST /generate     — Stages 1–5
  POST /generate-full — Stages 1–7
  POST /checklist    — stub (redirect)
  POST /export       — Stage 8: export

Strategy:
- Override get_current_user via app.dependency_overrides (no real DB user needed)
- Patch get_gdd_service with AsyncMock(return_value=mock_svc) so that
  `await get_gdd_service()` returns our mock_svc directly
- Service methods return MagicMock objects with .model_dump() returning dicts
- For /export: provide gdd_profile with formatted_document so the endpoint
  skips assembly and goes straight to export_gdd()
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch


# ============================================================
# Helpers
# ============================================================

def _mock_gdd_service():
    """Return a fully-mocked GDDService with sensible defaults."""
    svc = AsyncMock()

    # determine_gdd_format → object with .model_dump()
    fmt_mock = MagicMock()
    fmt_mock.model_dump.return_value = {
        "format": "full_gdd",
        "detail_level": "standard",
        "sections": ["title", "overview", "core_loop", "mechanics"],
        "estimated_pages": 50,
        "audience": "production",
    }
    svc.determine_gdd_format = AsyncMock(return_value=fmt_mock)

    # map_project_to_sections → object with .model_dump()
    map_mock = MagicMock()
    map_mock.model_dump.return_value = {
        "format_spec": {
            "format": "full_gdd",
            "detail_level": "standard",
            "sections": ["title", "overview"],
        },
        "active_mappings": {"title": {"source": "concept.title", "auto_fill": True}},
        "section_readiness": {"title": {"status": "ready", "coverage": 1.0}},
        "auto_fillable_sections": ["title"],
        "manual_sections": [],
        "ai_generatable_sections": [],
        "coverage_score": 0.25,
    }
    svc.map_project_to_sections = AsyncMock(return_value=map_mock)

    # generate_auto_sections → object with .model_dump()
    auto_mock = MagicMock()
    auto_mock.model_dump.return_value = {
        "sections": {"title": {"content": "# My Game", "source": "auto_fill"}},
        "count": 1,
        "total_coverage": 0.25,
    }
    svc.generate_auto_sections = AsyncMock(return_value=auto_mock)

    # generate_stages_1_5 → profile mock
    profile_1_5 = MagicMock()
    profile_1_5.model_dump.return_value = {
        "format_spec": {"format": "full_gdd"},
        "data_mapping": {},
        "auto_filled_sections": {},
        "stages_completed": [1, 2, 3, 4, 5],
        "coverage_score": 0.6,
    }
    svc.generate_stages_1_5 = AsyncMock(return_value=profile_1_5)

    # generate_stages_1_8 → profile mock
    profile_1_8 = MagicMock()
    profile_1_8.model_dump.return_value = {
        "format_spec": {"format": "full_gdd"},
        "data_mapping": {},
        "auto_filled_sections": {},
        "stages_completed": [1, 2, 3, 4, 5, 6, 7],
        "coverage_score": 0.9,
    }
    svc.generate_stages_1_8 = AsyncMock(return_value=profile_1_8)

    # assemble_gdd → object with .model_dump()
    asm_mock = MagicMock()
    asm_mock.model_dump.return_value = {
        "sections": {},
        "consistency_report": None,
    }
    svc.assemble_gdd = AsyncMock(return_value=asm_mock)

    # format_document (synchronous)
    fmt_doc_mock = MagicMock()
    fmt_doc_mock.title = "Test GDD"
    fmt_doc_mock.markdown = "# Test GDD\n"
    svc.format_document = MagicMock(return_value=fmt_doc_mock)

    # export_gdd → result mock
    export_mock = MagicMock()
    export_mock.success = True
    export_mock.format = "md"
    export_mock.content = "# GDD Document\n"
    export_mock.file_name = "GDD.md"
    export_mock.content_type = "text/markdown"
    export_mock.size_bytes = 100
    export_mock.file_path = None
    export_mock.error_message = ""
    svc.export_gdd = AsyncMock(return_value=export_mock)

    return svc


VALID_GDD_INPUT = {
    "concept": {"genre": "rpg", "title": "My Game"},
    "target_format": "full_gdd",
    "detail_level": "standard",
    "language": "ru",
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
# Tests — POST /format
# ============================================================

class TestDetermineFormat:
    """POST /api/v1/gdd/format"""

    @pytest.mark.asyncio
    async def test_format_success(self, auth_client):
        """Authenticated user can determine GDD format."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/format",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["format"] == "full_gdd"
        assert data["detail_level"] == "standard"
        assert "sections" in data
        mock_svc.determine_gdd_format.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_format_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post("/api/v1/gdd/format", json=VALID_GDD_INPUT)
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_format_value_error_returns_400(self, auth_client):
        """ValueError from service → 400."""
        mock_svc = _mock_gdd_service()
        mock_svc.determine_gdd_format = AsyncMock(
            side_effect=ValueError("Invalid format spec")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/format",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_format_unexpected_error_returns_500(self, auth_client):
        """Unexpected exception → 500."""
        mock_svc = _mock_gdd_service()
        mock_svc.determine_gdd_format = AsyncMock(
            side_effect=Exception("Unexpected error")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/format",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 500


# ============================================================
# Tests — POST /map
# ============================================================

class TestMapSections:
    """POST /api/v1/gdd/map"""

    @pytest.mark.asyncio
    async def test_map_success(self, auth_client):
        """Authenticated user can map sections."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/map",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "active_mappings" in data
        assert "auto_fillable_sections" in data
        assert "coverage_score" in data
        # /map calls both determine_gdd_format and map_project_to_sections
        mock_svc.determine_gdd_format.assert_awaited_once()
        mock_svc.map_project_to_sections.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_map_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post("/api/v1/gdd/map", json=VALID_GDD_INPUT)
        assert resp.status_code in (401, 403)


# ============================================================
# Tests — POST /auto-fill
# ============================================================

class TestAutoFill:
    """POST /api/v1/gdd/auto-fill"""

    @pytest.mark.asyncio
    async def test_auto_fill_success(self, auth_client):
        """Authenticated user can auto-fill GDD sections."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/auto-fill",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "sections" in data
        mock_svc.generate_auto_sections.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_auto_fill_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post("/api/v1/gdd/auto-fill", json=VALID_GDD_INPUT)
        assert resp.status_code in (401, 403)


# ============================================================
# Tests — POST /generate
# ============================================================

class TestGenerateGDD:
    """POST /api/v1/gdd/generate"""

    @pytest.mark.asyncio
    async def test_generate_success(self, auth_client):
        """Authenticated user can generate GDD (stages 1-5)."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/generate",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 200
        mock_svc.generate_stages_1_5.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_generate_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post("/api/v1/gdd/generate", json=VALID_GDD_INPUT)
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_generate_runtime_error_returns_503(self, auth_client):
        """RuntimeError from service → 503."""
        mock_svc = _mock_gdd_service()
        mock_svc.generate_stages_1_5 = AsyncMock(
            side_effect=RuntimeError("AI provider down")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/generate",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 503


# ============================================================
# Tests — POST /generate-full
# ============================================================

class TestGenerateFullGDD:
    """POST /api/v1/gdd/generate-full"""

    @pytest.mark.asyncio
    async def test_generate_full_success(self, auth_client):
        """Authenticated user can generate full GDD (stages 1-7)."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/generate-full",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 200
        mock_svc.generate_stages_1_8.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_generate_full_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post(
            "/api/v1/gdd/generate-full", json=VALID_GDD_INPUT
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_generate_full_value_error_returns_400(self, auth_client):
        """ValueError from service → 400."""
        mock_svc = _mock_gdd_service()
        mock_svc.generate_stages_1_8 = AsyncMock(
            side_effect=ValueError("Invalid input")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/generate-full",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_generate_full_runtime_error_returns_503(self, auth_client):
        """RuntimeError from service → 503."""
        mock_svc = _mock_gdd_service()
        mock_svc.generate_stages_1_8 = AsyncMock(
            side_effect=RuntimeError("AI provider unavailable")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/generate-full",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_generate_full_unexpected_error_returns_500(self, auth_client):
        """Unexpected exception → 500."""
        mock_svc = _mock_gdd_service()
        mock_svc.generate_stages_1_8 = AsyncMock(
            side_effect=Exception("Unexpected crash")
        )
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/generate-full",
                json=VALID_GDD_INPUT,
            )

        assert resp.status_code == 500


# ============================================================
# Tests — POST /checklist
# ============================================================

class TestChecklist:
    """POST /api/v1/gdd/checklist"""

    @pytest.mark.asyncio
    async def test_checklist_returns_redirect(self, auth_client):
        """Checklist endpoint returns redirect status."""
        resp = await auth_client.post(
            "/api/v1/gdd/checklist",
            json={
                "concept_id": "test-concept-1",
                "checklist_types": ["mda", "balance"],
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "redirect"

    @pytest.mark.asyncio
    async def test_checklist_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post(
            "/api/v1/gdd/checklist",
            json={"concept_id": "test-concept-1", "checklist_types": ["mda"]},
        )
        assert resp.status_code in (401, 403)


# ============================================================
# Tests — POST /export
# ============================================================

class TestExportGDD:
    """POST /api/v1/gdd/export"""

    @pytest.mark.asyncio
    async def test_export_markdown_success(self, auth_client):
        """Export GDD as Markdown returns content."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        # Provide gdd_profile with formatted_document so export skips assembly
        export_input = {
            "gdd_profile": {
                "format_spec": {"format": "full_gdd", "detail_level": "standard"},
                "formatted_document": {
                    "title": "Test GDD",
                    "markdown": "# Test GDD\n\nContent",
                },
            },
            "format": "md",
        }

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/export",
                json=export_input,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["format"] == "md"
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_export_unauthorized(self, test_client):
        """Unauthenticated request is rejected."""
        resp = await test_client.post(
            "/api/v1/gdd/export",
            json={"format": "pdf"},
        )
        assert resp.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_export_missing_gdd_profile_returns_400(self, auth_client):
        """Export without gdd_profile returns 400."""
        mock_svc = _mock_gdd_service()
        mock_get_svc = AsyncMock(return_value=mock_svc)

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/export",
                json={"format": "pdf"},
            )

        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_export_failure_returns_500(self, auth_client):
        """When export_gdd returns unsuccessful result, returns 500."""
        mock_svc = _mock_gdd_service()
        # Make export fail
        fail_export = MagicMock()
        fail_export.success = False
        fail_export.error_message = "PDF generation failed"
        fail_export.format = "pdf"
        fail_export.content = ""
        fail_export.file_name = ""
        fail_export.content_type = ""
        fail_export.size_bytes = 0
        fail_export.file_path = None
        mock_svc.export_gdd = AsyncMock(return_value=fail_export)
        mock_get_svc = AsyncMock(return_value=mock_svc)

        export_input = {
            "gdd_profile": {
                "format_spec": {"format": "full_gdd", "detail_level": "standard"},
                "formatted_document": {
                    "title": "Test GDD",
                    "markdown": "# Test GDD",
                },
            },
            "format": "pdf",
        }

        with patch("app.api.v1.gdd.get_gdd_service", mock_get_svc):
            resp = await auth_client.post(
                "/api/v1/gdd/export",
                json=export_input,
            )

        assert resp.status_code == 500
