# Task 2-b — Blocks 5 & 6 API Routes (Agent: blocks-5-6)

## Task
Implement Next.js API routes for Gidede Block 5 (progression / economy) and
Block 6 (GDD generate / GDD export / checklists), replacing the Python FastAPI
backend. All routes must:
- Auth via `getCurrentUser(request)` (returns 401 if no user)
- Verify project ownership (or auto-select most recent project when project_id
  is omitted)
- Persist results to Prisma tables via `upsert` with `where: { projectId }`
- Update `Project.projectStage` + `completionPercent`
- Return JSON matching the TypeScript types in `src/types/`

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/api-helpers.ts` | Shared helpers: `getOwnedProject`, `safeJsonParse`, `updateProjectStage`, error responders |
| `src/lib/checklist-logic.ts` | Shared checklist validation logic (used by both singular + plural checklist routes) |
| `src/app/api/v1/progression/design/route.ts` | POST — progression designer (algorithm 3.5) |
| `src/app/api/v1/economy/design/route.ts` | POST — economy designer (algorithm 3.6) |
| `src/app/api/v1/gdd/generate/route.ts` | POST — GDD generator (algorithm 3.7) |
| `src/app/api/v1/gdd/export/route.ts` | POST — GDD export (md/html/docx/pdf) |
| `src/app/api/v1/checklists/[action]/route.ts` | POST — checklist validation (algorithm 3.8, plural path per task spec) |
| `src/app/api/v1/checklist/[action]/route.ts` | POST — checklist validation (singular alias, matches frontend call `/checklist/validate`) |

## Work Log
- Read worklog.md + previous routes (auth, projects) to understand patterns.
- Read frontend types (`src/types/progression.ts`, `economy.ts`, `gdd.ts`) and
  shared interfaces (`shared/types/typescript/interfaces.ts`) for response shapes.
- Read block 5 + 6 page.tsx to discover exact API contracts:
  - Block 5 progression payload: `{genre, target_duration, target_levels,
    progression_type, monetization_model, pacing, project_id?}` → ProgressionDesignResponse
  - Block 5 economy payload: `{genre, monetization_type, openness, project_id?}` → EconomyDesignResponse
  - Block 6 GDD generate payload: `{target_format, detail_level,
    target_audience_doc, project_stage, language}` (no project_id — frontend
    keeps it in localStorage) → GDDProfile
  - Block 6 GDD export payload: `{format, project_id?}` → GDDExportResponse
  - Block 6 checklist (singular `/checklist/validate`): `{project_id}` → ChecklistValidationProfile
- Built shared `api-helpers.ts` with project ownership verification + stage updater
  (computes `completionPercent` from which child records exist on the project).
- **Progression designer** (`progression/design/route.ts`):
  - Validates enum inputs (PROGRESSION_TYPES, MONETIZATION_MODELS, PACING_OPTIONS)
  - Derives macro model: total_levels, target_duration, emergence_ratio,
    lock_key_model (soft_locks for F2P/P2W, key_gates otherwise), content requirements
  - Computes tier boundaries based on level count (1-3→1 tier, 4-10→2, 11-25→3,
    26-60→4, 60+→5). Each tier gets an archetype (Onboarding, Foundation,
    Expansion, Mastery, Endgame) with scale/dominant_mechanic/balance_type/
    difficulty_curve/resource_state/transition_trigger
  - Builds 4 curves (xp_to_level, level_to_power, level_to_cost, difficulty)
    using actual formulas per curveType (exponential `y = base * growth_rate ^
    (level-1)`, linear `y = base * level`, diminishing `1 - exp(-k*lvl)`,
    s_curve `1/(1+exp(-k*(lvl-n/2)))`, intermittent with 20% jumps every 5
    levels, polynomial `lvl^1.5`). Each curve includes 50 sample points
    (renderable as Recharts line charts in the CurvesTab UI).
  - Builds content plan: tier_plans (enemies/rewards/abilities/milestones/pacing
    scaled by tier size + pacing factor), unlock_tree (one unlock every
    targetLevels/10 levels with deterministic names + types), and
    perceived_difficulty_table (one row per level with
    target_perceived_difficulty + recommended_enemy_power + is_tier_boundary)
  - Validation: checks XP runaway (ratio > 1000 = critical, > 200 = warning),
    grind (hoursPerLevel > 1.5 = warning), F2P wall conflicts (relaxed + F2P =
    warning), build gaps (max gap between unlocks > 15 = warning), aesthetic
    alignment (info if no concept.aestheticProfile)
  - Returns full ProgressionDesignResponse matching the type (id, macro_model,
    tier_model, curves, content_plan, validation, summary, stages_completed,
    latency_ms)
  - Persists to ProjectProgression (upsert where projectId) with all
    JSON-stringified fields, updates project stage to "progression"
- **Economy designer** (`economy/design/route.ts`):
  - Validates monetization_type + openness
  - Builds resource inventory by genre preset (rpg → xp/gold/hp + mana/stamina/
    materials; shooter → score/ammo/armor; strategy → 4 RTS resources; etc.).
    F2P adds a "gems" premium currency. Each resource has class/type/bounds/
    initial_value/is_consumable/is_catalytic/is_anchor.
  - Classifies system type: Engine (no converters + no consumables), Economy
    (default), Ecology (has meta + converter). Returns type/sub_type/
    dominant_loop/interaction_type/openness/pricing_type/risk_level
  - Builds Machinations graph: nodes (pool/source/drain/converter) per resource
    + a drain_sink terminal, resource_flows (anchor → converter → outputs,
    consumable → drain_sink), state_connections (anchor gates converters),
    feedback_loops (reinforcing production cycle + balancing drain), and
    structural_patterns list
  - Finds conversion chains: one per catalytic resource, each with
    inputs/outputs/profitability/tier/risk. Computes avg_profitability +
    tier_coverage + warnings
  - Detects pathologies: Inflation (faucet/drain ratio > 1.5), Deflation/Drain
    (< 0.5), Stall (both < 0.2), Runaway (catalytic faucet > 1.0). Each gets
    severity (critical/warning/info) + affected_resources + correction text
  - Computes overall_severity from pathologies
  - Proposes adjustments (increase_drain / increase_faucet / decrease_faucet)
    with current_rate + new_rate + reason
  - Simulates 50 ticks per resource with faucet/drain + noise, bounded by
    resource bounds. Computes avg_resource_curves, resource_ranges,
    runaway_frequency, stall_frequency, stability_index, build_gap. Quality
    assessment has 6 boolean checks + overall_pass + critical_issues[]
  - Returns full EconomyDesignResponse matching the type
  - Persists to ProjectEconomy, updates project stage to "economy"
- **GDD generate** (`gdd/generate/route.ts`):
  - Validates format (8 formats), detail_level (4), audience (5), stage (5)
  - Resolves project (project_id optional — auto-selects most-recent)
  - For each format, picks a section catalogue (one_sheet → 6 sections,
    ten_pager → 10, full_gdd → 21, narrative_bible → 8, modular → 10, etc.)
  - Builds section content per section_name via deriveSectionContent():
    - "title" → from project name (auto_fill)
    - "logline", "usp" → from concept.usp (auto_fill) or generated text
      (ai_generate)
    - "concept" → from concept.onePagerData (auto_fill)
    - "core_loop" / "core_loop_summary" → from coreLoop.stepsData (auto_fill)
    - "mechanics" → from concept.mechanicSet (auto_fill)
    - "aesthetics" → from concept.aestheticProfile / mda.primaryAesthetic
    - "balance" → from balanceResult (auto_fill)
    - "progression" → from progression table (auto_fill)
    - "economy" → from economy table (auto_fill)
    - "monetization" → from economy.monetizationModel (auto_fill)
    - "narrative", "world_overview", "characters", "plot_arcs", "themes",
      "tone_voice", "story_mechanics", "branching_structure" → from
      mda.ludonarrativeCheck (ai_enrich) or generated text (manual)
    - "target_audience" → from concept.dynamicsProfile (auto_fill)
    - "platforms" → from onePager.platforms (auto_fill)
    - Others → manual skeleton placeholder
  - If no source data: generates placeholder text derived from project name/
    description/genre (in Russian or English based on language param)
  - Detail factor adjusts AI-generated content length (overview → short,
    exhaustive → extended)
  - Builds section mappings + readiness status (ready / ai_generatable /
    manual_required) + auto_fillable_sections + manual_sections + ai_generatable
    + coverage_score
  - Builds assembled_document: section_order, sections (with content/source/
    has_diagram/has_tables/has_formulas/requires_review), consistency_report
    (issues with severity, error_count, warning_count, info_count, is_valid)
  - Builds formatted_document: markdown (title + TOC + sections), word_count,
    estimated_pages per format
  - Builds manual_skeletons: for each manual section, priority (critical/
    important/optional), template, hints, estimated_effort
  - Returns full GDDProfile matching the type (format_spec, data_mapping,
    auto_filled_sections, ai_enriched_sections, manual_skeletons,
    assembled_document, formatted_document, stages_completed, coverage_score,
    latency_ms)
  - Persists to ProjectGDD, updates project stage to "gdd"
- **GDD export** (`gdd/export/route.ts`):
  - Validates format (pdf | docx | html | md)
  - Reads ProjectGDD.fullProfile JSON, extracts formatted_document.markdown
    (or falls back to assembled_document.sections → rebuild markdown)
  - If no GDD: builds minimal markdown from project name/description/genre
  - Converts markdown to requested format:
    - md: raw markdown base64
    - html: minimal HTML wrapper with inline CSS, base64
    - docx: minimal WordprocessingML flat XML, base64 (mime set to docx)
    - pdf: minimal one-page PDF with text in a stream, base64 (sufficient for
      download; real PDF generation would need a heavy dependency)
  - Returns { format, content (base64), filename, mime_type, size_bytes }
  - Filename sanitized (non-alphanumeric → _)
- **Checklists** (`checklists/[action]/route.ts` + `checklist/[action]/route.ts`):
  - Both routes share the same logic via `src/lib/checklist-logic.ts`
  - Validates action: validate | mda-check | balance-check | narrative-check |
    economy-check | lens-check (plus aliases mda/balance/narrative/economy/lenses)
  - For "validate": runs all 5 checks; for specific actions: runs only the
    requested check, others are skipped
  - **MDA check**: validates mdaProfile exists, mechanicSet has mechanics,
    overallMatch ≥ 0.5, lensValidation score ≥ 0.6. Issues with severity +
    suggestion
  - **Balance check**: validates balanceResult, overallBalanceScore, imbalance
    count, pathologies
  - **Narrative check**: validates ludonarrativeCheck issues, USP presence,
    genre-specific narrative_bible requirement
  - **Economy check**: validates economy.hasPathology, sim quality.overall_pass,
    stability_index
  - **Lens check**: validates individual lens scores < 0.5 → warning/error
  - Builds summary: weighted overall_score (MDA*0.3 + balance*0.3 + narrative*0.3
    + 0.1), readiness (ready/almost/not_ready), top_5_issues (sorted by
    severity), quick_wins (info+warning suggestions with effort level)
  - Persists issues + remediation_plan to ProjectChecklist (upsert), updates
    project stage to "validation"
  - Returns ChecklistValidationProfile matching the type

## Bugs Found & Fixed
- Initial economy route had `dominantLoop is not defined` ReferenceError —
  variable was named `dominant_loop` (snake_case) but referenced as
  `dominantLoop` in the return object. Renamed the local variable to
  `dominantLoopName` for clarity. Verified via curl test.

## Verification (curl, real Prisma DB writes)
- All 5 routes return HTTP 200 with the expected response shape:
  - `POST /progression/design` → 11929 bytes, 4 tiers, 50-point XP curve,
    validation.overall_score 0.86
  - `POST /economy/design` → 8249 bytes, classification.type=Economy,
    7 resources, 8 machinations nodes, 7 flows, sim_result.quality.overall_pass
    =false (deterministic, has pathologies)
  - `POST /gdd/generate` (full_gdd, detailed) → 40387 bytes, 21 sections
    filled, 4 auto-filled (title/concept/economy/monetization), 10 AI-
    generated, 7 manual
  - `POST /gdd/export` (md) → 3303 bytes, base64 content, filename
    "Test_5-6.md", mime "text/markdown"
  - `POST /checklist/validate` (singular, what frontend calls) → 200, full
    profile with summary.overall_score + readiness
  - `POST /checklists/validate` (plural, task contract) → 200, identical
    response shape (verified by diff)
  - `POST /checklists/mda-check` → 200, mda_check.skipped=true (no MDA data
    in test project)
- Error cases verified:
  - No auth → 401 `{detail:"Не авторизован"}`
  - Invalid progression_type → 422 `{detail:"Неверный тип прогрессии..."}`
  - No projects for user (auto-select mode) → 422 `{detail:"У пользователя
    нет проектов. Создайте проект перед запуском алгоритма."}`
- All routes properly persist to Prisma tables (verified by Prisma INSERT
  queries in dev.log) and update project.projectStage + completionPercent.
- Lint: only pre-existing errors in files I did NOT touch (block 7/8 pages,
  AIHintButton, useActiveProject). All my new files compile cleanly.

## Stage Summary
- 5 API route files + 2 shared lib helpers created, all returning valid JSON
  matching the TypeScript types expected by the frontend.
- Frontend (block 5 + 6 pages) can now successfully call all 5 endpoints.
- Project stage tracking works end-to-end: each route updates
  `projectStage` to the relevant stage (progression | economy | gdd |
  validation) and recomputes `completionPercent` based on which child
  records exist.
- Persistent storage via Prisma `upsert` (where projectId) ensures
  re-running a route overwrites the previous result for the same project.
- Both plural (`/checklists/[action]`) and singular (`/checklist/[action]`)
  paths work — the singular is what block 6 page.tsx actually calls.
