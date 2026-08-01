/**
 * Golden inputs for the algorithm remediation roadmap (R0-01).
 *
 * These fixtures describe product invariants, not snapshots of the current
 * heuristic output. A refactor may change generated prose or scores, but it
 * must keep the input, genre, forbidden mechanics and artifact lineage intact.
 */

export const GOLDEN_FIXTURE_SCHEMA_VERSION = 1 as const;

export const PIPELINE_STAGE_IDS = [
  "concept",
  "core_loop",
  "mda",
  "balance",
  "progression",
  "economy",
  "gdd",
  "validation",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];
export type GoldenLocale = "ru" | "en";

export interface GoldenConceptInput {
  genre: string;
  subgenres: string[];
  target_audience: {
    primary: string[];
    experience: string;
  };
  platform: string[];
  constraints: {
    team_size: number;
    budget: string;
  };
  reference_games: string[];
  forbidden_mechanics: string[];
  use_ai: false;
}

export interface PipelineGoldenFixture {
  id: string;
  schemaVersion: typeof GOLDEN_FIXTURE_SCHEMA_VERSION;
  description: string;
  ideas: Record<GoldenLocale, string>;
  input: GoldenConceptInput;
  artifactVersions: Record<PipelineStageId, number>;
  expectedInvariants: {
    locales: readonly ["ru", "en"];
    normalizedGenre: string;
    requiredSubgenres: string[];
    preserveIdeaVerbatim: true;
    excludeForbiddenMechanics: true;
    aiIndependentBaseline: true;
    stageOrder: typeof PIPELINE_STAGE_IDS;
  };
}

const ARTIFACT_VERSIONS: Record<PipelineStageId, number> = {
  concept: 1,
  core_loop: 1,
  mda: 1,
  balance: 1,
  progression: 1,
  economy: 1,
  gdd: 1,
  validation: 1,
};

function fixture(
  value: Omit<PipelineGoldenFixture, "schemaVersion" | "artifactVersions" | "expectedInvariants">,
): PipelineGoldenFixture {
  return {
    ...value,
    schemaVersion: GOLDEN_FIXTURE_SCHEMA_VERSION,
    artifactVersions: { ...ARTIFACT_VERSIONS },
    expectedInvariants: {
      locales: ["ru", "en"],
      normalizedGenre: value.input.genre,
      requiredSubgenres: [...value.input.subgenres],
      preserveIdeaVerbatim: true,
      excludeForbiddenMechanics: true,
      aiIndependentBaseline: true,
      stageOrder: PIPELINE_STAGE_IDS,
    },
  };
}

export const PIPELINE_GOLDEN_FIXTURES: readonly PipelineGoldenFixture[] = [
  fixture({
    id: "arena-shooter-reflex",
    description: "Fast real-time combat with aim, movement and short rounds.",
    ideas: {
      ru: "Арена на орбитальной станции, где игрок скользит по стенам, меняет оружие и захватывает энергетические маяки в коротких матчах.",
      en: "An orbital-station arena where the player wall-slides, swaps weapons, and captures energy beacons in short matches.",
    },
    input: {
      genre: "shooter",
      subgenres: ["action"],
      target_audience: { primary: ["challenge", "competition"], experience: "core" },
      platform: ["pc", "console"],
      constraints: { team_size: 8, budget: "medium" },
      reference_games: ["Quake", "Titanfall 2"],
      forbidden_mechanics: ["idle rewards", "auto aim"],
      use_ai: false,
    },
  }),
  fixture({
    id: "turn-based-strategy-logistics",
    description: "Deliberate planning, logistics and asymmetric factions.",
    ideas: {
      ru: "Пошаговая стратегия о караванах в затопленном мире: игрок планирует маршруты, снабжает поселения и договаривается с асимметричными фракциями.",
      en: "A turn-based strategy about caravans in a flooded world: the player plans routes, supplies settlements, and negotiates with asymmetric factions.",
    },
    input: {
      genre: "tbs",
      subgenres: ["simulation"],
      target_audience: { primary: ["strategy", "discovery"], experience: "core" },
      platform: ["pc"],
      constraints: { team_size: 6, budget: "medium" },
      reference_games: ["Into the Breach", "Frostpunk"],
      forbidden_mechanics: ["real-time combat", "loot boxes"],
      use_ai: false,
    },
  }),
  fixture({
    id: "spatial-puzzle-cooperation",
    description: "Cognitive spatial problem solving without combat.",
    ideas: {
      ru: "Головоломка о двух роботах, которые синхронно поворачивают комнаты музея, перенаправляют свет и открывают друг другу путь без сражений.",
      en: "A puzzle about two robots that rotate museum rooms in sync, redirect light, and open paths for each other without combat.",
    },
    input: {
      genre: "puzzle",
      subgenres: ["adventure"],
      target_audience: { primary: ["challenge", "fellowship"], experience: "casual" },
      platform: ["pc", "console"],
      constraints: { team_size: 4, budget: "small" },
      reference_games: ["Portal 2", "The Witness"],
      forbidden_mechanics: ["combat", "random failure"],
      use_ai: false,
    },
  }),
  fixture({
    id: "visual-novel-social-mystery",
    description: "Branching narrative driven by trust and incomplete information.",
    ideas: {
      ru: "Визуальная новелла о радиоведущей маленького города, которая по ночным звонкам раскрывает исчезновение и выбирает, кому из слушателей доверять.",
      en: "A visual novel about a small-town radio host who investigates a disappearance through late-night calls and chooses which listeners to trust.",
    },
    input: {
      genre: "visual_novel",
      subgenres: ["adventure"],
      target_audience: { primary: ["narrative", "expression"], experience: "casual" },
      platform: ["pc", "mobile"],
      constraints: { team_size: 3, budget: "small" },
      reference_games: ["Oxenfree", "80 Days"],
      forbidden_mechanics: ["grinding", "twitch combat"],
      use_ai: false,
    },
  }),
  fixture({
    id: "idle-ecology-restoration",
    description: "Long-horizon automation and compounding resource conversion.",
    ideas: {
      ru: "Медленная idle-игра о восстановлении мёртвой планеты: игрок запускает автономные экосистемы, связывает циклы ресурсов и наблюдает изменения неделями.",
      en: "A slow idle game about restoring a dead planet: the player starts autonomous ecosystems, links resource cycles, and watches them evolve over weeks.",
    },
    input: {
      genre: "idle",
      subgenres: ["simulation"],
      target_audience: { primary: ["discovery", "relaxation"], experience: "casual" },
      platform: ["mobile", "web"],
      constraints: { team_size: 3, budget: "small" },
      reference_games: ["Universal Paperclips", "Cell to Singularity"],
      forbidden_mechanics: ["forced ads", "precision input"],
      use_ai: false,
    },
  }),
  fixture({
    id: "survival-horror-sound",
    description: "Scarce resources, stealth and sound-driven threat detection.",
    ideas: {
      ru: "Хоррор о слепом архивисте в подземном хранилище: игрок ориентируется по звуку, экономит батареи и прячется от существа, запоминающего шумные маршруты.",
      en: "A horror game about a blind archivist in an underground vault: the player navigates by sound, conserves batteries, and hides from a creature that learns noisy routes.",
    },
    input: {
      genre: "survival_horror",
      subgenres: ["stealth"],
      target_audience: { primary: ["sensation", "challenge"], experience: "core" },
      platform: ["pc", "console"],
      constraints: { team_size: 7, budget: "medium" },
      reference_games: ["Alien: Isolation", "Amnesia: The Bunker"],
      forbidden_mechanics: ["power fantasy", "infinite ammunition"],
      use_ai: false,
    },
  }),
];
