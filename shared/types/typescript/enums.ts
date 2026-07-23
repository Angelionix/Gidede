/**
 * Gidede — Shared Enum Definitions
 * Фаза 4.A.12: Shared-модели и типы
 *
 * Общие перечисления, используемые и на frontend, и на backend.
 * Источник: алгоритмы 3.1–3.10
 */

// ============================================================
// ЭСТЕТИКА (MDA Framework, ЛеБланк)
// ============================================================

/** 8 эстетических ценностей ЛеБланка */
export type AestheticType =
  | 'sensation'      // Чувственное
  | 'fantasy'        // Фантазия
  | 'narrative'      // Нарратив
  | 'challenge'      // Вызов
  | 'fellowship'     // Товарищество
  | 'discovery'      // Открытие
  | 'expression'     // Выражение
  | 'submission';    // Подчинение

// ============================================================
// ЖАНРЫ (таксономия Роджерса)
// ============================================================

export type Genre =
  | 'action' | 'platformer' | 'shooter' | 'fighting' | 'stealth'
  | 'survival_horror' | 'rhythm' | 'adventure' | 'rpg' | 'action_rpg'
  | 'jrpg' | 'tactical_rpg' | 'mmorpg' | 'roguelike' | 'simulation'
  | 'strategy' | 'rts' | 'tbs' | 'tower_defense' | 'puzzle'
  | 'party' | 'educational' | 'racing' | 'sports' | 'sandbox'
  | 'horror' | 'metroidvania' | 'idle' | 'visual_novel';

// ============================================================
// МОТИВАЦИИ (модель Йи)
// ============================================================

export type YeeMotivation =
  | 'destruction' | 'excitement' | 'competition' | 'community'
  | 'challenge' | 'strategy' | 'completion' | 'power'
  | 'fantasy_yee' | 'story' | 'design' | 'discovery_yee';

export type BartleType = 'achiever' | 'explorer' | 'socializer' | 'killer';

// ============================================================
// ПЛАТФОРМЫ
// ============================================================

export type Platform = 'pc' | 'mobile' | 'console' | 'vr' | 'web';

// ============================================================
// CORE LOOP (Селлерс)
// ============================================================

export type LoopStructuralType = 'engine' | 'economy' | 'ecology' | 'hybrid';

export type LoopSubType =
  | 'braked_engine' | 'pure_engine'
  | 'multi_currency_economy' | 'single_currency_economy'
  | 'balanced_ecology'
  | 'hybrid_engine' | 'hybrid_economy';

export type EmergencePotential = 'none' | 'weak' | 'moderate' | 'strong';

// ============================================================
// БАЛАНС
// ============================================================

export type BalanceType = 'transitive' | 'intransitive' | 'situational' | 'mixed';

export type BalanceObjectType = 'character' | 'weapon' | 'unit' | 'ability' | 'item' | 'class';

export type GameMode = 'PvP' | 'PvE' | 'PvPvE';

// ============================================================
// ПРОГРЕССИЯ
// ============================================================

export type ProgressionType =
  | 'linear' | 'exponential' | 'diminishing'
  | 's_curve' | 'intermittent' | 'custom';

export type FlowTarget = 'relaxed' | 'balanced' | 'intense';

export type ContentBudget = 'low' | 'medium' | 'high';

// ============================================================
// ЭКОНОМИКА
// ============================================================

export type EconomyMonetizationType =
  | 'fixed' | 'player_driven' | 'f2p_dual_currency' | 'prestige' | 'mixed';

export type EconomyOpenness = 'open' | 'closed' | 'mixed';

export type ResourceClass = 'time' | 'currency' | 'game_object' | 'hp' | 'experience';

export type ResourceType = 'core' | 'subsidiary' | 'currency' | 'consumable' | 'meta';

// ============================================================
// GDD
// ============================================================

export type GDDFormat =
  | 'one_sheet' | 'ten_pager' | 'treatment' | 'sketch_design'
  | 'full_gdd' | 'concept_doc' | 'narrative_bible' | 'modular';

export type DocAudience = 'investor' | 'team_sync' | 'production' | 'personal' | 'educational';

export type DetailLevel = 'overview' | 'standard' | 'detailed' | 'exhaustive';

// ============================================================
// ЧЕК-ЛИСТЫ
// ============================================================

export type ChecklistType = 'mda' | 'balance' | 'narrative' | 'economy' | 'lenses' | 'playtest';

export type FocusArea = 'core_loop' | 'mechanics' | 'balance' | 'progression' | 'economy' | 'narrative' | 'overall';

// ============================================================
// СТАТУСЫ ПРОЕКТА
// ============================================================

export type ProjectStageName =
  | 'concept' | 'prototype' | 'preproduction' | 'production' | 'live_ops';

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';

export type UserPlan = 'free' | 'pro';

export type BudgetLevel = 'low' | 'medium' | 'high';

export type ScopeLevel = 'small' | 'medium' | 'large';

export type ExperienceLevel = 'casual' | 'midcore' | 'hardcore';

// ============================================================
// ЭКСПОРТ
// ============================================================

export type ExportFormat = 'pdf' | 'docx' | 'md' | 'html';

export type CitationStyle = 'footnote' | 'inline' | 'none';
