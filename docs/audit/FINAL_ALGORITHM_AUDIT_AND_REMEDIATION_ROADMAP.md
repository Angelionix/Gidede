# Gidede — итоговый аудит алгоритмов и roadmap исправлений

**Дата аудита:** 2026-08-01
**Ветка:** `nextjs-port`
**Коммит:** `694711092e514ae36480f9ca720c190a5a6c8212`
**Объект:** фактическая реализация `src/app/api/v1`, `src/lib`, Prisma-модель, тесты и документы проекта
**Основание:** сверка двух независимых аудитов с повторной проверкой спорных выводов по исходному коду

---

## 1. Итоговое заключение

Концепция Gidede жизнеспособна и потенциально ценна: приложение может заметно сократить путь от сырой идеи до структурированного набора гипотез, прототипа и живого дизайн-документа. Сильная сторона продукта — сочетание предметной структуры геймдизайна, детерминированных расчётов, MechanicsDB, прототипирования и опционального LLM-обогащения.

Главная проблема текущей реализации — разрыв между заявленным назначением и фактической доказательной силой результатов. Система хорошо генерирует структурированные черновики, но часто представляет шаблоны, lookup-эвристики и синтетические симуляции как проверку жизнеспособности игры.

Оценка текущего состояния:

| Область | Оценка | Комментарий |
|---|---:|---|
| Ценность продуктовой концепции | 8/10 | Проблема и целевая аудитория выбраны удачно |
| Генерация черновиков и вариантов | 6/10 | Уже полезна при ручной редактуре |
| Сквозная связность пайплайна | 2/10 | Стадии в значительной степени работают на разрозненных данных |
| Достоверность алгоритмических оценок | 3/10 | Много self-fulfilling и template-derived метрик |
| Пригодность для решения `go / iterate / stop` | 2/10 | Нет обязательного прототипного и плейтест-гейта |
| Готовность к полноценному GDD | 4/10 | Есть сборщик, но нет подтверждённого design state |

Продукт следует позиционировать не как «AI доказал, что концепция хорошая», а как систему управления дизайн-гипотезами:

```text
идея
  → несколько концепт-вариантов
  → выбранная гипотеза core loop
  → исполняемый прототип
  → плейтест и наблюдаемые метрики
  → решение go / iterate / stop
  → MDA, баланс, прогрессия и экономика
  → живой GDD с происхождением данных
```

Сейчас фактическая схема ближе к:

```text
текст
  → шаблонные JSON-артефакты
  → наличие строк в БД
  → completion до 100%
  → GDD, содержащий шаблоны и TBD
```

---

## 2. Сверка второго аудита

Второй аудит содержит существенные и полезные дополнения. Большинство его ключевых находок подтверждено повторным чтением кода.

### 2.1 Подтверждённые дополнения

1. `format: "full"` принимается pipeline runner, но GDD endpoint ожидает `full_gdd`.
2. Шесть новых Bible-чеков создают issues, но не участвуют в формуле readiness.
3. Economy AI вызывается после сохранения `fullProfile`, поэтому `ai_insights` теряется после перезагрузки.
4. `overallBalanceScore` равен stability index и не агрегирует transitive, dominance и Monte Carlo verdict.
5. В Balance нарушены скобки в `buildGap`.
6. Balance Machinations строит граф, но симулирует отдельный HP-распад, а не этот граф.
7. Контракты Concept → Core Loop → MDA → Balance → Progression/Economy разорваны.
8. Triangle of Weirdness гарантируется hardcoded USP-флагами.
9. Кириллические keywords не работают с текущим `\b` в JavaScript regex.
10. Core Loop может построить steps одного типа и классифицировать их как другой тип.
11. Дефолтный Engine создаёт 4 positive steps из 5 без braking и обнаруживает Runaway в собственном шаблоне.
12. Дефолтный Puzzle не содержит hint/reset/undo и поэтому обнаруживает critical Stuck State.
13. MDA возвращает `iterations = 3`, не выполняя итеративного изменения mechanics.
14. Bond matrix и часть Shell lens scores являются шаблонными.
15. Economy `producingFlows` ошибочно считает некоторые исходящие потоки производящими ресурс.
16. RAG существует только как самостоятельный search endpoint и не включён в LLM prompts.
17. AI-клиент не имеет timeout, retry policy и сброса permanent init failure.
18. Метка `glm-4.6` не подтверждается параметром `model` в запросе SDK.
19. GDD помечает шаблонный контент как `ai_generate`, не вызывая LLM для этих секций.
20. Rolling/Morris и Bond заявляют полные 7-point проверки, хотя часть пунктов представлена только комментариями.

### 2.2 Исправления и уточнения

| Утверждение второго аудита | Итог проверки |
|---|---|
| Ошибка скобок `buildGap` есть и в Economy | Не подтверждено. В текущем Economy используется `Math.abs(runawayFreq - stallFreq) / 2`. Ошибка осталась только в Balance |
| Markov matrix может иметь `rowSum > 1` | Не подтверждено. `faceProb = 1/n`, число переходов `n-1`, `lossProb ≤ 1`; сумма вне диагонали меньше 1 |
| При GDD 422 отчёт показывает `8/8 completed` | Неточно. Стадия отмечается `skipped`, completed count уменьшается. Но весь pipeline всё равно возвращает `ok: true`, что остаётся дефектом |
| Balance Monte Carlo — полноценная реальная симуляция | Только частично. 200 RNG-итераций выполняются, но они семплируют синтетическую payoff matrix, а не игровые правила |
| Progression perceived difficulty — полноценная реальная модель | Завышенная оценка. Формула исполняется, но её компоненты синтетически выводятся из номера уровня, а не из encounters или playtest telemetry |
| Economy Machinations — реальная модель | Структура node/edge существует, но потоковая модель сама сгенерирована из жанрового пресета и фактически не исполняется как граф |
| Экранирование текста решит prompt injection | Недостаточно. Нужны trust boundaries, отдельные structured fields, instruction hierarchy и schema validation |
| `format: full` ломает основной UI-сценарий | Ошибка API реальна, но текущий `/pipeline` UI отправляет `one_sheet`; severity — высокая для API/full GDD, но не глобальная недоступность пайплайна |

Общий вывод по второму аудиту: примерно 80–85% технических наблюдений полезны и подтверждены. Его сильная сторона — более глубокое чтение AI/RAG и отдельных математических функций. Слабая — местами завышенная серьёзность и смешение «формула исполняется» с «модель валидна для геймдизайна».

---

## 3. Критические сквозные дефекты

### C-01. Pipeline не использует результаты предыдущих стадий

`STAGES[].buildBody()` работает с одним исходным `PipelineInput`. HTTP response стадии не разбирается и не превращается во вход следующей стадии.

Следствия:

- Concept mechanic set отбрасывается;
- Core Loop получает keyword-derived `explore/combat/reward`;
- genre и primary aesthetic не передаются в Core Loop;
- MDA не получает выбранные Core Loop mechanics;
- Balance получает hardcoded объекты по исходному genre;
- Progression игнорирует Balance curves;
- Economy игнорирует Core Loop resource flow и Progression economy link.

### C-02. UI запускает pipeline с фиктивной идеей

`/pipeline` отправляет строку `Сгенерировать концепцию из данных проекта`, а не описание проекта или введённую пользователем идею. Русская строка не распознаётся англоязычным genre classifier и mechanics derivation.

### C-03. Нет quality gates и корректного статуса прогона

- любая `2xx` стадия считается completed независимо от внутренних scores;
- только ошибка Concept фатальна;
- `422` считается skipped и выполнение продолжается;
- общий результат возвращает `ok: true` при downstream errors;
- project version увеличивается даже при частичном прогоне;
- старые записи могут сохранить высокий completion после неудачного нового прогона.

### C-04. Completion измеряет наличие строк, а не готовность

`completionPercent` начисляется за существование Prisma sub-record. Не проверяются:

- версия upstream;
- stale state;
- validation result;
- review/acceptance;
- наличие прототипа;
- результат плейтеста;
- critical issues.

### C-05. Прототип и плейтест исключены из продуктового decision loop

Генерация прототипа и сохранение playtest существуют, но не влияют на Core Loop status, readiness и возможность перейти к GDD. В результате система способна «завершить» дизайн игры, базовая механика которой никогда не проверялась игроком.

### C-06. Научные термины используются для эвристик без provenance

Поля `nash_equilibrium`, `monte_carlo`, `machinations`, `fun_check`, `market_fit`, `iterations_done` и часть `models_used` выглядят как результаты строгого анализа, хотя некоторые из них являются lookup, hash, шаблоном или одним проходом формулы.

Принцип исправления: либо реализовать заявленный метод, либо честно переименовать результат и вернуть `method`, `assumptions`, `confidence`, `evidence`.

---

## 4. Поэтапный аудит

## 4.1 Concept — 5/10

### Что работает

- input validation для idea, genre и ограничений;
- multi-genre выборка из MechanicsDB;
- детерминированный результат;
- исключение forbidden mechanics;
- формирование нескольких core loop и USP candidates;
- AI enrichment выполняется до persist.

### Проблемы

- `inferGenres()` использует английский substring matching: возможны ложные совпадения вроде `history → story`;
- `pickAesthetics()` содержит русские keywords, но `\b` не образует корректные Unicode word boundaries;
- два из трёх USP безусловно получают Triangle `pass`, поэтому weirdness всегда true;
- Triangle может пройти только за weirdness без appealing и credible;
- novelty повышается от самоописаний `unique/novel`;
- feasibility не использует `team_size`, budget, platforms и технические constraints;
- audience fit не использует фактическую target audience;
- market fit — статическая таблица жанров без evidence и confidence;
- long-term goal выводится из количества mechanics;
- sustainability выводится из keywords и cross-genre;
- synergy scores `0.85/0.72` захардкожены;
- cross-genre mechanics добавляются минимум в количестве 1 даже при нулевом ratio;
- compatibility штрафует сознательно добавленные cross-genre mechanics;
- новая mechanics taxonomy существует, но не включена в основной generator flow.

### Требуемая модель

Concept должен генерировать несколько гипотез, показывать основания классификации, отдельно оценивать scope и не выдавать market/novelty score без внешних данных или явного статуса `heuristic`.

## 4.2 Core Loop — 4/10

### Что работает

- семь template builders;
- структурированный список steps и resources;
- подсчёт pathologies и resource sufficiency;
- классификация structural type;
- детерминированные рекомендации.

### Проблемы

- pipeline не передаёт Concept mechanics и genre;
- steps строятся по `loopType`, после чего другой классификатор может присвоить иной `structuralType`;
- custom steps получают ресурсы по позиции, а не по смыслу;
- chain integrity считает пустой output/input валидной связью;
- линейная chain может быть названа closed без проверки last → first;
- `has_conflict` означает любой negative feedback или consumption;
- `has_goal` означает наличие positive feedback;
- fun check зависит только от числа positive steps и длины 3–7;
- Engine template сам порождает critical Runaway;
- Puzzle template сам порождает critical Stuck State;
- hybrid subtype выбирается по чётности числа mechanics;
- outer/meta loops одинаковы для всех игр;
- иерархия добавляет quests, final boss, New Game+, daily challenges и leaderboard независимо от концепции.

## 4.3 MDA — 4/10

### Что работает

- MDA загружает genre/idea/aesthetics из Concept;
- поддерживает pipeline alias `target_aesthetics`;
- mechanics mapping детерминирован;
- вычисляется покрытие целевых dynamics;
- AI enrichment сохраняется.

### Проблемы

- Reverse MDA — статический union двух lookup-таблиц;
- Classic MDA не симулирует player/system state;
- `iterations = 3` не сопровождается тремя изменениями mechanic set;
- gameplay sequence и feedback loops шаблонны;
- Adams/Dormans patterns проверяют размеры групп, а не системные паттерны;
- aesthetic coverage и Classic MDA используют разные пути подсчёта;
- lens #41 выводится из общего synergy score, а не payoff/dominance;
- interest lenses зависят от `lens.id % 3`;
- Bond matrix почти полностью hardcoded;
- Bond dissonances всегда пусты;
- row/column consistency являются преобразованиями одного compatibility score;
- ludonarrative harmony выводится из mechanic compatibility, а не из narrative-mechanic pairs;
- Machinations model связывает canned feedback loops с первыми тремя mechanics.

## 4.4 Balance — 2/10

### Что работает

- deterministic PRNG;
- 200 повторов matchup sampling;
- transitive/intransitive разделы;
- поиск strict dominance;
- persistence и AI enrichment;
- набор pathology detectors.

### Проблемы

- pipeline анализирует hardcoded RPG/shooter/strategy/fighting objects;
- numeric attributes и уникальность IDs фактически не валидируются, несмотря на комментарий;
- атрибуты с разными единицами суммируются без нормализации;
- transitive и intransitive используют разные определения power;
- type modifiers слишком узкие и строковые;
- uniform over non-dominated strategies не является общим Nash solver;
- Gini измеряет искусственно созданное uniform distribution;
- RPS detector перебирает только соседние тройки и останавливается на первой;
- situational/Q-factor значения зависят от имени/hash;
- MC семплирует ту же эвристическую payoff matrix;
- seed зависит только от project ID, а не от версии input objects;
- Machinations graph не исполняется;
- `runs: 10` не соответствует одному выполненному simulation pass;
- stall condition практически недостижима, потому что `rMax` начинается с полного HP;
- в `buildGap` неверны скобки;
- `overallBalanceScore = stability`, поэтому OP/UP, dominance и MC verdict не определяют общий score;
- dedicated `pathologies` column хранит legacy subset, а новые результаты остаются только в `fullResult`.

## 4.5 Progression — 4/10

### Что работает

- детерминированный curve builder;
- несколько типов кривых;
- tier model и transition map;
- проверки XP growth, empty levels, unlock gaps и cost/power ratio;
- genre-specific economy link;
- AI enrichment сохраняется.

### Проблемы

- pipeline отправляет `total_levels`, endpoint читает `target_levels`, поэтому используется default 50;
- BalanceResult загружается, но не участвует в cost/power curves;
- `transitions_per_hour = levels / hours * 60` имеет неверную размерность;
- content stages, enemies, rewards и abilities выводятся из числа уровней по константам;
- unlock tree универсален для любых жанров;
- perceived difficulty components выводятся только из level ratio и tier index;
- grind recommendation меняет параметры в сторону роста `hoursPerLevel`;
- `progression_defined`, `economic_phases_defined`, `no_deadlock` и `no_stall` инициализируются true и не вычисляются;
- нет calibration по session length, failure rate и playtest telemetry.

## 4.6 Economy — 2/10

### Что работает

- детерминированный resource inventory;
- node/edge структура;
- faucet/drain, pathologies и corrections;
- reproducible PRNG;
- persistence результатов.

### Проблемы

- экономика строится из genre preset, а не Core Loop/Progression;
- catalytic/consumable roles назначаются по индексу;
- meta resources не создаются, поэтому часть classification branches недостижима;
- возможен duplicate `gems`;
- declared feedback loops не соответствуют фактическим graph edges;
- `f.resource === r.name` считает outbound flow производством ресурса;
- profitability опирается на initial values, которые сама система только что назначила;
- conversion graph и Machinations graph формируют разные представления потоков;
- симулируются независимые значения ресурсов, а не graph transactions;
- `num_runs: 10` декларируется без десяти прогонов;
- нет player agents, событий, policies, sensitivity analysis и confidence intervals;
- AI enrichment выполняется после persist и не сохраняется в `fullProfile`;
- любой pathology, включая info, устанавливает `hasPathology = true`.

## 4.7 GDD — 4/10

### Что работает

- несколько форматов;
- сбор данных из upstream tables;
- section catalogue;
- consistency report;
- экспортные структуры;
- general AI insights сохраняются.

### Проблемы

- pipeline разрешает `full`, GDD разрешает `full_gdd`;
- `generate-full` является отдельным упрощённым stub и не вызывает основной generator;
- множество deterministic templates помечено `ai_generate`;
- per-section LLM generation отсутствует;
- placeholder/TBD считается filled section;
- `stages_completed` включает assembly независимо от review status;
- production dates, platforms, tech stack и content volumes выводятся из жанровых констант;
- отсутствует provenance `section → source artifact/version`;
- нет invalidation после изменения upstream;
- небезопасный `JSON.parse` в live_ops способен завершить весь request ошибкой;
- completeness не требует accepted playtest.

## 4.8 Checklist — 2/10

### Что работает

- единый canonical endpoint;
- агрегация issues и remediation plan;
- набор legacy и Bible checks;
- persistence результата.

### Проблемы

- overall readiness — среднее только MDA, Balance, Narrative, Economy и Lenses;
- Progression не участвует в score;
- шесть новых Bible checks не влияют на readiness;
- skipped Economy/Lenses дают нейтральные 0.5;
- critical issues не являются hard gate для `ready`;
- OK-check добавляет info issue; затем непустой issues list снижает score;
- Shell filters в основном проверяют наличие ранее созданных оценок;
- Upton зависит от слабых Core Loop proxy checks;
- Rolling/Morris пункты 4 и 5 не реализованы;
- Bond пункты 5 и 6 не реализованы;
- remediation effort определяется только severity;
- prototype/playtest отсутствуют;
- freshness upstream отсутствует.

---

## 5. AI, универсальные LLM-router API и RAG

## 5.1 Текущее состояние

LLM слой напрямую импортирует `z-ai-web-dev-sdk`. Provider и model hardcoded в status/chat metadata, при этом model не передаётся в `chat.completions.create()`.

Основные риски:

- нельзя подключить другой router без изменения кода;
- нет timeout и AbortController;
- нет retry/backoff;
- один transient `ZAI.create()` failure кэшируется до рестарта процесса;
- нет capability negotiation;
- нет schema validation структурированных ответов;
- нет per-stage routing и fallback chain;
- нет централизованного usage/cost/latency log;
- RAG search не вызывается AI service;
- пользовательский контент смешан с instructions без явных trust boundaries.

## 5.2 Целевая архитектура

Нельзя гарантировать поддержку буквально любого API одним фиксированным JSON-форматом. Поэтому необходимы три уровня адаптации:

1. `OpenAICompatibleAdapter` — подключение router через UI без изменения кода.
2. `GenericHttpAdapter` — декларативный mapping request/response/SSE для нестандартного API.
3. `CustomProviderAdapter` — TypeScript plugin для API со сложной авторизацией или протоколом.

Базовый контракт:

```ts
interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
  stream(request: LlmRequest, onDelta: (delta: string) => void): Promise<LlmResponse>;
  completeStructured<T>(request: LlmRequest, schema: Schema<T>): Promise<T>;
  healthCheck(): Promise<ProviderHealth>;
  listModels(): Promise<ModelDescriptor[]>;
  capabilities(): ProviderCapabilities;
}
```

Сущности конфигурации:

```text
LlmProviderConfig
  id, ownerId, name, adapterType, baseUrl
  encryptedApiKey | secretRef
  encryptedHeaders
  defaultModel
  timeoutMs, retryPolicy
  capabilities
  enabled

LlmRoutePolicy
  projectId?, stage, taskType
  primaryProviderId, model
  fallbackChain
  temperature, maxOutputTokens

LlmCallLog
  providerId, model, stage, latencyMs
  inputTokens?, outputTokens?, estimatedCost?
  status, errorClass, traceId
```

Обязательные свойства:

- API key никогда не отправляется браузеру и не пишется в log;
- значения в UI маскируются;
- health-check и test connection;
- streaming и non-streaming;
- JSON schema validation с ограниченным repair retry;
- timeout, retry/backoff и circuit breaker;
- fallback только для классифицированных transient errors;
- provider/model выбираются по project и pipeline stage;
- алгоритмические scores не выставляются LLM напрямую;
- prompts отделены от provider adapters;
- retrieved Bible context содержит source IDs и ограниченный размер;
- все metadata отражают фактически использованный provider/model.

## 5.3 Роль LLM в алгоритмах

LLM разрешено:

- извлекать структуру из идеи;
- предлагать несколько альтернатив;
- объяснять deterministic diagnostics;
- генерировать текстовые секции с обязательным review;
- формировать тестовые гипотезы;
- связывать релевантные Bible sources.

LLM не должно:

- без evidence выставлять market fit, feasibility или fun score;
- объявлять концепт готовым;
- заменять Nash/Monte Carlo/Machinations вычисления текстовым ответом;
- автоматически пропускать quality gate;
- скрывать provider/model/fallback от пользователя.

---

## 6. Тесты и доказательства корректности

В репозитории найдено 11 test-файлов и 279 test cases. Это заметное улучшение, но тесты сосредоточены на isolated helpers:

- Concept validation;
- MechanicsDB/taxonomy;
- Core Loop classification, steps, validation и pathologies;
- MDA constants;
- Balance pathology helper.

Не покрыты автоматическими integration/contract tests:

- full pipeline;
- фактическая передача артефактов между stages;
- Progression route;
- Economy route;
- GDD route;
- Checklist readiness;
- prototype → playtest → gate;
- LLM provider fallback;
- RAG injection;
- stale propagation.

Дополнительные проблемы:

- в `package.json` нет `test` script;
- coverage threshold не задан;
- `test_projects` относятся к старой реализации;
- старый `AUDIT_REPORT.md` анализирует commit `b55ec7e`;
- `REFACTOR_TRACKER.md` заявляет 148/148, но внутри содержит TODO;
- комментарии `TASK ... FIXED` часто описывают намерение, а не подтверждённое поведение.

Для алгоритмических модулей unit test должен проверять не только текущую реализацию, но и domain invariant. Например, тест `Nash sums to 1` недостаточен: нужно проверить, что найденная стратегия является best response equilibrium для заданной payoff matrix.

---

## 7. Roadmap устранения замечаний

Оценки предполагают одного опытного full-stack разработчика. При параллельной работе backend/domain, frontend и QA календарный срок сокращается, но зависимости фаз сохраняются.

## Фаза 0. Baseline и честная терминология — 2–4 дня

| ID | Задача | Результат | Критерий приёмки |
|---|---|---|---|
| R0-01 | Зафиксировать golden fixtures для 6 контрастных жанров и RU/EN идей | Воспроизводимый baseline | Fixtures содержат inputs, expected invariants и artifact versions |
| R0-02 | Добавить `test`, `test:coverage`, `typecheck` scripts | Единый запуск проверок | Команды работают в clean checkout |
| R0-03 | Ввести taxonomy методов: `template`, `heuristic`, `simulation`, `solver`, `playtest_evidence`, `llm_generated` | Честная metadata | Каждый score содержит method и assumptions |
| R0-04 | Обновить audit tracker | Один источник статуса | DONE ставится только при code + tests + acceptance evidence |

## Фаза 1. Контракты и оркестратор — 1–2 недели — P0

| ID | Задача | Зависимость | Критерий приёмки |
|---|---|---|---|
| R1-01 | Создать versioned Zod schema для input/output каждой стадии | R0 | Invalid payload не сохраняется |
| R1-02 | Ввести `ArtifactEnvelope` с `artifactId`, `schemaVersion`, `upstreamVersions`, `inputHash`, `status` | R1-01 | Любой результат трассируется до входов |
| R1-03 | Переписать runner: stage output → next stage input | R1-01 | Contract test доказывает передачу выбранных mechanics и genre |
| R1-04 | Загружать реальную project idea/description; убрать фиктивную строку UI | — | RU и EN идея доходят до Concept без подмены |
| R1-05 | Нормализовать aliases `full → full_gdd`, `total_levels → target_levels` | R1-01 | Full GDD и заданное число уровней проходят E2E |
| R1-06 | Ввести statuses `success`, `partial`, `failed`, `blocked`, `needs_review` | R1-02 | Downstream error не возвращает `ok: true` |
| R1-07 | Реализовать stage quality gates и stop/resume | R1-06 | Pipeline останавливается на critical gate и возобновляется после исправления |
| R1-08 | Реализовать stale propagation по dependency graph | R1-02 | Изменение Concept инвалидирует зависимые артефакты |
| R1-09 | Completion считать по accepted/non-stale artifacts | R1-07, R1-08 | Наличие старой DB row не даёт completion |
| R1-10 | Version increment только для согласованного сохранённого run | R1-06 | Partial failure не маскируется новой версией проекта |

## Фаза 2. Core hypothesis → Prototype → Playtest — 1–2 недели — P0

| ID | Задача | Зависимость | Критерий приёмки |
|---|---|---|---|
| R2-01 | Передавать selected Concept mechanics/genre/aesthetic в Core Loop | R1-03 | Нет fallback `explore/combat/reward`, если Concept заполнен |
| R2-02 | Сначала определить structural type, затем строить steps | R2-01 | Step template и classified type совпадают |
| R2-03 | Заменить closure proxy на directed resource/state graph | R2-02 | Closed только при достижимом пути last → first |
| R2-04 | Исправить self-failing Engine/Puzzle templates | R2-02 | Default templates не создают неизбежный critical |
| R2-05 | Убрать вычисляемый `fun`; создать `fun_hypothesis` и test protocol | R2-03 | Fun status до playtest = `unverified` |
| R2-06 | Связать generated prototype с artifact versions | R2-05 | Прототип знает, какой Core Loop он проверяет |
| R2-07 | Расширить PlaytestResult: hypothesis, cohort, completion, confusion, retry, notes | R2-06 | Доступны агрегаты по версии прототипа |
| R2-08 | Добавить decision gate `go / iterate / stop / insufficient_data` | R2-07 | GDD нельзя принять без решения или явного override с причиной |

## Фаза 3. Универсальный LLM router и RAG — 1–2 недели — P0/P1

| ID | Задача | Зависимость | Критерий приёмки |
|---|---|---|---|
| R3-01 | Выделить `LlmClient` и provider registry | — | `ai-service` не импортирует конкретный SDK |
| R3-02 | Реализовать OpenAI-compatible adapter | R3-01 | Новый router подключается через UI без изменения кода |
| R3-03 | Реализовать Generic HTTP mapping и Custom adapter SPI | R3-01 | Нестандартный API подключается декларативно или одним plugin adapter |
| R3-04 | Добавить encrypted secrets/server secret references | R3-01 | Ключи отсутствуют в client payload, DB plaintext и logs |
| R3-05 | Добавить timeout, retry/backoff, TTL/circuit breaker | R3-01 | Transient init failure восстанавливается без рестарта |
| R3-06 | Добавить capability negotiation и model discovery | R3-02 | UI показывает поддерживаемые streaming/JSON/tools capabilities |
| R3-07 | Добавить per-stage routing и fallback chain | R3-05 | Concept и GDD могут использовать разные providers/models |
| R3-08 | Валидировать structured output схемой | R3-01 | Invalid JSON не попадает в domain state |
| R3-09 | Подключить Bible RAG к prompt builder | R3-01 | Ответ содержит использованные source IDs |
| R3-10 | Добавить call telemetry | R3-07 | Видны provider, фактическая model, latency, tokens и error class |
| R3-11 | Мигрировать ZAI как один из adapters | R3-02 | Текущее поведение доступно через общий контракт |

## Фаза 4. Concept и MDA — 2–3 недели — P1

| ID | Задача | Критерий приёмки |
|---|---|---|
| R4-01 | Unicode tokenization/`Intl.Segmenter` для RU/EN | Русские genre/aesthetic/core verbs распознаются unit tests |
| R4-02 | Word-level genre classifier с evidence | Нет substring false positives |
| R4-03 | Feasibility из team/budget/platform/scope | Изменение constraints изменяет feasibility объяснимо |
| R4-04 | Разделить market evidence и heuristic prior | Без данных нет псевдоточного market score |
| R4-05 | Генерировать USP candidates без hardcoded Triangle result | Triangle зависит от фактических свойств кандидата |
| R4-06 | Исправить mechanics affinity/cross-genre scoring | Intentional hybrid не штрафуется автоматически |
| R4-07 | Унифицировать mechanic namespace и taxonomy | Concept/Core/MDA используют одни IDs |
| R4-08 | Реализовать реальную MDA iteration loop | Каждая iteration меняет candidate set и сохраняет diff |
| R4-09 | Lens #41 получать из Balance dominance evidence | Нет вывода dominance из synergy proxy |
| R4-10 | Bond matrix строить из artifact evidence | Dissonance создаётся из конкретной несовместимой пары |

## Фаза 5. Balance, Progression и Economy — 3–5 недель — P1

| ID | Задача | Критерий приёмки |
|---|---|---|
| R5-01 | Ввести typed units и нормализацию Balance attributes | Несопоставимые units нельзя молча суммировать |
| R5-02 | Строить balance objects из MDA/Core domain model | Hardcoded genre objects используются только как explicit demo fixtures |
| R5-03 | Валидировать finite numeric attributes и unique IDs | NaN/string/duplicate возвращают 422 |
| R5-04 | Реализовать корректный solver для поддерживаемого класса игр или честно переименовать поле | Поле `nash_equilibrium` проходит mathematical fixtures |
| R5-05 | Перебирать все RPS cycles | Несоседний цикл обнаруживается |
| R5-06 | Seed = hash(project + canonical input + simulation version) | Изменение objects меняет seed, повтор того же input воспроизводим |
| R5-07 | Исправить Balance `buildGap`, stall и runs metadata | Метрика имеет тесты на крайние случаи |
| R5-08 | Composite overall balance score + hard sub-gates | OP/dominance/POOR verdict уменьшают score независимо от stability |
| R5-09 | Исполнять реальную combat/economy model, N runs и confidence intervals | `runs=N` соответствует N независимым прогонам |
| R5-10 | Progression потребляет Balance curves | Cost/power progression трассируется до Balance artifact |
| R5-11 | Исправить aliases, units и constant checks Progression | Все validation flags имеют вычисляющую ветку |
| R5-12 | Калибровать progression через playtest targets | Session/time-to-level/failure inputs изменяют curves |
| R5-13 | Economy строится из Core resource graph + Progression link | Нет жанрового preset при наличии upstream модели |
| R5-14 | Исправить producing flow, duplicates и classification reachability | Faucet/drain проверен graph fixtures |
| R5-15 | Исполнять Machinations graph с agents/events/policies | Diagnostics получены из исполняемого графа |
| R5-16 | Перенести Economy AI до persist | AI insight доступен после GET/reload |

## Фаза 6. GDD и финальная валидация — 1–2 недели — P1

| ID | Задача | Критерий приёмки |
|---|---|---|
| R6-01 | Удалить/делегировать stub GDD routes | Один canonical generator |
| R6-02 | Ввести source types `artifact`, `template`, `llm`, `manual`, `placeholder` | Template никогда не маркируется AI |
| R6-03 | Секция хранит source artifact/version и review status | Видно происхождение каждой формулы и утверждения |
| R6-04 | Placeholder/TBD не считается complete | filled и completeness отражают готовый контент |
| R6-05 | Автоинвалидация GDD sections | Изменение upstream помечает только зависимые sections stale |
| R6-06 | Per-section LLM generation только с review | LLM section не становится accepted автоматически |
| R6-07 | Включить все checks и Progression в readiness model | Каждый active checklist имеет вес или hard gate |
| R6-08 | `criticalIssueCount > 0` запрещает ready | Critical невозможно усреднить до ready |
| R6-09 | Missing required stage = fail/blocked, не 0.5 | Неполный проект не получает almost-ready baseline |
| R6-10 | Добавить prototype/playtest/freshness gates | Ready требует accepted evidence |
| R6-11 | Дописать или честно переименовать неполные 7-point checks | OK message соответствует выполненным пунктам |

## Фаза 7. Integration, observability и release gate — 1–2 недели

| ID | Задача | Критерий приёмки |
|---|---|---|
| R7-01 | Contract tests всех stage boundaries | Schema drift падает в CI |
| R7-02 | E2E RU/EN pipeline fixtures | Результаты различимы по жанру и входным данным |
| R7-03 | Property tests для curves/resource conservation/payoff | Проверяются invariants, а не snapshots |
| R7-04 | Statistical tests и confidence bounds | Симуляции имеют допустимые допуски |
| R7-05 | LLM adapter conformance suite | Любой adapter проходит единый набор тестов |
| R7-06 | Stale/gate/resume E2E | Изменение Concept корректно перестраивает downstream |
| R7-07 | Algorithm trace UI | Пользователь видит method, assumptions, evidence и confidence |
| R7-08 | CI thresholds | Domain ≥80%, routes/contracts ≥70%, critical E2E 100% |

---

## 8. Рекомендуемый порядок первых десяти исправлений

1. Исправить UI idea и pipeline field aliases.
2. Ввести versioned stage contracts.
3. Передавать Concept result в Core Loop и Core/MDA result дальше.
4. Исправить partial/failed status и completion semantics.
5. Подключить Prototype/Playtest decision gate.
6. Исправить Economy AI persist, faucet filter и Balance `buildGap/stall`.
7. Убрать ложный `overallBalanceScore` и fake Nash naming.
8. Сделать Checklist critical/missing/playtest hard gates.
9. Вынести универсальный LLM provider layer с timeout/retry/secrets.
10. Подключить RAG и добавить contract/E2E tests.

Этот порядок сначала восстанавливает целостность данных и честность статусов. Переписывать сложные формулы до исправления contracts нецелесообразно: иначе улучшенные алгоритмы продолжат получать синтетические или устаревшие входы.

---

## 9. Definition of Done для алгоритмического этапа

Этап считается завершённым только если выполнены все условия:

1. Есть versioned input/output schema.
2. Все upstream inputs имеют artifact IDs и versions.
3. Результат содержит method, assumptions, evidence и confidence.
4. Ошибочный или неполный input не сохраняется как completed.
5. Есть unit tests domain invariants.
6. Есть contract test с предыдущей и следующей стадией.
7. Есть минимум один positive и один adversarial fixture.
8. Если используется simulation, указаны seed, version, runs и uncertainty.
9. Если используется LLM, указан фактический provider/model и schema validation.
10. Downstream stale propagation проверена.
11. Документация соответствует фактическому коду.
12. Результат не объявляет субъективное свойство подтверждённым без playtest evidence.

---

## 10. Финальный вывод

Рефакторинг между `b55ec7e` и `6947110` действительно устранил ряд старых дефектов: MechanicsDB стала полезнее, появились модульные Core Loop проверки, детерминированный PRNG, расширенные GDD/checklists и unit tests. Однако закрытие отдельных task IDs не устранило главный системный риск — стадии всё ещё не образуют единый доказательный design loop.

Наиболее важная продуктовая корректировка: Gidede должна помогать не «дописать все блоки до 100%», а уменьшать неопределённость. Каждый этап обязан отвечать на три вопроса:

1. Какая гипотеза проверяется?
2. Какими данными она подтверждена или опровергнута?
3. Какое следующее решение разрешено: продолжить, итерировать, остановиться или собрать больше данных?

После внедрения artifact contracts, prototype/playtest gates, честной algorithm metadata и provider-agnostic LLM слоя текущая архитектура сможет стать прочной основой продукта, а не только генератором хорошо оформленных черновиков.
