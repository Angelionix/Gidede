"""
Gidede — Pydantic схемы проектов
Фаза 4.A.6: CRUD для проектов (Project State)
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ProjectCreate(BaseModel):
    """Схема создания проекта."""
    name: str = Field(..., min_length=1, max_length=255, description="Название проекта")
    description: Optional[str] = Field(None, description="Описание идеи игры")
    genre: Optional[str] = Field(None, max_length=100, description="Жанр игры")


class ProjectUpdate(BaseModel):
    """Схема обновления проекта."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    genre: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, pattern="^(draft|active|completed|archived)$")


class ProjectResponse(BaseModel):
    """Схема ответа с данными проекта."""
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    genre: Optional[str] = None
    status: str = "draft"
    project_stage: Optional[str] = None
    completion_percent: int = 0
    version: int = 1
    last_algorithm_run: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Флаги заполненности блоков
    has_concept: bool = False
    has_core_loop: bool = False
    has_mda: bool = False
    has_balance: bool = False
    has_progression: bool = False
    has_economy: bool = False
    has_gdd: bool = False
    has_checklist: bool = False

    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    """Детальный ответ с данными блоков проекта."""
    concept_data: Optional[dict] = None
    core_loop_data: Optional[dict] = None
    mda_data: Optional[dict] = None
    balance_data: Optional[dict] = None
    progression_data: Optional[dict] = None
    economy_data: Optional[dict] = None
    gdd_data: Optional[dict] = None
    checklist_data: Optional[dict] = None


class ProjectListResponse(BaseModel):
    """Схема ответа со списком проектов."""
    projects: list[ProjectResponse]
    total: int
    page: int = 1
    per_page: int = 20
