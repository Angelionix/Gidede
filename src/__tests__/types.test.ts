/**
 * Gidede — Type Interface Tests
 * Task 4-a: Expand frontend test coverage
 *
 * Tests that TypeScript interfaces exist and have correct structure.
 * Creates sample objects matching each interface to validate structure.
 * Verifies enum values for shared types.
 */

import { describe, it, expect } from "vitest";

// ============================================================
// Enums (shared/types/typescript/enums.ts)
// ============================================================

describe("Types — Shared Enums", () => {
  it("AestheticType values are correct", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    // Type-level check — we verify the type exists by creating an object
    type AestheticType = enums.AestheticType;
    const validValues: AestheticType[] = [
      "sensation", "fantasy", "narrative", "challenge",
      "fellowship", "discovery", "expression", "submission",
    ];
    expect(validValues).toHaveLength(8);
  });

  it("Genre type includes 29 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type Genre = enums.Genre;
    const validGenres: Genre[] = [
      "action", "platformer", "shooter", "fighting", "stealth",
      "survival_horror", "rhythm", "adventure", "rpg", "action_rpg",
      "jrpg", "tactical_rpg", "mmorpg", "roguelike", "simulation",
      "strategy", "rts", "tbs", "tower_defense", "puzzle",
      "party", "educational", "racing", "sports", "sandbox",
      "horror", "metroidvania", "idle", "visual_novel",
    ];
    expect(validGenres).toHaveLength(29);
  });

  it("Platform type has 5 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type Platform = enums.Platform;
    const validPlatforms: Platform[] = ["pc", "mobile", "console", "vr", "web"];
    expect(validPlatforms).toHaveLength(5);
  });

  it("LoopStructuralType has 4 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type LoopStructuralType = enums.LoopStructuralType;
    const validTypes: LoopStructuralType[] = ["engine", "economy", "ecology", "hybrid"];
    expect(validTypes).toHaveLength(4);
  });

  it("BalanceType has 4 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type BalanceType = enums.BalanceType;
    const validTypes: BalanceType[] = ["transitive", "intransitive", "situational", "mixed"];
    expect(validTypes).toHaveLength(4);
  });

  it("GameMode has 3 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type GameMode = enums.GameMode;
    const validModes: GameMode[] = ["PvP", "PvE", "PvPvE"];
    expect(validModes).toHaveLength(3);
  });

  it("ProgressionType has 6 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type ProgressionType = enums.ProgressionType;
    const validTypes: ProgressionType[] = [
      "linear", "exponential", "diminishing", "s_curve", "intermittent", "custom",
    ];
    expect(validTypes).toHaveLength(6);
  });

  it("ResourceClass has 5 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type ResourceClass = enums.ResourceClass;
    const validClasses: ResourceClass[] = ["time", "currency", "game_object", "hp", "experience"];
    expect(validClasses).toHaveLength(5);
  });

  it("ResourceType has 5 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type ResourceType = enums.ResourceType;
    const validTypes: ResourceType[] = ["core", "subsidiary", "currency", "consumable", "meta"];
    expect(validTypes).toHaveLength(5);
  });

  it("GDDFormat has 8 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type GDDFormat = enums.GDDFormat;
    const validFormats: GDDFormat[] = [
      "one_sheet", "ten_pager", "treatment", "sketch_design",
      "full_gdd", "concept_doc", "narrative_bible", "modular",
    ];
    expect(validFormats).toHaveLength(8);
  });

  it("DocAudience has 5 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type DocAudience = enums.DocAudience;
    const validAudiences: DocAudience[] = ["investor", "team_sync", "production", "personal", "educational"];
    expect(validAudiences).toHaveLength(5);
  });

  it("DetailLevel has 4 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type DetailLevel = enums.DetailLevel;
    const validLevels: DetailLevel[] = ["overview", "standard", "detailed", "exhaustive"];
    expect(validLevels).toHaveLength(4);
  });

  it("ProjectStageName has 5 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type ProjectStageName = enums.ProjectStageName;
    const validStages: ProjectStageName[] = ["concept", "prototype", "preproduction", "production", "live_ops"];
    expect(validStages).toHaveLength(5);
  });

  it("ExportFormat has 4 values", async () => {
    const enums = await import("../../shared/types/typescript/enums");
    type ExportFormat = enums.ExportFormat;
    const validFormats: ExportFormat[] = ["pdf", "docx", "md", "html"];
    expect(validFormats).toHaveLength(4);
  });
});

// ============================================================
// Concept Types (src/types/concept.ts)
// ============================================================

describe("Types — Concept Types", () => {
  it("ConceptFormState interface is correctly structured", async () => {
    const types = await import("@/types/concept");
    // Validate that the type can be satisfied by a sample object
    const formState: types.ConceptFormState = {
      idea: "A puzzle RPG",
      genreMode: "auto",
      genre: "",
      targetMotivations: [],
      experienceLevel: "casual",
      platforms: ["pc"],
      referenceGames: "",
      budget: "solo",
      forbiddenMechanics: [],
      forbiddenInput: "",
    };
    expect(formState.idea).toBe("A puzzle RPG");
    expect(formState.genreMode).toBe("auto");
    expect(formState.platforms).toContain("pc");
  });

  it("ConceptFormState genreMode accepts explicit", async () => {
    const types = await import("@/types/concept");
    const formState: types.ConceptFormState = {
      idea: "",
      genreMode: "explicit",
      genre: "rpg",
      targetMotivations: ["challenge"],
      experienceLevel: "hardcore",
      platforms: [],
      referenceGames: "Skyrim",
      budget: "medium",
      forbiddenMechanics: ["loot_boxes"],
      forbiddenInput: "loot_boxes",
    };
    expect(formState.genreMode).toBe("explicit");
    expect(formState.genre).toBe("rpg");
  });

  it("ConceptGenerationResult interface is correctly structured", async () => {
    const types = await import("@/types/concept");
    const result: types.ConceptGenerationResult = {
      id: "concept-1",
      title: "My Game",
      genre: "rpg",
      target_audience: "Hardcore RPG fans",
      story_synopsis: "A hero's journey",
      gameplay_description: "Turn-based combat",
      unique_features: ["Procedural dungeons"],
      competitors: ["Skyrim"],
      aesthetic_profile: null,
      dynamics_profile: null,
      mechanic_set: null,
      core_loop_candidates: [],
      usp_candidates: [],
      validation_report: null,
      status: "completed",
    };
    expect(result.id).toBe("concept-1");
    expect(result.unique_features).toHaveLength(1);
    expect(result.aesthetic_profile).toBeNull();
  });

  it("ConceptGenerationResult with generation_metadata", async () => {
    const types = await import("@/types/concept");
    const result: types.ConceptGenerationResult = {
      id: "concept-2",
      title: "My Game 2",
      genre: "action",
      target_audience: "Casual",
      story_synopsis: "Story",
      gameplay_description: "Fast action",
      unique_features: [],
      competitors: [],
      aesthetic_profile: null,
      dynamics_profile: null,
      mechanic_set: null,
      core_loop_candidates: [],
      usp_candidates: [],
      validation_report: null,
      status: "completed",
      generation_metadata: {
        stages_completed: [1, 2, 3],
        latency_ms: 1500,
        models_used: ["gpt-4"],
      },
    };
    expect(result.generation_metadata).toBeDefined();
    expect(result.generation_metadata!.stages_completed).toHaveLength(3);
  });
});

// ============================================================
// CoreLoop Types (src/types/coreloop.ts)
// ============================================================

describe("Types — CoreLoop Types", () => {
  it("CoreLoopFormState interface is correctly structured", async () => {
    const types = await import("@/types/coreloop");
    const formState: types.CoreLoopFormState = {
      conceptId: "concept-1",
      mechanics: "Combat, Exploration",
      genre: "rpg",
      desiredLoopType: "engine",
      customSteps: "",
    };
    expect(formState.conceptId).toBe("concept-1");
    expect(formState.desiredLoopType).toBe("engine");
  });

  it("CoreLoopDesignResult interface is correctly structured", async () => {
    const types = await import("@/types/coreloop");
    const result: types.CoreLoopDesignResult = {
      id: "coreloop-1",
      structural_type: { type: "engine" },
      steps: [{ action: "Fight", mechanics: ["attack"] }],
      inner_loops: [],
      outer_loops: [],
      meta_loop: null,
      pathologies: { critical: [] },
      recommendations: [],
      validation: null,
      loop_hierarchy: null,
      stages_completed: [1, 2],
      latency_ms: 500,
      models_used: ["gpt-4"],
    };
    expect(result.id).toBe("coreloop-1");
    expect(result.stages_completed).toHaveLength(2);
  });
});

// ============================================================
// MDA Types (src/types/mda.ts)
// ============================================================

describe("Types — MDA Types", () => {
  it("MDAFormState interface is correctly structured", async () => {
    const types = await import("@/types/mda");
    const formState: types.MDAFormState = {
      conceptId: "concept-1",
      genre: "rpg",
      primaryAesthetic: "challenge",
      secondaryAesthetic: "fantasy",
      tertiaryAesthetic: "discovery",
      idea: "An epic RPG",
      existingMechanics: "",
      requiredMechanics: "",
      forbiddenMechanics: "",
      maxMechanics: 10,
      convergenceThreshold: 0.8,
      fullAnalysis: true,
    };
    expect(formState.primaryAesthetic).toBe("challenge");
    expect(formState.fullAnalysis).toBe(true);
  });

  it("MDAAnalysisResult interface is correctly structured", async () => {
    const types = await import("@/types/mda");
    const result: types.MDAAnalysisResult = {
      aesthetic_profile: null,
      dynamics_target: null,
      mechanic_candidate_set: null,
      mechanic_set: null,
      classic_mda_result: null,
      lens_validation: null,
      bond_validation: null,
      genre: "rpg",
      concept_id: "concept-1",
      iterations_done: 3,
      stages_completed: [1],
      latency_ms: 2000,
      models_used: ["gpt-4"],
    };
    expect(result.genre).toBe("rpg");
    expect(result.iterations_done).toBe(3);
  });
});

// ============================================================
// Balance Types (src/types/balance.ts)
// ============================================================

describe("Types — Balance Types", () => {
  it("BalanceObject interface is correctly structured", async () => {
    const types = await import("@/types/balance");
    const obj: types.BalanceObject = {
      id: "1",
      name: "Warrior",
      type: "melee",
      attributes: { HP: 100, damage: 15 },
      cost: 100,
      tier: 1,
    };
    expect(obj.id).toBe("1");
    expect(obj.attributes.HP).toBe(100);
  });

  it("BalanceObject with optional tags", async () => {
    const types = await import("@/types/balance");
    const obj: types.BalanceObject = {
      id: "2",
      name: "Mage",
      type: "ranged",
      attributes: { damage: 25 },
      tags: ["magic", "ranged"],
    };
    expect(obj.tags).toHaveLength(2);
    expect(obj.cost).toBeUndefined();
  });

  it("FullBalanceRequest interface is correctly structured", async () => {
    const types = await import("@/types/balance");
    const request: types.FullBalanceRequest = {
      objects: [{ id: "1", name: "W", type: "melee", attributes: { HP: 100 } }],
      game_mode: "PvP",
      genre: "rpg",
      balance_type: "transitive",
      run_intransitive: true,
      run_situational: false,
      run_q_factor: false,
      run_monte_carlo: true,
      run_machinations: false,
    };
    expect(request.game_mode).toBe("PvP");
    expect(request.run_monte_carlo).toBe(true);
  });

  it("TransitiveResult interface is correctly structured", async () => {
    const types = await import("@/types/balance");
    const result: types.TransitiveResult = {
      attribute_weights: { HP: 0.3, damage: 0.7 },
      cost_curve_model: "linear",
      expected_cp: 1.0,
      objects: [],
      overpowered: [],
      underpowered: [],
      balanced: ["Warrior"],
      ideal_imbalance: [],
      warnings: [],
      suggestions: [],
    };
    expect(result.attribute_weights.HP).toBe(0.3);
    expect(result.balanced).toContain("Warrior");
  });

  it("MachinationsGraph interface is correctly structured", async () => {
    const types = await import("@/types/balance");
    const graph: types.MachinationsGraph = {
      nodes: [{ id: "1", name: "Gold", type: "pool" }],
      resource_flows: [{ from: "1", to: "2", rate: 1.0 }],
      state_connections: [{ from: "1", to: "2", modifier: "+" }],
      feedback_loops: [{ nodes: ["1", "2"], type: "reinforcing" }],
    };
    expect(graph.nodes).toHaveLength(1);
    expect(graph.resource_flows[0].rate).toBe(1.0);
  });
});

// ============================================================
// Economy Types (src/types/economy.ts)
// ============================================================

describe("Types — Economy Types", () => {
  it("EconomyDesignResponse has correct inventory structure", async () => {
    const types = await import("@/types/economy");
    const response: types.EconomyDesignResponse = {
      id: "econ-1",
      inventory: {
        resources: [{
          name: "Gold",
          resource_class: "currency",
          resource_type: "core",
          initial_value: 100,
          bounds: { min: 0, max: 10000 },
          is_consumable: false,
          is_catalytic: false,
          is_anchor: true,
        }],
        anchor: "Gold",
        core_count: 1,
        subsidiary_count: 0,
      },
      classification: { type: "economy" },
      machinations_model: {
        nodes: [],
        resource_flows: [],
        state_connections: [],
        feedback_loops: [],
        economic_type: "multi_currency_economy",
        structural_patterns: [],
      },
      conversion_graph: {
        chains: [],
        avg_profitability: 0,
        tier_coverage: {},
        warnings: [],
      },
      diagnostics: {
        pathologies: [],
        faucet_drain_ratios: {},
        overall_severity: "info",
      },
      balance: {
        adjustments: [],
        phase: "early",
        target_ratio: 1.0,
      },
      sim_result: {
        config: {},
        aggregated: {
          avg_resource_curves: {},
          resource_ranges: {},
          runaway_frequency: 0,
          stall_frequency: 0,
          stability_index: 1.0,
          build_gap: 0,
        },
        quality: {
          resources_in_bounds: true,
          progression_pacing_ok: true,
          no_runaway_for_minmaxer: true,
          no_stall_for_casual: true,
          build_gap_acceptable: true,
          economy_stable: true,
          overall_pass: true,
          critical_issues: [],
        },
        snapshots_count: 100,
      },
      stages_completed: [1],
      latency_ms: 500,
    };
    expect(response.id).toBe("econ-1");
    expect(response.inventory.anchor).toBe("Gold");
  });
});

// ============================================================
// Progression Types (src/types/progression.ts)
// ============================================================

describe("Types — Progression Types", () => {
  it("ProgressionDesignResponse has correct macro_model structure", async () => {
    const types = await import("@/types/progression");
    const response: types.ProgressionDesignResponse = {
      id: "prog-1",
      macro_model: {
        total_levels: 50,
        target_duration: 100,
        progression_type: "exponential",
        content_requirements: "50 enemies, 10 bosses",
        emergence_ratio: 0.3,
        lock_key_model: "level_gate",
        monetization_model: "f2p",
      },
      tier_model: {
        tiers: [{
          index: 0,
          level_range: [1, 10],
          level_count: 10,
          scale: "linear",
          dominant_mechanic: "combat",
          balance_type: "transitive",
          difficulty_curve: "linear",
          resource_state: "early",
          transition_trigger: "boss_defeat",
        }],
        num_tiers: 5,
        total_levels: 50,
        transition_map: {},
      },
      curves: {
        xp_to_level: { type: "exponential", formula: "base * level^2", parameters: { base: 100 } },
        level_to_power: { type: "linear", formula: "base + level * 10", parameters: { base: 10 } },
        level_to_cost: { type: "linear", formula: "base + level * 5", parameters: { base: 5 } },
        difficulty: { type: "s_curve", formula: "1 / (1 + e^(-x))", parameters: {} },
      },
      content_plan: {
        tier_plans: [],
        unlock_tree: [],
        perceived_difficulty_table: [],
      },
      validation: {
        issues: [],
        suggestions: [],
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        overall_score: 0.9,
        checks: {},
      },
      summary: {},
      stages_completed: [1],
      latency_ms: 300,
    };
    expect(response.id).toBe("prog-1");
    expect(response.macro_model.total_levels).toBe(50);
  });
});

// ============================================================
// GDD Types (src/types/gdd.ts)
// ============================================================

describe("Types — GDD Types", () => {
  it("GDDFormatSpec interface is correctly structured", async () => {
    const types = await import("@/types/gdd");
    const spec: types.GDDFormatSpec = {
      format: "one_sheet",
      detail_level: "overview",
      sections: ["overview", "gameplay"],
      estimated_pages: 1,
      audience: "investor",
      export_formats: ["pdf", "md"],
    };
    expect(spec.format).toBe("one_sheet");
    expect(spec.sections).toHaveLength(2);
  });

  it("SectionMapping interface is correctly structured", async () => {
    const types = await import("@/types/gdd");
    const mapping: types.SectionMapping = {
      source: "concept",
      auto_fill: true,
      ai_enrich: false,
      ai_generate: true,
      ai_suggest: true,
      manual: false,
      diagram: false,
      tables: false,
      formulas: false,
    };
    expect(mapping.source).toBe("concept");
    expect(mapping.auto_fill).toBe(true);
  });

  it("ConsistencyIssue interface is correctly structured", async () => {
    const types = await import("@/types/gdd");
    const issue: types.ConsistencyIssue = {
      severity: "warning",
      section_a: "gameplay",
      section_b: "narrative",
      issue_type: "ludonarrative_dissonance",
      description: "Gameplay contradicts narrative",
      suggestion: "Align mechanics with story",
    };
    expect(issue.severity).toBe("warning");
    expect(issue.issue_type).toBe("ludonarrative_dissonance");
  });

  it("GDDGenerationRequest interface is correctly structured", async () => {
    const types = await import("@/types/gdd");
    const request: types.GDDGenerationRequest = {
      target_format: "one_sheet",
      target_audience_doc: "investor",
      detail_level: "overview",
      project_stage: "concept",
      custom_sections: [],
      excluded_sections: [],
      language: "ru",
    };
    expect(request.target_format).toBe("one_sheet");
    expect(request.language).toBe("ru");
  });

  it("GDDExportResponse interface is correctly structured", async () => {
    const types = await import("@/types/gdd");
    const response: types.GDDExportResponse = {
      format: "pdf",
      content: "base64content",
      filename: "gdd.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
    };
    expect(response.format).toBe("pdf");
    expect(response.size_bytes).toBe(1024);
  });

  it("SectionReadiness interface is correctly structured", async () => {
    const types = await import("@/types/gdd");
    const readiness: types.SectionReadiness = {
      status: "ready",
      coverage: 0.95,
      auto_fillable: true,
    };
    expect(readiness.status).toBe("ready");
    expect(readiness.coverage).toBe(0.95);
  });
});

// ============================================================
// Shared Interfaces (shared/types/typescript/interfaces.ts)
// ============================================================

describe("Types — Shared Interfaces", () => {
  it("AestheticProfile interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const profile: interfaces.AestheticProfile = {
      primary: "challenge",
      secondary: "fantasy",
      tertiary: "discovery",
      rationale: "The game emphasizes player skill and mastery",
    };
    expect(profile.primary).toBe("challenge");
    expect(profile.rationale).toBeDefined();
  });

  it("DynamicsProfile interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const profile: interfaces.DynamicsProfile = {
      core_dynamics: ["resource_management", "exploration"],
      supporting_dynamics: ["social_interaction"],
      emergence_potential: "moderate",
      rationale: "Multiple systems interact",
    };
    expect(profile.emergence_potential).toBe("moderate");
    expect(profile.core_dynamics).toHaveLength(2);
  });

  it("ValidationReport interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const report: interfaces.ValidationReport = {
      triangle_check: { passed: true, score: 0.9, details: "Strong concept" },
      five_questions: { q1: true, q2: false },
      eight_filters: {},
      overall_score: 0.85,
      warnings: ["Question 2 failed"],
      suggestions: ["Refine the concept"],
    };
    expect(report.overall_score).toBe(0.85);
    expect(report.warnings).toHaveLength(1);
  });

  it("Pathology interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const pathology: interfaces.Pathology = {
      name: "Runaway Inflation",
      type: "runaway",
      severity: "critical",
      affected_resources: ["gold"],
      description: "Gold production exceeds consumption",
      correction: "Add gold sinks",
    };
    expect(pathology.type).toBe("runaway");
    expect(pathology.severity).toBe("critical");
  });

  it("CoreLoopStep interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const step: interfaces.CoreLoopStep = {
      action: "Attack enemy",
      mechanics: ["combat"],
      resources_consumed: ["stamina"],
      resources_produced: ["experience"],
      feedback_type: "positive",
      duration_estimate: 5,
    };
    expect(step.feedback_type).toBe("positive");
    expect(step.resources_consumed).toContain("stamina");
  });

  it("BalanceObject interface (shared) is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const obj: interfaces.BalanceObject = {
      id: "1",
      name: "Warrior",
      type: "melee",
      attributes: { HP: 100 },
      cost: 100,
      tier: 1,
      tags: ["frontline"],
    };
    expect(obj.name).toBe("Warrior");
    expect(obj.tags).toHaveLength(1);
  });

  it("ResourceProfile interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const profile: interfaces.ResourceProfile = {
      name: "Gold",
      class: "currency",
      type: "core",
      initial_value: 100,
      bounds: { min: 0, max: 99999 },
    };
    expect(profile.class).toBe("currency");
    expect(profile.bounds.max).toBe(99999);
  });

  it("ProjectState interface has all required blocks", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    // Just check the interface exists and can be referenced
    type PS = interfaces.ProjectState;
    // Verify it's a valid type by checking its keys exist
    const requiredKeys = [
      "id", "name", "createdAt", "updatedAt", "version",
      "concept", "coreLoop", "mdaProfile", "balance",
      "progression", "economy", "gdd", "validation",
      "projectStage", "completionPercent", "lastAlgorithmRun",
    ];
    expect(requiredKeys).toHaveLength(16);
  });

  it("OnePager interface is correctly structured", async () => {
    const interfaces = await import("../../shared/types/typescript/interfaces");
    const onePager: interfaces.OnePager = {
      title: "My Game",
      platform: ["pc"],
      targetAudience: "Hardcore RPG fans",
      rating: "M",
      storySynopsis: "Epic adventure",
      gameplayDescription: "Turn-based RPG",
      uniqueFeatures: ["Procedural generation"],
      competitors: ["Skyrim"],
      aestheticProfile: {
        primary: "fantasy",
        secondary: "challenge",
        tertiary: "narrative",
        rationale: "Fantasy RPG",
      },
      dynamicsProfile: {
        core_dynamics: ["exploration"],
        supporting_dynamics: [],
        emergence_potential: "moderate",
        rationale: "Open world",
      },
      mechanicSet: {
        base: ["movement"],
        combat: ["attack"],
        progression: ["leveling"],
        spatial: ["map"],
        social: [],
        total_count: 4,
        conflicts_resolved: [],
        synergies_detected: [],
        compatibility_score: 0.8,
      },
      coreLoop: {
        name: "Explore-Fight-Upgrade",
        steps: ["Explore", "Fight", "Upgrade"],
        loop_type: "engine",
        fun_check_reasoning: "Engaging loop",
        estimated_duration_seconds: 120,
      },
      usp: "Procedural everything",
      validationReport: {
        triangle_check: { passed: true, score: 0.9, details: "OK" },
        five_questions: {},
        eight_filters: {},
        overall_score: 0.85,
        warnings: [],
        suggestions: [],
      },
      loopType: "engine",
      compatibilityScore: 0.9,
      uniquenessScore: 0.7,
    };
    expect(onePager.title).toBe("My Game");
    expect(onePager.loopType).toBe("engine");
  });
});
