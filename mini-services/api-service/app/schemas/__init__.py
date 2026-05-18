"""
Gidede — Pydantic схемы для валидации API
Фаза 4.A.4–4.A.5: Схемы Project State + Auth
Фаза 4.B.6: Схемы Core Loop Designer
Фаза 4.C.1–4.C.3: Схемы Balance Service
Фаза 4.C.5: Схемы Progression Service
"""

from app.schemas.auth import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    TokenRefreshRequest, PasswordChange,
)
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse,
)
from app.schemas.coreloop import (
    CoreLoopStep, ResourceProfile, RiskProfile, StructuralType,
    LoopProfile, LoopHierarchy, Pathology, PathologyReport, CoreLoopProfile,
)
from app.schemas.balance import (
    BalanceObject, BalanceInput, BalanceMap,
    ObjectBalanceReport, TransitiveResult,
    IntransitiveResult, StrategyBalanceScore, RPSCycle,
    SituationalResult, Situation, VersatilityInfo,
    QFactorResult, QFactorObject,
    StabilityAnalysis,
    SimulationConfig, MatchupData, NumberFormatReport, MonteCarloResult,
    MachinationsNode, MachinationsResourceFlow, MachinationsStateConnection,
    MachinationsFeedbackLoop, MachinationsGraph,
    MachinationsSimConfig, EconomyRunSnapshot,
    AggregatedSimData, QualityAssessment, MachinationsSimResult,
    BalanceResult,
)
from app.schemas.progression import (
    ProgressionInput, ProgressionConstraints,
    ProgressionMacroModel,
    TierInfo, TierModel,
    CurveSpec, ProgressionCurves,
    ContentTierPlan, UnlockEntry, PerceivedDifficultyEntry,
    ContentPlan,
    ProgressionValidation,
    ProgressionProfile,
)

__all__ = [
    "UserRegister", "UserLogin", "UserResponse", "TokenResponse",
    "TokenRefreshRequest", "PasswordChange",
    "ProjectCreate", "ProjectUpdate", "ProjectResponse", "ProjectListResponse",
    "CoreLoopStep", "ResourceProfile", "RiskProfile", "StructuralType",
    "LoopProfile", "LoopHierarchy", "Pathology", "PathologyReport", "CoreLoopProfile",
    "BalanceObject", "BalanceInput", "BalanceMap",
    "ObjectBalanceReport", "TransitiveResult",
    "IntransitiveResult", "StrategyBalanceScore", "RPSCycle",
    "SituationalResult", "Situation", "VersatilityInfo",
    "QFactorResult", "QFactorObject",
    "StabilityAnalysis",
    "SimulationConfig", "MatchupData", "NumberFormatReport", "MonteCarloResult",
    "MachinationsNode", "MachinationsResourceFlow", "MachinationsStateConnection",
    "MachinationsFeedbackLoop", "MachinationsGraph",
    "MachinationsSimConfig", "EconomyRunSnapshot",
    "AggregatedSimData", "QualityAssessment", "MachinationsSimResult",
    "BalanceResult",
    "ProgressionInput", "ProgressionConstraints",
    "ProgressionMacroModel",
    "TierInfo", "TierModel",
    "CurveSpec", "ProgressionCurves",
    "ContentTierPlan", "UnlockEntry", "PerceivedDifficultyEntry",
    "ContentPlan",
    "ProgressionValidation",
    "ProgressionProfile",
]
