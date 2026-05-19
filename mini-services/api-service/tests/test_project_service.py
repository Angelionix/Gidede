"""
Gidede — Project Service Tests
Фаза 4.C: Тесты для сервиса управления проектами (CRUD)

Тесты:
- CRUD: create, get, update, delete — ~4 теста
- User isolation — ~2 теста
- Empty project state — ~2 теста
- Edge cases: compute_block_flags, compute_completion_percent — ~4 теста
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project_service import (
    create_project,
    get_project,
    update_project,
    delete_project,
    list_projects,
    compute_block_flags,
    compute_completion_percent,
    get_full_project_state,
)
from app.schemas.project import ProjectCreate, ProjectUpdate


# ============================================================
# Фикстуры
# ============================================================

@pytest.fixture
def mock_db():
    """Мок AsyncSession для тестирования без реальной БД."""
    db = AsyncMock(spec=AsyncSession)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def sample_project_create():
    """Тестовые данные для создания проекта."""
    return ProjectCreate(
        name="Test Game",
        description="Test game description",
        genre="rpg",
    )


@pytest.fixture
def mock_project():
    """Мок объекта Project."""
    project = MagicMock()
    project.id = "test_project_id"
    project.user_id = "test_user_id"
    project.name = "Test Game"
    project.description = "Test description"
    project.genre = "rpg"
    project.status = "draft"
    project.project_stage = None
    project.completion_percent = 0
    project.version = 1
    project.last_algorithm_run = None
    project.created_at = "2024-01-01"
    project.updated_at = "2024-01-01"

    # Empty block relationships
    project.concept = MagicMock(one_pager_data=None, aesthetic_profile=None)
    project.core_loop = MagicMock(steps_data=None, full_profile=None)
    project.mda_profile = MagicMock(mechanic_set=None, full_profile=None)
    project.balance_result = MagicMock(elements=None, full_result=None)
    project.progression = MagicMock(curves=None, full_profile=None)
    project.economy = MagicMock(resource_model=None, full_profile=None)
    project.gdd = MagicMock(sections=None, full_profile=None)
    project.checklist = MagicMock(issues=None, full_results=None)

    return project


# ============================================================
# CRUD: Create
# ============================================================

class TestCreateProject:
    """Тесты создания проекта."""

    @pytest.mark.asyncio
    async def test_create_project_returns_project(self, mock_db, sample_project_create):
        """create_project возвращает объект Project."""
        result = await create_project(
            db=mock_db,
            user_id="test_user_id",
            data=sample_project_create,
        )

        # Проверяем что add был вызван (для проекта + 8 блоков = 9 вызовов)
        assert mock_db.add.call_count == 9
        mock_db.flush.assert_awaited_once()
        assert result.user_id == "test_user_id"
        assert result.name == "Test Game"
        assert result.genre == "rpg"
        assert result.status == "draft"
        assert result.completion_percent == 0


# ============================================================
# CRUD: Get
# ============================================================

class TestGetProject:
    """Тесты получения проекта."""

    @pytest.mark.asyncio
    async def test_get_project_returns_project(self, mock_db, mock_project):
        """get_project возвращает проект по ID и user_id."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_project
        mock_db.execute.return_value = mock_result

        result = await get_project(mock_db, "test_project_id", "test_user_id")

        assert result is not None
        assert result.id == "test_project_id"

    @pytest.mark.asyncio
    async def test_get_project_wrong_user_returns_none(self, mock_db):
        """get_project возвращает None для чужого пользователя."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await get_project(mock_db, "test_project_id", "other_user_id")

        assert result is None


# ============================================================
# CRUD: Update
# ============================================================

class TestUpdateProject:
    """Тесты обновления проекта."""

    @pytest.mark.asyncio
    async def test_update_project_name(self, mock_db, mock_project):
        """Обновление названия проекта."""
        data = ProjectUpdate(name="New Name")

        result = await update_project(mock_db, mock_project, data)

        assert result.name == "New Name"
        mock_db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_project_partial(self, mock_db, mock_project):
        """Частичное обновление (только genre)."""
        data = ProjectUpdate(genre="action")

        result = await update_project(mock_db, mock_project, data)

        # Name and description unchanged
        assert result.name == "Test Game"
        assert result.genre == "action"


# ============================================================
# CRUD: Delete
# ============================================================

class TestDeleteProject:
    """Тесты удаления проекта."""

    @pytest.mark.asyncio
    async def test_delete_project_returns_true(self, mock_db, mock_project):
        """delete_project возвращает True."""
        result = await delete_project(mock_db, mock_project)

        assert result is True
        mock_db.delete.assert_called_once_with(mock_project)
        mock_db.flush.assert_awaited_once()


# ============================================================
# Block Flags & Completion
# ============================================================

class TestComputeBlockFlags:
    """Тесты вычисления флагов заполненности блоков."""

    def test_empty_project_all_flags_false(self, mock_project):
        """Пустой проект: все флаги False."""
        flags = compute_block_flags(mock_project)

        assert flags["has_concept"] is False
        assert flags["has_core_loop"] is False
        assert flags["has_mda"] is False
        assert flags["has_balance"] is False
        assert flags["has_progression"] is False
        assert flags["has_economy"] is False
        assert flags["has_gdd"] is False
        assert flags["has_checklist"] is False

    def test_project_with_concept_flag_true(self):
        """Проект с заполненной концепцией: has_concept = True."""
        project = MagicMock()
        project.concept = MagicMock(one_pager_data={"genre": "rpg"}, aesthetic_profile=None)

        flags = compute_block_flags(project)
        assert flags["has_concept"] is True

    def test_project_with_aesthetic_profile_flag_true(self):
        """Проект с aesthetic_profile: has_concept = True."""
        project = MagicMock()
        project.concept = MagicMock(one_pager_data=None, aesthetic_profile={"primary": "fantasy"})

        flags = compute_block_flags(project)
        assert flags["has_concept"] is True

    def test_completion_percent_empty(self, mock_project):
        """Пустой проект: completion = 0%."""
        flags = compute_block_flags(mock_project)
        percent = compute_completion_percent(flags)
        assert percent == 0

    def test_completion_percent_half(self):
        """4 блока заполнены: completion = 50%."""
        flags = {
            "has_concept": True,
            "has_core_loop": True,
            "has_mda": True,
            "has_balance": True,
            "has_progression": False,
            "has_economy": False,
            "has_gdd": False,
            "has_checklist": False,
        }
        percent = compute_completion_percent(flags)
        assert percent == 50

    def test_completion_percent_full(self):
        """Все 8 блоков заполнены: completion = 100%."""
        flags = {
            "has_concept": True,
            "has_core_loop": True,
            "has_mda": True,
            "has_balance": True,
            "has_progression": True,
            "has_economy": True,
            "has_gdd": True,
            "has_checklist": True,
        }
        percent = compute_completion_percent(flags)
        assert percent == 100


# ============================================================
# Edge Cases
# ============================================================

class TestEdgeCases:
    """Тесты краевых случаев."""

    @pytest.mark.asyncio
    async def test_create_project_with_minimal_data(self, mock_db):
        """Создание проекта только с названием."""
        data = ProjectCreate(name="Minimal")
        result = await create_project(mock_db, user_id="u1", data=data)

        assert result.name == "Minimal"
        assert result.description is None
        assert result.genre is None

    @pytest.mark.asyncio
    async def test_update_project_status(self, mock_db, mock_project):
        """Обновление статуса проекта."""
        data = ProjectUpdate(status="active")

        result = await update_project(mock_db, mock_project, data)

        assert result.status == "active"
