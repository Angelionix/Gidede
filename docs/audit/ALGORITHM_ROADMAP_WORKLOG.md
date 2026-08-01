# Gidede — worklog нового алгоритмического roadmap

**Активный план:** [`FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md`](FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md)
**Рабочая ветка:** `nextjs-port`
**Начало исполнения:** 2026-08-01
**Последнее обновление:** 2026-08-01

Этот файл — единственный источник текущего статуса работ по новому алгоритмическому roadmap.
Старые планы и `REFACTOR_TRACKER.md` сохранены как история и не используются для определения
готовности этапов.

## Точка продолжения

- **Следующая задача:** `R4-06` — исправить mechanics affinity/cross-genre scoring.
- **Зависимости:** `R4-05` завершена; USP candidates вычисляют Triangle of Weirdness из реальных свойств текста.
- **Ожидаемый результат:** intentional hybrid не штрафуется автоматически; cross-genre mechanics не понижают compatibility_score.
- **После неё:** `R4-07` — унифицировать mechanic namespace и taxonomy.

## Правила ведения

1. В каждый момент времени только одна задача имеет статус `IN PROGRESS`.
2. `DONE` разрешён только после реализации, релевантных тестов и проверки критерия приёмки.
3. Изменения задачи и обновление этого worklog входят в один коммит.
4. После каждой завершённой задачи коммит отправляется в `origin/nextjs-port`.
5. Если задача заблокирована, в журнале указываются причина, выполненные проверки и безопасная точка продолжения.
6. Новый агент перед началом работы читает разделы «Точка продолжения», «Статус roadmap» и последнюю запись истории.
7. Нельзя переносить статусы `DONE` из старого tracker без повторной проверки нового критерия приёмки.

## Статус roadmap

| ID | Статус | Краткий результат | Проверка |
|---|---|---|---|
| R0-01 | DONE | 6 жанров, 12 RU/EN inputs, invariants и версии 8 артефактов | 283 tests, TypeScript |
| R0-02 | DONE | Scripts test/test:coverage/typecheck | 283 tests, coverage, TypeScript |
| R0-03 | DONE | Taxonomy из 6 методов и score provenance для 8 стадий | 286 tests, TypeScript, ESLint |
| R0-04 | DONE | Новый roadmap назначен активным; создан единый worklog и handoff | Проверка ссылок и `git diff --check` |
| R1-01 | DONE | Versioned Zod input/output contracts для 8 стадий | 289 tests, TypeScript, scoped ESLint |
| R1-02 | DONE | `ArtifactEnvelope`, SHA-256 input hash и upstream tracing | 294 tests, TypeScript, scoped ESLint |
| R1-03 | DONE | PipelineContext: stage output → next input + cumulative lineage | 300 tests, TypeScript, scoped ESLint |
| R1-04 | DONE | Реальная project idea и persisted stage outputs без hardcoded inputs | 302 tests, TypeScript, scoped ESLint |
| R1-05 | DONE | Aliases приводятся к `full_gdd`, `target_format` и `target_levels` на contract boundary | 305 tests, TypeScript, scoped ESLint |
| R1-06 | DONE | Единые run/stage statuses; `ok` истинно только для полного success | 309 tests, TypeScript, scoped ESLint |
| R1-07 | DONE | Evidence-based gates, downstream blocking и безопасный `resume_from` | 316 tests, TypeScript, scoped ESLint |
| R1-08 | DONE | Persistent freshness-map и транзитивная invalidation по dependency graph | 322 tests, TypeScript, scoped ESLint, Prisma validate |
| R1-09 | DONE | Completion и блоки учитывают только accepted/non-stale artifacts | 324 tests, TypeScript, scoped ESLint |
| R1-10 | DONE | Version commit только для полного accepted/fresh snapshot с optimistic lock | 331 tests, TypeScript, scoped ESLint |
| R2-01 | DONE | Concept mechanics/genre/aesthetic доходят до Core Loop без generic fallback | 334 tests, TypeScript, scoped ESLint |
| R2-02 | DONE | Structural type выбирается до matching step template | 335 tests, TypeScript, scoped ESLint |
| R2-03 | DONE | Closedness доказана directed resource graph и last→first path | 339 tests, TypeScript, scoped ESLint |
| R2-04 | DONE | Engine/Puzzle defaults проходят mandatory structural checks | 341 tests, TypeScript, scoped ESLint |
| R2-05 | DONE | Вычисляемый fun заменён на `unverified` hypothesis и измеримый playtest protocol | 343 tests, TypeScript, scoped ESLint |
| R2-06 | DONE | PrototypeArtifact закрепляет прототип за accepted/fresh Core Loop lineage | 349 tests, TypeScript, scoped ESLint |
| R2-07 | DONE | Versioned playtest evidence хранит hypothesis/cohort/observations и агрегируется по прототипу | 353 tests, TypeScript, scoped ESLint, Prisma validate |
| R2-08 | DONE | GDD требует `go` либо документированный override; доступны 4 decision outcome | 355 tests, TypeScript, scoped ESLint |
| R3-01 | DONE | `LlmClient`, lazy registry и изолированный ZAI adapter отделены от `ai-service` | 358 tests, TypeScript, scoped ESLint |
| R3-02 | DONE | OpenAI-compatible router настраивается через UI, включая SSE и server secret ref | 365 tests, TypeScript, scoped ESLint, Prisma validate |
| R3-03 | DONE | Generic HTTP dot-path mapping, SSE/NDJSON и Custom adapter SPI | 372 tests, TypeScript, scoped ESLint, Prisma validate |
| R3-04 | DONE | AES-256-GCM encrypted API keys и client-safe secret status поверх `env:` refs | 376 tests, TypeScript, scoped ESLint |
| R3-05 | DONE | Timeout, transient retry/backoff, TTL cache, circuit breaker и recoverable init | 384 tests, TypeScript, scoped ESLint |
| R3-06 | DONE | Capability contract, health diagnostics и model discovery в adapters/UI | 391 tests, TypeScript, scoped ESLint |
| R3-07 | DONE | Несколько provider configs, per-stage model routing и transient-only fallback chain | 405 tests, TypeScript, scoped ESLint, Prisma validate |
| R3-08 | DONE | Strict Zod structured boundary и один bounded repair для всех JSON-задач | 419 tests, TypeScript, scoped ESLint |
| R3-09 | DONE | Bounded Bible RAG context и server-owned source provenance в assistant API/UI | 427 tests, TypeScript, scoped ESLint |
| R3-10 | DONE | Actual provider/model, latency, provider tokens и safe error class для каждого routed attempt | 438 tests, TypeScript, scoped ESLint, Prisma validate |
| R3-11 | DONE | Built-in ZAI зарегистрирован общим adapter descriptor с lazy/recoverable lifecycle | 445 tests, TypeScript, scoped ESLint |
| R4-01 | DONE | Общий `Intl.Segmenter`/Unicode tokenizer для RU/EN genre, aesthetics и core verbs | 453 tests, TypeScript, scoped ESLint |
| R4-02 | DONE | Word-level genre candidates, exact matched-keyword evidence и честный fallback | 458 tests, TypeScript, scoped ESLint |
| R4-03 | DONE | Composite feasibility из team/budget/platform/scope с per-factor breakdown | 510 tests, TypeScript, scoped ESLint |
| R4-04 | DONE | market_fit разделяет heuristic prior и external evidence с confidence/source | 543 tests, TypeScript, scoped ESLint |
| R4-05 | DONE | USP candidates вычисляют Triangle of Weirdness из реальных свойств текста | 577 tests, TypeScript, scoped ESLint |
| R4-06…R7 | TODO | См. активный roadmap | — |

## История выполнения

### 2026-08-01 — R4-05 — DONE

Что сделано:

- USP candidates больше не используют hardcoded `triangle_of_weirdness_check: "pass"|"warn"|"pass"` — теперь каждое значение вычисляется из реальных свойств USP-текста;
- новый модуль `src/lib/concept/triangle-check.ts` с функцией `evaluateTriangleOfWeirdness(usp, genre, context)`;
- три оси Triangle of Weirdness (Schreiber) реализованы как transparent keyword/phrase heuristics:
  - **weird**: cross-genre keywords (hybrid/blending/fusion/combining/merges/...) ИЛИ novelty signals (novel/unique/unconventional/emergent/reshapes/revolutionary/...);
  - **appealing**: player benefit phrases (player agency/story through gameplay/players experience/...) ИЛИ concrete verb в context ИЛИ emotional resonance (story/narrative/experience/journey/...), И разумная длина USP (30-300 chars);
  - **credible**: отсутствие hyperbolic claims (every decision/infinite/revolutionary/reshapes the world/...) И genre alignment (genre keyword в USP);
- pass требует все три оси; warn если хотя бы одна; fail если ни одной (исправляет BUG-1.4 — раньше проходило с 1 из 3);
- score = 0.4 weird + 0.3 appealing + 0.3 credible;
- `buildUSPCandidates` вынесена из route в тестируемый модуль `src/lib/concept/usp-builders.ts`; каждый candidate получает structured `triangle_check` field для UI transparency (weird/appealing/credible/score/reason);
- UI `USPCandidates.tsx` уже поддерживает structured `triangle_check` — теперь получает реальные значения;
- `algorithm-metadata` обновлён: `usp_candidates[*].triangle_of_weirdness_check` имеет отдельные assumptions о heuristic-сигналах и pass/warn/fail правиле.

Изменённые области:

- `src/lib/concept/triangle-check.ts` (новый) и `triangle-check.test.ts` (новый, 21 тест);
- `src/lib/concept/usp-builders.ts` (новый) и `usp-builders.test.ts` (новый, 13 тестов);
- `src/app/api/v1/concept/generate/route.ts` — удалена локальная `buildUSPCandidates`, импорт из нового модуля;
- `src/lib/algorithm-metadata.ts` — отдельная provenance-запись для usp_candidates triangle.

Проверки:

- targeted triangle-check/usp-builders tests — 2 файла, 34 теста пройдено;
- `bun run test` — 58 файлов, 577 тестов пройдено (было 543);
- `bun run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- legacy hardcoded pattern `"pass"|"warn"|"pass"` больше не возвращается: candidate #1 содержит «every decision reshapes the world» (hyperbolic) → credible=false → check != "pass";
- candidate #2 «Hybrid RPG experience blending...» → weird=true от cross-genre сигнала «hybrid»;
- candidate #3 «Narrative-driven RPG where... players experience story through gameplay» → appealing=true от player benefit сигнала «players experience»;
- разные USP-тексты дают разные triangle results (pass для strong USP, warn для partial, fail для слабого);
- reason human-readable и перечисляет какие signals сработали для каждой оси;
- score formula 0.4+0.3+0.3 проверена для разных комбинаций;
- determinism: одинаковые inputs дают идентичные outputs;
- следующей задачей назначена `R4-06`.

### 2026-08-01 — R4-04 — DONE

Что сделано:

- market_fit переведён с однозначного genre-lookup на двухслойную модель: heuristic prior (genre-based, всегда присутствует) + external evidence (reference games / competitor analysis / market research / playtest);
- новый тестируемый модуль `src/lib/concept/market-fit.ts` с функциями `computeMarketFit` и `MarketEvidence` type;
- без внешних данных score честно маркируется `source: "heuristic_prior"`, `confidence: "low"`, `evidence: []` — больше не выдаётся за псевдоточное market measurement;
- reason явно говорит «Heuristic prior only … not a measurement, no external evidence» вместо прежнего «Жанр имеет устоявшуюся аудиторию»;
- когда пользователь передаёт `reference_games`, они становятся low-confidence evidence (indirect signal, not verified market data); score становится evidence-weighted (70% prior + 30% evidence) с повышенным lift;
- stronger evidence (competitor_analysis medium/high, market_research medium/high, playtest high) дают больший lift и поднимают overall confidence до medium/high;
- improvement нацеливается на текущий уровень: no evidence → «attach reference games / market research»; low → «strengthen with competitor/playtest»; medium/high → «add market_research for high confidence»;
- `buildValidationReport` получил опциональный параметр `marketFit` (backward compatible);
- `/api/v1/concept/generate` передаёт реальные `reference_games` в validation;
- `algorithm-metadata` обновлён: `validation_report.eight_filters.market_fit.score` имеет отдельные assumptions о prior/evidence separation, low-confidence default и user-supplied reference games treatment.

Изменённые области:

- `src/lib/concept/market-fit.ts` (новый) и `market-fit.test.ts` (новый, 29 тестов);
- `src/lib/concept/validation.ts` и `validation.test.ts` (+4 integration теста для market_fit path);
- `src/app/api/v1/concept/generate/route.ts` — передача referenceGames в `buildValidationReport`;
- `src/lib/algorithm-metadata.ts` — отдельная provenance-запись для market_fit.

Проверки:

- targeted market-fit/validation tests — 2 файла, 84 теста пройдено (29 новых market-fit + 51 существующий validation включая 4 новых integration);
- `bun run test` — 56 файлов, 543 теста пройдено (было 510);
- `bun run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- no-evidence fixture: `source="heuristic_prior"`, `confidence="low"`, `evidence=[]`, `prior.weight=1.0`, reason содержит «Heuristic prior only» и «not a measurement» — нет псевдоточного market score;
- reference-games fixture: `source="evidence_weighted"`, evidence содержит 1 entry с `source="reference_games"`, `confidence="low"`, `evidence_score > prior.score`, `prior.weight=0.7`;
- market_research high evidence: overall `confidence="high"`, larger lift чем reference_games;
- changing evidence (none → ref → research) даёт разные score, reason и improvement по всем трём;
- changing genre (rpg vs visual_novel) даёт разный prior score (0.85 vs 0.45) и разный final score;
- составной fixture (reference_games + competitor_analysis) создаёт 2 evidence entries, overall confidence = max = medium;
- следующей задачей назначена `R4-05`.

### 2026-08-01 — R4-03 — DONE

Что сделано:

- feasibility переведена с compat-only эвристики на composite-модель: mechanics compatibility (0.35) + team capacity (0.25) + budget tier (0.2) + platform complexity (0.2);
- новый тестируемый модуль `src/lib/concept/feasibility.ts` с функциями `computeFeasibility` и `parseBudget`;
- team capacity считается как mechanics-per-developer с честными порогами (≤3 → 0.9, ≤6 → 0.75, ≤10 → 0.55, >10 → 0.35) и объяснением в reason;
- budget парсит tier keywords (low/medium/high/indie/AAA/bootstrapped/well-funded) и currency amounts ($25k, $1.5M, £200,000, 100000) с поддержкой thousands separators и k/m suffixes;
- platform complexity использует словарь известных платформ (web/mobile/PC/console/VR с весами 0.9→0.4) и применяет 5% penalty за каждую дополнительную платформу;
- когда constraints не указаны, возвращается legacy compat-only score для backward compatibility (все 41 существующий тест validation проходят без изменений);
- при любом указанном constraint активируется composite mode: feasibility filter получает поля `factors[]` (per-factor breakdown) и `composite: true`;
- reason агрегирует только specified-факторы, improvement нацеливается на слабейший specified-фактор с конкретной рекомендацией (scope/team, MVP/budget, single-platform, cross-genre narrowing);
- `buildValidationReport` получил опциональный параметр `constraints` (backward compatible);
- `/api/v1/concept/generate` передаёт реальные `team_size`, `budget`, `platform` в validation;
- `algorithm-metadata` обновлён: `validation_report.eight_filters.feasibility.score` имеет отдельные assumptions о composite-модели, fallback и rule-of-thumb порогах.

Изменённые области:

- `src/lib/concept/feasibility.ts` (новый) и `feasibility.test.ts` (новый, 46 тестов);
- `src/lib/concept/validation.ts` и `validation.test.ts` (+6 integration тестов для composite path);
- `src/app/api/v1/concept/generate/route.ts` — передача constraints в `buildValidationReport`;
- `src/lib/algorithm-metadata.ts` — отдельная provenance-запись для feasibility.

Проверки:

- targeted feasibility/validation tests — 2 файла, 93 теста пройдено (46 новых feasibility + 41 существующий validation + 6 новых integration);
- `bun run test` — 55 файлов, 510 тестов пройдено (было 458);
- `bun run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- legacy fixture (без constraints) возвращает score 0.9 для compat 86 — backward compat сохранён, `composite` и `factors` отсутствуют;
- composite fixture с `team_size: 5` активирует 4-факторную модель, веса суммируются в 1.0, score равен сумме contribution;
- изменение `team_size` (1 vs 10) для 12 механик даёт разный score (0.55 vs 0.9) и разный reason («1 чел» vs «10 чел»);
- изменение `budget` (low vs high) даёт разный score и reason содержит tier;
- изменение `platform` (web vs PlayStation) даёт разный score и reason содержит имя платформы;
- weakest-factor routing: team_capacity weakest → improvement про «scope/команду»; budget weakest → про «MVP»; platform weakest → про «платформы»;
- составной fixture (team=1, budget=low, platform=VR) vs (team=10, budget=high, platform=web) даёт разные score, reason и improvement по всем трём;
- следующей задачей назначена `R4-04`.

### 2026-08-01 — R4-02 — DONE

Что сделано:

- genre inference оформлен как versioned classifier result с selected primary/subgenres и полным ordered candidate list;
- каждый candidate содержит целочисленный score и точный список matched words/phrases, из которых этот score получен;
- источник решения различает `keyword_match`, `explicit` и `fallback_default`;
- отсутствие совпадений возвращает пустое evidence, default `action` и явную причину `no_keyword_matches`, без выдуманного confidence;
- explicit primary сохраняет inferred candidates как evidence и корректно использует их как subgenres, не теряя верхний inferred candidate;
- explicit subgenres дедуплицируются, исключают primary и ограничиваются тремя значениями;
- Concept output contract проверяет внутреннюю согласованность genre/primary/subgenres/evidence до persistence;
- evidence сохраняется в generation metadata, возвращается после загрузки Concept и кратко показывается в one-pager UI.

Изменённые области:

- `src/lib/concept/text-analysis.ts` и тест;
- `src/lib/contracts/stage-contracts.ts` и тест;
- `src/app/api/v1/concept/generate/route.ts`;
- `src/app/api/v1/concept/[id]/route.ts`;
- `src/types/concept.ts`;
- `src/components/gidede/concept/OnePagerCard.tsx`.

Проверки:

- targeted classifier/contract tests — 2 файла, 13 тестов пройдено;
- `npm run test` — 54 файла, 458 тестов пройдено;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript/TSX-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- positive fixture возвращает `sandbox` из четырёх exact signals и ordered evidence для `roguelike`/`strategy`;
- negative fixture с `history`, `gunship`, `carpet` и `rebuilds` не принимает substrings `story`, `gun`, `car`, `build` и честно уходит в fallback;
- explicit fixture маркируется `explicit`, сохраняет отдельный inferred candidate list и не смешивает его с выбранным primary;
- contract fixture отклоняет внутренне противоречивое evidence со score/keywords, primary/subgenre и top-candidate mismatch;
- следующей задачей назначена `R4-03`.

### 2026-08-01 — R4-01 — DONE

Что сделано:

- создан общий Unicode word tokenizer на `Intl.Segmenter` с fallback на Unicode property escapes;
- токены проходят NFKC/case normalization и безопасное русское `ё → е` folding;
- реализован общий exact word/phrase matcher для однословных, многословных и hyphenated keywords;
- genre inference вынесен из API route в тестируемый модуль и расширен русскими genre words/phrases;
- aesthetic ranking переведён с ASCII-only `\b` regex на общий RU/EN word/phrase matcher;
- Concept validation использует те же Unicode tokens для word count, core verbs, novelty, emotion и sustainability signals;
- core-verb lexicon поддерживает английские формы и распространённые русские инфинитивы/спряжения;
- сохранены deterministic tie order, максимум три subgenres и существующие genre-based aesthetic fallbacks.

Изменённые области:

- `src/lib/text/unicode-tokenizer.ts` и тест;
- `src/lib/concept/text-analysis.ts` и тест;
- `src/lib/concept/validation.ts` и тест;
- `src/app/api/v1/concept/generate/route.ts`.

Проверки:

- targeted tokenizer/text-analysis/validation tests — 3 файла, 48 тестов пройдено;
- `npm run test` — 54 файла, 453 теста пройдено;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- tokenizer fixture сегментирует кириллицу, латиницу, em dash, slash и hyphenated phrases и нормализует `ё`;
- genre fixtures распознают русские `стратегия`, `визуальная новелла` и `защита башен`;
- aesthetic fixtures распознают русскую fellowship-лексику и английскую discovery-лексику;
- core-verb fixtures и validation integration распознают спряжённые `исследует`, `собирает`, `планирует`, `защищает`;
- общий phrase matcher не принимает `team` внутри `steam` и `story` внутри `история`;
- следующей задачей назначена `R4-02`.

### 2026-08-01 — R3-11 — DONE

Что сделано:

- built-in ZAI зарегистрирован non-configurable descriptor в том же `LlmAdapterRegistry`, что OpenAI-compatible, Generic HTTP и custom adapters;
- adapter registry различает built-in и user-configurable descriptors, но создаёт их через один `LlmAdapterConfig → LlmClient` contract;
- built-in descriptor намеренно не показывается как HTTP connection в settings и отклоняется на configured-options boundary;
- concrete ZAI import и factory находятся только на provider/adapter bootstrap boundary;
- `default-client` больше не импортирует ZAI provider, SDK, concrete factory или hardcoded ZAI ID/model;
- отдельный built-in resolver связывает общий adapter registry с lazy provider instance registry;
- SDK создаётся только при первом health/completion вызове, а не во время импорта или построения route;
- rejected SDK initialization удаляется из внутреннего promise cache, поэтому следующий вызов повторяет init без рестарта процесса;
- model override, reasoning, temperature и max tokens передаются из общего request contract в ZAI payload;
- completion и streaming responses, actual model и usage возвращаются через общие normalized contracts;
- capabilities/health/listModels реализуются тем же `LlmClient`, что используется routing, resilience и telemetry;
- прежнее поведение built-in fallback и deterministic rules fallback сохранено;
- устаревший ADR обновлён и больше не описывает прямой вызов ZAI из `ai-service`.

Изменённые области:

- `src/lib/llm/adapter-registry.ts` и тест;
- `src/lib/llm/configured-adapters.ts` и новый integration test;
- `src/lib/llm/built-in-client.ts`;
- `src/lib/llm/default-client.ts` и routing test;
- `src/lib/llm/providers/zai.ts` и новый adapter test;
- `docs/LLM_ADAPTERS.md`;
- `docs/adr/003-sse-streaming.md`.

Проверки:

- targeted adapter/bootstrap/ZAI/routing tests — 6 файлов, 26 тестов пройдено;
- `npm run test` — 52 файла, 445 тестов пройдено;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет;
- source audit — `z-ai-web-dev-sdk` импортируется только concrete ZAI adapter, domain API и `default-client` не содержат ZAI references.

Acceptance evidence:

- unified registry fixture создаёт built-in ZAI через тот же descriptor contract и исключает его только из configurable UI list;
- built-in compatibility fixture выполняет completion через общий `LlmClient` с прежними provider/model IDs;
- payload fixture подтверждает передачу route model override и normalized generation options;
- completion fixture нормализует фактическую model и token usage;
- stream fixture нормализует content, actual model и final usage chunk;
- init fixture: первый SDK factory call падает, второй без рестарта успешно выполняет completion;
- фаза R3 завершена, следующей задачей назначена `R4-01`.

### 2026-08-01 — R3-10 — DONE

Что сделано:

- общий LLM-контракт расширен normalized token usage и metadata-only call telemetry;
- `RoutedLlmClient` создаёт отдельное событие для каждой provider attempt, включая transient primary failure и успешный fallback;
- success telemetry использует фактический `response.model`/stream model, а не объявленный primary provider;
- latency измеряется вокруг provider attempt и не включает запись telemetry в БД;
- ошибки приводятся к закрытой taxonomy без provider body/message: timeout, circuit open, abort, network, rate limit, authentication, invalid request, transient/provider/unknown;
- provider-reported token counts нормализуются без coercion; отсутствие usage явно маркируется `usage_source: unavailable`, token estimates не фабрикуются;
- OpenAI-compatible adapter читает standard usage в completion/stream и запрашивает final stream usage;
- Generic HTTP mapping поддерживает declarative response/stream paths для actual model и input/output/total tokens;
- ZAI adapter нормализует usage через тот же provider-agnostic contract;
- telemetry сохраняется в user-owned Prisma model, который не имеет полей для prompt, response, headers, exception message или secrets;
- сбой persistence/request observer изолирован через `Promise.allSettled` и не меняет результат LLM-вызова;
- authenticated telemetry API отдаёт до 100 последних записей, валидирует stage и строит bounded summary;
- settings UI показывает actual provider/model, status, latency, stream mode, tokens и error class;
- assistant response/history metadata теперь используют actual successful fallback provider/model и содержат normalized `llm_call`;
- документированы privacy boundary, endpoint, Generic mapping и применение Prisma schema.

Изменённые области:

- `src/lib/llm/types.ts`, `telemetry.ts`, `telemetry-store.ts` и тесты;
- `src/lib/llm/routing.ts`, `default-client.ts` и тесты;
- OpenAI-compatible, Generic HTTP и ZAI adapters;
- `prisma/schema.prisma`;
- `src/app/api/v1/settings/llm/telemetry/route.ts` и тест;
- assistant AI service/chat/stream contracts и тесты;
- `src/app/settings/page.tsx`;
- `docs/LLM_ADAPTERS.md`.

Проверки:

- telemetry/routing/provider/API fixtures — 11 новых тестов включены в regression suite;
- `npm run test` — 50 файлов, 438 тестов пройдено;
- `npm run typecheck` — ошибок нет;
- `npm run db:generate` — Prisma Client успешно обновлён;
- `prisma validate` с локальным SQLite URL — schema valid;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- non-stream fixture возвращает actual provider response model и exact provider token usage;
- fallback fixture создаёт classified error primary и отдельный successful actual fallback record;
- stream fixture получает actual model и usage из финального usage-only chunk;
- synchronous telemetry sink failure не прерывает успешный stream;
- authenticated persistence fixture связывает запись с текущим user и stage;
- API fixture показывает provider, actual model, latency, tokens и error class и не позволяет читать данные другого user;
- assistant fixtures возвращают actual fallback provider/model вместо preflight primary metadata;
- persistence contract test доказывает отсутствие prompt/response полей;
- следующей задачей назначена `R3-11`.

### 2026-08-01 — R3-09 — DONE

Что сделано:

- Bible chunks получили стабильные публичные `source_id`, не содержащие абсолютных filesystem paths;
- создан provider-agnostic prompt builder с лимитами: до 4 источников, 1 500 символов на выдержку, 5 000 символов суммарного текста и 2 000 символов retrieval query;
- retrieved markdown сериализуется как JSON, boundary markers экранируются, а prompt явно запрещает исполнять инструкции из справочных выдержек;
- assistant AI service использует один и тот же RAG prompt builder для streaming и non-streaming вызовов;
- старые string-returning функции AI service сохранены как backward-compatible wrappers;
- non-streaming response и streaming `done` event возвращают `source_ids` и bounded source metadata, сформированные retriever, а не моделью;
- provenance сохраняется в metadata истории assistant и показывается под ответом в UI;
- отдельный RAG search endpoint также возвращает `source_id` для Bible results;
- retrieval работает fail-open: пустая выдача или недоступный индекс не отключают LLM и возвращают пустые source arrays;
- документированы лимиты, trust boundary, provenance и fallback semantics.

Изменённые области:

- `src/lib/bible-rag.ts` и тест;
- `src/lib/llm/bible-context.ts` и тест;
- `src/lib/ai-service.ts` и RAG integration test;
- assistant chat/stream routes и route tests;
- `src/app/api/v1/rag/search/route.ts`;
- `src/app/blocks/7/page.tsx`;
- `docs/LLM_ADAPTERS.md`.

Проверки:

- targeted RAG/AI/API tests — 5 файлов, 8 тестов пройдены;
- `npm run test` — 47 файлов, 427 тестов пройдено;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- реальный Bible index дважды возвращает одинаковые IDs формата `bible:<section-file>:chunk-N`;
- oversized fixture ограничивается четырьмя sources и bounded prompt size;
- prompt-injection fixture не может закрыть reference boundary собственным marker;
- AI-service fixture подтверждает присутствие Bible context в messages и возврат exact retriever provenance;
- non-streaming API fixture подтверждает exact `source_ids` в response и persisted history metadata;
- streaming fixture подтверждает exact `source_ids` в `done` event и persisted history metadata;
- следующей задачей назначена `R3-10`.

### 2026-08-01 — R3-08 — DONE

Что сделано:

- введён provider-agnostic `createStructuredCompletion` для всех JSON-producing LLM tasks;
- JSON извлекается balanced scanner без изменения содержимого и без эвристического переписывания model output;
- empty и oversized responses отклоняются до domain mapping;
- parsed value обязан пройти task-specific strict Zod schema без type coercion и undeclared fields;
- допускается максимум один repair completion; runtime guard не позволяет расширить этот лимит;
- repair prompt получает previous output как JSON-encoded untrusted data и запрещает выполнять содержащиеся в нём instructions;
- после неуспешного repair возвращается typed `LlmStructuredOutputError` без raw provider output;
- Concept enrichment, custom mechanic, graph generation from text/GDD и graph suggestions переведены с ручного `JSON.parse`/`as` на общий boundary;
- Concept/mechanic schemas ограничивают типы, обязательные поля, массивы и размеры строк;
- graph schema ограничивает node/edge count, finite taxonomy, ID/handle lengths, координаты и properties;
- graph invariants требуют уникальные node IDs, существующие edge endpoints, event node и win/lose outcome;
- invalid structured result перехватывается AI service и возвращает `null`, поэтому caller сохраняет deterministic/domain fallback вместо невалидных данных.

Изменённые области:

- `src/lib/llm/structured-output.ts` и тесты;
- `src/lib/ai-structured-schemas.ts` и тесты;
- `src/lib/ai-service.ts`;
- `src/lib/ai-service-structured.test.ts`;
- `docs/LLM_ADAPTERS.md`.

Проверки:

- targeted structured-output/schema/AI-boundary tests — 3 файла, 14 тестов пройдены;
- `npm run test` — 42 файла, 419 тестов пройдено;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- coercible Concept fixture с number/boolean вместо string дважды отклоняется и возвращает `null`;
- malformed JSON получает ровно один repair call; второй invalid response создаёт typed error с `attempts: 2`;
- successful repair повторно проходит ту же schema и только после этого возвращается caller;
- unknown executable graph node type, duplicate IDs и dangling endpoints не проходят schema/invariants;
- suggestion type вне finite taxonomy отклоняется;
- oversized response не копируется в exception, а repair prompt маркирует previous output как untrusted data;
- в `ai-service` больше нет прямого `JSON.parse` или unchecked `as` для LLM structured output;
- следующей задачей назначена `R3-09`.

### 2026-08-01 — R3-07 — DONE

Что сделано:

- one-to-one LLM config заменён на несколько user-owned provider connections;
- добавлена отдельная `UserLlmRoute` policy с stage, ordered chain, model overrides, temperature и max output tokens;
- route policy валидирует stage, 1–5 candidates, models, generation limits и отсутствие duplicate entries;
- `RoutedLlmClient` применяет provider/model chain поверх существующего resilient client layer;
- fallback выполняется только после исчерпания retries на transient network/timeout/`408/425/429/5xx` errors;
- permanent request/auth/model errors немедленно возвращаются caller и не маскируются другим provider;
- streaming переключается только до первого chunk; после emitted chunk fallback запрещён во избежание дублирования текста;
- health route считается доступным, если primary недоступен, но настроенный fallback здоров;
- все AI service calls получили явный stage ID: assistant, concept, prototype, core_loop, mda, balance, progression, economy или gdd;
- exact stage policy наследует `default` route; без сохранённой policy первый enabled user provider получает built-in ZAI transient fallback;
- settings API создаёт и редактирует несколько provider configs, проверяет ownership и очищает route references при удалении;
- отдельный authenticated routes API атомарно сохраняет policies и отклоняет чужие provider config IDs;
- settings UI позволяет переключать/создавать connections и задавать primary/fallback provider/model для каждой стадии;
- diagnostics проверяет явно выбранное подключение, а не неявный default route;
- документированы semantics маршрутизации и fallback.

Изменённые области:

- `prisma/schema.prisma`;
- `src/lib/llm/routing.ts` и тесты;
- `src/lib/llm/default-client.ts` и routing test;
- `src/lib/ai-service.ts` и stage-routing test;
- `src/app/api/v1/settings/llm/route.ts`;
- `src/app/api/v1/settings/llm/routes/route.ts` и тесты;
- `src/app/api/v1/settings/llm/introspect/route.ts` и тесты;
- assistant chat/status routes;
- `src/app/settings/page.tsx`;
- `docs/LLM_ADAPTERS.md`.

Проверки:

- targeted routing/resolver/API/ai-service tests — 5 файлов, 17 тестов пройдены;
- `npm run test` — 39 файлов, 405 тестов пройдено;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `prisma validate` с локальным SQLite URL — schema valid;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- resolver fixture назначает Concept и GDD разные provider configs и разные model overrides;
- API fixture сохраняет независимые Concept/GDD chains и отклоняет provider другого пользователя;
- transient `503` fixture вызывает fallback provider, permanent `400` — нет;
- streaming fixtures подтверждают fallback до первого chunk и запрет после первого chunk;
- model/temperature/max token fixture подтверждает применение stage policy к normalized request;
- AI-service fixtures подтверждают передачу `concept` и `gdd` в stage resolver;
- следующей задачей назначена `R3-08`.

### 2026-08-01 — R3-06 — DONE

Что сделано:

- общий `LlmClient` расширен нормализованными contracts capabilities, health и model catalog;
- каждый adapter явно объявляет streaming, JSON mode, tools и model discovery без догадок в pipeline-коде;
- OpenAI-compatible adapter получает каталог через стандартный `/models` endpoint и не считает сбой discovery доказательством отказа chat completions;
- Generic HTTP mapping поддерживает декларативные capability flags, отдельный GET/HEAD health endpoint и dot-path mapping каталога моделей;
- built-in ZAI adapter реализует тот же introspection contract и не заявляет неподдерживаемый model discovery;
- health check и model discovery проходят через timeout, retry/backoff и circuit breaker, а результаты кэшируются независимыми TTL;
- authenticated settings endpoint возвращает только нормализованные результаты и не проксирует provider error bodies;
- settings UI показывает health/latency и capability badges, а обнаруженные model IDs подключает к выбору модели;
- assistant status API дополнен capabilities и health;
- конфигурация Generic HTTP, introspection и новые TTL environment variables документированы.

Изменённые области:

- `src/lib/llm/types.ts`;
- `src/lib/llm/providers/zai.ts`;
- `src/lib/llm/providers/openai-compatible.ts` и тесты;
- `src/lib/llm/providers/generic-http.ts` и тесты;
- `src/lib/llm/resilience.ts` и тесты;
- `src/lib/llm/default-client.ts`;
- `src/app/api/v1/settings/llm/introspect/route.ts` и тесты;
- `src/app/api/v1/assistant/status/route.ts`;
- `src/app/settings/page.tsx`;
- `docs/LLM_ADAPTERS.md` и `docs/DEPLOYMENT.md`.

Проверки:

- targeted provider/resilience/introspection tests — 4 файла, 22 теста пройдены;
- `npm run test` — 35 файлов, 391 тест пройден;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- OpenAI-compatible fixture проверяет корректный `/models` URL, server-side auth header и нормализованный catalog;
- Generic HTTP fixture доказывает явные JSON/tools capabilities, HEAD health и mapped model discovery;
- resilience fixtures доказывают независимые health/models TTL и retry transient discovery failure;
- route fixtures доказывают authentication, нормализованный response и отсутствие discovery call без capability;
- UI показывает все четыре capability, health/latency и использует discovery catalog как model suggestions;
- следующей задачей назначена `R3-07`.

### 2026-08-01 — R3-05 — DONE

Что сделано:

- введена единая `ResilientLlmClient`-обёртка для built-in и пользовательских adapters;
- request timeout реализован через `AbortController`/`AbortSignal` и применяется к fetch adapters;
- для streaming тот же timeout ограничивает ожидание каждого следующего chunk;
- network errors, timeout и HTTP `408/425/429/5xx` классифицированы как transient;
- permanent HTTP `4xx` не повторяются и не открывают circuit;
- transient requests получают до двух retries с exponential backoff, bounded jitter и configurable limits;
- stream повторяется только до первого emitted chunk; после выдачи контента ошибка не создаёт повтор/дубликаты;
- circuit breaker открывается после трёх failed logical requests, блокирует новые вызовы и допускает один half-open probe после cooldown;
- polling открытого circuit не продлевает cooldown;
- configured clients кэшируются по config ID/version на TTL, поэтому circuit state сохраняется между запросами и периодически обновляется;
- rejected provider factory promise немедленно удаляется из registry, а следующий запрос повторяет initialization без рестарта;
- permanent `initError` cache в default client удалён;
- upstream error body не включается в exception/log message, status остаётся достаточным для классификации;
- policy настраивается серверными environment variables и документирована.

Изменённые области:

- `src/lib/llm/resilience.ts` и тесты;
- `src/lib/llm/errors.ts`;
- `src/lib/llm/client-cache.ts` и тесты;
- `src/lib/llm/registry.ts` и тесты;
- `src/lib/llm/default-client.ts`;
- `src/lib/llm/types.ts` (`AbortSignal`);
- `src/lib/llm/providers/openai-compatible.ts` и тесты;
- `src/lib/llm/providers/generic-http.ts`;
- `docs/LLM_ADAPTERS.md`;
- `docs/DEPLOYMENT.md`.

Проверки:

- targeted registry/cache/resilience/provider tests — 5 файлов, 20 тестов пройдены;
- `npm run test` — 34 файла, 384 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- unit test: первый provider factory call падает, второй успешно создаёт client в том же процессе;
- hanging completion и idle stream завершаются typed timeout вместо бесконечного ожидания;
- `503/429` проходят retry/backoff, `400` выполняется ровно один раз;
- после threshold circuit блокирует вызов без обращения к provider и восстанавливается успешным half-open probe;
- interrupted stream после первого chunk вызывает provider ровно один раз;
- TTL fixture доказывает reuse до expiry и recreation после него;
- следующей задачей назначена `R3-06`.

### 2026-08-01 — R3-04 — DONE

Что сделано:

- реализовано versioned envelope encryption `enc:v1` на AES-256-GCM с 96-bit IV, authentication tag и AAD;
- master key загружается только из `GIDEDE_LLM_SECRETS_KEY` и обязан быть base64-encoded 32-byte value;
- отсутствующий или некорректный master key не получает небезопасный fallback;
- encrypted envelope хранится в существующем server-only `secretRef`; plaintext в Prisma не записывается;
- существующие `env:VARIABLE_NAME` references сохранены и разрешаются тем же server-side resolver;
- API settings никогда не возвращает encrypted envelope или plaintext: клиент получает только `secret_source`, safe environment ref и availability;
- сохранение настроек без нового секрета сохраняет существующий ciphertext, новый ключ атомарно заменяет его, очистка требует `clear_secret`;
- одновременная передача plaintext key и environment ref, а также clear+replacement отклоняются;
- UI получил password-only поле, статус encrypted/environment source и явную операцию очистки;
- после успешного сохранения plaintext удаляется из React state и никогда не возвращается сервером;
- при недоступном master key encrypted input блокируется, а provider health возвращает unavailable без исключения и утечки;
- tampered ciphertext и неверный master key дают обобщённую ошибку без secret/ciphertext contents;
- deployment и adapter documentation дополнены генерацией, хранением и правилами ротации master key.

Изменённые области:

- `src/lib/llm/secret-storage.ts` и тесты;
- `src/lib/llm/config.ts`;
- `src/lib/llm/providers/openai-compatible.ts`;
- `src/lib/llm/providers/generic-http.ts`;
- `src/app/api/v1/settings/llm/route.ts`;
- `src/app/settings/page.tsx`;
- `docs/LLM_ADAPTERS.md`;
- `docs/DEPLOYMENT.md`.

Проверки:

- targeted secret/config/provider tests — 4 файла, 16 тестов пройдены;
- `npm run test` — 32 файла, 376 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript/TSX-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- ciphertext не содержит plaintext и успешно расшифровывается только тем же 256-bit master key;
- изменение ciphertext обнаруживается GCM authentication и не раскрывает исходное значение в error;
- client-safe serializer исключает весь encrypted envelope из JSON ответа;
- DB field получает только `env:` reference, `enc:v1` envelope либо `null`;
- static mapping secrets по-прежнему запрещены, а runtime adapter получает secret только через server resolver;
- следующей задачей назначена `R3-05`.

### 2026-08-01 — R3-03 — DONE

Что сделано:

- реализован `LlmAdapterRegistry`, отделяющий тип/конфигурацию adapter от registry готовых provider instances;
- adapter descriptor содержит стабильный ID, UI label, validator/normalizer options и factory общего `LlmClient`;
- неизвестные, повторные и некорректные adapter IDs отклоняются до выполнения LLM-запроса;
- встроенные OpenAI-compatible и Generic HTTP adapters регистрируются в едином bootstrap;
- реализован Generic HTTP adapter с декларативным mapping request/response dot paths;
- mapping поддерживает messages array или собранный prompt, model, stream flag, temperature, max tokens, static body и безопасные static headers;
- ответы читаются из вложенных JSON paths, включая numeric array components;
- streaming поддерживает SSE и NDJSON; non-streaming API адаптируется к streaming contract одним chunk;
- секрет передаётся только через общий `secretRef` и выбранный `auth_header/auth_scheme`;
- static `Authorization`, `x-api-key` и другие secret-bearing headers в JSON mapping запрещены;
- настройки/API расширены выбором adapter и валидируемым adapter-specific `configJson` до 20 KB;
- custom adapter после регистрации descriptor появляется в settings API/UI и не требует изменения `ai-service`;
- добавлена документация настройки mapping и подключения custom adapter.

Изменённые области:

- `src/lib/llm/adapter-registry.ts` и тесты;
- `src/lib/llm/configured-adapters.ts`;
- `src/lib/llm/providers/generic-http.ts` и тесты;
- `src/lib/llm/default-client.ts`;
- `src/app/api/v1/settings/llm/route.ts`;
- `src/app/settings/page.tsx`;
- `prisma/schema.prisma` (`UserLlmConfig.configJson`);
- `docs/LLM_ADAPTERS.md`.

Проверки:

- targeted adapter registry/Generic HTTP tests — 2 файла, 7 тестов пройдены;
- `npm run test` — 31 файл, 372 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript/TSX-файлов — ошибок нет;
- `prisma validate` с test `DATABASE_URL` — schema valid;
- `npm run db:generate` — Prisma Client успешно сгенерирован;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- нестандартный nested JSON API подключается только через UI mapping без правок TypeScript-кода;
- API без native streaming остаётся совместимым с общим streaming call path;
- isolated SPI test подключает vendor adapter одним descriptor и получает готовый `LlmClient`;
- `default-client` выбирает adapter по persisted ID, а `ai-service` и алгоритмы стадий не изменены;
- следующей задачей назначена `R3-04`.

### 2026-08-01 — R3-02 — DONE

Что сделано:

- реализован OpenAI-compatible adapter для `POST {base_url}/chat/completions` без зависимости от конкретного SDK;
- нормализованные `LlmClient` requests транслируются в OpenAI messages/model/temperature/max_tokens contract;
- обычные JSON completions и фрагментированные SSE streams приводятся обратно к общим response/chunk types;
- ошибки роутера классифицируются по HTTP status и безопасному message без вывода API-ключа;
- добавлена пользовательская конфигурация router: label, base URL, model, server secret reference и enabled flag;
- API настроек принимает только secret references вида `env:VARIABLE_NAME` и отвергает plaintext-подобные ключи;
- UI `/settings` позволяет создать, изменить, отключить и удалить OpenAI-compatible router без правок кода;
- активная конфигурация определяется по bearer/cookie request context, включая внутренние HTTP-вызовы стадий pipeline;
- `ai-service` не изменён: пользовательский adapter подключается через существующий `getDefaultLlmClient`;
- при отсутствии пользовательской конфигурации сохраняется встроенный ZAI/rules-engine fallback.

Изменённые области:

- `prisma/schema.prisma` (`UserLlmConfig`);
- `src/lib/llm/config.ts` и тесты;
- `src/lib/llm/providers/openai-compatible.ts` и тесты;
- `src/lib/llm/default-client.ts`;
- `src/lib/server-auth.ts`;
- `src/app/api/v1/settings/llm/route.ts`;
- `src/app/settings/page.tsx`.

Проверки:

- targeted config/adapter tests — 2 файла, 7 тестов пройдены;
- `npm run test` — 29 файлов, 365 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript/TSX-файлов — ошибок нет;
- `prisma validate` с test `DATABASE_URL` — schema valid;
- `npm run db:generate` — Prisma Client успешно сгенерирован;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- новый OpenAI-compatible router задаётся в UI через label/base URL/model/`env:` secret reference;
- для перехода на новый router не требуется изменение `ai-service` или stage algorithms;
- adapter покрыт тестами request mapping, bearer secret resolution, non-stream response, fragmented SSE и HTTP errors;
- значение секрета не хранится в Prisma model, не возвращается API и не включается в error messages;
- следующей задачей назначена `R3-03`.

### 2026-08-01 — R3-01 — DONE

Что сделано:

- введён provider-agnostic `LlmClient` с нормализованными message, completion и streaming contracts;
- контракт поддерживает model, temperature, max tokens и reasoning без SDK-specific типов;
- реализован `LlmRegistry`: регистрация factory, lazy initialization, singleton reuse, список providers и выбор default;
- текущий `z-ai-web-dev-sdk` изолирован в `providers/zai.ts` и адаптирует native response/stream к общему контракту;
- default-client bootstrap регистрирует legacy ZAI provider без знания о нём в доменном сервисе;
- все 14 completion/stream paths `ai-service` переведены на `LlmClient.createCompletion`;
- `ai-service` больше не импортирует, не создаёт и не типизируется через конкретный SDK;
- assistant status получает provider/model из активного клиента, а не из hardcoded значения.

Изменённые области:

- `src/lib/llm/types.ts`;
- `src/lib/llm/registry.ts` и тесты;
- `src/lib/llm/default-client.ts`;
- `src/lib/llm/providers/zai.ts`;
- `src/lib/ai-service.ts`;
- `src/app/api/v1/assistant/status/route.ts`;
- `src/app/api/v1/assistant/chat/route.ts` и streaming route.

Проверки:

- LLM registry targeted tests — 3 теста пройдены;
- `npm run test` — 27 файлов, 358 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет;
- `z-ai-web-dev-sdk` отсутствует в `ai-service` и находится только в concrete adapter.

Acceptance evidence:

- provider factory не вызывается при регистрации и создаётся только при первом `get`;
- повторный `get` использует тот же client instance;
- default provider переключается registry без изменений вызывающего кода;
- duplicate/unknown provider IDs отклоняются;
- следующей задачей назначена `R3-02`.

### 2026-08-01 — R2-08 — DONE

Что сделано:

- реализован детерминированный decision gate `go / iterate / stop / insufficient_data`;
- gate читает пороги непосредственно из versioned fun-hypothesis protocol;
- `insufficient_data` возвращается, если не достигнут minimum participant count или не измерена хотя бы одна метрика на минимальной выборке;
- `go` возможен только при прохождении всех comparator/target условий;
- достаточные данные с частичным провалом дают `iterate`;
- `stop` требует полного провала всех порогов минимум в двух когортах и удвоенной минимальной выборки;
- GDD выбирает последнюю generated-версию прототипа для текущего hypothesis ID и блокируется без `go`;
- API возвращает HTTP 409 с полным gate result и требованиями к override;
- явный override разрешает GDD только с причиной длиной минимум 20 символов и сохраняется в GDD profile/inputData;
- Block 6 UI получил явный warning, checkbox и поле причины override; payload теперь содержит активный `project_id`.

Изменённые области:

- `src/lib/playtest-evidence.ts` и тесты;
- `src/app/api/v1/gdd/generate/route.ts`;
- `src/app/blocks/6/page.tsx`;
- `src/types/gdd.ts`.

Проверки:

- playtest decision/prototype lineage/pipeline stale targeted tests — 3 файла, 17 тестов пройдены;
- `npm run test` — 26 файлов, 355 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- 4 участника при minimum=5 всегда дают `insufficient_data`, даже при идеальных rates;
- ровно достигнутые пороги completion/replay/confusion дают `go`;
- один проваленный порог при достаточной выборке даёт `iterate`;
- полный повторный провал в 2 когортах и на 10 участниках при minimum=5 даёт `stop`;
- GDD без `go` не сохраняется и не продвигает project stage;
- override без содержательной причины отклоняется;
- следующей задачей назначена `R3-01`.

### 2026-08-01 — R2-07 — DONE

Что сделано:

- `PlaytestResult` расширен идентичностью и schema version прототипа, input hash, source artifact versions и временем генерации;
- сохраняются стабильный `hypothesisId`, полный snapshot statement/status/protocol, cohort и participant IDs;
- добавлены наблюдения `completion`, `confusionEvents`, `retryCount` и существующие notes;
- save API валидирует PrototypeArtifact, ownership и freshness относительно текущего pipeline state; stale evidence отклоняется с HTTP 409;
- completion выводится из фактического outcome, если не передан явно; confusion/retry остаются nullable, если их не измеряли;
- import принимает только versioned evidence, повторяет freshness/hypothesis checks и пропускает legacy/stale записи;
- JSON export сохраняет reconstructable `prototype_artifact`; CSV экспортирует version/evidence поля с корректным escaping;
- history возвращает evidence rows и `aggregates_by_prototype` с числом когорт/участников, observed count и rates;
- UI считает рестарты прототипа, передаёт completion/retry и показывает агрегаты отдельно для каждой версии/гипотезы.

Изменённые области:

- `prisma/schema.prisma`;
- `src/lib/playtest-evidence.ts` и тесты;
- `src/lib/prototype-lineage.ts`;
- `src/app/api/v1/playtests/save/route.ts`;
- `src/app/api/v1/playtests/import/route.ts`;
- `src/app/api/v1/playtests/history/route.ts`;
- `src/app/api/v1/playtests/export/route.ts`;
- `src/app/prototypes/page.tsx`.

Проверки:

- playtest-evidence/prototype-lineage/pipeline-stale targeted tests — 3 файла, 15 тестов пройдены;
- `npm run test` — 26 файлов, 353 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- Prisma client успешно сгенерирован;
- `prisma validate` с test `DATABASE_URL` — schema valid;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- hypothesis ID детерминированно зависит от Core Loop version, statement и protocol;
- агрегаты группируются по паре `prototypeId + hypothesisId`, а не по общему prototype type;
- completion 2/3 даёт rate `0.667`; confusion использует только 2 фактических наблюдения, а не все 3 запуска;
- полностью отсутствующая метрика возвращает `observed=0, rate=null`, а не ложный ноль;
- stale prototype не может записать доказательство для новой версии Core Loop;
- следующей задачей назначена `R2-08`.

### 2026-08-01 — R2-06 — DONE

Что сделано:

- введён versioned `PrototypeArtifact` с `prototypeId`, `schemaVersion`, `projectId`, `sourceArtifactVersions`, `inputHash` и `generatedAt`;
- генератор прототипа принимает только accepted/non-stale Core Loop и проверяет согласованность его upstream lineage;
- snapshot источников содержит точные ссылки `artifactId@schemaVersion`, включая сам `core_loop`;
- input hash зависит от lineage и фактической конфигурации прототипа: mode, type, steps, resource, goal и override;
- реализована проверка freshness прототипа относительно текущего `pipelineState` с диагностикой отсутствующей, stale или изменившейся версии;
- `prototype_artifact` возвращается API генерации, а `prototypeId` встраивается в 2D/3D `gidede-playtest` events;
- страница прототипов показывает версию Core Loop и сопоставляет iframe event с правильным прототипом, включая compare mode;
- playtest payload уже передаёт `prototype_artifact` для следующей задачи ingestion/persistence.

Изменённые области:

- `src/lib/prototype-lineage.ts` и тесты;
- `src/lib/prototype-generator.ts`;
- `src/app/api/v1/prototypes/generate/route.ts`;
- `src/app/prototypes/page.tsx`.

Проверки:

- prototype-lineage/pipeline-stale targeted tests — 2 файла, 11 тестов пройдены;
- `npm run test` — 25 файлов, 349 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- generated prototype содержит refs `concept-v1@1.0.0` и `core-v1@1.0.0`;
- замена Core Loop на `core-v2` даёт freshness result `false` с точной причиной version mismatch;
- stale или не accepted Core Loop блокирует генерацию с domain error;
- 2D и 3D iframe events содержат тот же `prototypeId`, что API artifact;
- следующей задачей назначена `R2-07`.

### 2026-08-01 — R2-05 — DONE

Что сделано:

- удалён синтетический `fun_check` с `passed` и `score`, вычислявшийся по доле positive feedback и числу шагов;
- введён общий контракт `fun_hypothesis` со статусами `unverified/supported/rejected`, утверждением, test protocol и evidence;
- до появления результатов playtest гипотеза всегда имеет статус `unverified` и пустой evidence;
- test protocol фиксирует 30 секунд, минимум 5 участников, задачу без подсказок, три наблюдаемые метрики и правило принятия решения;
- структурная валидация отделена от fun и теперь содержит 4 явных `structural_checks`;
- checklist сообщает `upton_fun_unverified` как info, а не выдаёт ложный failed test;
- concept candidates и Core Loop UI показывают гипотезу как непроверенную и отображают протокол вместо фиктивной оценки;
- удалён score provenance для несуществующего `validation.fun_check.score`; синхронизированы TypeScript/Python contracts и Prisma JSON comment.

Изменённые области:

- `src/lib/coreloop/validation.ts` и тесты;
- `src/app/api/v1/concept/generate/route.ts`;
- `src/lib/checklist-logic.ts`, `src/lib/algorithm-metadata.ts`;
- `src/components/gidede/coreloop/ValidationPanel.tsx`;
- `src/components/gidede/concept/CoreLoopCandidates.tsx`;
- `shared/types/typescript/interfaces.ts`, `shared/types/python/models.py`;
- `prisma/schema.prisma`.

Проверки:

- targeted Core Loop/metadata tests — 3 файла, 55 тестов пройдены;
- `npm run test` — 24 файла, 343 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых TypeScript/TSX-файлов — ошибок нет;
- `git diff --check` — ошибок нет;
- исполняемый код и shared contracts больше не содержат `fun_check`/`fun_check_reasoning`.

Acceptance evidence:

- `fun_hypothesis.status=unverified`, `evidence=[]`, полей `score` и `passed` нет;
- изменение количества positive-feedback шагов не является доказательством fun и не влияет на structural acceptance;
- structural score считается только по closure, resource balance, critical pathologies и диапазону 3–7 шагов;
- следующей задачей назначена `R2-06`.

### 2026-08-01 — R2-04 — DONE

Что сделано:

- Engine resource chain перестроена в замкнутый directed cycle `momentum → target_lock → combo → xp → power → momentum`;
- финальный Engine step моделирует рост сложности как negative feedback/brake;
- default Engine больше не создаёт critical Runaway;
- Puzzle chain получила явное состояние `board_ready` и полностью связанный цикл через observation/pattern/placement/match;
- финальный Puzzle step содержит recovery mechanic `Undo/Hint` и возвращает `board_ready`;
- default Puzzle больше не создаёт critical Stuck State;
- добавлены интеграционные проверки template → classification → pathologies → validation.

Изменённые области:

- `src/lib/coreloop/steps.ts`
- `src/lib/coreloop/steps.test.ts`

Проверки:

- steps/pathologies/validation tests — 3 файла, 68 тестов пройдены;
- `npm run test` — 24 файла, 341 тест пройден;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- Engine: `has_braking=true`, `critical_count=0`, directed closure `[4,0]`, `overall_passed=true`;
- Puzzle: присутствует `Undo/Hint`, `critical_count=0`, directed closure `[4,0]`, `overall_passed=true`;
- pathology rules не ослаблялись: исправлены сами templates;
- следующей задачей назначена `R2-05`.

### 2026-08-01 — R2-03 — DONE

Что сделано:

- введён явный directed resource-flow graph: ребро `producer step → consumer step` существует только для фактически общего ресурса;
- реализован BFS, возвращающий кратчайший достижимый path между шагами и ресурсы переходов;
- `checkLoopClosedness` признаёт loop closed только при наличии path от последнего step index к первому;
- результат closedness содержит проверяемый `step_path` и `closing_resources`;
- удалены ложные proxies: return/repeat keywords больше не доказывают closure;
- целая forward-only chain без обратного пути больше не считается closed;
- comparison ресурсов нормализуется без потери display-value.

Изменённые области:

- `src/lib/coreloop/resource-graph.ts`
- `src/lib/coreloop/resource-graph.test.ts`
- `src/lib/coreloop/validation.ts`
- `src/lib/coreloop/validation.test.ts`

Проверки:

- resource graph/validation tests — 2 файла, 27 тестов пройдены;
- `npm run test` — 24 файла, 339 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- прямой path `last → first` по `momentum` возвращает `step_path: [last, first]`;
- многошаговый path `last → bridge → first` корректно находится BFS;
- balanced resource sets с направлением только `first → last` не дают closure;
- последний action `Повторить цикл` без resource path возвращает `is_closed: false`;
- следующей задачей назначена `R2-04`.

### 2026-08-01 — R2-02 — DONE

Что сделано:

- выделен чистый `classifyLoopType`, не зависящий от уже построенных steps;
- сохранён явный порядок сигналов: valid user override → Concept primary aesthetic → genre default → hybrid;
- Core Loop endpoint сначала классифицирует type, затем передаёт его в `buildSteps`;
- удалена дублирующая genre→type таблица из endpoint: единственным источником классификации стал модуль `coreloop/classify`;
- `classifyStructuralType` использует тот же классификатор для post-build diagnostics, subtype, braking, resources и risk assessment;
- публичный `StructuralType` оставлен обратно совместимым для специальных diagnostic fixtures.

Изменённые области:

- `src/lib/coreloop/classify.ts`
- `src/lib/coreloop/classify.test.ts`
- `src/app/api/v1/coreloop/design/route.ts`

Проверки:

- classification/steps tests — 2 файла, 51 тест пройден;
- `npm run test` — 23 файла, 335 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- fixture `genre=action + aesthetic=discovery` сначала классифицируется как `economy`;
- для него строится economy template с цепью `raw_resource`, а не engine template жанрового default;
- итоговый `structural_type.type` совпадает с type выбранного template;
- existing tests подтверждают все 7 loop types и приоритет explicit override;
- следующей задачей назначена `R2-03`.

### 2026-08-01 — R2-01 — DONE

Что сделано:

- введён единый `resolveCoreLoopInput` для объединения request overrides, сохранённого Concept и project context;
- без явных overrides Core Loop получает выбранные Concept mechanics, genre и primary aesthetic;
- явные пользовательские mechanics/genre/aesthetic сохраняют приоритет и дедуплицируются;
- при отсутствии Concept mechanics resolver возвращает `missing`, а не изобретает `explore/combat/reward`;
- endpoint Core Loop разрешает persisted Concept context до contract validation и хеширует уже фактически использованный canonical input;
- `prepare-input` возвращает подготовленные данные как на верхнем уровне для существующего UI, так и в `prepared_input` для совместимости;
- подготовка Блока 2 отдаёт `concept_id`, mechanics, genre, primary aesthetic и provenance источника механик;
- форма Core Loop больше не инициализируется RPG/fake mechanics и передаёт активный `project_id` серверу;
- неиспользуемая константа фиктивных механик удалена.

Изменённые области:

- `src/lib/coreloop/input.ts`
- `src/lib/coreloop/input.test.ts`
- `src/lib/pipeline-helpers.ts`
- `src/app/api/v1/pipeline/prepare-input/[projectId]/[blockId]/route.ts`
- `src/app/api/v1/coreloop/design/route.ts`
- `src/app/blocks/2/page.tsx`
- `src/constants/coreloop.ts`

Проверки:

- Core Loop input/context/contract tests — 3 файла, 17 тестов пройдены;
- `npm run test` — 23 файла, 334 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- fixture сохранённого puzzle Concept передаёт `Rotate Rooms`, `Unlock Light Paths`, `Redirect Light`, `Synchronize Robots`, genre `puzzle` и aesthetic `discovery`;
- результат не содержит generic `explore/combat/reward`;
- тест подтверждает, что явные пользовательские overrides не теряются;
- пустой Concept context даёт пустой список/validation error, а не скрытый fallback;
- следующей задачей назначена `R2-02`.

### 2026-08-01 — R1-10 — DONE

Что сделано:

- введено единое решение `evaluatePipelineVersionCommit`: version commit разрешён только для `success` run, когда все восемь artifacts приняты и свежи;
- ответы `partial`, `failed`, `blocked` и `needs_review` больше не могут увеличить `Project.version`;
- успешные ответы стадий без полностью согласованного persisted snapshot возвращают 409/`needs_review`, а не ложный `ok: true`;
- version increment выполняется через optimistic lock по версии, с которой стартовал run;
- конкурентное изменение версии возвращает 409 и не выдаёт run за закоммиченный;
- прежнее подавление ошибки version update удалено: сбой commit теперь виден клиенту;
- `notify-updated` записывает только активность и больше не увеличивает версию;
- partial runner явно возвращает `version_committed: false`;
- pipeline responses сообщают `project_version`, `version_committed` и причину решения.

Изменённые области:

- `src/lib/pipeline-versioning.ts`
- `src/lib/pipeline-versioning.test.ts`
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`
- `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts`
- `src/app/api/v1/pipeline/notify-updated/route.ts`

Проверки:

- versioning/status/freshness tests — 3 файла, 16 тестов пройдены;
- `npm run test` — 22 файла, 331 тест пройден;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- поиск `version: { increment: 1 }` — остался только guarded commit полного pipeline;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- parameterized tests подтверждают отсутствие commit для всех четырёх non-success statuses;
- `success` с непринятым Validation не коммитит версию;
- изменение Concept делает downstream stale и запрещает commit до пересчёта;
- только полный accepted/fresh snapshot разрешает increment;
- уведомление блока и partial runner не меняют версию проекта;
- следующей задачей назначена `R2-01`.

### 2026-08-01 — R1-09 — DONE

Что сделано:

- freshness-map хранит отдельный `acceptedAt`, поэтому существование DB row и успешная приёмка больше не смешиваются;
- artifact считается принятым только при `status: success` и пройденном quality gate;
- completion вычисляется централизованно по восьми принятым, свежим artifacts с прежними весами стадий;
- stale artifact немедленно перестаёт давать completion до фактического пересчёта и повторной приёмки;
- legacy rows без доказательства приёмки не увеличивают completion и показываются как `in_progress`, а не `completed`;
- агрегированные блоки Progression/Economy и GDD/Validation завершаются только когда приняты и свежи обе составляющие;
- выбор следующего блока использует те же freshness/acceptance rules, что и отображаемый статус.

Изменённые области:

- `src/lib/pipeline-stale.ts`
- `src/lib/pipeline-stale.test.ts`
- `src/lib/api-helpers.ts`
- `src/lib/pipeline-helpers.ts`
- `src/lib/pipeline-helpers.test.ts`

Проверки:

- targeted freshness/block tests — 2 файла, 8 тестов пройдены;
- `npm run test` — 21 файл, 324 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- принятые Concept и Core Loop дают 24%, а изменение Concept делает Core Loop stale и снижает completion до 12%;
- повторно сохранённый, но не принятый Core Loop остаётся с нулевым вкладом;
- старые stage rows при пустом `pipelineState` не считаются завершёнными;
- следующим незавершённым блоком legacy-проекта корректно выбирается Concept;
- следующей задачей назначена `R1-10`.

### 2026-08-01 — R1-08 — DONE

Что сделано:

- в `Project` добавлено JSON-поле `pipelineState` для versioned artifact freshness-map;
- задан явный dependency graph всех восьми стадий и вычисление транзитивных descendants;
- `updateProjectStage` после каждого сохранения записывает свежий artifact и помечает существующие downstream artifacts stale;
- stale reason содержит upstream stage и старый/новый artifact ref, а `staleSince` фиксируется один раз до пересчёта;
- cold bootstrap старых проектов сравнивает сохранённые `upstreamVersions` с текущими refs и обнаруживает stale даже при пустом `pipelineState`;
- пересчёт стадии очищает stale только у неё самой; её ещё не пересчитанные descendants остаются stale;
- pipeline state API отображает persisted stale в блоках, включая агрегированные блоки Progression/Economy и GDD/Validation;
- notifications строятся из той же freshness-map;
- прежний mock DELETE stale больше не скрывает устаревший результат: возвращает 409 до реального пересчёта.

Изменённые области:

- `prisma/schema.prisma`
- `src/lib/pipeline-stale.ts`
- `src/lib/pipeline-stale.test.ts`
- `src/lib/api-helpers.ts`
- `src/lib/pipeline-helpers.ts`
- `src/lib/pipeline-helpers.test.ts`
- `src/app/api/v1/pipeline/stale/[projectId]/[blockId]/route.ts`

Проверки:

- stale/block freshness tests — 2 файла, 6 тестов пройдены;
- `npm run test` — 21 файл, 322 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `prisma generate` — Prisma Client успешно обновлён локально;
- `prisma validate` с временным SQLite URL — schema valid;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- изменение Concept помечает stale все семь существующих downstream artifacts;
- изменение Progression инвалидирует Economy, GDD и Validation;
- тест подтверждает частичное восстановление: пересчёт Economy не делает GDD свежим;
- cold-bootstrap fixture с новым Concept и Core Loop, ссылающимся на старый Concept ref, помечает Core Loop stale;
- pipeline block и notification tests читают одну persisted freshness-map;
- следующей задачей назначена `R1-09`.

### 2026-08-01 — R1-07 — DONE

Что сделано:

- введён единый `evaluateStageQuality` для восьми стадий без новых произвольных score thresholds;
- hard gates используют только фактические critical signals: `critical_count`, `critical_issues`, severity `critical/error` и GDD `error_count`;
- мягкие сигналы validation/convergence/readiness переводят стадию в `needs_review`, но не блокируют downstream;
- full и partial runners прекращают выполнение на critical gate или stage failure и маркируют зависимые стадии `blocked`;
- ответы содержат `quality_gate`, `stopped_by` и resume metadata;
- full runner принимает `resume_from`, загружает все предыдущие persisted outputs и разрешает продолжение только при совпадающем versioned artifact со статусом `success` и очищенном hard gate;
- сохранённые pipeline outputs вынесены в общий parser; malformed legacy JSON не превращается в фиктивный output;
- UI запоминает предложенную точку продолжения и показывает кнопку «Продолжить с …» после исправления блокирующей стадии.

Изменённые области:

- `src/lib/pipeline-quality-gates.ts`
- `src/lib/pipeline-quality-gates.test.ts`
- `src/lib/pipeline-persisted-outputs.ts`
- `src/lib/pipeline-persisted-outputs.test.ts`
- `src/lib/pipeline-context.ts`
- `src/lib/pipeline-context.test.ts`
- full/partial pipeline runners и pipeline UI

Проверки:

- gate/persistence/context/status tests — 4 файла, 20 тестов пройдены;
- `npm run test` — 19 файлов, 316 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- тест подтверждает остановку Core Loop при explicit critical pathology;
- Balance, Progression, Economy и GDD fixtures с critical signals закрывают hard gate;
- soft MDA non-convergence даёт review без остановки;
- resume отвергает legacy output без envelope и сохранённый output с неисправленным critical gate;
- resume принимает только успешный versioned artifact после очистки hard gate;
- следующей задачей назначена `R1-08`.

### 2026-08-01 — R1-06 — DONE

Что сделано:

- введён единый доменный расчёт статусов `success`, `partial`, `failed`, `blocked`, `needs_review` для запусков пайплайна;
- успешный HTTP response получает status из фактического `ArtifactEnvelope`, поэтому `partial` и `needs_review` не маскируются как completed;
- HTTP 422 классифицируется как `needs_review`, HTTP 424 как `blocked`, остальные transport/server errors как `failed`;
- `ok` обоих runner’ов вычисляется только как `status === "success"`;
- full runner больше не возвращает `ok: true` после downstream failure: смесь готовых артефактов и ошибки получает `partial`;
- ошибка Concept помечает корневую стадию как `failed`/`needs_review`, а все невыполненные downstream-стадии — как `blocked`;
- `stages_completed` считает реально созданные артефакты, а не текстовые labels;
- UI полного запуска понимает новые статусы и отдельно показывает success, review, blocked и failure.

Изменённые области:

- `src/lib/pipeline-run-status.ts`
- `src/lib/pipeline-run-status.test.ts`
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`
- `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts`
- `src/app/pipeline/page.tsx`

Проверки:

- status unit tests — 4 теста пройдены;
- `npm run test` — 17 файлов, 309 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- поиск старых stage statuses `completed/skipped/error` в runner/UI — совпадений нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- тест подтверждает: `success + failed + blocked → partial`, и `isSuccessfulRun("partial") === false`;
- запуск без полезного output сохраняет корневую причину: `failed + blocked → failed`, `needs_review + blocked → needs_review`;
- только набор из одних `success` возвращает общий `success` и `ok: true`;
- следующей задачей назначена `R1-07`.

### 2026-08-01 — R1-05 — DONE

Что сделано:

- versioned input contracts нормализуют `total_levels → target_levels`, `format → target_format` и `full → full_gdd`;
- после успешной валидации `validateStageInput` возвращает канонический payload, а не только boolean-флаг;
- Progression и GDD handlers вычисляют результат, создают `ArtifactEnvelope` и сохраняют input data из канонического payload;
- при одновременной передаче alias и canonical field каноническое поле имеет приоритет;
- full и partial runners используют единый `resolvePipelineInput`, принимающий как старые, так и новые имена;
- runner формирует только `target_levels` для Progression и `target_format` для GDD;
- UI полного запуска переведён на канонические поля;
- `/gdd/format` и `/gdd/generate-full` принимают оба имени формата и возвращают `full_gdd` для legacy-значения `full`.

Изменённые области:

- `src/lib/contracts/stage-contracts.ts`
- `src/lib/contracts/stage-contracts.test.ts`
- `src/lib/pipeline-context.ts`
- `src/lib/pipeline-context.test.ts`
- Progression, GDD и pipeline API routes
- `src/app/pipeline/page.tsx`

Проверки:

- contract/context tests — 2 файла, 14 тестов пройдены;
- `npm run test` — 16 файлов, 305 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- поиск legacy-полей во внутренних pipeline requests — совпадений нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- тест полного пути input normalization → runner request подтверждает `total_levels: 37 → target_levels: 37` без возврата к default 50;
- тот же тест подтверждает `format: "full" → target_format: "full_gdd"`;
- contract tests подтверждают удаление alias-полей из parsed payload и приоритет canonical fields при конфликте;
- следующей задачей назначена `R1-06`.

### 2026-08-01 — R1-04 — DONE

Что сделано:

- UI запуска пайплайна передаёт точные `description` и `genre` выбранного проекта вместо фиктивной строки;
- full runner серверно выбирает idea в порядке request → project description → project name и отклоняет запуск, если ни одно реальное значение не удовлетворяет минимальной длине;
- partial runner больше не содержит canned idea, RPG-набор объектов, `explore/combat/reward` или фиксированный aesthetic;
- partial runner исполняет стадии в каноническом порядке через общий `PipelineContext` и строит каждый request из фактических upstream outputs;
- сохранённые результаты всех пропущенных upstream-стадий до последнего выбранного блока используются как контекст, включая несмежный выбор блоков;
- legacy outputs без `ArtifactEnvelope` разрешено использовать как данные, но для них не изобретается ложная lineage-версия;
- endpoint Validation унифицирован с каноническим `/api/v1/checklists/validate`;
- full и partial runners возвращают фактически использованную `concept_idea`, а partial runner также возвращает накопленные `artifact_versions`.

Изменённые области:

- `src/lib/pipeline-context.ts`
- `src/lib/pipeline-context.test.ts`
- `src/lib/pipeline-helpers.ts`
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`
- `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts`
- `src/app/pipeline/page.tsx`

Проверки:

- `npm run test -- src/lib/pipeline-context.test.ts` — 8 тестов пройдены;
- `npm run test` — 16 файлов, 302 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- поиск прежних hardcoded pipeline inputs — совпадений нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- тест подтверждает неизменную передачу RU и EN idea без подмены canned-текстом;
- request idea имеет приоритет над project description, а project description — над достаточно длинным project name;
- короткий project name без description не превращается в выдуманную концепцию и приводит к validation error;
- тест legacy seed подтверждает: persisted output доступен downstream-стадии, но `upstreamVersions` остаётся пустым без валидного envelope;
- следующей задачей назначена `R1-05`.

### 2026-08-01 — R1-03 — DONE

Что сделано:

- создан тестируемый `PipelineContext`, хранящий реальные stage outputs и накопленные artifact versions;
- full runner разбирает JSON каждого успешного stage response и регистрирует его до построения следующего request;
- Core Loop получает `concept_id`, generated genre, primary aesthetic и выбранные Concept mechanics;
- MDA получает generated genre, все Concept aesthetics и тот же mechanic set;
- Balance objects детерминированно строятся из выбранных mechanics, а не из фиксированного RPG-набора;
- Progression и Economy получают generated genre;
- каждая downstream-стадия получает cumulative `upstream_versions` в формате `artifactId@schemaVersion`;
- итог full-run response содержит `artifact_versions`, а каждая завершённая стадия — `artifact_id` и `schema_version`;
- keyword fallback расширен RU/EN и используется только при отсутствии Concept output;
- из full runner удалены независимые hardcoded build bodies и fallback `explore/combat/reward` при наличии Concept;
- partial runner остаётся отдельным источником фиктивных данных и назначен областью `R1-04`.

Изменённые области:

- `src/lib/pipeline-context.ts`
- `src/lib/pipeline-context.test.ts`
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`

Проверки:

- `npm run test -- src/lib/pipeline-context.test.ts` — 6 тестов пройдены;
- `npm run test` — 16 файлов, 300 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint затронутых файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- contract test подтверждает передачу Concept mechanics/genre/aesthetics в Core Loop и MDA;
- Balance test подтверждает построение объектов из выбранных mechanics;
- все восемь runner requests проходят соответствующие Zod input contracts;
- lineage test подтверждает накопление реальных artifact refs по порядку стадий;
- следующей задачей назначена `R1-04`.

### 2026-08-01 — R1-02 — DONE

Что сделано:

- введён тип и Zod-контракт `ArtifactEnvelope`;
- envelope содержит обязательные `artifactId`, `artifactType`, `envelopeVersion`, `schemaVersion`, `upstreamVersions`, `inputHash`, `status`, `createdAt`;
- `inputHash` вычисляется как SHA-256 канонического JSON с рекурсивной сортировкой object keys;
- `artifactId` создаётся как UUID, успешный результат получает статус `success`;
- все восемь input contracts принимают валидируемый `upstream_versions`;
- все восемь output contracts требуют schema-valid envelope;
- envelope добавлен в ответы и сохраняемые full profiles Concept, Core Loop, MDA, Balance, Progression, Economy, GDD и Validation;
- Concept сохраняет envelope в `generationMetadata` и возвращает его после reload;
- публичные result-типы расширены `ArtifactEnvelope`;
- прямой вызов стадии без upstream остаётся допустимым и честно сохраняет пустую карту; заполнение реальной цепочки выполняется в `R1-03`.

Изменённые области:

- `src/lib/contracts/artifact-envelope.ts`
- `src/lib/contracts/artifact-envelope.test.ts`
- `src/lib/contracts/stage-contracts.ts`
- восемь stage handlers, `src/lib/checklist-logic.ts` и result-типы

Проверки:

- contract tests — 2 файла, 8 тестов пройдены;
- `npm run test` — 15 файлов, 294 теста пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint всех затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- одинаковый JSON с разным порядком ключей даёт одинаковый `inputHash`;
- изменение значимого входа меняет hash;
- malformed upstream versions, hash и status отклоняются Zod-контрактом;
- каждый persisted full profile содержит версию схемы, hash входа и upstream map;
- следующей задачей назначена `R1-03`.

### 2026-08-01 — R1-01 — DONE

Что сделано:

- создан единый реестр `STAGE_CONTRACTS_V1` для Concept, Core Loop, MDA, Balance, Progression, Economy, GDD и Validation;
- input/output каждой стадии описаны Zod-схемой версии `1.0.0`;
- все восемь API-входов валидируются сразу после JSON parsing;
- каждый результат содержит `contract_version` и проверяется непосредственно перед первым `db.upsert`;
- invalid output вызывает `StageOutputContractError` до persistence;
- Concept сохраняет contract version и algorithm metadata в `generationMetadata` и возвращает их после перезагрузки;
- публичные result-типы синхронизированы с versioned contract;
- добавлены positive и negative contract tests, включая malformed input, отсутствующую и неверную output version.

Изменённые области:

- `src/lib/contracts/stage-contracts.ts`
- `src/lib/contracts/stage-contracts.test.ts`
- восемь stage API handlers и `src/lib/checklist-logic.ts`
- `src/app/api/v1/concept/[id]/route.ts`
- result-типы в `src/types`

Проверки:

- `npm run test -- src/lib/contracts/stage-contracts.test.ts` — 3 теста пройдены;
- `npm run test` — 14 файлов, 289 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- scoped ESLint всех затронутых TypeScript-файлов — ошибок нет;
- `npm run lint` — остаются 12 существовавших до задачи React-hook ошибок в несвязанных UI-файлах; затронутые R1-01 файлы в ошибках отсутствуют;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- у каждой стадии есть явные input/output schema и contract version;
- malformed Concept/Core Loop/Balance inputs отклоняются contract tests;
- unversioned и wrong-version outputs отклоняются до кода persistence;
- следующей задачей назначена `R1-02`.

### 2026-08-01 — R0-03 — DONE

Что сделано:

- введена закрытая taxonomy `template`, `heuristic`, `simulation`, `solver`, `playtest_evidence`, `llm_generated`;
- создан общий контракт `AlgorithmMetadata` с versioned taxonomy и картой JSON-путей score → method/assumptions;
- описаны фактические предположения текущих Concept, Core Loop, MDA, Balance, Progression, Economy, GDD и Checklist метрик;
- `algorithm_metadata` добавлена в ответы всех восьми стадий и попадает в сохраняемые full profiles;
- публичные TypeScript-типы результатов расширены новым контрактом без изменения существующих числовых полей;
- добавлены тесты полноты taxonomy, непустых assumptions и честной классификации текущих методов.

Изменённые области:

- `src/lib/algorithm-metadata.ts`
- `src/lib/algorithm-metadata.test.ts`
- API generators в `src/app/api/v1/{concept,coreloop,mda,balance,progression,economy,gdd}`
- `src/lib/checklist-logic.ts`
- result-типы в `src/types`

Проверки:

- `npm run test -- src/lib/algorithm-metadata.test.ts` — 3 теста пройдены;
- `npm run test` — 13 файлов, 286 тестов пройдены;
- `npm run typecheck` — ошибок нет;
- ESLint для всех затронутых TypeScript-файлов — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- каждый известный score-путь стадий имеет method и как минимум одно явное assumption;
- synthetic Monte Carlo/resource-flow результаты помечены `simulation`, а агрегаты и lookup-формулы — `heuristic`;
- текущая реализация нигде не заявляет `solver`, `playtest_evidence` или `llm_generated` для score, которого эти методы не создавали;
- Phase 0 завершена, следующей задачей назначена `R1-01`.

### 2026-08-01 — R0-02 — DONE

Что сделано:

- в `package.json` добавлена единая команда `test` (`vitest run`);
- добавлена команда `test:coverage` (`vitest run --coverage`);
- добавлена команда `typecheck` (`tsc --noEmit`);
- команды не зависят от shell-конструкций и доступны через npm/Bun-compatible scripts.

Изменённые области:

- `package.json`

Проверки:

- `npm run test` — 12 файлов, 283 теста пройдены;
- `npm run test:coverage` — 283 теста пройдены, statements 93.84%, branches 87.58%, functions 99.32%, lines 95.22%;
- `npm run typecheck` — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- все три команды запускаются из корня после установки зависимостей;
- test/coverage используют версию Vitest из devDependencies и общий `vitest.config.ts`;
- следующей задачей назначена `R0-03`.

### 2026-08-01 — R0-01 — DONE

Что сделано:

- добавлены шесть golden fixtures для контрастных жанров `shooter`, `tbs`, `puzzle`, `visual_novel`, `idle`, `survival_horror`;
- каждый fixture содержит семантически парные RU/EN идеи, полный Concept input и ожидаемые продуктовые инварианты;
- для всех восьми стадий зафиксированы положительные artifact versions и ожидаемый порядок;
- baseline не зависит от LLM (`use_ai: false`) и не закрепляет нестабильный сгенерированный текст;
- исполняемый тест прогоняет все 12 локализованных входов через действующий `validateConceptInput`.

Изменённые области:

- `src/lib/golden-fixtures/pipeline-golden.ts`
- `src/lib/golden-fixtures/pipeline-golden.test.ts`

Проверки:

- `vitest run src/lib/golden-fixtures/pipeline-golden.test.ts` — 1 файл, 4 теста пройдены;
- `vitest run` — 12 файлов, 283 теста пройдены;
- `tsc --noEmit` — ошибок нет;
- `git diff --check` — ошибок нет.

Acceptance evidence:

- fixtures содержат inputs, expected invariants и версии всех pipeline artifacts;
- ID и жанры уникальны, обе локали обязательны и проходят текущий входной контракт;
- следующей задачей назначена `R0-02`.

### 2026-08-01 — R0-04 — DONE

Что сделано:

- README содержит заметный указатель на новый roadmap и worklog;
- активный roadmap ссылается на журнал исполнения;
- старый `REFACTOR_TRACKER.md` явно помечен как исторический;
- определены критерии `DONE`, порядок публикации и инструкция для handoff;
- следующей задачей назначена `R0-01`.

Acceptance evidence:

- все ссылки используют существующие файлы репозитория;
- в активном статусе нет взаимоисключающих задач;
- Markdown проходит `git diff --check`.

## Шаблон записи следующей задачи

```markdown
### YYYY-MM-DD — Rn-nn — DONE | BLOCKED

Что сделано:
- ...

Изменённые области:
- `path/to/file`

Проверки:
- `command` — результат

Acceptance evidence:
- ...

Следующая задача:
- `Rn-nn` — ...
```
