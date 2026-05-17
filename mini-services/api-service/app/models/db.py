"""
Gidede — ORM-модели SQLAlchemy для Project State
Фаза 4.A.4: Схема PostgreSQL (Project State)

Модели основаны на спецификации алгоритма 3.10 (Этап 3: Модель данных Project State).
Стратегия: реляционные поля для индексации + JSON-поля для гибкости.

Таблицы:
- users: пользователи системы
- projects: игровые проекты (основная таблица Project State)
- project_concepts: Блок 1 — Генератор концепции (OnePager из 3.1)
- project_core_loops: Блок 2 — Core Loop Designer (CoreLoopProfile из 3.2)
- project_mda_profiles: Блок 3 — MDA Lab (MDAProfile из 3.3)
- project_balance_results: Блок 4 — Баланс и симуляция (BalanceResult из 3.4)
- project_progressions: Блок 5 — Прогрессия (ProgressionProfile из 3.5)
- project_economies: Блок 5 — Экономика (EconomyProfile из 3.6)
- project_gdds: Блок 6 — GDD Generator (GDDProfile из 3.7)
- project_checklists: Блок 6 — Валидация (ChecklistResults из 3.8)
- mechanics_db: Статическая БД механик (127 механик в 15 группах)
- prompt_logs: Логи вызовов AI-промптов
"""

from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey,
    Index, Enum as SQLEnum, JSON, Date,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.core.database import Base


# ============================================================
# ENUMS
# ============================================================

class UserPlan(str, enum.Enum):
    """Уровень доступа пользователя."""
    FREE = "free"
    PRO = "pro"


class ProjectStatus(str, enum.Enum):
    """Статус проекта."""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectStage(str, enum.Enum):
    """Текущий этап проекта (какой блок выполнялся последним)."""
    CONCEPT = "concept"          # Блок 1
    CORE_LOOP = "core_loop"      # Блок 2
    MDA = "mda"                  # Блок 3
    BALANCE = "balance"          # Блок 4
    PROGRESSION = "progression"  # Блок 5
    ECONOMY = "economy"          # Блок 5
    GDD = "gdd"                  # Блок 6
    VALIDATION = "validation"    # Блок 6


# ============================================================
# USER
# ============================================================

class User(Base):
    """Пользователь системы Gidede."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    plan = Column(String(20), nullable=False, default=UserPlan.FREE.value, index=True)
    ai_calls_count = Column(Integer, nullable=False, default=0)
    ai_calls_limit = Column(Integer, nullable=False, default=50)  # free: 50/day, pro: 500/day
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, nullable=True)

    # Связи
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email} ({self.plan})>"


class RefreshToken(Base):
    """Refresh-токены для JWT авторизации."""
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(512), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    is_revoked = Column(Boolean, nullable=False, default=False)

    # Связи
    user = relationship("User", back_populates="refresh_tokens")

    def __repr__(self):
        return f"<RefreshToken user={self.user_id} revoked={self.is_revoked}>"


# ============================================================
# PROJECT (Project State — основная таблица)
# ============================================================

class Project(Base):
    """
    Проект Game Design — единый источник истины (Project State).
    Основная таблица, связывающая все данные блоков.
    """
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    genre = Column(String(100), nullable=True, index=True)
    status = Column(String(20), nullable=False, default=ProjectStatus.DRAFT.value, index=True)
    project_stage = Column(String(30), nullable=True, index=True)
    completion_percent = Column(Integer, nullable=False, default=0)
    version = Column(Integer, nullable=False, default=1)
    last_algorithm_run = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    user = relationship("User", back_populates="projects")
    concept = relationship("ProjectConcept", back_populates="project", uselist=False, cascade="all, delete-orphan")
    core_loop = relationship("ProjectCoreLoop", back_populates="project", uselist=False, cascade="all, delete-orphan")
    mda_profile = relationship("ProjectMDAProfile", back_populates="project", uselist=False, cascade="all, delete-orphan")
    balance_result = relationship("ProjectBalanceResult", back_populates="project", uselist=False, cascade="all, delete-orphan")
    progression = relationship("ProjectProgression", back_populates="project", uselist=False, cascade="all, delete-orphan")
    economy = relationship("ProjectEconomy", back_populates="project", uselist=False, cascade="all, delete-orphan")
    gdd = relationship("ProjectGDD", back_populates="project", uselist=False, cascade="all, delete-orphan")
    checklist = relationship("ProjectChecklist", back_populates="project", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.name} ({self.status})>"


# ============================================================
# БЛОК 1: КОНЦЕПЦИЯ (алгоритм 3.1)
# ============================================================

class ProjectConcept(Base):
    """
    Блок 1: Генератор концепции.
    Хранит OnePager из алгоритма 3.1.

    Реляционные поля для индексации:
    - genre, subgenre — быстрый поиск по жанру
    - primary_aesthetic — фильтрация по эстетике

    JSON-поля для гибкости:
    - one_pager_data — полная структура OnePager
    - aesthetic_profile — AestheticProfile
    - dynamics_profile — DynamicsProfile
    - mechanic_set — MechanicSet (выбранные механики)
    - validation_report — результаты валидации (Triangle, 5 Questions, 8 Filters)
    - usp_candidates — кандидаты USP
    - core_loop_candidates — кандидаты Core Loop
    """
    __tablename__ = "project_concepts"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    genre = Column(String(100), nullable=True, index=True)
    subgenre = Column(String(100), nullable=True)
    primary_aesthetic = Column(String(50), nullable=True, index=True)
    usp = Column(Text, nullable=True)

    # JSON-поля (полные данные из алгоритма 3.1)
    input_data = Column(JSON, nullable=True)            # ConceptInput
    one_pager_data = Column(JSON, nullable=True)        # OnePager (8 полей)
    aesthetic_profile = Column(JSON, nullable=True)     # AestheticProfile (3 эстетики)
    dynamics_profile = Column(JSON, nullable=True)      # DynamicsProfile
    mechanic_set = Column(JSON, nullable=True)          # MechanicSet (15 групп)
    validation_report = Column(JSON, nullable=True)     # ValidationReport
    usp_candidates = Column(JSON, nullable=True)        # [{usp, triangle_check, differentiation}]
    core_loop_candidates = Column(JSON, nullable=True)  # [{name, steps, loop_type, fun_check}]

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="concept")

    def __repr__(self):
        return f"<ProjectConcept genre={self.genre}>"


# ============================================================
# БЛОК 2: CORE LOOP (алгоритм 3.2)
# ============================================================

class ProjectCoreLoop(Base):
    """
    Блок 2: Core Loop Designer.
    Хранит CoreLoopProfile из алгоритма 3.2.

    Реляционные поля:
    - structural_type — Engine/Economy/Ecology
    - pathology_count — количество обнаруженных патологий

    JSON-поля:
    - loop_hierarchy — 6-уровневая иерархия петель (микро → мета)
    - pathologies — PathologyReport (7 патологий)
    - recommendations — Recommendation[]
    - validation_data — результаты «30 секунд веселья» и чек-листы
    """
    __tablename__ = "project_core_loops"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    structural_type = Column(String(30), nullable=True, index=True)  # Engine/Economy/Ecology
    structural_subtype = Column(String(50), nullable=True)           # braked/pure, multi_currency/single
    step_count = Column(Integer, nullable=True)                      # Количество шагов Core Loop
    hierarchy_depth = Column(Integer, nullable=True)                 # Глубина иерархии петель
    pathology_count = Column(Integer, nullable=True, default=0)

    # JSON-поля
    input_data = Column(JSON, nullable=True)           # CoreLoopInput
    steps_data = Column(JSON, nullable=True)           # CoreLoopStep[]
    inner_loops = Column(JSON, nullable=True)          # InnerLoop[]
    outer_loops = Column(JSON, nullable=True)          # OuterLoop[]
    meta_loop = Column(JSON, nullable=True)            # MetaLoop
    loop_hierarchy = Column(JSON, nullable=True)       # LoopHierarchy (6 уровней)
    pathologies = Column(JSON, nullable=True)          # PathologyReport
    recommendations = Column(JSON, nullable=True)      # Recommendation[]
    validation_data = Column(JSON, nullable=True)      # Валидация (30 сек + чек-листы)
    full_profile = Column(JSON, nullable=True)         # Полный CoreLoopProfile

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="core_loop")

    def __repr__(self):
        return f"<ProjectCoreLoop type={self.structural_type}>"


# ============================================================
# БЛОК 3: MDA (алгоритм 3.3)
# ============================================================

class ProjectMDAProfile(Base):
    """
    Блок 3: MDA Lab.
    Хранит MDAProfile из алгоритма 3.3.

    Реляционные поля:
    - primary_aesthetic, secondary_aesthetic — целевая эстетика
    - overall_match — общий score совпадения

    JSON-поля:
    - target_dynamics — целевые динамики
    - mechanic_set — StructuredMechanicSet
    - observed_dynamics — наблюдаемые динамики
    - predicted_aesthetics — предсказанная эстетика
    - match_scores — score совпадения по эстетикам
    - lens_validation — Линзы Шелла
    - bond_validation — Матрица Бонда 4×3
    - ludonarrative_check — лудонарративный диссонанс
    """
    __tablename__ = "project_mda_profiles"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    primary_aesthetic = Column(String(50), nullable=True, index=True)
    secondary_aesthetic = Column(String(50), nullable=True)
    overall_match = Column(Float, nullable=True)  # 0.0–1.0
    iteration_count = Column(Integer, nullable=True, default=0)

    # JSON-поля
    input_data = Column(JSON, nullable=True)            # MDAGenerationInput
    target_dynamics = Column(JSON, nullable=True)       # DynamicsTarget
    mechanic_set = Column(JSON, nullable=True)          # StructuredMechanicSet
    observed_dynamics = Column(JSON, nullable=True)     # string[]
    predicted_aesthetics = Column(JSON, nullable=True)  # Record<AestheticType, number>
    match_scores = Column(JSON, nullable=True)          # Record<AestheticType, number>
    lens_validation = Column(JSON, nullable=True)       # LensValidation (9 линз)
    bond_validation = Column(JSON, nullable=True)       # BondValidation (матрица 4×3)
    ludonarrative_check = Column(JSON, nullable=True)   # LudonarrativeCheck
    machinations_model = Column(JSON, nullable=True)    # MachinationsGraph
    simulation_results = Column(JSON, nullable=True)    # Симуляция геймплея
    full_profile = Column(JSON, nullable=True)          # Полный MDAProfile

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="mda_profile")

    def __repr__(self):
        return f"<ProjectMDAProfile aesthetics={self.primary_aesthetic} match={self.overall_match}>"


# ============================================================
# БЛОК 4: БАЛАНС (алгоритм 3.4)
# ============================================================

class ProjectBalanceResult(Base):
    """
    Блок 4: Баланс и симуляция.
    Хранит BalanceResult из алгоритма 3.4.

    Реляционные поля:
    - balance_type — transitive/intransitive
    - overall_score — общий score баланса
    - imbalance_count — количество дисбалансов

    JSON-поля:
    - elements — BalancedElement[]
    - cost_power_curves — CostPowerCurve[]
    - intransitive_matrix — PayoffMatrix
    - nash_equilibrium — NashEquilibrium
    - monte_carlo_results — MonteCarloResult[]
    - pathologies — BalancePathology[]
    - corrections — CorrectionProposal[]
    - situational_values — матрица ситуационной ценности
    """
    __tablename__ = "project_balance_results"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    balance_type = Column(String(30), nullable=True, index=True)  # transitive/intransitive/mixed
    overall_balance_score = Column(Float, nullable=True)  # 0.0–1.0
    imbalance_count = Column(Integer, nullable=True, default=0)
    element_count = Column(Integer, nullable=True)

    # JSON-поля
    input_data = Column(JSON, nullable=True)                # BalanceInput
    elements = Column(JSON, nullable=True)                  # BalancedElement[]
    cost_power_curves = Column(JSON, nullable=True)         # CostPowerCurve[]
    intransitive_matrix = Column(JSON, nullable=True)       # PayoffMatrix
    nash_equilibrium = Column(JSON, nullable=True)          # NashEquilibrium
    monte_carlo_results = Column(JSON, nullable=True)       # MonteCarloResult[]
    machinations_results = Column(JSON, nullable=True)      # Machinations simulation
    pathologies = Column(JSON, nullable=True)               # BalancePathology[]
    corrections = Column(JSON, nullable=True)               # CorrectionProposal[]
    situational_values = Column(JSON, nullable=True)        # SituationValue matrix
    full_result = Column(JSON, nullable=True)               # Полный BalanceResult

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="balance_result")

    def __repr__(self):
        return f"<ProjectBalanceResult score={self.overall_balance_score}>"


# ============================================================
# БЛОК 5: ПРОГРЕССИЯ (алгоритм 3.5)
# ============================================================

class ProjectProgression(Base):
    """
    Блок 5: Прогрессия.
    Хранит ProgressionProfile из алгоритма 3.5.

    Реляционные поля:
    - total_levels — общее количество уровней
    - tier_count — количество этапов
    - curve_type — тип кривой прогрессии

    JSON-поля:
    - macro_model — ProgressionMacroModel
    - tier_model — TierModel (2–5 этапов)
    - curves — ProgressionCurves (4 кривые)
    - content_plan — ContentPlan
    - economy_link — ProgressionEconomyLink
    - validation — ProgressionValidation
    """
    __tablename__ = "project_progressions"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    total_levels = Column(Integer, nullable=True)
    tier_count = Column(Integer, nullable=True)
    curve_type = Column(String(30), nullable=True, index=True)  # 7 типов кривых
    target_duration_hours = Column(Float, nullable=True)

    # JSON-поля
    input_data = Column(JSON, nullable=True)            # ProgressionInput
    macro_model = Column(JSON, nullable=True)           # ProgressionMacroModel
    tier_model = Column(JSON, nullable=True)            # TierModel
    curves = Column(JSON, nullable=True)                # ProgressionCurves (4 кривые)
    content_plan = Column(JSON, nullable=True)          # ContentPlan
    economy_link = Column(JSON, nullable=True)          # ProgressionEconomyLink
    validation = Column(JSON, nullable=True)            # ProgressionValidation
    full_profile = Column(JSON, nullable=True)          # Полный ProgressionProfile

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="progression")

    def __repr__(self):
        return f"<ProjectProgression levels={self.total_levels}>"


# ============================================================
# БЛОК 5: ЭКОНОМИКА (алгоритм 3.6)
# ============================================================

class ProjectEconomy(Base):
    """
    Блок 5: Экономическое моделирование.
    Хранит EconomyProfile из алгоритма 3.6.

    Реляционные поля:
    - system_type — тип экономической системы
    - resource_count — количество ресурсов
    - has_pathology — есть ли патологии

    JSON-поля:
    - resource_model — ResourceModel
    - machinations_model — MachinationsGraph
    - conversion_chains — ConversionChain[]
    - pathologies — EconomyPathology[]
    - corrections — EconomyCorrection[]
    - simulation_results — SimulationResult
    - monetization_model — MonetizationSpec
    """
    __tablename__ = "project_economies"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    system_type = Column(String(30), nullable=True, index=True)  # Engine/Economy/Ecology
    resource_count = Column(Integer, nullable=True)
    has_pathology = Column(Boolean, nullable=True, default=False)

    # JSON-поля
    input_data = Column(JSON, nullable=True)            # EconomyInput
    resource_model = Column(JSON, nullable=True)        # ResourceModel
    machinations_model = Column(JSON, nullable=True)    # MachinationsGraph
    conversion_chains = Column(JSON, nullable=True)     # ConversionChain[]
    pathologies = Column(JSON, nullable=True)           # EconomyPathology[]
    corrections = Column(JSON, nullable=True)           # EconomyCorrection[]
    simulation_results = Column(JSON, nullable=True)    # SimulationResult
    monetization_model = Column(JSON, nullable=True)    # MonetizationSpec
    full_profile = Column(JSON, nullable=True)          # Полный EconomyProfile

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="economy")

    def __repr__(self):
        return f"<ProjectEconomy type={self.system_type}>"


# ============================================================
# БЛОК 6: GDD (алгоритм 3.7)
# ============================================================

class ProjectGDD(Base):
    """
    Блок 6: GDD Generator.
    Хранит GDDProfile из алгоритма 3.7.

    Реляционные поля:
    - format — тип GDD (one_sheet/ten_pager/full)
    - section_count — количество секций
    - completeness_percent — процент заполненности

    JSON-поля:
    - sections — GDDSection[]
    - visual_elements — Record<string, VisualElement>
    - consistency_issues — ConsistencyIssue[]
    - completeness_report — CompletenessReport
    """
    __tablename__ = "project_gdds"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    format = Column(String(20), nullable=True, index=True)  # one_sheet/ten_pager/full
    section_count = Column(Integer, nullable=True)
    completeness_percent = Column(Float, nullable=True)

    # JSON-поля
    input_data = Column(JSON, nullable=True)            # GDDGenerationInput
    sections = Column(JSON, nullable=True)              # GDDSection[]
    visual_elements = Column(JSON, nullable=True)       # Record<string, VisualElement>
    consistency_issues = Column(JSON, nullable=True)    # ConsistencyIssue[]
    completeness_report = Column(JSON, nullable=True)   # CompletenessReport
    full_profile = Column(JSON, nullable=True)          # Полный GDDProfile

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="gdd")

    def __repr__(self):
        return f"<ProjectGDD format={self.format} sections={self.section_count}>"


# ============================================================
# БЛОК 6: ВАЛИДАЦИЯ (алгоритм 3.8)
# ============================================================

class ProjectChecklist(Base):
    """
    Блок 6: Валидация и чек-листы.
    Хранит ChecklistResults из алгоритма 3.8.

    Реляционные поля:
    - overall_score — общий score валидации
    - readiness_level — уровень готовности
    - critical_issue_count — количество критических проблем

    JSON-поля:
    - mda_check — MDACheckResult
    - balance_check — BalanceCheckResult
    - narrative_check — NarrativeCheckResult
    - economy_check — EconomyCheckResult
    - lens_check — LensCheckResult
    - issues — ValidationIssue[]
    - remediation_plan — RemediationItem[]
    """
    __tablename__ = "project_checklists"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Реляционные поля для индексации
    overall_score = Column(Float, nullable=True)  # 0.0–1.0
    readiness_level = Column(String(30), nullable=True, index=True)  # draft/review/ready/production
    critical_issue_count = Column(Integer, nullable=True, default=0)
    total_issue_count = Column(Integer, nullable=True, default=0)

    # JSON-поля
    input_data = Column(JSON, nullable=True)            # ChecklistInput
    mda_check = Column(JSON, nullable=True)             # MDACheckResult
    balance_check = Column(JSON, nullable=True)         # BalanceCheckResult
    narrative_check = Column(JSON, nullable=True)       # NarrativeCheckResult
    economy_check = Column(JSON, nullable=True)         # EconomyCheckResult
    lens_check = Column(JSON, nullable=True)            # LensCheckResult
    issues = Column(JSON, nullable=True)                # ValidationIssue[]
    remediation_plan = Column(JSON, nullable=True)      # RemediationItem[]
    full_results = Column(JSON, nullable=True)          # Полный ChecklistResults

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи
    project = relationship("Project", back_populates="checklist")

    def __repr__(self):
        return f"<ProjectChecklist score={self.overall_score} readiness={self.readiness_level}>"


# ============================================================
# MECHANICS DB (статическая справочная таблица)
# ============================================================

class MechanicDB(Base):
    """
    Статическая БД механик — 127 механик в 15 группах (SW.BAND).
    Используется в Блоках 1, 3, 5 для подбора механик.
    """
    __tablename__ = "mechanics_db"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    group_name = Column(String(100), nullable=False, index=True)      # Группа (15 групп)
    mechanic_name = Column(String(255), nullable=False)                # Название механики
    description = Column(Text, nullable=True)                          # Описание
    dynamics_served = Column(JSON, nullable=True)                      # Динамики, которые обслуживает
    aesthetics_served = Column(JSON, nullable=True)                    # Эстетики, которые обслуживает
    genre_affinity = Column(JSON, nullable=True)                       # Жанровое сродство
    conflicts_with = Column(JSON, nullable=True)                       # Конфликтующие механики
    synergies_with = Column(JSON, nullable=True)                       # Синергетические механики
    source = Column(String(50), nullable=True)                         # Источник (SW.BAND, Schell, и т.д.)

    __table_args__ = (
        Index("ix_mechanics_group_name", "group_name"),
    )

    def __repr__(self):
        return f"<MechanicDB {self.mechanic_name} ({self.group_name})>"


# ============================================================
# PROMPT LOGS (логирование вызовов AI)
# ============================================================

class PromptLog(Base):
    """
    Логи вызовов AI-промптов.
    Используется для мониторинга, анализа стоимости и A/B тестирования.
    """
    __tablename__ = "prompt_logs"

    id = Column(String, primary_key=True, default=lambda: __import__("uuid").uuid4().hex)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    prompt_id = Column(String(100), nullable=False, index=True)     # CLASSIFY_GENRE и т.д.
    model_used = Column(String(100), nullable=False)                 # Реально использованная модель
    provider = Column(String(30), nullable=False)                    # openai/anthropic
    attempts = Column(Integer, nullable=False, default=1)
    from_cache = Column(Boolean, nullable=False, default=False)
    validation_passed = Column(Boolean, nullable=False, default=True)
    latency_ms = Column(Integer, nullable=True)
    tokens_input = Column(Integer, nullable=True)
    tokens_output = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("ix_prompt_logs_prompt_created", "prompt_id", "created_at"),
        Index("ix_prompt_logs_user_created", "user_id", "created_at"),
    )

    def __repr__(self):
        return f"<PromptLog {self.prompt_id} model={self.model_used} success={self.success}>"
