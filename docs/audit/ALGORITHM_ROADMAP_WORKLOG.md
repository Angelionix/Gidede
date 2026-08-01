# Gidede — worklog нового алгоритмического roadmap

**Активный план:** [`FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md`](FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md)
**Рабочая ветка:** `nextjs-port`
**Начало исполнения:** 2026-08-01
**Последнее обновление:** 2026-08-01

Этот файл — единственный источник текущего статуса работ по новому алгоритмическому roadmap.
Старые планы и `REFACTOR_TRACKER.md` сохранены как история и не используются для определения
готовности этапов.

## Точка продолжения

- **Следующая задача:** `R1-05` — нормализовать aliases формата GDD и количества уровней.
- **Зависимости:** `R1-04` завершена; full и partial runners используют реальные данные проекта и `PipelineContext`.
- **Ожидаемый результат:** `full`/`full_gdd` и `total_levels`/`target_levels` имеют единое каноническое представление и проходят E2E.
- **После неё:** `R1-06` — ввести честные статусы выполнения пайплайна.

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
| R1-05 | TODO | Aliases `full`/`full_gdd`, `total_levels`/`target_levels` | — |
| R1-06 | TODO | Статусы success/partial/failed/blocked/needs_review | — |
| R1-07 | TODO | Quality gates и stop/resume | — |
| R1-08 | TODO | Stale propagation | — |
| R1-09 | TODO | Completion по accepted/non-stale artifacts | — |
| R1-10 | TODO | Version increment только для согласованного run | — |
| R2…R7 | TODO | См. активный roadmap | — |

## История выполнения

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
