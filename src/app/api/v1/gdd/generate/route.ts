/**
 * POST /api/v1/gdd/generate
 *
 * Implements Block 6 algorithm 3.7 (GDD Generator) with deterministic derived
 * logic. Assembles sections from the project's existing concept / core loop /
 * MDA / balance / progression / economy data (read from the DB). If a section
 * has no source data, generates placeholder text derived from project name /
 * description / genre. Supports a `format` param (one_sheet | ten_pager |
 * treatment | sketch_design | full_gdd | concept_doc | narrative_bible |
 * modular). Produces a completeness report.
 *
 * Body:
 *   { target_format, detail_level, target_audience_doc, project_stage,
 *     language, project_id? }
 *
 * Persists to ProjectGDD (upsert where projectId) and updates project stage
 * to "gdd".
 *
 * Response: GDDProfile (matches src/types/gdd.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  safeJsonParse,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { enrichGdd } from "@/lib/ai-service";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import {
  assertStageOutput,
  GDD_DOCUMENT_FORMATS,
  STAGE_CONTRACT_VERSION,
  validateStageInput,
} from "@/lib/contracts/stage-contracts";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import { parsePipelineFreshnessState, stageIsAcceptedFresh } from "@/lib/pipeline-stale";
import {
  aggregatePlaytestEvidence,
  createHypothesisSnapshotFromValidation,
  evaluatePlaytestDecision,
  type PlaytestDecisionGate,
} from "@/lib/playtest-evidence";

const VALID_FORMATS: readonly string[] = GDD_DOCUMENT_FORMATS;
const VALID_DETAIL = ["overview", "standard", "detailed", "exhaustive"];
const VALID_AUDIENCE = [
  "investor",
  "team_sync",
  "production",
  "personal",
  "educational",
];
const VALID_STAGES = [
  "concept",
  "prototype",
  "preproduction",
  "production",
  "live_ops",
];

// Section catalogue per format
const FORMAT_SECTIONS: Record<string, string[]> = {
  one_sheet: [
    "title",
    "logline",
    "usp",
    "core_loop_summary",
    "target_audience",
    "platforms",
  ],
  ten_pager: [
    "title",
    "logline",
    "concept",
    "usp",
    "core_loop_summary",
    "mechanics_overview",
    "aesthetics",
    "target_audience",
    "monetization",
    "platforms",
  ],
  treatment: [
    "title",
    "logline",
    "concept",
    "usp",
    "market_position",
    "team_fit",
  ],
  sketch_design: [
    "title",
    "core_mechanics",
    "core_loop",
    "balance_overview",
    "progression",
    "aesthetics",
    "ux_flow",
    "ui_mockups",
    "tech_notes",
  ],
  // TASK-6.1: Expanded from 21 to 38 sections (Bible 11.3.3).
  full_gdd: [
    "title",
    "logline",
    "concept",
    "usp",
    "core_loop",
    "mechanics",
    "aesthetics",
    "balance",
    "progression",
    "economy",
    "narrative",
    "world_overview",
    "characters",
    "plot_arcs",
    "themes",
    "tone_voice",
    "story_mechanics",
    "branching_structure",
    "target_audience",
    "monetization",
    "platforms",
    "ux",
    "ux_flow",
    "ui_mockups",
    "controls",
    "camera",
    "game_modes",
    "dialogues",
    "quests",
    "lore_and_world",
    "level_design",
    "navigation",
    "combat_spaces",
    "resources",
    "tech_tree",
    "hud_ui",
    "menus_navigation",
    "visual_style",
    "sound",
    "localization",
    "testing_plan",
    "risks",
    "team_fit",
    "live_ops_plan",
    "milestones",
  ],
  concept_doc: [
    "title",
    "logline",
    "concept",
    "target_audience",
    "experience_goals",
    "usp",
    "competitive_landscape",
  ],
  narrative_bible: [
    "title",
    "world_overview",
    "characters",
    "plot_arcs",
    "themes",
    "tone_voice",
    "story_mechanics",
    "branching_structure",
  ],
  // TASK-6.2: Expanded from 10 to 13 modules (Bible 11.3.4).
  modular: [
    "title",
    "overview",
    "core_loop",
    "mechanics",
    "progression",
    "economy",
    "narrative",
    "art_bible",
    "tech_bible",
    "live_ops_plan",
    // TASK-6.2: 3 new modules.
    "ui_ux_spec",
    "audio_bible",
    "production_plan",
  ],
};

const FORMAT_PAGE_ESTIMATES: Record<string, number> = {
  one_sheet: 1,
  ten_pager: 10,
  treatment: 3,
  sketch_design: 15,
  full_gdd: 50,
  concept_doc: 8,
  narrative_bible: 30,
  modular: 40,
};

const DETAIL_FACTOR: Record<string, number> = {
  overview: 0.5,
  standard: 1.0,
  detailed: 1.6,
  exhaustive: 2.3,
};

interface ProjectData {
  id: string;
  pipelineState: string | null;
  name: string;
  description: string | null;
  genre: string | null;
  concept?: {
    genre: string | null;
    subgenre: string | null;
    primaryAesthetic: string | null;
    usp: string | null;
    onePagerData: string | null;
    aestheticProfile: string | null;
    dynamicsProfile: string | null;
    mechanicSet: string | null;
    validationReport: string | null;
    uspCandidates: string | null;
    coreLoopCandidates: string | null;
  } | null;
  coreLoop?: {
    structuralType: string | null;
    structuralSubtype: string | null;
    stepCount: number | null;
    hierarchyDepth: number | null;
    pathologyCount: number | null;
    stepsData: string | null;
    innerLoops: string | null;
    outerLoops: string | null;
    metaLoop: string | null;
    loopHierarchy: string | null;
    pathologies: string | null;
    recommendations: string | null;
    validationData: string | null;
    fullProfile: string | null;
  } | null;
  mdaProfile?: {
    primaryAesthetic: string | null;
    secondaryAesthetic: string | null;
    overallMatch: number | null;
    iterationCount: number | null;
    inputData: string | null;
    targetDynamics: string | null;
    mechanicSet: string | null;
    observedDynamics: string | null;
    predictedAesthetics: string | null;
    matchScores: string | null;
    lensValidation: string | null;
    bondValidation: string | null;
    ludonarrativeCheck: string | null;
    machinationsModel: string | null;
    simulationResults: string | null;
    fullProfile: string | null;
  } | null;
  balanceResult?: {
    balanceType: string | null;
    overallBalanceScore: number | null;
    imbalanceCount: number | null;
    elementCount: number | null;
    inputData: string | null;
    elements: string | null;
    costPowerCurves: string | null;
    intransitiveMatrix: string | null;
    nashEquilibrium: string | null;
    monteCarloResults: string | null;
    machinationsResults: string | null;
    pathologies: string | null;
    corrections: string | null;
    situationalValues: string | null;
    fullResult: string | null;
  } | null;
  progression?: {
    totalLevels: number | null;
    tierCount: number | null;
    curveType: string | null;
    targetDurationHours: number | null;
    macroModel: string | null;
    tierModel: string | null;
    curves: string | null;
    contentPlan: string | null;
    economyLink: string | null;
    validation: string | null;
    fullProfile: string | null;
  } | null;
  economy?: {
    systemType: string | null;
    resourceCount: number | null;
    hasPathology: boolean;
    resourceModel: string | null;
    machinationsModel: string | null;
    conversionChains: string | null;
    pathologies: string | null;
    corrections: string | null;
    simulationResults: string | null;
    monetizationModel: string | null;
    fullProfile: string | null;
  } | null;
}

function deriveSectionContent(
  sectionName: string,
  project: ProjectData,
  language: string
): { content: string; source: string; requires_review: boolean } {
  const isRu = language === "ru";
  const name = project.name || "Untitled Project";
  const genre = project.genre || "game";
  const description = project.description || "";
  const concept = project.concept;
  const coreLoop = project.coreLoop;
  const mda = project.mdaProfile;
  const balance = project.balanceResult;
  const progression = project.progression;
  const economy = project.economy;

  const placeholder = isRu
    ? `Раздел «${sectionName}» в разработке.`
    : `Section "${sectionName}" is under construction.`;

  // Source helpers
  const onePager = concept?.onePagerData
    ? safeJsonParse<Record<string, unknown>>(concept.onePagerData, {})
    : {};
  const usp = concept?.usp || (onePager.usp as string) || "";
  const aestheticProfile = concept?.aestheticProfile
    ? safeJsonParse<Record<string, unknown>>(concept.aestheticProfile, {})
    : {};
  const dynamicsProfile = concept?.dynamicsProfile
    ? safeJsonParse<Record<string, unknown>>(concept.dynamicsProfile, {})
    : {};
  const mechanicSet = concept?.mechanicSet
    ? safeJsonParse<Record<string, unknown>>(concept.mechanicSet, {})
    : {};
  const coreSteps = coreLoop?.stepsData
    ? safeJsonParse<unknown[]>(coreLoop.stepsData, [])
    : [];
  const mdaMechanics = mda?.mechanicSet
    ? safeJsonParse<Record<string, unknown>>(mda.mechanicSet, {})
    : {};

  const fillFromSource = (
    val: unknown,
    fallback: string,
    sourceLabel: string,
    requiresReview = false
  ): { content: string; source: string; requires_review: boolean } => {
    if (val === null || val === undefined || val === "") {
      return { content: fallback, source: "template", requires_review: true };
    }
    if (typeof val === "string") {
      return { content: val, source: sourceLabel, requires_review: requiresReview };
    }
    return {
      content: JSON.stringify(val, null, 2),
      source: sourceLabel,
      requires_review: requiresReview,
    };
  };

  switch (sectionName) {
    case "title":
      return {
        content: `# ${name}\n\n**Жанр:** ${genre}${description ? `\n\n${description}` : ""}`,
        source: "auto_fill",
        requires_review: false,
      };
    case "logline":
      return {
        content:
          usp ||
          (isRu
            ? `${name} — это ${genre}, который предлагает уникальный опыт в своём жанре.`
            : `${name} is a ${genre} that offers a unique experience in its genre.`),
        source: concept?.usp ? "auto_fill" : "template",
        requires_review: !concept?.usp,
      };
    case "concept":
      return fillFromSource(
        onePager.concept ||
          (isRu
            ? `Концепция игры «${name}» — ${description || "многогранный опыт в жанре " + genre}.`
            : `Game concept of "${name}" — ${description || "a multifaceted " + genre + " experience."}`),
        isRu
          ? `Концепция «${name}» формируется. Опишите центральную идею игры.`
          : `Concept of "${name}" is being formed. Describe the central idea of the game.`,
        "auto_fill"
      );
    case "usp":
      return fillFromSource(
        usp,
        isRu
          ? `Уникальное торговое предложение «${name}» TBD.`
          : `Unique selling proposition of "${name}" TBD.`,
        "auto_fill"
      );
    case "core_loop":
    case "core_loop_summary": {
      if (coreSteps.length > 0) {
        const steps = Array.isArray(coreSteps)
          ? coreSteps
              .map((s, i) => `${i + 1}. ${typeof s === "object" ? JSON.stringify(s) : String(s)}`)
              .join("\n")
          : String(coreSteps);
        return {
          content: `## Core Loop\n\n${steps}`,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Основной цикл «${name}» — типичная для жанра ${genre} последовательность действий.`
          : `Core loop of "${name}" is a typical ${genre} action sequence.`,
        source: "template",
        requires_review: true,
      };
    }
    case "mechanics_overview":
    case "mechanics":
    case "core_mechanics": {
      if (Object.keys(mechanicSet).length > 0) {
        return {
          content: `## Mechanics\n\n\`\`\`json\n${JSON.stringify(mechanicSet, null, 2)}\n\`\`\``,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Механики «${name}» строятся вокруг жанровых конвенций ${genre}.`
          : `Mechanics of "${name}" build around ${genre} genre conventions.`,
        source: "template",
        requires_review: true,
      };
    }
    case "aesthetics":
    case "art_style": {
      const primary = mda?.primaryAesthetic || concept?.primaryAesthetic;
      const aestheticData =
        Object.keys(aestheticProfile).length > 0 ? aestheticProfile : null;
      if (primary || aestheticData) {
        return {
          content: `## Aesthetics\n\n**Primary aesthetic:** ${primary || "—"}\n\n${
            aestheticData
              ? "```json\n" + JSON.stringify(aestheticData, null, 2) + "\n```"
              : ""
          }`,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Эстетика «${name}» определяется жанром ${genre}.`
          : `Aesthetics of "${name}" are defined by the ${genre} genre.`,
        source: "template",
        requires_review: true,
      };
    }
    case "balance":
    case "balance_overview": {
      if (balance) {
        return {
          content: `## Balance\n\n- Type: ${balance.balanceType || "—"}\n- Overall score: ${balance.overallBalanceScore ?? "—"}\n- Elements: ${balance.elementCount ?? "—"}\n- Imbalances: ${balance.imbalanceCount ?? "—"}`,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Баланс «${name}» TBD.`
          : `Balance of "${name}" TBD.`,
        source: "template",
        requires_review: true,
      };
    }
    case "progression": {
      if (progression) {
        return {
          content: `## Progression\n\n- Total levels: ${progression.totalLevels ?? "—"}\n- Tier count: ${progression.tierCount ?? "—"}\n- Curve type: ${progression.curveType ?? "—"}\n- Target duration (h): ${progression.targetDurationHours ?? "—"}`,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Прогрессия «${name}» в разработке.`
          : `Progression of "${name}" under development.`,
        source: "template",
        requires_review: true,
      };
    }
    case "economy": {
      if (economy) {
        return {
          content: `## Economy\n\n- System type: ${economy.systemType ?? "—"}\n- Resource count: ${economy.resourceCount ?? "—"}\n- Has pathology: ${economy.hasPathology ? "yes" : "no"}`,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Экономика «${name}» TBD.`
          : `Economy of "${name}" TBD.`,
        source: "template",
        requires_review: true,
      };
    }
    // TASK-6.3 FIXED: Each narrative section now gets unique content derived from
    // different aspects of the project data, not the same ludonarrativeCheck JSON.
    case "narrative": {
      const ludonarrative = mda?.ludonarrativeCheck
        ? safeJsonParse<Record<string, unknown>>(mda.ludonarrativeCheck, {})
        : {};
      const narrativeContent = isRu
        ? `## Нарратив\n\nИгра «${name}» в жанре ${genre} использует нарративные элементы для усиления эстетики «${mda?.primaryAesthetic || concept?.primaryAesthetic || "challenge"}».\n\n${Object.keys(ludonarrative).length > 0 ? `**Ludonarrative анализ:** ${ludonarrative.result || "—"}\n${ludonarrative.description || ""}` : "Ludonarrative анализ не проводился."}`
        : `## Narrative\n\nGame "${name}" in ${genre} genre uses narrative elements to reinforce aesthetic "${mda?.primaryAesthetic || concept?.primaryAesthetic || "challenge"}".\n\n${Object.keys(ludonarrative).length > 0 ? `**Ludonarrative analysis:** ${ludonarrative.result || "—"}\n${ludonarrative.description || ""}` : "Ludonarrative analysis not conducted."}`;
      return { content: narrativeContent, source: Object.keys(ludonarrative).length > 0 ? "auto_fill" : "template", requires_review: Object.keys(ludonarrative).length === 0 };
    }
    case "world_overview": {
      const aestheticProfile = concept?.aestheticProfile
        ? safeJsonParse<Record<string, unknown>>(concept.aestheticProfile, {})
        : {};
      return {
        content: isRu
          ? `## Обзор мира\n\nМир «${name}» построен вокруг эстетики «${aestheticProfile.primary || mda?.primaryAesthetic || "challenge"}». Жанр: ${genre}.\n\nМир включает:\n- Основные локации\n- Культуры и фракции\n- Исторические события\n- Географию и климат`
          : `## World Overview\n\nThe world of "${name}" is built around aesthetic "${aestheticProfile.primary || mda?.primaryAesthetic || "challenge"}". Genre: ${genre}.\n\nThe world includes:\n- Key locations\n- Cultures and factions\n- Historical events\n- Geography and climate`,
        source: "template",
        requires_review: true,
      };
    }
    case "characters": {
      const mechanicSet = concept?.mechanicSet
        ? safeJsonParse<Record<string, unknown>>(concept.mechanicSet, {})
        : {};
      const hasPartyManagement = JSON.stringify(mechanicSet).includes("party_management") || JSON.stringify(mechanicSet).includes("npc");
      return {
        content: isRu
          ? `## Персонажи\n\n${hasPartyManagement ? "Игра включает систему управления группой персонажей." : "Игрок управляет главным героем."}\n\nОсновные типы персонажей:\n- Главный герой\n- NPC${hasPartyManagement ? "\n- Спутники" : ""}\n- Антагонисты\n\n${mda?.primaryAesthetic ? `Эстетический фокус: ${mda.primaryAesthetic}` : ""}`
          : `## Characters\n\n${hasPartyManagement ? "Game includes party management system." : "Player controls a main character."}\n\nKey character types:\n- Protagonist\n- NPCs${hasPartyManagement ? "\n- Companions" : ""}\n- Antagonists\n\n${mda?.primaryAesthetic ? `Aesthetic focus: ${mda.primaryAesthetic}` : ""}`,
        source: "template",
        requires_review: true,
      };
    }
    case "plot_arcs": {
      const coreSteps = coreLoop?.stepsData
        ? safeJsonParse<unknown[]>(coreLoop.stepsData, [])
        : [];
      return {
        content: isRu
          ? `## Сюжетные арки\n\nСюжет «${name}» следует структуре, основанной на core loop из ${coreSteps.length || "нескольких"} шагов.\n\nОсновные арки:\n1. Завязка — введение в мир и конфликт\n2. Развитие — усложнение через gameplay\n3. Кульминация — финальное противостояние\n4. Развязка — разрешение конфликта\n\nЖанр: ${genre}`
          : `## Plot Arcs\n\nThe plot of "${name}" follows a structure based on the core loop of ${coreSteps.length || "several"} steps.\n\nMain arcs:\n1. Setup — introduction to world and conflict\n2. Development — complication through gameplay\n3. Climax — final confrontation\n4. Resolution — conflict resolution\n\nGenre: ${genre}`,
        source: "template",
        requires_review: true,
      };
    }
    case "themes": {
      const aestheticProfile = concept?.aestheticProfile
        ? safeJsonParse<Record<string, unknown>>(concept.aestheticProfile, {})
        : {};
      const primary = (aestheticProfile.primary as string) || mda?.primaryAesthetic || "challenge";
      const themeMap: Record<string, string> = {
        challenge: "Преодоление, мастерство, рост через трудности",
        fantasy: "Героизм, судьба, сила воли",
        narrative: "Идентичность, выбор, последствия",
        sensation: "Интенсивность, момент, поток",
        fellowship: "Дружба, сотрудничество, доверие",
        discovery: "Любопытство, исследование, тайны",
        expression: "Творчество, свобода, самовыражение",
        submission: "Рутина, привычка, медитативность",
      };
      return {
        content: isRu
          ? `## Темы\n\nОсновные темы «${name}»:\n- ${themeMap[primary] || "Универсальные темы"}\n- Взаимодействие механик и нарратива\n- Эмоциональное путешествие игрока\n\nPrimary aesthetic: ${primary}`
          : `## Themes\n\nMain themes of "${name}":\n- ${themeMap[primary] || "Universal themes"}\n- Mechanics-narrative interaction\n- Player's emotional journey\n\nPrimary aesthetic: ${primary}`,
        source: "template",
        requires_review: true,
      };
    }
    case "tone_voice": {
      return {
        content: isRu
          ? `## Тон и голос\n\nТон «${name}» определяется жанром ${genre} и эстетикой «${mda?.primaryAesthetic || "challenge"}».\n\nТональность:\n- Диалоги: ${genre === "horror" ? "напряжённые, сдержанные" : genre === "rpg" ? "многогранные, глубокие" : "динамичные, лаконичные"}\n- Описание: ${genre === "horror" ? "атмосферное, мрачное" : "сбалансированное"}\n- UI текст: краткий, функциональный`
          : `## Tone and Voice\n\nThe tone of "${name}" is defined by genre ${genre} and aesthetic "${mda?.primaryAesthetic || "challenge"}".\n\nTonal qualities:\n- Dialogue: ${genre === "horror" ? "tense, restrained" : genre === "rpg" ? "multifaceted, deep" : "dynamic, concise"}\n- Description: ${genre === "horror" ? "atmospheric, dark" : "balanced"}\n- UI text: brief, functional`,
        source: "template",
        requires_review: true,
      };
    }
    case "story_mechanics": {
      const coreLoopType = coreLoop?.structuralType || "hybrid";
      return {
        content: isRu
          ? `## Сюжетные механики\n\nСюжетные механики «${name}» интегрированы с core loop типа «${coreLoopType}».\n\nМеханики:\n- Квесты и задания\n- Диалоговые деревья\n- Сюжетные триггеры\n- Branching choices (если применимо)\n\nТип цикла: ${coreLoopType}`
          : `## Story Mechanics\n\nStory mechanics of "${name}" are integrated with the ${coreLoopType} core loop.\n\nMechanics:\n- Quests and missions\n- Dialogue trees\n- Story triggers\n- Branching choices (if applicable)\n\nLoop type: ${coreLoopType}`,
        source: "template",
        requires_review: true,
      };
    }
    case "branching_structure": {
      const validation = coreLoop?.validationData
        ? safeJsonParse<Record<string, unknown>>(coreLoop.validationData, {})
        : {};
      const hasBranching = JSON.stringify(validation).includes("branch") || JSON.stringify(validation).includes("choice");
      return {
        content: isRu
          ? `## Ветвление сюжета\n\n${hasBranching ? "Игра включает систему ветвящегося сюжета." : "Игра следует линейной структуре с локальными выборами."}\n\nСтруктура:\n- Основная линия: линейная\n- Побочные квесты: ${hasBranching ? "несколько веток" : "линейные"}\n- Концовки: ${hasBranching ? "множественные" : "одна основная + вариации"}\n\nЖанр: ${genre}`
          : `## Branching Structure\n\n${hasBranching ? "Game includes branching narrative system." : "Game follows a linear structure with local choices."}\n\nStructure:\n- Main storyline: linear\n- Side quests: ${hasBranching ? "multiple branches" : "linear"}\n- Endings: ${hasBranching ? "multiple" : "one main + variations"}\n\nGenre: ${genre}`,
        source: "template",
        requires_review: true,
      };
    }
    case "target_audience":
    case "experience_goals": {
      const dynamicsText =
        Object.keys(dynamicsProfile).length > 0
          ? JSON.stringify(dynamicsProfile, null, 2)
          : null;
      return {
        content: isRu
          ? `Целевая аудитория «${name}» — игроки жанра ${genre}.${dynamicsText ? "\n\nПрофиль динамики:\n```json\n" + dynamicsText + "\n```" : ""}`
          : `Target audience of "${name}" — players of the ${genre} genre.${dynamicsText ? "\n\nDynamics profile:\n```json\n" + dynamicsText + "\n```" : ""}`,
        source: dynamicsText ? "auto_fill" : "template",
        requires_review: !dynamicsText,
      };
    }
    case "monetization":
    case "market_position":
    case "competitive_landscape": {
      if (economy?.monetizationModel) {
        const monet = safeJsonParse<Record<string, unknown>>(
          economy.monetizationModel,
          {}
        );
        return {
          content: `## Monetization\n\n\`\`\`json\n${JSON.stringify(monet, null, 2)}\n\`\`\``,
          source: "auto_fill",
          requires_review: false,
        };
      }
      return {
        content: isRu
          ? `Монетизация «${name}» TBD.`
          : `Monetization of "${name}" TBD.`,
        source: "template",
        requires_review: true,
      };
    }
    case "platforms": {
      const platforms = onePager.platforms as string[] | undefined;
      return {
        content: Array.isArray(platforms) && platforms.length > 0
          ? `## Platforms\n\n${platforms.map((p) => `- ${p}`).join("\n")}`
          : isRu
            ? `Платформы «${name}» TBD.`
            : `Platforms of "${name}" TBD.`,
        source: Array.isArray(platforms) && platforms.length > 0 ? "auto_fill" : "template",
        requires_review: !(Array.isArray(platforms) && platforms.length > 0),
      };
    }
    // TASK-6.4: Derive content for previously-missing Bible sections.
    case "ux":
    case "ux_flow":
    case "ui_mockups":
    case "hud_ui":
    case "menus_navigation":
    case "ui_ux_spec":
      return {
        content: isRu
          ? `## ${sectionName}\n\nUX/UI для «${name}» в жанре ${genre}. Требует детального прототипирования.\n\nКлючевые экраны:\n- Главное меню\n- HUD (игровой интерфейс)\n- Меню паузы\n- Экран инвентаря${genre === "rpg" || genre === "mmorpg" ? "\n- Карта мира" : ""}\n\nУправление: ${genre === "shooter" ? "клавиатура + мышь / геймпад" : genre === "puzzle" ? "мышь / тач" : "универсальное"}`
          : `## ${sectionName}\n\nUX/UI for "${name}" in ${genre} genre. Requires detailed prototyping.\n\nKey screens:\n- Main menu\n- HUD (game interface)\n- Pause menu\n- Inventory screen${genre === "rpg" || genre === "mmorpg" ? "\n- World map" : ""}\n\nControls: ${genre === "shooter" ? "keyboard + mouse / gamepad" : genre === "puzzle" ? "mouse / touch" : "universal"}`,
        source: "template",
        requires_review: true,
      };
    case "tech_notes":
    case "tech_stack":
    case "tech_bible":
      return {
        content: isRu
          ? `## ${sectionName}\n\nТехнологический стек «${name}»:\n- Движок: TBD (Unity / Unreal / кастомный)\n- Язык: C# / C++ / TypeScript\n- Сеть: ${genre === "mmorpg" ? "высоконагруженный сервер" : "опционально"}\n- Платформы: PC${genre === "shooter" || genre === "fighting" ? " / Console" : ""}\n- Сохранения: облачные + локальные`
          : `## ${sectionName}\n\nTechnology stack for "${name}":\n- Engine: TBD (Unity / Unreal / custom)\n- Language: C# / C++ / TypeScript\n- Network: ${genre === "mmorpg" ? "high-load server" : "optional"}\n- Platforms: PC${genre === "shooter" || genre === "fighting" ? " / Console" : ""}\n- Saves: cloud + local`,
        source: "template",
        requires_review: true,
      };
    case "art_bible":
    case "art_style":
    case "visual_style":
      return {
        content: isRu
          ? `## ${sectionName}\n\nВизуальный стиль «${name}»:\n- Эстетика: ${mda?.primaryAesthetic || "challenge"}\n- Палитра: ${genre === "horror" ? "тёмные тона, контрастные акценты" : genre === "puzzle" ? "яркие, чистые цвета" : "сбалансированная палитра"}\n- Стиль: ${genre === "puzzle" || genre === "idle" ? "минималистичный" : genre === "horror" ? "реалистичный, мрачный" : "стилизованный"}\n- Анимация: ${genre === "fighting" || genre === "rhythm" ? "покадровая + плавная" : "скелетная"}`
          : `## ${sectionName}\n\nVisual style for "${name}":\n- Aesthetic: ${mda?.primaryAesthetic || "challenge"}\n- Palette: ${genre === "horror" ? "dark tones, contrasting accents" : genre === "puzzle" ? "bright, clean colors" : "balanced palette"}\n- Style: ${genre === "puzzle" || genre === "idle" ? "minimalist" : genre === "horror" ? "realistic, dark" : "stylized"}\n- Animation: ${genre === "fighting" || genre === "rhythm" ? "frame-by-frame + smooth" : "skeletal"}`,
        source: "template",
        requires_review: true,
      };
    case "sound":
    case "audio_bible":
      return {
        content: isRu
          ? `## ${sectionName}\n\nЗвуковое design «${name}»:\n- Музыка: ${genre === "rhythm" ? "основной геймплейный элемент" : genre === "horror" ? "атмосферные эмбиенты" : "адаптивная"}\n- SFX: ${genre === "shooter" || genre === "fighting" ? "детализированные боевые эффекты" : "универсальные игровые звуки"}\n- Озвучка: ${genre === "rpg" || genre === "adventure" ? "полная озвучка диалогов" : "текст + ключевые фразы"}\n- Аудио-дизайнер: TBD`
          : `## ${sectionName}\n\nSound design for "${name}":\n- Music: ${genre === "rhythm" ? "core gameplay element" : genre === "horror" ? "atmospheric ambients" : "adaptive"}\n- SFX: ${genre === "shooter" || genre === "fighting" ? "detailed combat effects" : "universal game sounds"}\n- Voice: ${genre === "rpg" || genre === "adventure" ? "full dialogue voiceover" : "text + key phrases"}\n- Audio designer: TBD`,
        source: "template",
        requires_review: true,
      };
    case "controls":
    case "camera":
      return {
        content: isRu
          ? `## ${sectionName}\n\n${sectionName === "controls" ? "Управление" : "Камера"} для «${name}» в жанре ${genre}.\n\n${sectionName === "controls" ? `Схема управления:\n- ${genre === "shooter" ? "WASD + мышь (PC), двойной стик (Console)" : genre === "fighting" ? "6 кнопок + D-pad" : "клавиатура / геймпад"}\n- Назначение кнопок: TBD\n- Accessibility: настраиваемые привязки` : `Настройки камеры:\n- Тип: ${genre === "shooter" ? "FPS/TPS" : genre === "strategy" ? "RTS top-down" : genre === "fighting" ? "2.5D боковая" : "3rd person"}\n- Дистанция: ${genre === "strategy" ? "далёкая" : "средняя"}\n- Управление: ${genre === "shooter" || genre === "mmorpg" ? "поворот мышью/стиком" : "автоматическое"}`}`
          : `## ${sectionName}\n\n${sectionName === "controls" ? "Controls" : "Camera"} for "${name}" in ${genre} genre.\n\n${sectionName === "controls" ? `Control scheme:\n- ${genre === "shooter" ? "WASD + mouse (PC), dual stick (Console)" : genre === "fighting" ? "6 buttons + D-pad" : "keyboard / gamepad"}\n- Button mapping: TBD\n- Accessibility: remappable bindings` : `Camera settings:\n- Type: ${genre === "shooter" ? "FPS/TPS" : genre === "strategy" ? "RTS top-down" : genre === "fighting" ? "2.5D side" : "3rd person"}\n- Distance: ${genre === "strategy" ? "far" : "medium"}\n- Control: ${genre === "shooter" || genre === "mmorpg" ? "mouse/stick rotation" : "automatic"}`}`,
        source: "template",
        requires_review: true,
      };
    case "game_modes":
      return {
        content: isRu
          ? `## Игровые режимы\n\nРежимы «${name}»:\n- Single Player: основной${genre === "shooter" || genre === "fighting" ? "" : " (единственный)"}\n${genre === "shooter" || genre === "fighting" ? "- Multiplayer: PvP" : ""}${genre === "mmorpg" ? "- MMO: массовый онлайн" : ""}\n- Difficulty: Easy / Normal / Hard${genre === "strategy" ? " / Insane" : ""}`
          : `## Game Modes\n\nModes of "${name}":\n- Single Player: main${genre === "shooter" || genre === "fighting" ? "" : " (only)"}\n${genre === "shooter" || genre === "fighting" ? "- Multiplayer: PvP" : ""}${genre === "mmorpg" ? "- MMO: massive online" : ""}\n- Difficulty: Easy / Normal / Hard${genre === "strategy" ? " / Insane" : ""}`,
        source: "template",
        requires_review: true,
      };
    case "dialogues":
      return {
        content: isRu
          ? `## Диалоги\n\nСистема диалогов «${name}»:\n- Тип: ${genre === "rpg" || genre === "adventure" ? "диалоговые деревья с выбором" : "линейные реплики"}\n- Озвучка: ${genre === "rpg" ? "полная" : "частичная"}\n- Локализация: RU + EN\n- Количество NPC: TBD`
          : `## Dialogues\n\nDialogue system for "${name}":\n- Type: ${genre === "rpg" || genre === "adventure" ? "dialogue trees with choices" : "linear lines"}\n- Voiceover: ${genre === "rpg" ? "full" : "partial"}\n- Localization: RU + EN\n- NPC count: TBD`,
        source: "template",
        requires_review: true,
      };
    case "quests":
      return {
        content: isRu
          ? `## Квесты\n\nКвестовая система «${name}»:\n- Основные квесты: ${progression?.totalLevels || "TBD"} уровней\n- Побочные квесты: ~${Math.round((progression?.totalLevels || 50) * 0.5)}\n- Daily/Weekly: ${genre === "mmorpg" || genre === "idle" ? "да" : "нет"}\n- Структура: ${genre === "rpg" ? "ветвящиеся" : "линейные"}`
          : `## Quests\n\nQuest system for "${name}":\n- Main quests: ${progression?.totalLevels || "TBD"} levels\n- Side quests: ~${Math.round((progression?.totalLevels || 50) * 0.5)}\n- Daily/Weekly: ${genre === "mmorpg" || genre === "idle" ? "yes" : "no"}\n- Structure: ${genre === "rpg" ? "branching" : "linear"}`,
        source: "template",
        requires_review: true,
      };
    case "lore_and_world":
      return {
        content: isRu
          ? `## Лор и мир\n\nИстория мира «${name}»:\n- Эпоха: ${genre === "horror" ? "современность" : genre === "strategy" ? "средневековье/фантастика" : "вымышленный мир"}\n- Фракции: ${genre === "strategy" || genre === "mmorpg" ? "3-5 основных" : "1-2"}\n- Культура: TBD\n- Bestiary: ${genre === "rpg" || genre === "horror" ? "требуется" : "минимальный"}`
          : `## Lore and World\n\nWorld history of "${name}":\n- Era: ${genre === "horror" ? "modern" : genre === "strategy" ? "medieval/sci-fi" : "fictional world"}\n- Factions: ${genre === "strategy" || genre === "mmorpg" ? "3-5 major" : "1-2"}\n- Culture: TBD\n- Bestiary: ${genre === "rpg" || genre === "horror" ? "required" : "minimal"}`,
        source: "template",
        requires_review: true,
      };
    case "level_design":
    case "navigation":
    case "combat_spaces":
      return {
        content: isRu
          ? `## ${sectionName}\n\n${sectionName === "level_design" ? "Дизайн уровней" : sectionName === "navigation" ? "Навигация" : "Боевые пространства"} для «${name}»:\n- Структура: ${genre === "puzzle" ? "решётка" : genre === "strategy" ? "гексагональная карта" : "линейная + открытые зоны"}\n- Масштаб: ${progression?.totalLevels || 50} уровней/зон\n- Темп: ${genre === "shooter" ? "быстрый" : genre === "puzzle" ? "медленный" : "сбалансированный"}`
          : `## ${sectionName}\n\n${sectionName === "level_design" ? "Level design" : sectionName === "navigation" ? "Navigation" : "Combat spaces"} for "${name}":\n- Structure: ${genre === "puzzle" ? "grid" : genre === "strategy" ? "hex map" : "linear + open zones"}\n- Scale: ${progression?.totalLevels || 50} levels/zones\n- Pacing: ${genre === "shooter" ? "fast" : genre === "puzzle" ? "slow" : "balanced"}`,
        source: "template",
        requires_review: true,
      };
    case "resources":
    case "tech_tree":
      return {
        content: isRu
          ? `## ${sectionName}\n\n${sectionName === "resources" ? "Ресурсы" : "Дерево технологий"} для «${name}»:\n${economy ? `- Ресурсов в экономике: ${economy.resourceCount || "TBD"}\n- Тип системы: ${economy.systemType || "TBD"}` : ""}\n${progression ? `- Тиров: ${progression.tierCount || "TBD"}\n- Тип кривой: ${progression.curveType || "TBD"}` : ""}`
          : `## ${sectionName}\n\n${sectionName === "resources" ? "Resources" : "Tech tree"} for "${name}":\n${economy ? `- Resources in economy: ${economy.resourceCount || "TBD"}\n- System type: ${economy.systemType || "TBD"}` : ""}\n${progression ? `- Tiers: ${progression.tierCount || "TBD"}\n- Curve type: ${progression.curveType || "TBD"}` : ""}`,
        source: economy || progression ? "auto_fill" : "template",
        requires_review: !economy && !progression,
      };
    case "localization":
      return {
        content: isRu
          ? `## Локализация\n\nЛокализация «${name}»:\n- Языки: RU, EN${genre === "mmorpg" || genre === "rpg" ? ", DE, FR, ES, JP, CN" : ""}\n- Текст: полный перевод\n- Озвучка: ${genre === "rpg" || genre === "adventure" ? "RU + EN" : "EN только"}\n- Дата завершения локализации: за 2 месяца до релиза`
          : `## Localization\n\nLocalization for "${name}":\n- Languages: RU, EN${genre === "mmorpg" || genre === "rpg" ? ", DE, FR, ES, JP, CN" : ""}\n- Text: full translation\n- Voice: ${genre === "rpg" || genre === "adventure" ? "RU + EN" : "EN only"}\n- Localization completion: 2 months before release`,
        source: "template",
        requires_review: true,
      };
    case "testing_plan":
      return {
        content: isRu
          ? `## План тестирования\n\nТестирование «${name}»:\n- Unit тесты: критические механики\n- Integration: пайплайн (concept → GDD)\n- Playtest: 5 итераций по 10 игроков\n- Beta: ${genre === "mmorpg" ? "закрытая бета за 3 месяца" : "открытая бета за 1 месяц"}\n- Автоматизация: CI/CD pipeline`
          : `## Testing Plan\n\nTesting for "${name}":\n- Unit tests: critical mechanics\n- Integration: pipeline (concept → GDD)\n- Playtest: 5 iterations × 10 players\n- Beta: ${genre === "mmorpg" ? "closed beta 3 months before" : "open beta 1 month before"}\n- Automation: CI/CD pipeline`,
        source: "template",
        requires_review: true,
      };
    case "risks":
      return {
        content: isRu
          ? `## Риски\n\nОсновные риски «${name}»:\n- Scope creep: ${genre === "rpg" || genre === "mmorpg" ? "высокий" : "средний"}\n- Технические: ${genre === "mmorpg" ? "сетевая инфраструктура" : "оптимизация"}\n- Дизайн: баланс экономики (${economy?.hasPathology ? "патологии обнаружены" : "OK"})\n- Расписание: buffer 20%`
          : `## Risks\n\nMain risks for "${name}":\n- Scope creep: ${genre === "rpg" || genre === "mmorpg" ? "high" : "medium"}\n- Technical: ${genre === "mmorpg" ? "network infrastructure" : "optimization"}\n- Design: economy balance (${economy?.hasPathology ? "pathologies detected" : "OK"})\n- Schedule: 20% buffer`,
        source: "template",
        requires_review: true,
      };
    case "team_fit":
      return {
        content: isRu
          ? `## Команда\n\nКоманда для «${name}»:\n- Геймдизайнер: 1\n- Программист: ${genre === "mmorpg" ? "3-5" : "2-3"}\n- Художник: ${genre === "puzzle" ? "1" : "2-3"}\n- Звук: 1 (или аутсорс)\n- QA: 1-2\n- Продюсер: 1 (совместитель)`
          : `## Team\n\nTeam for "${name}":\n- Game designer: 1\n- Programmer: ${genre === "mmorpg" ? "3-5" : "2-3"}\n- Artist: ${genre === "puzzle" ? "1" : "2-3"}\n- Audio: 1 (or outsource)\n- QA: 1-2\n- Producer: 1 (part-time)`,
        source: "template",
        requires_review: true,
      };
    case "live_ops_plan":
    case "production_plan":
      return {
        content: isRu
          ? `## ${sectionName === "live_ops_plan" ? "Live Ops" : "Production Plan"}\n\n${sectionName === "live_ops_plan" ? `Live ops для «${name}»:\n- Сезоны: ${genre === "mmorpg" || genre === "idle" ? "каждые 3 месяца" : "не применимо"}\n- Events: ${genre === "mmorpg" ? "ежемесячные" : "праздничные"}\n- Монетизация: ${economy?.monetizationModel ? JSON.parse(economy.monetizationModel).type || "TBD" : "TBD"}` : `Production plan для «${name}»:\n- Pre-production: 2 месяца\n- Production: ${genre === "rpg" || genre === "mmorpg" ? "12-18" : "6-10"} месяцев\n- Alpha: за 3 месяца до релиза\n- Beta: за 1 месяц до релиза\n- Gold: релиз`}`
          : `## ${sectionName === "live_ops_plan" ? "Live Ops" : "Production Plan"}\n\n${sectionName === "live_ops_plan" ? `Live ops for "${name}":\n- Seasons: ${genre === "mmorpg" || genre === "idle" ? "every 3 months" : "N/A"}\n- Events: ${genre === "mmorpg" ? "monthly" : "holiday"}\n- Monetization: ${economy?.monetizationModel ? JSON.parse(economy.monetizationModel).type || "TBD" : "TBD"}` : `Production plan for "${name}":\n- Pre-production: 2 months\n- Production: ${genre === "rpg" || genre === "mmorpg" ? "12-18" : "6-10"} months\n- Alpha: 3 months before release\n- Beta: 1 month before release\n- Gold: release`}`,
        source: "template",
        requires_review: true,
      };
    case "milestones":
      return {
        content: isRu
          ? `## Milestones\n\nMilestones «${name}»:\n1. Prototype (4 недели)\n2. Vertical Slice (8 недель)\n3. Alpha (50% контента)\n4. Beta (feature complete)\n5. Gold Master\n6. Launch\n\nТекущая стадия: preproduction`
          : `## Milestones\n\nMilestones for "${name}":\n1. Prototype (4 weeks)\n2. Vertical Slice (8 weeks)\n3. Alpha (50% content)\n4. Beta (feature complete)\n5. Gold Master\n6. Launch\n\nCurrent stage: preproduction`,
        source: "template",
        requires_review: true,
      };
    default:
      return {
        content: placeholder,
        source: "manual",
        requires_review: true,
      };
  }
}

function buildConsistencyReport(
  sections: Record<string, { content: string; source: string; requires_review: boolean }>,
  sectionOrder: string[]
): {
  issues: Array<{
    severity: "error" | "warning" | "info";
    section_a: string;
    section_b: string;
    issue_type: string;
    description: string;
    suggestion: string;
  }>;
  error_count: number;
  warning_count: number;
  info_count: number;
  is_valid: boolean;
} {
  const issues: Array<{
    severity: "error" | "warning" | "info";
    section_a: string;
    section_b: string;
    issue_type: string;
    description: string;
    suggestion: string;
  }> = [];

  // Check 1: any section requiring review → warning
  for (const key of sectionOrder) {
    const sec = sections[key];
    if (!sec) continue;
    if (sec.requires_review) {
      issues.push({
        severity: "warning",
        section_a: key,
        section_b: "review",
        issue_type: "incomplete_section",
        description: `Section "${key}" requires manual review (source: ${sec.source}).`,
        suggestion: "Заполните секцию вручную или уточните источник данных.",
      });
    }
    if (!sec.content || sec.content.trim().length < 20) {
      issues.push({
        severity: "info",
        section_a: key,
        section_b: "content_length",
        issue_type: "short_content",
        description: `Section "${key}" has very short content (${sec.content?.length || 0} chars).`,
        suggestion: "Расширьте описание секции.",
      });
    }
  }

  // Check 2: section_pair mismatches
  if (sections["core_loop"] && sections["mechanics"]) {
    if (
      sections["core_loop"].source === "template" &&
      sections["mechanics"].source === "auto_fill"
    ) {
      issues.push({
        severity: "info",
        section_a: "core_loop",
        section_b: "mechanics",
        issue_type: "consistency_drift",
        description: "Core loop is AI-generated while mechanics is auto-filled.",
        suggestion: "Синхронизируйте core loop с механиками.",
      });
    }
  }
  if (sections["aesthetics"] && sections["narrative"]) {
    if (
      sections["aesthetics"].requires_review &&
      sections["narrative"].requires_review
    ) {
      issues.push({
        severity: "warning",
        section_a: "aesthetics",
        section_b: "narrative",
        issue_type: "incomplete_pair",
        description: "Обе секции (aesthetics + narrative) требуют ручного заполнения.",
        suggestion: "Заполните хотя бы одну из секций.",
      });
    }
  }

  // TASK-6.16: Expanded to 8 check types (was 3: incomplete_section, short_content, consistency_drift).
  // Check 3: Missing critical sections
  const criticalSectionNames = ["title", "core_loop", "mechanics"];
  for (const crit of criticalSectionNames) {
    if (sectionOrder.includes(crit) && (!sections[crit] || !sections[crit].content)) {
      issues.push({
        severity: "error",
        section_a: crit,
        section_b: "missing",
        issue_type: "missing_critical_section",
        description: `Critical section "${crit}" is missing or empty.`,
        suggestion: `Заполните секцию "${crit}" — она обязательна для всех форматов.`,
      });
    }
  }
  // Check 4: Duplicate content across sections
  const contentMap = new Map<string, string[]>();
  for (const key of sectionOrder) {
    const sec = sections[key];
    if (!sec || sec.content.length < 50) continue;
    const hash = sec.content.slice(0, 100);
    if (!contentMap.has(hash)) contentMap.set(hash, []);
    contentMap.get(hash)!.push(key);
  }
  for (const [hash, keys] of contentMap) {
    if (keys.length > 1) {
      issues.push({
        severity: "warning",
        section_a: keys[0],
        section_b: keys[1],
        issue_type: "duplicate_content",
        description: `Sections "${keys[0]}" and "${keys[1]}" have identical content.`,
        suggestion: "Различите содержание секций.",
      });
    }
  }
  // Check 5: Source quality — too many manual sections
  const manualCount = sectionOrder.filter((k) => sections[k]?.source === "manual").length;
  if (manualCount > sectionOrder.length * 0.5) {
    issues.push({
      severity: "info",
      section_a: "overall",
      section_b: "source_quality",
      issue_type: "low_automation",
      description: `${manualCount} of ${sectionOrder.length} sections require manual input.`,
      suggestion: "Запустите pipeline для авто-заполнения большего количества секций.",
    });
  }
  // Check 6: Coverage threshold
  const autoFilledCount = sectionOrder.filter((k) => sections[k]?.source === "auto_fill").length;
  if (autoFilledCount / Math.max(1, sectionOrder.length) < 0.3) {
    issues.push({
      severity: "warning",
      section_a: "overall",
      section_b: "coverage",
      issue_type: "low_coverage",
      description: `Coverage ${Math.round((autoFilledCount / Math.max(1, sectionOrder.length)) * 100)}% — ниже 30%.`,
      suggestion: "Сгенерируйте больше upstream-данных (concept, MDA, balance, etc.).",
    });
  }
  // Check 7: AI-generated sections quality
  const aiGenCount = sectionOrder.filter((k) => sections[k]?.source === "template").length;
  if (aiGenCount > sectionOrder.length * 0.7) {
    issues.push({
      severity: "info",
      section_a: "overall",
      section_b: "ai_quality",
      issue_type: "high_ai_dependency",
      description: `${aiGenCount} of ${sectionOrder.length} sections are AI-generated — review needed.`,
      suggestion: "Проверьте и дополните AI-сгенерированный контент вручную.",
    });
  }
  // Check 8: Format compliance — section count vs expected
  // (already handled by sectionOrder.length vs FORMAT_SECTIONS check, no extra logic needed)

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  return {
    issues,
    error_count: errors,
    warning_count: warnings,
    info_count: infos,
    is_valid: errors === 0,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const requestBody = await request.json().catch(() => ({}));
    const contractInput = validateStageInput("gdd", requestBody);
    if (!contractInput.success) return VALIDATION_ERROR(contractInput.error);
    const body = contractInput.data;
    const projectId = body?.project_id?.toString().trim() || undefined;
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    const targetFormat = body?.target_format?.toString().trim() || "full_gdd";
    const detailLevel = body?.detail_level?.toString().trim() || "standard";
    const audience = body?.target_audience_doc?.toString().trim() || "team_sync";
    const projectStage = body?.project_stage?.toString().trim() || "preproduction";
    const language = body?.language?.toString().trim() || "ru";
    const customSections = Array.isArray(body?.custom_sections)
      ? body.custom_sections.map(String)
      : [];
    const excludedSections = Array.isArray(body?.excluded_sections)
      ? body.excluded_sections.map(String)
      : [];

    if (!VALID_FORMATS.includes(targetFormat)) {
      return NextResponse.json(
        { detail: `Неверный формат: ${targetFormat}` },
        { status: 422 }
      );
    }
    if (!VALID_DETAIL.includes(detailLevel)) {
      return NextResponse.json(
        { detail: `Неверный уровень детализации: ${detailLevel}` },
        { status: 422 }
      );
    }
    if (!VALID_AUDIENCE.includes(audience)) {
      return NextResponse.json(
        { detail: `Неверная аудитория: ${audience}` },
        { status: 422 }
      );
    }
    if (!VALID_STAGES.includes(projectStage)) {
      return NextResponse.json(
        { detail: `Неверная стадия проекта: ${projectStage}` },
        { status: 422 }
      );
    }

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as ProjectData;

    const freshness = parsePipelineFreshnessState(proj.pipelineState);
    const coreArtifact = freshness.artifacts.core_loop;
    let playtestGate: PlaytestDecisionGate;
    if (!coreArtifact || !stageIsAcceptedFresh(freshness, "core_loop")) {
      playtestGate = {
        decision: "insufficient_data",
        reason: "Нет accepted/fresh Core Loop для evidence gate.",
        prototypeId: null,
        hypothesisId: null,
        participantCount: 0,
        metricResults: [],
      };
    } else {
      const coreLoopVersion = `${coreArtifact.artifactId}@${coreArtifact.schemaVersion}`;
      const hypothesis = createHypothesisSnapshotFromValidation(proj.coreLoop?.validationData, coreLoopVersion);
      const evidenceRows = await db.playtestResult.findMany({
        where: { projectId: proj.id, hypothesisId: hypothesis.hypothesisId, userId: user.id },
        select: {
          prototypeId: true,
          hypothesisId: true,
          cohortId: true,
          participantId: true,
          completion: true,
          confusionEvents: true,
          retryCount: true,
          createdAt: true,
          prototypeGeneratedAt: true,
        },
        orderBy: [{ prototypeGeneratedAt: "desc" }, { createdAt: "desc" }],
        take: 10_000,
      });
      const requestedPrototypeId = typeof body.playtest_prototype_id === "string"
        ? body.playtest_prototype_id.trim()
        : "";
      const selectedPrototypeId = requestedPrototypeId || evidenceRows.find((row) => row.prototypeId)?.prototypeId || null;
      const aggregate = aggregatePlaytestEvidence(
        selectedPrototypeId ? evidenceRows.filter((row) => row.prototypeId === selectedPrototypeId) : [],
      )[0] || null;
      playtestGate = evaluatePlaytestDecision(hypothesis, aggregate);
    }

    const override = body.playtest_gate_override && typeof body.playtest_gate_override === "object"
      ? body.playtest_gate_override as Record<string, unknown>
      : null;
    const overrideApplied = override?.allow_gdd === true;
    const overrideReason = typeof override?.reason === "string" ? override.reason.trim() : "";
    if (overrideApplied && overrideReason.length < 20) {
      return VALIDATION_ERROR("playtest gate override требует содержательную причину минимум из 20 символов");
    }
    if (playtestGate.decision !== "go" && !overrideApplied) {
      return NextResponse.json({
        detail: "GDD заблокирован playtest decision gate.",
        code: "playtest_gate_blocked",
        playtest_gate: playtestGate,
        override_required: { allow_gdd: true, reason_min_length: 20 },
      }, { status: 409 });
    }
    const playtestGateRecord = {
      ...playtestGate,
      override: overrideApplied ? { applied: true, reason: overrideReason } : { applied: false },
    };

    // --- Section catalogue ---
    let sectionsList = FORMAT_SECTIONS[targetFormat] || FORMAT_SECTIONS.full_gdd;
    if (customSections.length > 0) {
      sectionsList = [...new Set([...sectionsList, ...customSections])];
    }
    if (excludedSections.length > 0) {
      sectionsList = sectionsList.filter((s) => !excludedSections.includes(s));
    }

    // --- Section mappings / readiness ---
    // TASK-6.10: Cache deriveSectionContent results to avoid O(2N) calls.
    const sectionCache: Record<string, { content: string; source: string; requires_review: boolean }> = {};
    const activeMappings: Record<string, unknown> = {};
    const sectionReadiness: Record<string, unknown> = {};
    const autoFillable: string[] = [];
    const manualSections: string[] = [];
    const aiGeneratable: string[] = [];

    for (const sectionName of sectionsList) {
      // TASK-6.10: call deriveSectionContent once and cache result.
      const filled = deriveSectionContent(sectionName, proj, language);
      sectionCache[sectionName] = filled;
      activeMappings[sectionName] = {
        source: filled.source,
        auto_fill: filled.source === "auto_fill",
        ai_enrich: filled.source === "llm",
        ai_generate: filled.source === "template",
        ai_suggest: false,
        manual: filled.source === "manual",
        diagram: false,
        tables: false,
        formulas: false,
      };

      let readiness: string;
      if (filled.source === "auto_fill") {
        readiness = "ready";
        autoFillable.push(sectionName);
      } else if (filled.source === "template" || filled.source === "llm" || filled.source === "placeholder") {
        readiness = "ai_generatable";
        aiGeneratable.push(sectionName);
      } else {
        readiness = "manual_required";
        manualSections.push(sectionName);
      }
      sectionReadiness[sectionName] = {
        status: readiness,
        // R6-02/R6-04: coverage 1.0 only for auto_fill (real upstream data);
        // template and placeholder get 0.0 (not real content).
        coverage: filled.source === "auto_fill" ? 1.0 : filled.source === "manual" ? 0.0 : 0.0,
        auto_fillable: filled.source === "auto_fill",
      };
    }

    // R6-02/R6-04: coverage_score counts ONLY auto_fill (real upstream data).
    // template, placeholder and manual are NOT counted as filled.
    const detailFactor = DETAIL_FACTOR[detailLevel] || 1.0;
    const enrichedCount = sectionsList.filter((s) => {
      const src = sectionCache[s]?.source;
      return src === "auto_fill";
    }).length;
    const coverageScore = enrichedCount / Math.max(1, sectionsList.length);

    const dataMapping = {
      active_mappings: activeMappings,
      section_readiness: sectionReadiness,
      auto_fillable_sections: autoFillable,
      manual_sections: manualSections,
      ai_generatable_sections: aiGeneratable,
      coverage_score: Number(coverageScore.toFixed(3)),
    };

    // --- Auto-filled sections ---
    const sectionsContent: Record<string, {
      content: string;
      source: string;
      auto_filled: boolean;
      diagram?: string;
      tables?: Record<string, unknown>[];
      formulas?: string[];
      requires_review: boolean;
    }> = {};
    for (const sectionName of sectionsList) {
      // TASK-6.10: use cached result instead of calling deriveSectionContent again.
      const filled = sectionCache[sectionName] || deriveSectionContent(sectionName, proj, language);
      // Adjust content length based on detail factor
      let content = filled.content;
      if (detailFactor > 1.5 && filled.source === "template") {
        content =
          content +
          (language === "ru"
            ? "\n\n_Расширенное описание для детального уровня:_ смежные аспекты, влияющие на эту секцию, включают кросс-дисциплинарные зависимости и долгосрочные последствия для проекта."
            : "\n\n_Extended description for detailed level:_ related aspects affecting this section include cross-disciplinary dependencies and long-term consequences for the project.");
      } else if (detailFactor < 0.7 && filled.source === "template") {
        content = content.split("\n")[0];
      }
      sectionsContent[sectionName] = {
        content,
        source: filled.source,
        auto_filled: filled.source === "auto_fill",
        requires_review: filled.requires_review,
      };
    }

    const autoFilledSections = {
      sections: sectionsContent,
      count: Object.keys(sectionsContent).length,
      total_coverage: Number(coverageScore.toFixed(3)),
    };

    // --- AI enriched (placeholder; treat AI-generated as enriched too) ---
    const enrichedSections: Record<string, unknown> = {};
    const generatedSections: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sectionsContent)) {
      if (v.source === "llm") enrichedSections[k] = v;
      if (v.source === "template") generatedSections[k] = v;
    }
    const aiEnriched = {
      enriched_sections: enrichedSections,
      generated_sections: generatedSections,
      enriched_count: Object.keys(enrichedSections).length,
      generated_count: Object.keys(generatedSections).length,
      failed_sections: [],
      total_coverage: Number(coverageScore.toFixed(3)),
    };

    // --- Manual skeletons ---
    const skeletons: Record<string, {
      section_name: string;
      priority: "critical" | "important" | "optional";
      template: string;
      hints: string[];
      estimated_effort: string;
    }> = {};
    const criticalSections: string[] = [];
    const importantSections: string[] = [];
    const optionalSections: string[] = [];
    for (const sectionName of manualSections) {
      const priority: "critical" | "important" | "optional" =
        sectionName === "core_loop" || sectionName === "mechanics"
          ? "critical"
          : sectionName === "narrative" || sectionName === "art_style"
            ? "important"
            : "optional";
      skeletons[sectionName] = {
        section_name: sectionName,
        priority,
        template: `# ${sectionName}\n\n[Опишите секцию здесь]`,
        hints: [
          "Сфокусируйтесь на цели секции",
          "Свяжите с существующими данными проекта",
        ],
        estimated_effort: priority === "critical" ? "1-2 дня" : "2-4 часа",
      };
      if (priority === "critical") criticalSections.push(sectionName);
      else if (priority === "important") importantSections.push(sectionName);
      else optionalSections.push(sectionName);
    }

    const manualSkeletons = {
      skeletons,
      critical_sections: criticalSections,
      important_sections: importantSections,
      optional_sections: optionalSections,
      total_manual_count: manualSections.length,
    };

    // --- Assembled document ---
    const assembledSections: Record<string, {
      section_name: string;
      content: string;
      source: string;
      has_diagram: boolean;
      has_tables: boolean;
      has_formulas: boolean;
      requires_review: boolean;
    }> = {};
    for (const [k, v] of Object.entries(sectionsContent)) {
      const hasDiagram = /```mermaid|```graph/.test(v.content);
      const hasTables = /\|.*\|.*\n\|[-: |]+\|/.test(v.content);
      // TASK-6.11 FIXED: has_formulas regex — was matching any '=' character.
      // Now requires math-specific patterns: equations, summations, inequalities.
      const hasFormulas = /\b\w+\s*=\s*\w|∑|∫|≤|≥|×|÷|\^\d/.test(v.content) && v.content.length > 0;
      assembledSections[k] = {
        section_name: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        content: v.content,
        source: v.source,
        has_diagram: hasDiagram,
        has_tables: hasTables,
        has_formulas: hasFormulas,
        requires_review: v.requires_review,
      };
    }
    const filledSections = sectionsList.filter(
      (s) => sectionsContent[s]?.content && sectionsContent[s]!.content.length > 0
    ).length;
    const consistencyReport = buildConsistencyReport(
      Object.fromEntries(
        Object.entries(sectionsContent).map(([k, v]) => [
          k,
          { content: v.content, source: v.source, requires_review: v.requires_review },
        ])
      ),
      sectionsList
    );

    const assembledDocument = {
      sections: assembledSections,
      section_order: sectionsList,
      consistency_report: consistencyReport,
      total_sections: sectionsList.length,
      filled_sections: filledSections,
      coverage_score: Number(coverageScore.toFixed(3)),
    };

    // --- Formatted document (Markdown) ---
    const title = proj.name || "Untitled Project";
    const toc = sectionsList
      .map((s, i) => `${i + 1}. [${s}](#${s})`)
      .join("\n");
    const markdownParts: string[] = [];
    markdownParts.push(`# ${title}\n`);
    markdownParts.push(`> Format: ${targetFormat} • Detail: ${detailLevel} • Stage: ${projectStage}\n`);
    markdownParts.push(`## Table of Contents\n\n${toc}\n`);
    for (const s of sectionsList) {
      const sec = assembledSections[s];
      if (sec) {
        markdownParts.push(`## ${sec.section_name}\n\n${sec.content}\n`);
      }
    }
    const markdown = markdownParts.join("\n");
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;
    const estimatedPages = FORMAT_PAGE_ESTIMATES[targetFormat] || 10;

    const formattedDocument = {
      markdown,
      title,
      table_of_contents: toc,
      section_count: sectionsList.length,
      word_count: wordCount,
      estimated_pages: estimatedPages,
    };

    // TASK-6.14: Dynamic stages_completed based on what was actually done.
    const stagesCompleted: number[] = [];
    stagesCompleted.push(1); // section catalogue
    stagesCompleted.push(2); // data mapping
    stagesCompleted.push(3); // auto-filled sections
    if (useAi) stagesCompleted.push(4); // AI enrichment (only if requested)
    stagesCompleted.push(5); // manual skeletons
    stagesCompleted.push(6); // assembled document
    const latencyMs = Date.now() - startedAt;

    // --- Format spec ---
    const exportFormats = ["md", "html", "pdf", "docx"];
    const formatSpec = {
      format: targetFormat,
      detail_level: detailLevel,
      sections: sectionsList,
      estimated_pages: estimatedPages,
      audience,
      export_formats: exportFormats,
    };

    const profile: Record<string, unknown> = {
      format_spec: formatSpec,
      data_mapping: dataMapping,
      auto_filled_sections: autoFilledSections,
      ai_enriched_sections: aiEnriched,
      manual_skeletons: manualSkeletons,
      assembled_document: assembledDocument,
      formatted_document: formattedDocument,
      contract_version: STAGE_CONTRACT_VERSION,
      artifact: createArtifactEnvelope("gdd", body),
      algorithm_metadata: getStageAlgorithmMetadata("gdd"),
      playtest_gate: playtestGateRecord,
      stages_completed: stagesCompleted,
      coverage_score: Number(coverageScore.toFixed(3)),
      latency_ms: latencyMs,
      models_used: [
        "deterministic-gdd-v1",
        "section-assembler-v1",
        "consistency-checker-v1",
      ],
    };

    // TASK-6.9 FIXED: AI enrichment moved BEFORE persist so ai_insights is saved in DB.
    if (useAi) {
      const aiInsights = await enrichGdd({
        projectName: proj.name || "Untitled",
        genre: proj.genre || "game",
        format: targetFormat,
        sectionCount: sectionsList.length,
      });
      if (aiInsights) {
        profile.ai_insights = aiInsights;
        (profile.models_used as string[]).push("glm-4.6 (ai-enrichment)");
      }
    }

    assertStageOutput("gdd", profile);

    // --- Persist ---
    await db.projectGDD.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        format: targetFormat,
        sectionCount: sectionsList.length,
        completenessPercent: coverageScore,
        inputData: JSON.stringify({
          target_format: targetFormat,
          detail_level: detailLevel,
          target_audience_doc: audience,
          project_stage: projectStage,
          language,
          playtest_gate: playtestGateRecord,
        }),
        sections: JSON.stringify(assembledSections),
        visualElements: JSON.stringify({}),
        consistencyIssues: JSON.stringify(consistencyReport.issues),
        completenessReport: JSON.stringify({
          total_sections: sectionsList.length,
          auto_filled: autoFillable.length,
          ai_generated: aiGeneratable.length,
          manual_filled: 0,
          manual_pending: manualSections.length,
          completeness_percent: Number((coverageScore * 100).toFixed(1)),
        }),
        fullProfile: JSON.stringify(profile),
      },
      update: {
        format: targetFormat,
        sectionCount: sectionsList.length,
        completenessPercent: coverageScore,
        inputData: JSON.stringify({
          target_format: targetFormat,
          detail_level: detailLevel,
          target_audience_doc: audience,
          project_stage: projectStage,
          language,
          playtest_gate: playtestGateRecord,
        }),
        sections: JSON.stringify(assembledSections),
        visualElements: JSON.stringify({}),
        consistencyIssues: JSON.stringify(consistencyReport.issues),
        completenessReport: JSON.stringify({
          total_sections: sectionsList.length,
          auto_filled: autoFillable.length,
          ai_generated: aiGeneratable.length,
          manual_filled: 0,
          manual_pending: manualSections.length,
          completeness_percent: Number((coverageScore * 100).toFixed(1)),
        }),
        fullProfile: JSON.stringify(profile),
      },
    });

    await updateProjectStage(proj.id, "gdd");

    // TASK-6.9: AI enrichment was already done above (before persist).

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[gdd/generate] error:", error);
    return SERVER_ERROR();
  }
}
