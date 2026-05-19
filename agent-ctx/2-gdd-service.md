# Task 2: GDD Service (Блок 6) — Этапы 1–3 (алгоритм 3.7)

## Agent: Code Implementation Agent
## Status: COMPLETED

## Summary

Implemented the GDD Generator service (Блок 6) — Этапы 1–3 of algorithm 3.7 for the Gidede project.

## Files Created

### 1. `app/schemas/gdd.py` (NEW)
Pydantic models for GDD generation:
- `GDDFormat` — 8 format types: one_sheet, ten_pager, treatment, sketch_design, full_gdd, concept_doc, narrative_bible, modular
- `DocAudience` — 5 audience types: investor, team_sync, production, personal, educational
- `DetailLevel` — 4 levels: overview, standard, detailed, exhaustive
- `GDDFormatSpec` — Stage 1 result: format, detail_level, sections, estimated_pages
- `SectionMapping` — How a section maps to Project State data (source, auto_fill, ai_enrich, ai_generate, ai_suggest, manual, diagram, tables, formulas flags)
- `SectionReadiness` — Readiness status of a section (status, coverage, auto_fillable)
- `GDDDataMapping` — Stage 2 result: active_mappings, section_readiness, coverage_score
- `SectionContent` — Content of a filled section (content, source, diagram, tables, formulas, requires_review)
- `AutoFilledSections` — Stage 3 result: sections dict, count, total_coverage
- `GDDGenerationInput` — Input for GDD generation (concept, core_loop, mda_profile, balance_result, progression_profile, economy_profile, target_format, etc.)
- `GDDConstraints` — Constraints (max_pages, include_diagrams, include_formulas, include_tables)
- `GDDProfile` — Full GDD profile (format_spec, data_mapping, auto_filled_sections, stages_completed, coverage_score, latency_ms)

### 2. `app/services/gdd_service.py` (NEW)
GDDService class with 3 stages + 67 section mappings:

**Stage 1: `determine_gdd_format()`** (algorithm 3.7.3)
- targetFormat → use it; otherwise heuristic by audience → format, or project stage → format
- audience: investor→treatment, team_sync→sketch_design, production→full_gdd, personal→modular, educational→ten_pager
- stage: concept→one_sheet, prototype→ten_pager, preproduction→sketch_design, production→full_gdd, live_ops→modular
- genre → detail_level (rpg→detailed, mmo→exhaustive, action→standard, puzzle→overview, etc.)
- 8 format section templates (6-38 sections each)
- Page estimation based on format + detail level multiplier

**Stage 2: `map_project_to_sections()`** (algorithm 3.7.4)
- 67 section mappings in SECTION_DATA_MAP (38 standard + 29 format-specific)
- 8 blocks: Overview(6), Gameplay(8), Characters/Narrative(5), Levels/World(4), Economy/Progression(4), UI/Visual(4), Multiplayer/Social(3), Technical/Business(4)
- Readiness checking: assesses data coverage from Project State sources
- Coverage score calculation: auto_fillable / total

**Stage 3: `generate_auto_sections()`** (algorithm 3.7.5)
- 20+ section formatters for different content types
- Text sections → direct formatting
- Diagram sections → Mermaid markdown diagrams
- Table sections → structured table data
- Formula sections → formatted formula strings
- AI-enriched sections flagged with requires_review

**Convenience method: `generate_stages_1_3()`** — runs all 3 stages, returns GDDProfile

## Files Modified

### 3. `app/schemas/__init__.py` (MODIFIED)
Added GDD schema exports:
- GDDFormatSpec, SectionMapping, SectionReadiness, GDDDataMapping, SectionContent, AutoFilledSections, GDDGenerationInput, GDDConstraints, GDDProfile

### 4. `app/services/__init__.py` (MODIFIED)
Added GDDService export

### 5. `app/api/v1/gdd.py` (MODIFIED)
Replaced stub endpoints with real API:
- `POST /format` — Stage 1: Determine GDD format
- `POST /map` — Stage 2: Map Project State → GDD sections
- `POST /auto-fill` — Stage 3: Generate auto-filled sections
- `POST /generate` — Full pipeline Stages 1-3
- `POST /checklist` — Stub (Phase 4.D.2)
- `POST /export` — Stub (Phase 4.D.3)

### 6. `app/api/v1/__init__.py` (VERIFIED)
gdd_router already included — no changes needed

## Key Design Decisions

1. **No AI calls for Stages 1-3**: The GDD service follows the algorithm specification — Stages 1-3 are deterministic (format selection, section mapping, auto-fill from existing data). AI calls will be used in Stages 4+ (4.D.2-4.D.3).

2. **67 section mappings**: Beyond the 38 standard sections, additional format-specific sections (logline, visual_hook, title_logline, game_type, concept_overview, etc.) are included to support all 8 GDD formats.

3. **Mermaid diagrams**: Auto-generated diagram representations use Mermaid markdown syntax for core loops, system maps, feedback patterns, progression, and economy.

4. **Review flags**: Sections with `ai_enrich=True` are auto-filled but flagged with `requires_review=True` to indicate they would benefit from AI enrichment in Stage 4.

5. **Pattern consistency**: Follows the same patterns as existing services (ConceptService, ProgressionService, EconomyService) — class-based service with PromptExecutor dependency, logging, timing, Pydantic models.

6. **Coverage scoring**: Two-level coverage — `data_mapping.coverage_score` for overall data availability, `auto_filled_sections.total_coverage` for actual auto-fill coverage.

## Test Results

- All 8 format templates verified: one_sheet(6), ten_pager(10), treatment(4), sketch_design(5), full_gdd(38), concept_doc(6), narrative_bible(11), modular(13)
- Rich input test: 15/38 sections auto-filled with full Project State data
- Heuristic tests: investor→treatment ✓, concept stage→one_sheet ✓
- Diagrams, tables, formulas generated correctly for appropriate sections
