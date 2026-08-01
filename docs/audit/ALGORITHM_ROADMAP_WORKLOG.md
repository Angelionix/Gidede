# Gidede — worklog нового алгоритмического roadmap

**Активный план:** [`FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md`](FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md)
**Рабочая ветка:** `nextjs-port`
**Начало исполнения:** 2026-08-01
**Последнее обновление:** 2026-08-01

Этот файл — единственный источник текущего статуса работ по новому алгоритмическому roadmap.
Старые планы и `REFACTOR_TRACKER.md` сохранены как история и не используются для определения
готовности этапов.

## Точка продолжения

- **Следующая задача:** `R2-02` — сначала определять structural type, затем строить steps.
- **Зависимости:** `R2-01` завершена; Core Loop получает mechanics/genre/aesthetic из сохранённого Concept без generic fallback.
- **Ожидаемый результат:** step template выбирается по фактически классифицированному structural type, а не по предварительному genre-default.
- **После неё:** `R2-03` — заменить closure proxy на directed resource/state graph.

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
| R2-02 | TODO | Structural type определяется до построения steps | — |
| R2-03…R7 | TODO | См. активный roadmap | — |

## История выполнения

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
