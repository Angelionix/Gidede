"""
Gidede — Shared Enum Definitions (Python)
Фаза 4.A.12: Shared-модели и типы

Общие перечисления, синхронизированные с TypeScript-версией.
Источник: алгоритмы 3.1–3.10
"""

from enum import Enum


# ============================================================
# ЭСТЕТИКА (MDA Framework)
# ============================================================

class AestheticType(str, Enum):
    """8 эстетических ценностей ЛеБланка."""
    SENSATION = "sensation"
    FANTASY = "fantasy"
    NARRATIVE = "narrative"
    CHALLENGE = "challenge"
    FELLOWSHIP = "fellowship"
    DISCOVERY = "discovery"
    EXPRESSION = "expression"
    SUBMISSION = "submission"


# ============================================================
# ЖАНРЫ
# ============================================================

class Genre(str, Enum):
    """Таксономия жанров (Роджерс)."""
    ACTION = "action"
    PLATFORMER = "platformer"
    SHOOTER = "shooter"
    FIGHTING = "fighting"
    STEALTH = "stealth"
    SURVIVAL_HORROR = "survival_horror"
    RHYTHM = "rhythm"
    ADVENTURE = "adventure"
    RPG = "rpg"
    ACTION_RPG = "action_rpg"
    JRPG = "jrpg"
    TACTICAL_RPG = "tactical_rpg"
    MMORPG = "mmorpg"
    ROGUELIKE = "roguelike"
    SIMULATION = "simulation"
    STRATEGY = "strategy"
    RTS = "rts"
    TBS = "tbs"
    TOWER_DEFENSE = "tower_defense"
    PUZZLE = "puzzle"
    PARTY = "party"
    EDUCATIONAL = "educational"
    RACING = "racing"
    SPORTS = "sports"
    SANDBOX = "sandbox"
    HORROR = "horror"
    METROIDVANIA = "metroidvania"
    IDLE = "idle"
    VISUAL_NOVEL = "visual_novel"


# ============================================================
# МОТИВАЦИИ (модель Йи)
# ============================================================

class YeeMotivation(str, Enum):
    DESTRUCTION = "destruction"
    EXCITEMENT = "excitement"
    COMPETITION = "competition"
    COMMUNITY = "community"
    CHALLENGE_M = "challenge"
    STRATEGY = "strategy"
    COMPLETION = "completion"
    POWER = "power"
    FANTASY_YEE = "fantasy_yee"
    STORY = "story"
    DESIGN = "design"
    DISCOVERY_YEE = "discovery_yee"


class BartleType(str, Enum):
    ACHIEVER = "achiever"
    EXPLORER = "explorer"
    SOCIALIZER = "socializer"
    KILLER = "killer"


# ============================================================
# CORE LOOP
# ============================================================

class LoopStructuralType(str, Enum):
    ENGINE = "engine"
    ECONOMY = "economy"
    ECOLOGY = "ecology"
    HYBRID = "hybrid"


class LoopSubType(str, Enum):
    BRAKED_ENGINE = "braked_engine"
    PURE_ENGINE = "pure_engine"
    MULTI_CURRENCY_ECONOMY = "multi_currency_economy"
    SINGLE_CURRENCY_ECONOMY = "single_currency_economy"
    BALANCED_ECOLOGY = "balanced_ecology"
    HYBRID_ENGINE = "hybrid_engine"
    HYBRID_ECONOMY = "hybrid_economy"


class EmergencePotential(str, Enum):
    NONE = "none"
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"


# ============================================================
# БАЛАНС
# ============================================================

class BalanceType(str, Enum):
    TRANSITIVE = "transitive"
    INTRANSITIVE = "intransitive"
    SITUATIONAL = "situational"
    MIXED = "mixed"


class BalanceObjectType(str, Enum):
    CHARACTER = "character"
    WEAPON = "weapon"
    UNIT = "unit"
    ABILITY = "ability"
    ITEM = "item"
    CLASS = "class"


class GameMode(str, Enum):
    PVP = "PvP"
    PVE = "PvE"
    PVPVE = "PvPvE"


# ============================================================
# ПРОГРЕССИЯ
# ============================================================

class ProgressionType(str, Enum):
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    DIMINISHING = "diminishing"
    S_CURVE = "s_curve"
    INTERMITTENT = "intermittent"
    CUSTOM = "custom"


class FlowTarget(str, Enum):
    RELAXED = "relaxed"
    BALANCED = "balanced"
    INTENSE = "intense"


class ContentBudget(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# ============================================================
# ЭКОНОМИКА
# ============================================================

class EconomyMonetizationType(str, Enum):
    FIXED = "fixed"
    PLAYER_DRIVEN = "player_driven"
    F2P_DUAL_CURRENCY = "f2p_dual_currency"
    PRESTIGE = "prestige"
    MIXED = "mixed"


class EconomyOpenness(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    MIXED = "mixed"


class ResourceClass(str, Enum):
    TIME = "time"
    CURRENCY = "currency"
    GAME_OBJECT = "game_object"
    HP = "hp"
    EXPERIENCE = "experience"


class ResourceType(str, Enum):
    CORE = "core"
    SUBSIDIARY = "subsidiary"
    CURRENCY = "currency"
    CONSUMABLE = "consumable"
    META = "meta"


# ============================================================
# GDD
# ============================================================

class GDDFormat(str, Enum):
    ONE_SHEET = "one_sheet"
    TEN_PAGER = "ten_pager"
    TREATMENT = "treatment"
    SKETCH_DESIGN = "sketch_design"
    FULL_GDD = "full_gdd"
    CONCEPT_DOC = "concept_doc"
    NARRATIVE_BIBLE = "narrative_bible"
    MODULAR = "modular"


class DocAudience(str, Enum):
    INVESTOR = "investor"
    TEAM_SYNC = "team_sync"
    PRODUCTION = "production"
    PERSONAL = "personal"
    EDUCATIONAL = "educational"


class DetailLevel(str, Enum):
    OVERVIEW = "overview"
    STANDARD = "standard"
    DETAILED = "detailed"
    EXHAUSTIVE = "exhaustive"


# ============================================================
# ЧЕК-ЛИСТЫ
# ============================================================

class ChecklistType(str, Enum):
    MDA = "mda"
    BALANCE = "balance"
    NARRATIVE = "narrative"
    ECONOMY = "economy"
    LENSES = "lenses"
    PLAYTEST = "playtest"


class FocusArea(str, Enum):
    CORE_LOOP = "core_loop"
    MECHANICS = "mechanics"
    BALANCE = "balance"
    PROGRESSION = "progression"
    ECONOMY = "economy"
    NARRATIVE = "narrative"
    OVERALL = "overall"


# ============================================================
# СТАТУСЫ
# ============================================================

class ProjectStageName(str, Enum):
    CONCEPT = "concept"
    PROTOTYPE = "prototype"
    PREPRODUCTION = "preproduction"
    PRODUCTION = "production"
    LIVE_OPS = "live_ops"


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class UserPlan(str, Enum):
    FREE = "free"
    PRO = "pro"


class BudgetLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ScopeLevel(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class ExperienceLevel(str, Enum):
    CASUAL = "casual"
    MIDCORE = "midcore"
    HARDCORE = "hardcore"


class ExportFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    MD = "md"
    HTML = "html"


class CitationStyle(str, Enum):
    FOOTNOTE = "footnote"
    INLINE = "inline"
    NONE = "none"
