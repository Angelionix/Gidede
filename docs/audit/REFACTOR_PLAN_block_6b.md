# Рефакторинг Блока 6b — Чек-лист валидации (Universal Design Validator)

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-6b (sub-agent)
**Связанные документы**:
- `docs/audit/AUDIT_REPORT.md` (раздел 6b)
- `docs/audit/REFACTOR_PLAN_block_6.md` (TASK-6.6, TASK-6.8 — поглощаются этим планом)
- `docs/bible/bible_2_11_gdd_templates_checklists.md` (разделы 11.4–11.6)
- `docs/bible/bible_2_6_economy_progression.md` (раздел 6.13.4 — 12-point checklist)
- `docs/bible/bible_2_5_balance.md` (Q-фактор, SPS, золотое правило)

**Объект рефакторинга**:
- `src/app/api/v1/gdd/checklist/route.ts` (121 строка — STUB)
- `src/app/api/v1/checklists/[action]/route.ts` (87 строк)
- `src/app/api/v1/checklist/[action]/route.ts` (70 строк — alias)
- `src/lib/checklist-logic.ts` (743 строки, 5 check-functions)
- `src/lib/ai-service.ts` (нет `enrichChecklist` — создать)
- `src/types/gdd.ts` (`ChecklistValidationProfile`, строки 140–177)
- `src/constants/mda.ts` (`PRIORITY_LENSES` — 9 вместо 113)
- `prisma/schema.prisma` (модель `ProjectChecklist`, строки 310–333)
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (STAGES:165–168 вызывает STUB)
- `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts` (BLOCK_STAGES:92–98 вызывает STUB)
- `scripts/run_pipeline_test.sh:144` (вызывает `/gdd/checklist`)
- `src/components/gidede/gdd/ChecklistPanel.tsx` (frontend, ожидает rich impl shape)
- `src/app/blocks/6/page.tsx:163` (frontend, вызывает `/checklist/validate`)

---

## Контекст

Блок 6b (Checklist validation, алгоритм 3.8) — финальная стадия пайплайна Gidede.
Запускает валидацию всех предыдущих блоков (1, 2, 3, 4, 5a, 5b, 6) против набора
критериев из Библии 11.5–11.6, формирует readiness score и remediation plan.

**Архитектурный конфликт**: в кодовой базе существует **две параллельные реализации**:

1. **STUB `/api/v1/gdd/checklist`** (121 строка, route.ts:25–82):
   - 5 захардкоженных проверок существования полей в БД
   - scores целые 80/0/40/70/75, overall=53 (подтверждено во всех 10 test_projects)
   - **pipeline runner (`run-full-pipeline/route.ts:166`) и test script (`run_pipeline_test.sh:144`) вызывают ИМЕННО этот endpoint**
   - response shape: `{ overall_score, readiness_level, checks: {mda_check: {passed, score, message}}, issues: [{check, severity, message}], critical_issue_count, total_issue_count }`

2. **Rich impl `/api/v1/checklists/[action]` + `/api/v1/checklist/[action]`** (87 + 70 строк):
   - вызывают `lib/checklist-logic.ts` (743 строки, 5 check-functions)
   - 15 правил вместо ~220 из Библии
   - **frontend (`blocks/6/page.tsx:163`) вызывает ИМЕННО этот endpoint**
   - response shape: `ChecklistValidationProfile` (types/gdd.ts:140–177)

**Два разных response shape**, одна Prisma-модель `ProjectChecklist`. Если
пользователь сначала запускает pipeline (STUB) → в БД пишется STUB shape, затем
кликает «Запустить валидацию» в UI (rich impl) → БД перезаписывается rich shape.
Last-write-wins → inconsistent state.

**Подтверждённые дефекты** (проверены на всех 10 test_projects):

```
test_projects/01_Shadow_Depths/08_checklist.json:
{
  "overall_score": 53,
  "readiness_level": "review",
  "checks": {
    "mda_check":      {"passed": true,  "score": 80, "message": "MDA-профиль сгенерирован"},
    "balance_check":  {"passed": false, "score": 0,  "message": "Баланс не сгенерирован"},
    "economy_check":  {"passed": false, "score": 40, "message": "Обнаружены патологии"},
    "narrative_check":{"passed": true,  "score": 70, "message": "Концепция сгенерирована"},
    "lens_check":     {"passed": true,  "score": 75, "message": "Линзы Шелла применены через MDA"}
  },
  "critical_issue_count": 0,
  "total_issue_count": 2
}
```

**10/10 test_projects байт-в-байт идентичны** (score 80/0/40/70/75, overall 53).
Root cause: STUB не зависит от входа — только от существования записей в БД.
Все 10 проектов прошли все блоки, поэтому все имеют `mdaProfile`, `concept`,
`economy` (с `hasPathology=true` → 40), но **НЕ имеют `balanceResult`**
(`04_balance.json` для всех 10 — это 422 ошибка, подтверждено в Block 4 audit).

**Bible 11.5–11.6 spec coverage** (подтверждено чтением `bible_2_11_gdd_templates_checklists.md`):

| Bible раздел | Спецификация | Реализация | Покрытие |
|--------------|--------------|------------|----------|
| 11.5.1 | 113 линз Шелла в 16 категориях | `PRIORITY_LENSES` (9 линз, mda.ts) + `runLensCheck` (только читает pre-computed) | ~8% (9/113) |
| 11.5.2 | 8 фильтров идеи Шелла | `concept/generate` (4/8 захардкожены, Block 1 plan) | 50% в concept, 0% в checklist |
| 11.5.3 | 7-point balance checklist (Rolling/Morris) | `runBalanceCheck` (4 generic checks) | 0% (0/7 Bible checks) |
| 11.5.4 | 6 эвристик Аптона | НЕ реализовано | 0% (0/6) |
| 11.5.5 | 7 методов косвенного руководства Бонд | НЕ реализовано | 0% (0/7) |
| 11.5.6 | 5 убийц удовольствия Фуллертон | НЕ реализовано | 0% (0/5) |
| 11.5.7 | 4+3 цели проектирования Бонд | НЕ реализовано | 0% (0/7) |
| 11.6.1 | 10 уровней Universal Design Validator | `checklist-logic.ts` (5 checks, levels 2/3/4/5/6 partial) | ~10% (5/80+, levels 7/9/10 absent) |
| 11.6.2 | Adaptive prioritization по жанру | hardcoded `0.3/0.3/0.3/0.1` (checklist-logic.ts:511–513) | 0% |
| 11.6.3 | 3 severity levels (🔴🟡🟢) | `error|warning|info` (соответствует) | 100% |

**Итог coverage**: ~15 правил из ~220 специфицированных (~7%).

---

## Цели рефакторинга

1. **Унифицировать endpoint валидации** — заменить STUB `/gdd/checklist` на вызов `lib/checklist-logic.ts`, удалить вторую реализацию (или алиас), обеспечить один response shape.
2. **Починить pipeline runner** — вызывать `/checklist/validate` (rich impl) вместо `/gdd/checklist` (STUB).
3. **Реализовать 113 линз Шелла** (Bible 11.5.1) — отдельная библиотека `src/lib/schell-lenses.ts`, фильтрация по жанру, не дублировать Block 3 MDA.
4. **Реализовать 8 фильтров идеи Шелла** (Bible 11.5.2) — в checklist layer как Level 1 Universal Design Validator, переиспользовать данные из concept.validationReport (после Block 1 TASK-1.4).
5. **Реализовать 6 эвристик Аптона** (Bible 11.5.4) — Level 2 Mechanics validator.
6. **Реализовать 7 методов косвенного руководства Бонд** (Bible 11.5.5) — Level 7 Level Design validator (ныне отсутствует).
7. **Реализовать 5 убийц удовольствия Фуллертон** (Bible 11.5.6) — Level 8 Experience validator.
8. **Реализовать 4+3 цели проектирования Бонд** (Bible 11.5.7) — Level 8 Experience validator.
9. **Реализовать 7-point Rolling/Morris balance checklist** (Bible 11.5.3) — расширить `runBalanceCheck` с 4 до 11 checks.
10. **Реализовать 12-point economy checklist** (Bible 6.13.4,引用 из audit 6b.5) — расширить `runEconomyCheck` с 3 до 15 checks.
11. **Реализовать 11 narrative document types validation** (Bible 11.4.1) — расширить `runNarrativeCheck` с 3 до 14 checks.
12. **Реализовать Universal Design Validator 10 уровней** (Bible 11.6.1) — новый модуль `src/lib/universal-design-validator.ts`.
13. **Реализовать adaptive prioritization по жанру** (Bible 11.6.2) — таблица жанр→приоритет уровней, динамические веса в `buildSummary`.
14. **Починить hardcoded weights и clamp baseline** — заменить `0.3/0.3/0.3/0.1` на genre-aware веса, убрать `+0.1` baseline boost (критические issues должны реально понижать score).
15. **Добавить `enrichChecklist` в ai-service.ts** — LLM-интерпретация найденных issues + remediation advice.
16. **Расширить Prisma `ProjectChecklist`** — добавить `aiInsights`, `modelsUsed`, `universalValidatorResult`, `adaptiveWeights`, `genreSnapshot` поля.
17. **Обновить types/gdd.ts** — `ChecklistValidationProfile` должен включать `universal_design_validator`, `ai_insights`, `models_used`.
18. **Динамический `stages_completed`** — вычислять из actual upstream block status, не `[1,2,3,4,5,6]` hardcoded.

---

## Задачи

### TASK-6b.1: Унифицировать endpoint `/gdd/checklist` — заменить STUB на вызов `lib/checklist-logic.ts`

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-6b.2, TASK-6b.11, TASK-6b.13, TASK-6b.15)
**Файлы**: `src/app/api/v1/gdd/checklist/route.ts` (полная переработка)

**Описание проблемы**:

`gdd/checklist/route.ts:25–82` — STUB:

```ts
// MDA check
checks.mda_check = {
  passed: !!project.mdaProfile,
  score: project.mdaProfile ? 80 : 0,
  message: project.mdaProfile ? "MDA-профиль сгенерирован" : "MDA-профиль отсутствует",
};

// Balance check
checks.balance_check = {
  passed: !!project.balanceResult && (project.balanceResult.overallBalanceScore || 0) >= 60,
  score: project.balanceResult?.overallBalanceScore || 0,
  message: project.balanceResult ? `Score: ${project.balanceResult.overallBalanceScore}%` : "Баланс не сгенерирован",
};

// Economy check
checks.economy_check = {
  passed: !!project.economy && !project.economy.hasPathology,
  score: project.economy ? (project.economy.hasPathology ? 40 : 80) : 0,
  message: project.economy ? (project.economy.hasPathology ? "Обнаружены патологии" : "Без патологий") : "Экономика не сгенерирована",
};

// Narrative check
checks.narrative_check = {
  passed: !!project.concept,
  score: project.concept ? 70 : 0,
  message: project.concept ? "Концепция сгенерирована" : "Концепция отсутствует",
};

// Lens check (Schell)
checks.lens_check = {
  passed: !!project.mdaProfile,
  score: project.mdaProfile ? 75 : 0,
  message: "Линзы Шелла применены через MDA",
};
```

Никакой реальной валидации — просто проверка существования полей в БД.
Scores целые 80/0/40/70/75 → overall=53 (round((80+0+40+70+75)/5)=53).

При этом `lib/checklist-logic.ts` (743 строки) содержит реальную валидацию:
- `runMdaCheck` — 3 правила
- `runBalanceCheck` — 4 правила
- `runNarrativeCheck` — 3 правила
- `runEconomyCheck` — 3 правила
- `runLensCheck` — 1 правило

**Pipeline runner** (`run-full-pipeline/route.ts:163–168`):
```ts
{
  stage: "validation",
  block_id: 6,
  endpoint: "/api/v1/gdd/checklist",   // ← STUB
  buildBody: () => ({}),
},
```

**Test script** (`run_pipeline_test.sh:144`):
```bash
R=$(curl -s -X POST $API/gdd/checklist \  # ← STUB
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PID\"}" \
  --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
```

**Решение**:

Полностью переписать `gdd/checklist/route.ts` — тонкая обёртка над
`runChecklistValidation`:

```ts
/**
 * POST /api/v1/gdd/checklist
 * Запуск чек-листа валидации GDD (Block 6, алгоритм 3.8).
 *
 * Тонкая обёртка над lib/checklist-logic.ts:runChecklistValidation.
 * Body: { project_id?, depth?, checklist_types?, use_ai? }
 *
 * Response: ChecklistValidationProfile (src/types/gdd.ts)
 *
 * Историческая справка: до рефакторинга это был STUB (121 строка),
 * который возвращал захардкоженные scores 80/0/40/70/75. Богатая
 * реализация в lib/checklist-logic.ts была dead code в pipeline.
 * Block 6b refactor (TASK-6b.1) заменил STUB на реальную логику.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  UNAUTH,
  SERVER_ERROR,
} from "@/lib/api-helpers";
import { runChecklistValidation } from "@/lib/checklist-logic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
    const depth = body?.depth?.toString().trim() || "standard";
    const checklistTypes = Array.isArray(body?.checklist_types)
      ? body.checklist_types.map(String)
      : undefined;
    const action = body?.action?.toString().trim() || "validate";

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;

    const project = owned.project as Parameters<typeof runChecklistValidation>[0];
    const result = await runChecklistValidation(project, action, {
      depth,
      checklistTypes,
    });

    return NextResponse.json(result.profile);
  } catch (error) {
    console.error("[gdd/checklist] error:", error);
    return SERVER_ERROR();
  }
}
```

**Type consistency**: response теперь соответствует `ChecklistValidationProfile`
(types/gdd.ts:140–177). Frontend `ChecklistPanel.tsx` (ожидает
`validation.summary.overall_score`, `validation.mda_check.overall_mda_score`
и т.д.) начнёт работать с pipeline output, а не только с ручным запуском.

**Migration note**: старый STUB shape `{ overall_score, readiness_level,
checks: {mda_check: {passed, score, message}}, issues }` НЕ будет больше
возвращаться. Если внешние потребители зависят от старого shape —
зарегистрировать в changelog. Внутри repo таких потребителей нет
(подтверждено grep по `src/`).

**Тест-кейсы**:

1. `POST /gdd/checklist` с `{project_id: P01}` (проект со всеми блоками) →
   возвращает `ChecklistValidationProfile` с `scope.active_checklists =
   ["mda", "balance", "narrative", "economy", "lenses"]`, `summary.overall_score`
   в [0, 1], `summary.readiness` в `{"ready", "almost", "not_ready"}`.
2. `POST /gdd/checklist` с `{project_id: P01, checklist_types: ["mda"]}` →
   `scope.active_checklists = ["mda"]`, `balance_check.skipped = true`,
   `narrative_check.skipped = true`.
3. `POST /gdd/checklist` без `project_id` (auto-select most recent) → 200,
   валидирует последний проект пользователя.
4. `POST /gdd/checklist` с `{project_id: "nonexistent"}` → 404.
5. **Pipeline regression**: pipeline runner вызывает `/gdd/checklist` →
   `08_checklist.json` теперь содержит `ChecklistValidationProfile` shape
   (с `scope`, `summary`, `stages_completed`), а не STUB shape.
6. **Score differentiation**: 10 test_projects с разными жанрами/concept
   теперь дают разные `overall_score` (после TASK-6b.11 adaptive prioritization).

**Риски**:

- **Frontend уже ожидает rich impl shape** — `ChecklistPanel.tsx:147` использует
  `validation.summary.overall_score`, `validation.latency_ms`. STUB этого не
  возвращал → frontend сейчас ломается на pipeline-выходе (но не на ручном
  клике). После TASK-6b.1 frontend заработает единообразно.
- **DB migration**: `ProjectChecklist.fullResults` сейчас хранит STUB shape.
  Старые записи будут несовместимы с новым shape. Митигация: `safeJsonParse`
  в consumers, документировать в changelog, опционально migration script
  для пересохранения старых записей.
- **Pipeline latency**: rich impl делает больше проверок → pipeline stage
  latency вырастет с ~5ms до ~50–100ms. Приемлемо для пайплайна.

**Dependencies**: нет (стартовая задача)

---

### TASK-6b.2: Реализовать 113 линз Шелла как библиотеку (Bible 11.5.1)

**Сложность**: XL
**Приоритет**: 🔴 (блокирует TASK-6b.6, TASK-6b.11)
**Файлы**: новый `src/lib/schell-lenses.ts`, новый `src/constants/schell-lenses.ts`

**Описание проблемы**:

Bible 11.5.1 специфицирует **113 линз Шелла в 16 категориях**:

| Категория | Линзы | Когда применять |
|-----------|-------|----------------|
| Опыт игрока | 1–3, 68–70 | Концепция |
| Удивление и мотивация | 4–8 | Идеация |
| Элементы и целостность | 9–12 | Каждая итерация |
| Идея и итерация | 13–18 | Концепция |
| Игрок и мотивация | 19–25 | Профилирование |
| Механики | 26–36 | Дизайн механик |
| Баланс | 37–53 | Балансировка |
| Головоломки | 54–58 | Дизайн головоломок |
| Интерфейс | 59–67 | UI/UX |
| Интерес и нарратив | 68–82 | Нарратив |
| Мир и персонажи | 83–91 | Дизайн мира |
| Среда и архитектура | 92–95 | Level Design |
| Социальные аспекты | 96–99 | Мультиплеер |
| Команда и процесс | 100–103 | Управление |
| Технология и бизнес | 104–109 | Производство |
| Этика | 110–113 | Ответственность |

Текущая реализация `src/constants/mda.ts:8–18` — `PRIORITY_LENSES` с **9 линзами**
(тетрада, единство, резонанс, эмерджентность, пространство действий,
треугольность, доминантная стратегия, кривая интереса, свобода vs
управляемость). Это Subset для Block 3 MDA lens validation, НЕ библиотека
для checklist layer.

`runLensCheck` (checklist-logic.ts:454–493) только читает pre-computed
`mda.lensValidation.results` (9 элементов из Block 3):

```ts
const lensVal = safeJsonParse<{
  overall_score?: number;
  results?: Array<{ lens_name?: string; score?: number; question?: string }>;
}>(mda.lensValidation, {});

if (Array.isArray(lensVal.results)) {
  for (const r of lensVal.results) {
    if (typeof r.score === "number" && r.score < 0.5) {
      issues.push({
        severity: r.score < 0.3 ? "error" : "warning",
        issue_type: "lens_low_score",
        description: `Линза «${r.lens_name || "—"}» набрала ${r.score.toFixed(2)}`,
        suggestion: `Пересмотрите: ${r.question || "—"}`,
      });
    }
  }
}
```

**104 линзы отсутствуют**. Block 3 MDA применяет только 9 priority lenses
к mechanicSet — это не полный lens audit.

**Решение**:

1. **Создать `src/constants/schell-lenses.ts`** — полный каталог 113 линз
   в 16 категориях, по 7 полей каждая:

   ```ts
   export type LensCategory =
     | "player_experience"    // 1-3, 68-70
     | "surprise_motivation"  // 4-8
     | "elements_unity"       // 9-12
     | "idea_iteration"       // 13-18
     | "player_motivation"    // 19-25
     | "mechanics"            // 26-36
     | "balance"              // 37-53
     | "puzzles"              // 54-58
     | "interface"            // 59-67
     | "interest_narrative"   // 68-82 (overlap with player_experience)
     | "world_characters"     // 83-91
     | "environment_arch"     // 92-95
     | "social"               // 96-99
     | "team_process"         // 100-103
     | "tech_business"        // 104-109
     | "ethics";              // 110-113

   export type LensSeverity = "info" | "warning" | "error";
   export type LensPhase = "concept" | "prototype" | "production" | "live";

   export interface SchellLens {
     id: number;              // 1..113
     name: string;            // e.g. "Линза опыта игрока"
     question: string;        // главный вопрос линзы
     category: LensCategory;
     phase: LensPhase;        // когда применять
     // Жанровая релевантность (Bible 11.5.1: "Линза справедливости (37)
     // критична для PvP-игр, но почти не применима к single-player puzzle")
     genre_relevance: Partial<Record<string, "low" | "medium" | "high">>;
     // Источник данных для автоматической проверки
     data_source?: "concept" | "coreloop" | "mda" | "balance" | "progression"
                 | "economy" | "gdd" | "manual";
     // Эвристика для auto-check (для AI/algorithmic lenses)
     // undefined = требует ручной оценки или LLM
     auto_check?: (data: unknown) => { passed: boolean; score: number; note?: string };
   }

   export const SCHELL_LENSES: SchellLens[] = [
     // === Опыт игрока (1-3) ===
     {
       id: 1,
       name: "Линза опыта игрока",
       question: "Какой опыт я хочу дать игроку?",
       category: "player_experience",
       phase: "concept",
       genre_relevance: { default: "high" },
       data_source: "concept",
     },
     {
       id: 2,
       name: "Линза привлекательности",
       question: "В чём суть игры, привлекающая игрока?",
       category: "player_experience",
       phase: "concept",
       genre_relevance: { default: "high" },
       data_source: "concept",
     },
     {
       id: 3,
       name: "Линза потока",
       question: "Соответствует ли сложность навыку игрока?",
       category: "player_experience",
       phase: "prototype",
       genre_relevance: {
         rpg: "high", action: "high", strategy: "high", puzzle: "high",
         rhythm: "high", racing: "medium", horror: "medium",
         narrative: "low", walking_sim: "low",
       },
       data_source: "progression",
       auto_check: (data: any) => {
         // progression.curve.perceived_difficulty_variance
         const variance = data?.curve?.perceived_difficulty_variance ?? 0;
         return {
           passed: variance < 0.3,
           score: Math.max(0, 1 - variance),
           note: variance < 0.15 ? "Стабильная кривая" : "Резкие скачки сложности",
         };
       },
     },
     // ... и так далее для всех 113
   ];

   // Lens 37 (Fairness) — пример жанрово-зависимой линзы
   {
     id: 37,
     name: "Линза справедливости",
     question: "Игра справедлива ко всем игрокам?",
     category: "balance",
     phase: "production",
     genre_relevance: {
       pvp_shooter: "high", moba: "high", fighting: "high",
       battle_royale: "high",
       rpg: "medium", strategy: "medium",
       puzzle: "low", walking_sim: "low", narrative: "low",
     },
     data_source: "balance",
     auto_check: (data: any) => {
       // balance.nash_equilibrium.uniformity > 0.8 = fair
       const uniformity = data?.nash_equilibrium?.uniformity ?? 0;
       return {
         passed: uniformity > 0.7,
         score: uniformity,
         note: uniformity > 0.7 ? "Сбалансировано" : "Несправедливые преимущества",
       };
     },
   },
   ```

2. **Создать `src/lib/schell-lenses.ts`** — функции применения линз:

   ```ts
   import { SCHELL_LENSES, SchellLens, LensCategory } from "@/constants/schell-lenses";

   export interface LensApplicationResult {
     lens_id: number;
     lens_name: string;
     category: LensCategory;
     applied: boolean;          // false = skipped due to genre_relevance=low
     skipped_reason?: "low_genre_relevance" | "no_data_source" | "manual_required";
     score: number;             // 0..1
     passed: boolean;
     note?: string;
   }

   export interface LensApplicationOptions {
     genre?: string;
     phase?: "concept" | "prototype" | "production" | "live";
     categories?: LensCategory[];   // фильтр по категориям
     data_sources?: Record<string, unknown>;  // pre-loaded data
   }

   /**
    * Выбрать релевантные линзы по жанру + фазе.
    * Bible 11.5.1: "AI должен выбирать релевантные линзы на основе жанра,
    * типа Core Loop и целевой аудитории."
    */
   export function selectRelevantLenses(opts: LensApplicationOptions): SchellLens[] {
     const genre = normalizeGenre(opts.genre);
     return SCHELL_LENSES.filter((lens) => {
       if (opts.phase && lens.phase !== opts.phase) return false;
       if (opts.categories && !opts.categories.includes(lens.category)) return false;
       const relevance = lens.genre_relevance[genre] ?? lens.genre_relevance.default ?? "medium";
       return relevance !== "low";
     });
   }

   /**
    * Применить auto-checkable линзы к данным проекта.
    * Линзы без auto_check помечаются как manual_required.
    */
   export function applyLenses(
     lenses: SchellLens[],
     data: Record<string, unknown>,
     opts: LensApplicationOptions
   ): LensApplicationResult[] {
     return lenses.map((lens) => {
       if (!lens.auto_check) {
         return {
           lens_id: lens.id,
           lens_name: lens.name,
           category: lens.category,
           applied: false,
           skipped_reason: "manual_required",
           score: 0,
           passed: false,
         };
       }
       const dataSource = lens.data_source;
       if (!dataSource || !data[dataSource]) {
         return {
           lens_id: lens.id,
           lens_name: lens.name,
           category: lens.category,
           applied: false,
           skipped_reason: "no_data_source",
           score: 0,
           passed: false,
         };
       }
       const result = lens.auto_check(data[dataSource]);
       return {
         lens_id: lens.id,
         lens_name: lens.name,
         category: lens.category,
         applied: true,
         score: result.score,
         passed: result.passed,
         note: result.note,
       };
     });
   }

   function normalizeGenre(genre?: string): string {
     if (!genre) return "default";
     return genre.toLowerCase().replace(/[\s-]/g, "_");
   }
   ```

3. **Сверить со списком Bible 11.5.1**: в спецификации указаны диапазоны
   ID (1–3, 4–8, 9–12, 13–18, 19–25, 26–36, 37–53, 54–58, 59–67, 68–82,
   83–91, 92–95, 96–99, 100–103, 104–109, 110–113). Проверить что:
   - Сумма: 3+5+4+6+7+11+17+5+9+15+9+4+4+4+6+4 = 113 ✅
   - 16 категорий ✅
   - overlaps: lens 68–70 указаны в двух категориях (player_experience
     и interest_narrative) — это нормально, в Bible указано «1–3, 68–70»
     для player_experience и «68–82» для interest_narrative. Решение:
     дублировать линзы 68–70 в обе категории через `category_secondary`.

4. **Жанровая матрица**: для каждой из 113 линз указать
   `genre_relevance` для ~10–15 жанров (`rpg`, `shooter`, `strategy`,
   `puzzle`, `racing`, `fighting`, `platformer`, `simulation`,
   `adventure`, `tower_defense`, `horror`, `roguelike`, `sandbox`,
   `metroidvania`, `rhythm`, `narrative`, `walking_sim`). Минимум
   `default: "medium"` для всех линз + явные `"high"`/`"low"` для
   жанровых специфик.

5. **Auto-check implementation**: из 113 линз ~40–50 могут быть
   проверены автоматически (имеют data_source и тривиальную эвристику).
   Остальные требуют:
   - ручной оценки дизайнера (отметить `skipped_reason: "manual_required"`)
   - или LLM-проверки через `enrichChecklist` (TASK-6b.13).

**Тест-кейсы**:

- `SCHELL_LENSES.length === 113` — ровно 113 элементов.
- `selectRelevantLenses({genre: "puzzle"})` исключает категорию `social`
  (lens 96–99) если все имеют `puzzle: "low"`.
- `selectRelevantLenses({genre: "fighting"})` включает lens 37 (Справедливость)
  с `fighting: "high"`.
- `selectRelevantLenses({phase: "concept"})` возвращает только линзы
  с `phase: "concept"` (~20–25 линз из категорий player_experience,
  surprise_motivation, idea_iteration).
- `applyLenses(lenses, {progression: {curve: {perceived_difficulty_variance: 0.5}}}, {})`
  для lens #3 (Поток) возвращает `{score: 0.5, passed: false,
  note: "Резкие скачки сложности"}`.
- `applyLenses(lenses, {}, {})` без data_sources возвращает все линзы
  с `skipped_reason: "no_data_source"`.

**Риски**:

- **Объём работы**: 113 линз × 7 полей × ~15 жанров в `genre_relevance`
  = ~12000 ячеек данных. Митигация: batch-генерация через LLM
  (z-ai-web-dev-sdk) + ручной review спорных случаев. Оценка: 2–3 дня
  чистой работы.
- **Дублирование с Block 3 MDA**: Block 3 имеет `PRIORITY_LENSES` (9
  линз). После TASK-6b.2 Block 3 должен ИМПОРТИРОВАТЬ из
  `schell-lenses.ts` subset. Митигация: `PRIORITY_LENSES = SCHELL_LENSES
  .filter(l => [9, 11, 12, 30, 31, 40, 41, 69, 74].includes(l.id))`.
- **Performance**: 113 lens checks × проект может занять ~500ms.
  Митигация: parallel execution (Promise.all для auto_check), кэш по
  genre+phase, skip low-relevance lenses.

**Dependencies**: нет (стартовая задача, может выполняться параллельно с TASK-6b.1).

---

### TASK-6b.3: Реализовать 8 фильтров идеи Шелла в checklist layer (Bible 11.5.2)

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 1 Universal Design Validator)
**Файлы**: новый `src/lib/schell-idea-filters.ts`, `src/lib/checklist-logic.ts` (runNarrativeCheck → runConceptCheck)

**Описание проблемы**:

Bible 11.5.2 специфицирует **8 фильтров идеи Шелла**:

| # | Фильтр | Ключевой вопрос | Красный флаг |
|---|--------|----------------|-------------|
| 1 | Художественное чутьё | «Нравится ли мне эта игра?» | Нет эмоциональной связи |
| 2 | Аудитория | «Подойдёт ли игра моей целевой аудитории?» | Несоответствие жанра и аудитории |
| 3 | Создание опыта | «Достаточно ли хорош дизайн игры?» | Механики не создают заявленный опыт |
| 4 | Инновации | «Достаточно ли игра инновационная?» | Клон без уникальности |
| 5 | Бизнес и маркетинг | «Будет ли игра продаваться?» | Нет рынка / перенасыщенный рынок |
| 6 | Разработка | «Технически возможно создать эту игру?» | Нереализуемо с текущими ресурсами |
| 7 | Социальный компонент | «Оправдывает ли социальная составляющая ожидания?» | Обязательный мультиплеер без аудитории |
| 8 | Плейтесты | «Нравится ли игра игрокам?» | Игрокам скучно/непонятно |

Bible: «Восемь фильтров — система, а не список: каждый фильтр влияет на
остальные.»

Текущая реализация:
- `concept/generate/route.ts` имеет `eight_filters` (см. Block 1 audit:
  4/8 захардкожены: `clarity=0.8`, `market_fit=0.6`,
  `emotional_impact=0.7`, `sustainability=0.65`).
- `concept/[id]/validate/route.ts:53–56` — STUB с 2 фильтрами:
  ```ts
  idea_filters: {
    "Triangle check": { passed: true, note: "Genre, audience, and USP are aligned" },
    "Market fit": { passed: true, note: "Genre has established audience" },
  },
  ```
- `checklist-logic.ts` — НЕ имеет concept-check функции. `runNarrativeCheck`
  проверяет только ludonarrative + USP exists + narrative_bible GDD.

**Решение**:

1. **Создать `src/lib/schell-idea-filters.ts`**:

   ```ts
   export interface IdeaFilterResult {
     filter_id: number;       // 1..8
     filter_name: string;
     key_question: string;
     passed: boolean;
     score: number;           // 0..1
     red_flag?: string;       // Bible column "Красный флаг"
     note: string;
     affected_by?: number[];  // Bible: "каждый фильтр влияет на остальные"
   }

   export interface IdeaFilterInput {
     concept: {
       genre?: string | null;
       usp?: string | null;
       target_audience?: string | null;
       primary_aesthetic?: string | null;
       mechanics: Array<{ name: string; genres: string[]; genre_affinity?: Record<string, string> }>;
       idea_text: string;
     };
     core_loop: {
       structural_type?: string;
       step_count?: number;
     };
     market_data?: {
       genre_saturation: "low" | "medium" | "high";  // по жанру
       audience_match: number;                       // 0..1
     };
     technical_constraints?: {
       team_size: number;
       budget_tier: "indie" | "aa" | "aaa";
       platform: string[];
     };
     playtest_data?: {
       enjoyment_score?: number;
       confusion_score?: number;
     };
   }

   /**
    * Применить 8 фильтров идеи Шелла к концепции.
    * Bible 11.5.2: "если идея не проходит один фильтр — модифицируй и
    * прогони через ВСЕ восемь заново."
    */
   export function runSchellIdeaFilters(input: IdeaFilterInput): {
     filters: IdeaFilterResult[];
     overall_pass: boolean;
     cycle_required: boolean;  // true если хотя бы один filter не passed
     affected_filters: number[];  // Bible: "каждый фильтр влияет на остальные"
   } {
     const filters: IdeaFilterResult[] = [];

     // Filter 1: Художественное чутьё
     // Эвристика: если primary_aesthetic задан и idea_text > 50 символов
     const f1Passed = !!input.concept.primary_aesthetic
                   && input.concept.idea_text.length > 50;
     filters.push({
       filter_id: 1,
       filter_name: "Художественное чутьё",
       key_question: "Нравится ли мне эта игра?",
       passed: f1Passed,
       score: f1Passed ? 0.8 : 0.3,
       red_flag: f1Passed ? undefined : "Нет эмоциональной связи",
       note: f1Passed
         ? "Эстетика и идея согласованы"
         : "Эстетика не задана или идея слишком короткая",
     });

     // Filter 2: Аудитория
     const audienceMatch = input.market_data?.audience_match ?? 0.5;
     const f2Passed = audienceMatch > 0.6;
     filters.push({
       filter_id: 2,
       filter_name: "Аудитория",
       key_question: "Подойдёт ли игра моей целевой аудитории?",
       passed: f2Passed,
       score: audienceMatch,
       red_flag: f2Passed ? undefined : "Несоответствие жанра и аудитории",
       note: `audience_match = ${audienceMatch.toFixed(2)}`,
       affected_by: [4, 7],  // инновации и социальный компонент влияют
     });

     // Filter 3: Создание опыта
     // Эвристика: >=3 механик с medium/high affinity для жанра
     const genre = input.concept.genre?.toLowerCase() ?? "default";
     const relevantMechanics = input.concept.mechanics.filter(
       (m) => (m.genre_affinity?.[genre] === "medium"
            || m.genre_affinity?.[genre] === "high")
            || m.genres.includes(genre)
     ).length;
     const f3Passed = relevantMechanics >= 3;
     filters.push({
       filter_id: 3,
       filter_name: "Создание опыта",
       key_question: "Достаточно ли хорош дизайн игры?",
       passed: f3Passed,
       score: Math.min(1, relevantMechanics / 5),
       red_flag: f3Passed ? undefined : "Механики не создают заявленный опыт",
       note: `${relevantMechanics} релевантных механик для жанра "${genre}"`,
       affected_by: [1, 4],
     });

     // Filter 4: Инновации
     // Эвристика: USP задан и не шаблонный
     const usp = input.concept.usp ?? "";
     const genericUspPatterns = [
       "уникальная боевая система",
       "open world",
       "procedural generation",
       "multiplayer",
     ];
     const isGeneric = genericUspPatterns.some((p) =>
       usp.toLowerCase().includes(p)
     );
     const f4Passed = usp.length > 20 && !isGeneric;
     filters.push({
       filter_id: 4,
       filter_name: "Инновации",
       key_question: "Достаточно ли игра инновационная?",
       passed: f4Passed,
       score: f4Passed ? 0.8 : isGeneric ? 0.3 : 0.5,
       red_flag: f4Passed ? undefined : "Клон без уникальности",
       note: isGeneric
         ? "USP содержит шаблонные фразы — добавьте конкретику"
         : "USP дифференцирован",
       affected_by: [2, 6],
     });

     // Filter 5: Бизнес и маркетинг
     const saturation = input.market_data?.genre_saturation ?? "medium";
     const f5Score = saturation === "low" ? 0.8
                    : saturation === "medium" ? 0.5 : 0.3;
     const f5Passed = f5Score >= 0.5;
     filters.push({
       filter_id: 5,
       filter_name: "Бизнес и маркетинг",
       key_question: "Будет ли игра продаваться?",
       passed: f5Passed,
       score: f5Score,
       red_flag: f5Passed ? undefined : "Нет рынка / перенасыщенный рынок",
       note: `Насыщение жанра: ${saturation}`,
       affected_by: [4, 7],
     });

     // Filter 6: Разработка
     // Эвристика: budget_tier + team_size + platform должны быть согласованы
     const budgetTier = input.technical_constraints?.budget_tier ?? "indie";
     const teamSize = input.technical_constraints?.team_size ?? 1;
     const platforms = input.technical_constraints?.platform ?? ["pc"];
     const f6Score = (
       (budgetTier === "indie" && teamSize <= 5 && platforms.length <= 2)
       ? 0.8
       : (budgetTier === "aa" && teamSize <= 20)
       ? 0.7
       : (budgetTier === "aaa" && teamSize > 20)
       ? 0.8
       : 0.4
     );
     filters.push({
       filter_id: 6,
       filter_name: "Разработка",
       key_question: "Технически возможно создать эту игру?",
       passed: f6Score >= 0.6,
       score: f6Score,
       red_flag: f6Score >= 0.6 ? undefined : "Нереализуемо с текущими ресурсами",
       note: `budget=${budgetTier}, team=${teamSize}, platforms=${platforms.join(",")}`,
       affected_by: [4, 5],
     });

     // Filter 7: Социальный компонент
     // Эвристика: если жанр multiplayer, нужна audience_match > 0.7
     const isMultiplayerGenre = ["mmo", "moba", "battle_royale", "fighting"]
       .includes(genre);
     const f7Passed = !isMultiplayerGenre
                   || (input.market_data?.audience_match ?? 0) > 0.7;
     filters.push({
       filter_id: 7,
       filter_name: "Социальный компонент",
       key_question: "Оправдывает ли социальная составляющая ожидания?",
       passed: f7Passed,
       score: f7Passed ? 0.8 : 0.3,
       red_flag: f7Passed ? undefined : "Обязательный мультиплеер без аудитории",
       note: isMultiplayerGenre
         ? "Мультиплеерный жанр требует подтверждённой аудитории"
         : "Single-player, социальный компонент опционален",
       affected_by: [2, 5],
     });

     // Filter 8: Плейтесты
     // Эвристика: если есть playtest_data, evaluate; иначе warning "нет данных"
     const hasPlaytest = input.playtest_data?.enjoyment_score != null;
     const enjoyment = input.playtest_data?.enjoyment_score ?? 0;
     const confusion = input.playtest_data?.confusion_score ?? 0;
     const f8Score = hasPlaytest ? Math.max(0, enjoyment - confusion) : 0.5;
     const f8Passed = hasPlaytest
       ? enjoyment > 0.6 && confusion < 0.4
       : false;  // не passed, но не error
     filters.push({
       filter_id: 8,
       filter_name: "Плейтесты",
       key_question: "Нравится ли игра игрокам?",
       passed: f8Passed,
       score: f8Score,
       red_flag: hasPlaytest && !f8Passed
         ? "Игрокам скучно/непонятно"
         : undefined,
       note: hasPlaytest
         ? `enjoyment=${enjoyment.toFixed(2)}, confusion=${confusion.toFixed(2)}`
         : "Плейтесты ещё не проводились — необходимы данные",
       affected_by: [1, 3, 4],
     });

     const failedFilters = filters.filter((f) => !f.passed);
     return {
       filters,
       overall_pass: failedFilters.length === 0,
       cycle_required: failedFilters.length > 0,
       affected_filters: failedFilters.flatMap((f) => f.affected_by ?? []),
     };
   }
   ```

2. **Добавить `runConceptCheck` в `checklist-logic.ts`** (новая функция,
   не заменяет существующие):

   ```ts
   import { runSchellIdeaFilters } from "@/lib/schell-idea-filters";

   function runConceptCheck(project: ProjectData): {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_concept_score: number;
     filter_results: IdeaFilterResult[];
   } {
     if (!project.concept) {
       return { skipped: true, issues: [], overall_concept_score: 0, filter_results: [] };
     }

     const mechanicSet = project.concept.mechanicSet
       ? safeJsonParse<any>(project.concept.mechanicSet, {})
       : {};
     const mechanics = (mechanicSet.mechanics || []).map((m: any) => ({
       name: m.name,
       genres: m.genres || [],
       genre_affinity: m.genre_affinity,
     }));

     const result = runSchellIdeaFilters({
       concept: {
         genre: project.concept.genre,
         usp: project.concept.usp,
         primary_aesthetic: project.concept.primaryAesthetic,
         mechanics,
         idea_text: project.concept.onePagerData || "",
       },
       core_loop: {
         structural_type: project.coreLoop?.structuralType ?? undefined,
         step_count: project.coreLoop?.stepCount ?? undefined,
       },
     });

     const issues: ChecklistIssue[] = result.filters
       .filter((f) => !f.passed)
       .map((f) => ({
         severity: f.score < 0.3 ? "error" : "warning",
         issue_type: `concept_filter_${f.filter_id}_failed`,
         description: `Фильтр "${f.filter_name}": ${f.red_flag || f.note}`,
         suggestion: `Перепройдите фильтр #${f.filter_id}. ${
           f.affected_by?.length
             ? `Также перепроверьте фильтры: ${f.affected_by.join(", ")} (Bible 11.5.2: "каждый фильтр влияет на остальные")`
             : ""
         }`,
       }));

     if (result.overall_pass) {
       issues.push({
         severity: "info",
         issue_type: "concept_filters_passed",
         description: "Все 8 фильтров идеи пройдены",
         suggestion: "Регулярно перепроверяйте при изменении концепции",
       });
     }

     const score = result.filters.reduce((sum, f) => sum + f.score, 0) / 8;
     return {
       skipped: false,
       issues,
       overall_concept_score: Number(clamp(score).toFixed(3)),
       filter_results: result.filters,
     };
   }
   ```

3. **Добавить "concept" в `ALL_CHECKLISTS`** (checklist-logic.ts:171–177):

   ```ts
   const ALL_CHECKLISTS = [
     "concept",   // NEW (Bible 11.5.2)
     "mda",
     "balance",
     "narrative",
     "economy",
     "lenses",
   ];
   ```

4. **Обновить `VALID_ACTIONS`** в обоих route файлах:
   ```ts
   const VALID_ACTIONS = new Set([
     "validate",
     "concept-check",  // NEW
     "mda-check",
     // ...
     "concept",  // NEW alias
   ]);
   ```

5. **Обновить `ChecklistValidationProfile`** (types/gdd.ts:140–177):
   ```ts
   concept_check?: {
     skipped: boolean;
     issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
     overall_concept_score: number;
     filter_results: Array<{
       filter_id: number;
       filter_name: string;
       key_question: string;
       passed: boolean;
       score: number;
       red_flag?: string;
       note: string;
     }>;
   };
   ```

6. **Обновить `buildSummary`** для учёта concept_check в overall_score
   (см. TASK-6b.12 для adaptive weights).

**Тест-кейсы**:

- `runSchellIdeaFilters({concept: {usp: ""}})` → Filter 4 не passed,
  `cycle_required: true`, `affected_filters` содержит 2, 6.
- `runSchellIdeaFilters({concept: {genre: "mmo", usp: "..."}})` без
  `market_data` → Filter 7 не passed (multiplayer genre без audience).
- `runSchellIdeaFilters({playtest_data: undefined})` → Filter 8 score=0.5,
  passed=false, note="Плейтесты ещё не проводились".
- `runSchellIdeaFilters({concept: {...all good}})` → overall_pass=true,
  8 filters passed.
- `runConceptCheck(project)` без concept → `{skipped: true}`.

**Риски**:

- **Зависимость от Block 1 TASK-1.4** (реальные 8 фильтров в concept):
  если Block 1 уже реализовал `eight_filters` с реальной логикой, то
  `runConceptCheck` в checklist layer должен **переиспользовать** данные
  из `concept.validationReport`, а не дублировать логику. Решение:
  проверить `concept.validationReport.eight_filters` — если есть,
  parse и использовать; если нет, запустить `runSchellIdeaFilters` с
  fresh data.
- **LLM-зависимость**: Filter 8 (плейтесты) реально требует playtest data,
  которого нет на ранних стадиях. Митигация: помечать как warning, не
  error; если `playtest_data` отсутствует, score=0.5, не passed.
- **Generic USP patterns**: список `genericUspPatterns` субъективен.
  Митигация: вынести в `src/constants/schell-idea-filters.ts`, расширять
  по мере обнаружения ложных срабатываний.

**Dependencies**: TASK-6b.1 (для интеграции в `/gdd/checklist` response).
Желательно TASK-1.4 из Block 1 plan (для переиспользования concept.validationReport).

---

### TASK-6b.4: Реализовать 6 эвристик Аптона (Bible 11.5.4) — Level 2 Mechanics validator

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 2)
**Файлы**: новый `src/lib/upton-heuristics.ts`, `src/lib/checklist-logic.ts` (расширить `runMdaCheck`)

**Описание проблемы**:

Bible 11.5.4 специфицирует **6 эвристик Аптона** (через Зубека):

- [ ] **Выбор**: Есть ли у игрока осознанный выбор из нескольких вариантов?
- [ ] **Разнообразие**: Меняются ли доступные действия со временем?
- [ ] **Последствия**: Приводят ли действия к приписываемым им результатам?
- [ ] **Предсказуемость**: Может ли игрок понять связь действий и исходов?
- [ ] **Неопределённость**: Не является ли исход полностью предрешённым?
- [ ] **Удовлетворение**: Достижимы ли желанные результаты при разумных усилиях?

Текущая реализация `runMdaCheck` (checklist-logic.ts:184–257) имеет только
3 правила:
1. `mda_no_mechanics` — проверка существования mechanicSet
2. `mda_low_match` — `overallMatch < 0.5`
3. `mda_low_lens_score` — `lensValidation.overall_score < 0.6`

Никаких эвристик Аптона.

**Решение**:

1. **Создать `src/lib/upton-heuristics.ts`**:

   ```ts
   export interface UptonHeuristicResult {
     heuristic_id: number;   // 1..6
     heuristic_name: "Выбор" | "Разнообразие" | "Последствия"
                    | "Предсказуемость" | "Неопределённость" | "Удовлетворение";
     question: string;
     passed: boolean;
     score: number;          // 0..1
     evidence: string;       // какие данные подтверждают
     suggestion?: string;
   }

   export interface UptonInput {
     mechanics: Array<{
       name: string;
       group?: string;
       aesthetics?: string[];
     }>;
     core_loop: {
       step_count: number;
       steps: Array<{ action: string; choice?: string[] }>;
     };
     mda: {
       overall_match: number;
       mechanic_set: {
         compatibility_score?: number;
         synergy_score?: number;
       };
     };
   }

   /**
    * Применить 6 эвристик Аптона к механикам и core loop.
    * Bible 11.5.4 (через Зубека, Кн. 6).
    */
   export function runUptonHeuristics(input: UptonInput): {
     heuristics: UptonHeuristicResult[];
     overall_score: number;
   } {
     const heuristics: UptonHeuristicResult[] = [];

     // 1. Выбор: >=3 механик + >=2 шагов с choice
     const mechanicCount = input.mechanics.length;
     const choicesInLoop = input.core_loop.steps.filter(s => s.choice?.length).length;
     const h1Score = Math.min(1, (mechanicCount / 5) * 0.5 + (choicesInLoop / 3) * 0.5);
     heuristics.push({
       heuristic_id: 1,
       heuristic_name: "Выбор",
       question: "Есть ли у игрока осознанный выбор из нескольких вариантов?",
       passed: h1Score >= 0.5,
       score: h1Score,
       evidence: `${mechanicCount} механик, ${choicesInLoop} шагов с выбором в core loop`,
       suggestion: h1Score < 0.5
         ? "Добавьте механики с взаимоисключающими выборами"
         : undefined,
     });

     // 2. Разнообразие: механики из >=3 разных групп
     const groups = new Set(input.mechanics.map(m => m.group).filter(Boolean));
     const h2Score = Math.min(1, groups.size / 4);
     heuristics.push({
       heuristic_id: 2,
       heuristic_name: "Разнообразие",
       question: "Меняются ли доступные действия со временем?",
       passed: groups.size >= 3,
       score: h2Score,
       evidence: `Механики из ${groups.size} групп: ${Array.from(groups).join(", ")}`,
       suggestion: groups.size < 3
         ? "Добавьте механики из других групп (Базовые, Боевые, Экономика, Движение)"
         : undefined,
     });

     // 3. Последствия: overallMatch > 0.6 (механики соответствуют эстетикам)
     const h3Score = input.mda.overall_match;
     heuristics.push({
       heuristic_id: 3,
       heuristic_name: "Последствия",
       question: "Приводят ли действия к приписываемым им результатам?",
       passed: h3Score >= 0.6,
       score: h3Score,
       evidence: `MDA overall_match = ${h3Score.toFixed(2)}`,
       suggestion: h3Score < 0.6
         ? "Механики не соответствуют целевым эстетикам — пересмотрите mapping"
         : undefined,
     });

     // 4. Предсказуемость: compatibility_score (механики совместимы между собой)
     const compat = input.mda.mechanic_set.compatibility_score ?? 0.5;
     const h4Score = compat / 100;  // normalize 0..100 → 0..1
     heuristics.push({
       heuristic_id: 4,
       heuristic_name: "Предсказуемость",
       question: "Может ли игрок понять связь действий и исходов?",
       passed: h4Score >= 0.5,
       score: h4Score,
       evidence: `compatibility_score = ${compat}%`,
       suggestion: h4Score < 0.5
         ? "Низкая совместимость механик — игроки не смогут предсказать исходы"
         : undefined,
     });

     // 5. Неопределённость: synergy_score > 0.3 (есть эмерджентность)
     const synergy = input.mda.mechanic_set.synergy_score ?? 0.5;
     const h5Score = Math.min(1, synergy + 0.2);  // baseline 0.2 для single-player
     heuristics.push({
       heuristic_id: 5,
       heuristic_name: "Неопределённость",
       question: "Не является ли исход полностью предрешённым?",
       passed: h5Score >= 0.4,
       score: h5Score,
       evidence: `synergy_score = ${synergy.toFixed(2)}`,
       suggestion: h5Score < 0.4
         ? "Слишком детерминированные механики — добавьте случайность или эмерджентность"
         : undefined,
     });

     // 6. Удовлетворение: core loop имеет >=5 шагов
     const stepCount = input.core_loop.step_count;
     const h6Score = Math.min(1, stepCount / 7);
     heuristics.push({
       heuristic_id: 6,
       heuristic_name: "Удовлетворение",
       question: "Достижимы ли желанные результаты при разумных усилиях?",
       passed: stepCount >= 4,
       score: h6Score,
       evidence: `core loop имеет ${stepCount} шагов`,
       suggestion: stepCount < 4
         ? "Слишком короткий core loop — игроки не почувствуют прогрессию"
         : undefined,
     });

     const overall = heuristics.reduce((s, h) => s + h.score, 0) / 6;
     return { heuristics, overall_score: overall };
   }
   ```

2. **Расширить `runMdaCheck` в `checklist-logic.ts`** — вызвать
   `runUptonHeuristics` и добавить issues:

   ```ts
   import { runUptonHeuristics } from "@/lib/upton-heuristics";

   function runMdaCheck(project: ProjectData): {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_mda_score: number;
     upton_heuristics?: UptonHeuristicResult[];  // NEW
   } {
     // ... existing 3 checks ...

     // NEW: 6 Upton heuristics (Bible 11.5.4)
     const mechanicSetData = mda.mechanicSet
       ? safeJsonParse<any>(mda.mechanicSet, {})
       : {};
     const coreLoopData = project.coreLoop?.stepsData
       ? safeJsonParse<{ steps?: any[] }>(project.coreLoop.stepsData, {})
       : {};

     if (mechanicSetData.mechanics && coreLoopData.steps) {
       const uptonResult = runUptonHeuristics({
         mechanics: mechanicSetData.mechanics,
         core_loop: {
           step_count: project.coreLoop?.stepCount ?? coreLoopData.steps.length,
           steps: coreLoopData.steps,
         },
         mda: {
           overall_match: mda.overallMatch ?? 0,
           mechanic_set: {
             compatibility_score: mechanicSetData.compatibility_score,
             synergy_score: mechanicSetData.synergy_score,
           },
         },
       });

       for (const h of uptonResult.heuristics) {
         if (!h.passed) {
           issues.push({
             severity: h.score < 0.3 ? "error" : "warning",
             issue_type: `upton_${h.heuristic_id}_${h.heuristic_name.toLowerCase()}`,
             description: `Эвристика "${h.heuristic_name}": ${h.evidence}`,
             suggestion: h.suggestion || `Пересмотрите ${h.heuristic_name.toLowerCase()}`,
           });
         }
       }

       // Blend MDA score with Upton score (50/50)
       score = (score + uptonResult.overall_score) / 2;

       return {
         skipped: false,
         issues,
         overall_mda_score: Number(clamp(score).toFixed(3)),
         upton_heuristics: uptonResult.heuristics,
       };
     }

     // ... fallback without Upton ...
   }
   ```

3. **Обновить `ChecklistValidationProfile`** (types/gdd.ts):
   ```ts
   mda_check?: {
     skipped: boolean;
     issues: Array<{...}>;
     overall_mda_score: number;
     upton_heuristics?: Array<{
       heuristic_id: number;
       heuristic_name: string;
       question: string;
       passed: boolean;
       score: number;
       evidence: string;
       suggestion?: string;
     }>;
   };
   ```

**Тест-кейсы**:

- `runUptonHeuristics({mechanics: [], core_loop: {step_count: 0, steps: []}, mda: {...}})`
  → все 6 эвристик не passed, overall_score < 0.3.
- `runUptonHeuristics({mechanics: [5 механик из 4 групп], core_loop: {step_count: 7, steps: [...]}, mda: {overall_match: 0.8, mechanic_set: {compatibility_score: 80, synergy_score: 0.6}}})`
  → все 6 passed, overall_score > 0.7.
- `runMdaCheck(project)` без `mechanicSet.mechanics` → `upton_heuristics` поле
  отсутствует, fallback на existing 3 checks.
- Pipeline regression: `08_checklist.json` теперь содержит `mda_check.upton_heuristics`
  массив из 6 элементов.

**Риски**:

- **Эвристики субъективны**: Bible даёт только вопросы, не метрики.
  Митигация: документировать rationale в комментариях, использовать
  domain knowledge (5 механик = "достаточный выбор" — обычная практика
  в industry).
- **Зависимость от Block 3**: `compatibility_score` и `synergy_score`
  сейчас захардкожены/сломаны (см. Block 3 audit: `overall_match = 0`
  всегда). После Block 3 TASK-3.3 эти значения станут реальными, и
  Upton heuristics заработают корректно.

**Dependencies**: TASK-6b.1 (для route integration). Желательно Block 3
TASK-3.3 (для корректных `overall_match`, `compatibility_score`,
`synergy_score`).

---

### TASK-6b.5: Реализовать 7-point Rolling/Morris balance checklist (Bible 11.5.3)

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 4)
**Файлы**: новый `src/lib/rolling-morris-checklist.ts`, `src/lib/checklist-logic.ts` (переписать `runBalanceCheck`)

**Описание проблемы**:

Bible 11.5.3 специфицирует **7-point balance checklist** (Роллингс/Моррис):

- [ ] **Баланс PvP**: Нет изначальных преимуществ? Случайные события равновероятны для всех?
- [ ] **Баланс «игрок — геймдизайнер»**: Уровень владения соответствует вызову? Худший враг ≠ сама игра?
- [ ] **Баланс «геймдизайнер — игрок»**: Все возможности сопоставимы по ценности? Доминирующие стратегии компенсированы?
- [ ] **Q-фактор**: Каждый компонент лучше других хотя бы по одному атрибуту? Нет ли «мёртвых» компонентов?
- [ ] **Правило SPS**: Взаимосвязи между компонентами образуют цикл «камень-ножницы-бумага»? Нет статически доминирующего выбора?
- [ ] **Золотое правило**: Случайный выбор никогда не является оптимальной стратегией?
- [ ] **Масштабируемость**: Баланс не нарушится при добавлении новых элементов?

Текущая реализация `runBalanceCheck` (checklist-logic.ts:259–324) имеет
только 4 generic checks:
1. `balance_low_score` — `overallBalanceScore < 0.5`
2. `balance_many_imbalances` — `imbalanceCount > 3`
3. `balance_pathologies` — `pathologies.length > 0`
4. `balance_ok` — info fallback

**Ни одна** из 7 Bible checks не реализована.

**Решение**:

1. **Создать `src/lib/rolling-morris-checklist.ts`**:

   ```ts
   export interface BalanceCheckResult {
     check_id: number;        // 1..7
     check_name: string;
     question: string;
     passed: boolean;
     score: number;           // 0..1
     evidence: string;
     suggestion?: string;
   }

   export interface BalanceChecklistInput {
     balance: {
       overall_score: number;       // 0..1
       objects: Array<{
         id: string;
         name: string;
         type: string;
         attributes: Record<string, number>;
         cost?: number;
         tier?: number;
       }>;
       payoff_matrix?: number[][];
       nash_equilibrium?: {
         uniformity: number;        // 0..1, 1 = perfect RPS
         dominant_strategy_exists: boolean;
       };
       q_factor?: {
         dead_components: string[]; // object IDs, худшие по всем атрибутам
         unique_bests: number;      // сколько объектов имеют хотя бы один "лучший" атрибут
       };
       imbalance_count: number;
       pathologies: Array<{ type: string; severity: string }>;
     };
     game_mode: "pve" | "pvp" | "mixed";
     scale_test?: {
       new_objects_break_balance: boolean;
     };
   }

   /**
    * 7-point balance checklist (Rolling/Morris, Bible 11.5.3).
    * Основан на модели 3 типов баланса + Q-фактор + SPS + золотое правило.
    */
   export function runRollingMorrisChecklist(input: BalanceChecklistInput): {
     checks: BalanceCheckResult[];
     overall_score: number;
   } {
     const checks: BalanceCheckResult[] = [];

     // 1. Баланс PvP (только для pvp/mixed)
     if (input.game_mode === "pvp" || input.game_mode === "mixed") {
       const uniformity = input.balance.nash_equilibrium?.uniformity ?? 0;
       const hasDominant = input.balance.nash_equilibrium?.dominant_strategy_exists ?? false;
       const c1Score = uniformity * (hasDominant ? 0.3 : 1.0);
       checks.push({
         check_id: 1,
         check_name: "Баланс PvP",
         question: "Нет изначальных преимуществ? Случайные события равновероятны для всех?",
         passed: c1Score > 0.7 && !hasDominant,
         score: c1Score,
         evidence: `nash uniformity=${uniformity.toFixed(2)}, dominant_strategy=${hasDominant}`,
         suggestion: hasDominant
           ? "Есть доминирующая стратегия — нарушает PvP баланс"
           : uniformity < 0.7
             ? "Неравновероятные исходы для PvP"
             : undefined,
       });
     } else {
       // PvE — check не применим
       checks.push({
         check_id: 1,
         check_name: "Баланс PvP",
         question: "Нет изначальных преимуществ? Случайные события равновероятны для всех?",
         passed: true,
         score: 1.0,
         evidence: "PvE режим — check не применим",
       });
     }

     // 2. Баланс «игрок — геймдизайнер» (skill vs challenge)
     // Эвристика: imbalance_count < 3 (не слишком много дисбалансов)
     const c2Score = Math.max(0, 1 - input.balance.imbalance_count * 0.15);
     checks.push({
       check_id: 2,
       check_name: "Баланс «игрок — геймдизайнер»",
       question: "Уровень владения соответствует вызову? Худший враг ≠ сама игра?",
       passed: c2Score > 0.5,
       score: c2Score,
       evidence: `imbalance_count = ${input.balance.imbalance_count}`,
       suggestion: c2Score < 0.5
         ? "Слишком много дисбалансов — игра может стать «худшим врагом»"
         : undefined,
     });

     // 3. Баланс «геймдизайнер — игрок» (все возможности равноценны)
     // Эвристика: stddev атрибутов cost/power < 30% от mean
     const costs = input.balance.objects.map(o => o.cost ?? 0).filter(c => c > 0);
     const c3Score = costs.length > 1
       ? computeBalanceUniformity(costs)
       : 0.5;
     checks.push({
       check_id: 3,
       check_name: "Баланс «геймдизайнер — игрок»",
       question: "Все возможности сопоставимы по ценности? Доминирующие стратегии компенсированы?",
       passed: c3Score > 0.6,
       score: c3Score,
       evidence: `cost uniformity = ${c3Score.toFixed(2)} (across ${costs.length} objects)`,
       suggestion: c3Score < 0.6
         ? "Слишком большой разброс cost между объектами"
         : undefined,
     });

     // 4. Q-фактор: нет мёртвых компонентов
     const deadComponents = input.balance.q_factor?.dead_components ?? [];
     const uniqueBests = input.balance.q_factor?.unique_bests ?? input.balance.objects.length;
     const c4Score = deadComponents.length === 0
       ? Math.min(1, uniqueBests / input.balance.objects.length)
       : 0.2;
     checks.push({
       check_id: 4,
       check_name: "Q-фактор",
       question: "Каждый компонент лучше других хотя бы по одному атрибуту? Нет ли «мёртвых» компонентов?",
       passed: deadComponents.length === 0,
       score: c4Score,
       evidence: deadComponents.length > 0
         ? `Мёртвые компоненты: ${deadComponents.join(", ")}`
         : `${uniqueBests}/${input.balance.objects.length} объектов имеют уникальный "лучший" атрибут`,
       suggestion: deadComponents.length > 0
         ? `Удалите или переработайте мёртвые компоненты: ${deadComponents.join(", ")}`
         : undefined,
     });

     // 5. SPS (Stone-Paper-Scissors): нет доминирующего выбора
     const hasDominant = input.balance.nash_equilibrium?.dominant_strategy_exists ?? false;
     const c5Score = hasDominant ? 0.2 : 0.9;
     checks.push({
       check_id: 5,
       check_name: "Правило SPS",
       question: "Взаимосвязи между компонентами образуют цикл «камень-ножницы-бумага»? Нет статически доминирующего выбора?",
       passed: !hasDominant,
       score: c5Score,
       evidence: hasDominant
         ? "Обнаружена доминирующая стратегия — SPS цикл нарушен"
         : "Доминирующая стратегия не обнаружена",
       suggestion: hasDominant
         ? "Внедрите SPS цикл: каждый объект должен проигрывать хотя бы одному другому"
         : undefined,
     });

     // 6. Золотое правило: случайный выбор ≠ оптимальная стратегия
     // Эвристика: если payoff_matrix uniform → random = optimal (нарушение)
     const payoff = input.balance.payoff_matrix;
     const isUniform = payoff && payoff.length > 0
       ? isPayoffMatrixUniform(payoff)
       : false;
     const c6Score = isUniform ? 0.2 : 0.8;
     checks.push({
       check_id: 6,
       check_name: "Золотое правило",
       question: "Случайный выбор никогда не является оптимальной стратегией?",
       passed: !isUniform,
       score: c6Score,
       evidence: isUniform
         ? "Payoff matrix uniform — случайный выбор = оптимальный (нарушение)"
         : "Payoff matrix дифференцирован",
       suggestion: isUniform
         ? "Добавьте асимметрию в payoff matrix, чтобы случайный выбор был субоптимальным"
         : undefined,
     });

     // 7. Масштабируемость
     const scaleBreaks = input.scale_test?.new_objects_break_balance ?? false;
     const c7Score = scaleBreaks ? 0.3 : 0.8;
     checks.push({
       check_id: 7,
       check_name: "Масштабируемость",
       question: "Баланс не нарушится при добавлении новых элементов?",
       passed: !scaleBreaks,
       score: c7Score,
       evidence: scaleBreaks
         ? "Тест масштабирования показал нарушение баланса"
         : "Тест масштабирования пройден (или не проводился)",
       suggestion: scaleBreaks
         ? "Перепроектируйте cost-power curves для устойчивости к новым объектам"
         : undefined,
     });

     const overall = checks.reduce((s, c) => s + c.score, 0) / checks.length;
     return { checks, overall_score: overall };
   }

   function computeBalanceUniformity(values: number[]): number {
     if (values.length < 2) return 1.0;
     const mean = values.reduce((a, b) => a + b, 0) / values.length;
     const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
     const stddev = Math.sqrt(variance);
     const cv = mean > 0 ? stddev / mean : 1;  // coefficient of variation
     return Math.max(0, 1 - cv);
   }

   function isPayoffMatrixUniform(matrix: number[][]): boolean {
     if (matrix.length === 0) return false;
     const flat = matrix.flat();
     const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
     const variance = flat.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / flat.length;
     return variance < 0.01;  // near-zero variance = uniform
   }
   ```

2. **Переписать `runBalanceCheck` в `checklist-logic.ts`** — заменить 4
   generic checks на 7-point Rolling/Morris + сохранить compatibility:

   ```ts
   import { runRollingMorrisChecklist } from "@/lib/rolling-morris-checklist";

   function runBalanceCheck(project: ProjectData): {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_balance_score: number;
     rolling_morris_checks?: BalanceCheckResult[];  // NEW
   } {
     const balance = project.balanceResult;
     if (!balance) {
       return { skipped: true, issues: [], overall_balance_score: 0 };
     }

     // Parse balance data from JSON columns
     const fullResult = balance.fullResult
       ? safeJsonParse<any>(balance.fullResult, {})
       : {};
     const objects = fullResult.objects || [];
     const payoff_matrix = fullResult.payoff_matrix;
     const nash_equilibrium = fullResult.nash_equilibrium;
     const q_factor = fullResult.q_factor;
     const pathologies = balance.pathologies
       ? safeJsonParse<any[]>(balance.pathologies, [])
       : [];

     const rmResult = runRollingMorrisChecklist({
       balance: {
         overall_score: (balance.overallBalanceScore ?? 0) / 100,
         objects,
         payoff_matrix,
         nash_equilibrium,
         q_factor,
         imbalance_count: balance.imbalanceCount ?? 0,
         pathologies,
       },
       game_mode: fullResult.game_mode || "pve",
     });

     // Convert RM checks to ChecklistIssues
     const issues: ChecklistIssue[] = rmResult.checks
       .filter((c) => !c.passed)
       .map((c) => ({
         severity: c.score < 0.3 ? "error" : "warning",
         issue_type: `balance_rm_${c.check_id}_${c.check_name.toLowerCase().replace(/[^a-zа-я0-9]/gi, "_")}`,
         description: `${c.check_name}: ${c.evidence}`,
         suggestion: c.suggestion || `Пересмотрите ${c.check_name}`,
       }));

     if (issues.length === 0) {
       issues.push({
         severity: "info",
         issue_type: "balance_rm_all_passed",
         description: "Все 7 checks Rolling/Morris пройдены",
         suggestion: "Контролируйте при добавлении нового контента",
       });
     }

     // Blend: 60% RM score + 40% original overallBalanceScore (для stability)
     const originalScore = (balance.overallBalanceScore ?? 0) / 100;
     const blendedScore = rmResult.overall_score * 0.6 + originalScore * 0.4;

     return {
       skipped: false,
       issues,
       overall_balance_score: Number(clamp(blendedScore).toFixed(3)),
       rolling_morris_checks: rmResult.checks,
     };
   }
   ```

3. **Обновить `ChecklistValidationProfile`** (types/gdd.ts):
   ```ts
   balance_check?: {
     skipped: boolean;
     issues: Array<{...}>;
     overall_balance_score: number;
     rolling_morris_checks?: Array<{
       check_id: number;
       check_name: string;
       question: string;
       passed: boolean;
       score: number;
       evidence: string;
       suggestion?: string;
     }>;
   };
   ```

**Тест-кейсы**:

- `runRollingMorrisChecklist({game_mode: "pve"})` → check #1 (PvP)
  возвращает `passed: true, score: 1.0, evidence: "PvE режим — check не применим"`.
- `runRollingMorrisChecklist({game_mode: "pvp", balance: {nash_equilibrium: {uniformity: 0.4, dominant_strategy_exists: true}}})`
  → check #1 не passed, check #5 не passed.
- `runRollingMorrisChecklist({balance: {q_factor: {dead_components: ["obj1"]}}})`
  → check #4 не passed, score=0.2.
- `runRollingMorrisChecklist({balance: {payoff_matrix: [[0.5, 0.5], [0.5, 0.5]]}})`
  → check #6 не passed (uniform matrix).
- Pipeline regression: `08_checklist.json` теперь содержит
  `balance_check.rolling_morris_checks` массив из 7 элементов.

**Риски**:

- **Зависимость от Block 4**: `payoff_matrix`, `nash_equilibrium`,
  `q_factor` сейчас захардкожены/фейковые (см. Block 4 audit: fake Nash
  uniform `1/n`, hardcoded HP/damage в Machinations). После Block 4
  TASK-4.5 (real Nash) и TASK-4.7 (Machinations from object types) эти
  значения станут реальными.
- **PV E vs PvP**: check #1 (PvP) не применим к PvE. Решение: возвращать
  `passed: true, score: 1.0` с evidence "не применимо", не падать.
- **Scale test**: `scale_test.new_objects_break_balance` требует
  дополнительной симуляции. Решение: опциональный параметр, если
  отсутствует — score=0.8 (default "passed").

**Dependencies**: TASK-6b.1. Желательно Block 4 TASK-4.5, TASK-4.7.

---

### TASK-6b.6: Реализовать 7 методов Бонд косвенного руководства + Level 7 LD validator (Bible 11.5.5)

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 7)
**Файлы**: новый `src/lib/bond-indirect-guidance.ts`, новый `src/lib/level-design-validator.ts`, `src/lib/checklist-logic.ts` (добавить `runLevelDesignCheck`)

**Описание проблемы**:

Bible 11.5.5 специфицирует **7 методов косвенного руководства Бонд**:

- [ ] **Указывающие линии**: Элементы среды направляют взгляд
- [ ] **Камера**: Направление взгляда через положение камеры
- [ ] **Контраст**: Яркость, текстура, цвет, направленность
- [ ] **Звук**: Музыка для настроения, эффекты для локальных подсказок
- [ ] **Имитация**: NPC демонстрируют действия
- [ ] **Отсутствие альтернатив**: Закрытые двери, тупики
- [ ] **Брендинг**: Визуальный язык, приучающий к ассоциациям

Bible 11.6.1 УРОВЕНЬ 7: ВАЛИДАЦИЯ LEVEL DESIGN:
- Читаемость: игрок понимает пространство?
- Навигация: 7 методов руководства + 9 инструментов
- Боевые пространства: Combat Fronts корректны?
- Темп: матрица 3×3 + чередование интенсивности
- Beat Chart: арка механик соответствует арке уровня

Текущая реализация `checklist-logic.ts` — **полностью отсутствует**
Level Design validation. Нет `runLevelDesignCheck` функции.

**Решение**:

1. **Создать `src/lib/bond-indirect-guidance.ts`** — 7 methods check:

   ```ts
   export interface BondGuidanceResult {
     method_id: number;       // 1..7
     method_name: "Указывающие линии" | "Камера" | "Контраст"
                    | "Звук" | "Имитация" | "Отсутствие альтернатив"
                    | "Брендинг";
     question: string;
     applied: boolean;        // false = не описано в GDD
     passed: boolean;
     score: number;
     evidence: string;
   }

   export interface BondGuidanceInput {
     gdd: {
       sections: {
         level_design?: { content: string; source: string };
         navigation?: { content: string; source: string };
         visual_style?: { content: string; source: string };
         sound_and_music?: { content: string; source: string };
         camera?: { content: string; source: string };
         hud_ui?: { content: string; source: string };
       };
     };
   }

   export function runBondIndirectGuidance(input: BondGuidanceInput): {
     methods: BondGuidanceResult[];
     overall_score: number;
   } {
     const sections = input.gdd.sections;
     const methods: BondGuidanceResult[] = [];

     // 1. Указывающие линии — в level_design / navigation
     const ldContent = (sections.level_design?.content || "") + " " + (sections.navigation?.content || "");
     const hasLeadingLines = /ведущ|направля|указ|sightline|leading/i.test(ldContent);
     methods.push({
       method_id: 1,
       method_name: "Указывающие линии",
       question: "Элементы среды направляют взгляд?",
       applied: hasLeadingLines,
       passed: hasLeadingLines,
       score: hasLeadingLines ? 0.8 : 0.3,
       evidence: hasLeadingLines
         ? "GDD описывает указывающие линии в level_design/navigation"
         : "Нет описания указывающих линий в GDD",
     });

     // 2. Камера — в camera / level_design
     const camContent = sections.camera?.content || "" + " " + ldContent;
     const hasCameraGuidance = /камер|camera|framing|view|ракурс/i.test(camContent);
     methods.push({
       method_id: 2,
       method_name: "Камера",
       question: "Направление взгляда через положение камеры?",
       applied: hasCameraGuidance,
       passed: hasCameraGuidance,
       score: hasCameraGuidance ? 0.8 : 0.3,
       evidence: hasCameraGuidance
         ? "GDD описывает camera guidance"
         : "Нет описания camera guidance в GDD",
     });

     // 3. Контраст — в visual_style
     const vsContent = sections.visual_style?.content || "";
     const hasContrast = /контраст|contrast|яркост|brightness|color|цвет|текстур|texture/i.test(vsContent);
     methods.push({
       method_id: 3,
       method_name: "Контраст",
       question: "Яркость, текстура, цвет, направленность?",
       applied: hasContrast,
       passed: hasContrast,
       score: hasContrast ? 0.8 : 0.3,
       evidence: hasContrast
         ? "GDD описывает contrast в visual_style"
         : "Нет описания contrast в GDD",
     });

     // 4. Звук — в sound_and_music
     const sndContent = sections.sound_and_music?.content || "";
     const hasSoundGuidance = /звук|sound|музык|music|sfx|ambient/i.test(sndContent);
     methods.push({
       method_id: 4,
       method_name: "Звук",
       question: "Музыка для настроения, эффекты для локальных подсказок?",
       applied: hasSoundGuidance,
       passed: hasSoundGuidance,
       score: hasSoundGuidance ? 0.8 : 0.3,
       evidence: hasSoundGuidance
         ? "GDD описывает sound guidance"
         : "Нет описания sound guidance в GDD",
     });

     // 5. Имитация (NPC demonstration)
     const hasImitation = /npc|имита|demonstrat|показ|обучающ|tutorial/i.test(ldContent + " " + vsContent);
     methods.push({
       method_id: 5,
       method_name: "Имитация",
       question: "NPC демонстрируют действия?",
       applied: hasImitation,
       passed: hasImitation,
       score: hasImitation ? 0.8 : 0.3,
       evidence: hasImitation
         ? "GDD описывает NPC imitation"
         : "Нет описания NPC imitation в GDD",
     });

     // 6. Отсутствие альтернатив
     const hasNoAlternative = /тупик|dead.?end|закрыт|closed|единствен|only.?path|funnel/i.test(ldContent);
     methods.push({
       method_id: 6,
       method_name: "Отсутствие альтернатив",
       question: "Закрытые двери, тупики?",
       applied: hasNoAlternative,
       passed: hasNoAlternative,
       score: hasNoAlternative ? 0.8 : 0.3,
       evidence: hasNoAlternative
         ? "GDD описывает funneling через отсутствие альтернатив"
         : "Нет описания funneling в GDD",
     });

     // 7. Брендинг
     const hasBranding = /бренд|brand|визуальн.*язык|visual.*language|ассоциа|association/i.test(vsContent + " " + (sections.hud_ui?.content || ""));
     methods.push({
       method_id: 7,
       method_name: "Брендинг",
       question: "Визуальный язык, приучающий к ассоциациям?",
       applied: hasBranding,
       passed: hasBranding,
       score: hasBranding ? 0.8 : 0.3,
       evidence: hasBranding
         ? "GDD описывает branding"
         : "Нет описания branding в GDD",
     });

     const overall = methods.reduce((s, m) => s + m.score, 0) / 7;
     return { methods, overall_score: overall };
   }
   ```

2. **Создать `src/lib/level-design-validator.ts`** — Level 7 full validator:

   ```ts
   import { runBondIndirectGuidance, BondGuidanceResult } from "./bond-indirect-guidance";

   export interface LevelDesignValidationResult {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_ld_score: number;
     // Bible 11.6.1 Level 7 sub-checks
     readability: { score: number; passed: boolean; evidence: string };
     navigation: {
       bond_methods: BondGuidanceResult[];
       overall_score: number;
     };
     combat_spaces: { score: number; passed: boolean; evidence: string };
     pacing: { score: number; passed: boolean; evidence: string };
     beat_chart: { score: number; passed: boolean; evidence: string };
   }

   /**
    * Level 7: Level Design validation (Bible 11.6.1).
    * Включает 7 методов Бонд (Bible 11.5.5).
    */
   export function runLevelDesignCheck(project: ProjectData): LevelDesignValidationResult {
     if (!project.gdd) {
       return { skipped: true, issues: [], overall_ld_score: 0, ... };
     }

     const gddSections = safeJsonParse<{ sections?: Record<string, any> }>(
       project.gdd.fullProfile || "{}", {}
     ).sections || {};

     // 1. Bond indirect guidance (7 methods, Bible 11.5.5)
     const bondResult = runBondIndirectGuidance({ gdd: { sections: gddSections } });

     // 2. Readability — есть ли описание geometry/sightlines
     const readabilityContent = (gddSections.level_design?.content || "")
                             + " " + (gddSections.navigation?.content || "");
     const hasReadability = /геометр|geometry|sightline|читаем|readab|визуальн.*простран/i.test(readabilityContent);

     // 3. Combat Fronts — есть ли описание combat spaces
     const combatContent = gddSections.combat_spaces?.content || gddSections.level_design?.content || "";
     const hasCombatFronts = /combat.?front|фронт.*бо|cover|укрыт|flank|фланг/i.test(combatContent);

     // 4. Pacing — matrix 3×3 + intensity alternation
     const pacingContent = gddSections.level_design?.content || "";
     const hasPacing = /темп|pacing|интенсивн|intensity|чередов|alternat|3x3|matrix/i.test(pacingContent);

     // 5. Beat Chart
     const hasBeatChart = /beat.?chart|арка.*механик|mechanic.*arc|уровн.*арка/i.test(pacingContent);

     // Build issues
     const issues: ChecklistIssue[] = [];

     for (const m of bondResult.methods) {
       if (!m.passed) {
         issues.push({
           severity: "warning",
           issue_type: `ld_bond_method_${m.method_id}_${m.method_name.toLowerCase()}`,
           description: `Метод Бонд "${m.method_name}" не описан в GDD: ${m.evidence}`,
           suggestion: `Добавьте описание в секции level_design/navigation/visual_style`,
         });
       }
     }

     if (!hasReadability) {
       issues.push({
         severity: "warning",
         issue_type: "ld_no_readability",
         description: "Читаемость пространства не описана",
         suggestion: "Опишите sightlines и geometry в level_design секции",
       });
     }

     if (!hasCombatFronts) {
       issues.push({
         severity: "info",
         issue_type: "ld_no_combat_fronts",
         description: "Combat Fronts не описаны",
         suggestion: "Если применимо, опишите combat spaces в GDD",
       });
     }

     if (!hasPacing) {
       issues.push({
         severity: "warning",
         issue_type: "ld_no_pacing",
         description: "Pacing matrix 3×3 не описана",
         suggestion: "Опишите чередование интенсивности в level_design секции",
       });
     }

     if (!hasBeatChart) {
       issues.push({
         severity: "info",
         issue_type: "ld_no_beat_chart",
         description: "Beat Chart отсутствует",
         suggestion: "Создайте Beat Chart для арки механик по уровням",
       });
     }

     if (issues.length === 0) {
       issues.push({
         severity: "info",
         issue_type: "ld_ok",
         description: "Level Design валидация пройдена",
         suggestion: "Перепроверяйте при добавлении новых уровней",
       });
     }

     const scores = [
       bondResult.overall_score,
       hasReadability ? 0.8 : 0.4,
       hasCombatFronts ? 0.8 : 0.5,  // не обязательно для всех жанров
       hasPacing ? 0.8 : 0.4,
       hasBeatChart ? 0.8 : 0.5,
     ];
     const overall = scores.reduce((a, b) => a + b, 0) / scores.length;

     return {
       skipped: false,
       issues,
       overall_ld_score: Number(clamp(overall).toFixed(3)),
       readability: { score: hasReadability ? 0.8 : 0.4, passed: hasReadability, evidence: "..." },
       navigation: { bond_methods: bondResult.methods, overall_score: bondResult.overall_score },
       combat_spaces: { score: hasCombatFronts ? 0.8 : 0.5, passed: hasCombatFronts, evidence: "..." },
       pacing: { score: hasPacing ? 0.8 : 0.4, passed: hasPacing, evidence: "..." },
       beat_chart: { score: hasBeatChart ? 0.8 : 0.5, passed: hasBeatChart, evidence: "..." },
     };
   }
   ```

3. **Добавить "level_design" в `ALL_CHECKLISTS`** и `runLevelDesignCheck`
   в `runChecklistValidation` dispatcher.

4. **Обновить `ChecklistValidationProfile`** type с `level_design_check?`.

**Тест-кейсы**:

- `runBondIndirectGuidance({gdd: {sections: {}}})` → все 7 методов
  `applied: false`, score=0.3.
- `runBondIndirectGuidance({gdd: {sections: {level_design: {content: "sightlines ведущие к цели"}}}})`
  → method #1 (Указывающие линии) `passed: true`.
- `runLevelDesignCheck(project без gdd)` → `skipped: true`.
- `runLevelDesignCheck(project с gdd, content содержит "sightlines",
  "camera framing", "contrast", "sound cues")` → 4/7 методов passed.
- Pipeline regression: `08_checklist.json` теперь содержит
  `level_design_check` секцию (раньше отсутствовала).

**Риски**:

- **Зависимость от GDD content**: GDD сейчас имеет 21 секцию вместо 38
  (см. Block 6 audit). После Block 6 TASK-6.1, TASK-6.4 (38 секций)
  уровень детализации повысится, и Bond methods check станет точнее.
- **Regex-based matching**: regex `/ведущ|направля|.../` может давать
  false negatives (русский язык богат словоформами). Митигация: LLM
  interpretation в `enrichChecklist` (TASK-6b.13) для спорных случаев.
- **Combat Fronts не применим к non-combat играм** (puzzle, walking_sim):
  score=0.5 (нейтральный), не fail.

**Dependencies**: TASK-6b.1. Желательно Block 6 TASK-6.1, TASK-6.4 (38 секций GDD).

---

### TASK-6b.7: Реализовать 5 убийц удовольствия Фуллертон + 4+3 цели Бонд (Bible 11.5.6, 11.5.7) — Level 8 Experience validator

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 8)
**Файлы**: новый `src/lib/fullerton-pleasure-killers.ts`, новый `src/lib/bond-design-goals.ts`, новый `src/lib/experience-validator.ts`, `src/lib/checklist-logic.ts` (добавить `runExperienceCheck`)

**Описание проблемы**:

Bible 11.5.6 — **5 убийц удовольствия Фуллертон**:

| Убийца | Описание | Решение |
|--------|----------|---------|
| **Микроменеджмент** | Слишком много мелких решений без значимости | Автоматизировать рутину |
| **Застой** | Нет ощущения прогресса | Добавить микро-цели и фидбэк |
| **Непреодолимые препятствия** | Невозможно продвинуться без удачи | Альтернативные пути, подсказки |
| **Произвольные события** | Случайность без возможности влияния | Случайность + агентность |
| **Предсказуемые пути** | Один очевидный маршрут без альтернатив | Ветвление, тайны, секреты |

Bible 11.5.7 — **4+3 цели проектирования Бонд**:

**Для игрока**:
- [ ] **Уважение**: Ценится ли время и вложения игрока?
- [ ] **Магический круг**: Не нарушается ли погружение?
- [ ] **Поток**: Сложность между скукой и разочарованием?
- [ ] **Интересные решения**: Есть ли обоюдоострые выборы с последствиями?

**Для игры**:
- [ ] **Формальная система**: Чёткие правила, определяющие структуру?
- [ ] **Неопределённость**: Исход неизвестен заранее?
- [ ] **Неравноценность результатов**: Есть градации успеха?

Bible 11.6.1 УРОВЕНЬ 8: ВАЛИДАЦИЯ ОПЫТА:
- Поток: баланс вызова и навыка?
- Кривая интереса: крючок→нарастание→кульминация?
- Убийцы удовольствия: ни одного из 5?
- Цели проектирования: уважение + магический круг + поток + интересные решения
- Мотивация: внутренняя + внешняя поддерживаются?

Текущая реализация `checklist-logic.ts` — **полностью отсутствует**
Experience validation.

**Решение**:

1. **Создать `src/lib/fullerton-pleasure-killers.ts`**:

   ```ts
   export interface PleasureKillerResult {
     killer_id: number;       // 1..5
     killer_name: "Микроменеджмент" | "Застой" | "Непреодолимые препятствия"
                 | "Произвольные события" | "Предсказуемые пути";
     detected: boolean;
     severity: "error" | "warning" | "info";
     evidence: string;
     solution: string;
   }

   export interface PleasureKillerInput {
     core_loop: {
       step_count: number;
       steps: Array<{ action: string; micro?: boolean; meaningful?: boolean }>;
     };
     progression: {
       total_levels: number;
       perceived_difficulty_variance: number;
       has_branching: boolean;
       has_alternative_paths: boolean;
       has_secrets: boolean;
     };
     economy: {
       has_randomness: boolean;
       has_player_agency_over_random: boolean;
     };
     balance: {
       has_insurmountable_obstacles: boolean;  // check из Block 4
     };
   }

   export function runFullertonPleasureKillers(input: PleasureKillerInput): {
     killers: PleasureKillerResult[];
     overall_score: number;
   } {
     const killers: PleasureKillerResult[] = [];

     // 1. Микроменеджмент
     const microSteps = input.core_loop.steps.filter(s => s.micro && !s.meaningful);
     const microDetected = microSteps.length > input.core_loop.steps.length * 0.3;
     killers.push({
       killer_id: 1,
       killer_name: "Микроменеджмент",
       detected: microDetected,
       severity: microDetected ? "warning" : "info",
       evidence: microDetected
         ? `${microSteps.length}/${input.core_loop.steps.length} шагов — микроменеджмент без значимости`
         : "Микроменеджмент не обнаружен",
       solution: microDetected
         ? "Автоматизируйте рутинные шаги или сделайте их значимыми"
         : "—",
     });

     // 2. Застой
     const variance = input.progression.perceived_difficulty_variance;
     const stagnationDetected = variance < 0.1;  // слишком плоская кривая
     killers.push({
       killer_id: 2,
       killer_name: "Застой",
       detected: stagnationDetected,
       severity: stagnationDetected ? "warning" : "info",
       evidence: stagnationDetected
         ? `perceived_difficulty_variance = ${variance.toFixed(2)} (слишком плоская кривая)`
         : `perceived_difficulty_variance = ${variance.toFixed(2)}`,
       solution: stagnationDetected
         ? "Добавьте микро-цели и фидбэк для ощущения прогресса"
         : "—",
     });

     // 3. Непреодолимые препятствия
     const insurmountable = input.balance.has_insurmountable_obstacles;
     killers.push({
       killer_id: 3,
       killer_name: "Непреодолимые препятствия",
       detected: insurmountable,
       severity: insurmountable ? "error" : "info",
       evidence: insurmountable
         ? "Обнаружены непреодолимые препятствия (требуют удачи)"
         : "Все препятствия преодолимы при правильной стратегии",
       solution: insurmountable
         ? "Добавьте альтернативные пути или подсказки"
         : "—",
     });

     // 4. Произвольные события
     const arbitraryRandom = input.economy.has_randomness
                          && !input.economy.has_player_agency_over_random;
     killers.push({
       killer_id: 4,
       killer_name: "Произвольные события",
       detected: arbitraryRandom,
       severity: arbitraryRandom ? "warning" : "info",
       evidence: arbitraryRandom
         ? "Случайность есть, но игрок не может на неё влиять"
         : input.economy.has_randomness
           ? "Случайность есть, игрок может влиять (агентность)"
           : "Случайность отсутствует",
       solution: arbitraryRandom
         ? "Добавьте игроку инструменты влияния на случайные события"
         : "—",
     });

     // 5. Предсказуемые пути
     const noBranching = !input.progression.has_branching;
     const noAlternatives = !input.progression.has_alternative_paths;
     const noSecrets = !input.progression.has_secrets;
     const predictableDetected = noBranching && noAlternatives && noSecrets;
     killers.push({
       killer_id: 5,
       killer_name: "Предсказуемые пути",
       detected: predictableDetected,
       severity: predictableDetected ? "warning" : "info",
       evidence: predictableDetected
         ? "Нет ветвления, альтернатив, секретов — один предсказуемый путь"
         : `branching=${input.progression.has_branching}, alternatives=${input.progression.has_alternative_paths}, secrets=${input.progression.has_secrets}`,
       solution: predictableDetected
         ? "Добавьте ветвление, альтернативные пути или секреты"
         : "—",
     });

     const detectedCount = killers.filter(k => k.detected).length;
     const overall = Math.max(0, 1 - detectedCount * 0.2);  // -0.2 per killer
     return { killers, overall_score: overall };
   }
   ```

2. **Создать `src/lib/bond-design-goals.ts`**:

   ```ts
   export interface BondGoalResult {
     goal_id: string;          // "P1".."P4" для player, "G1".."G3" для game
     goal_name: string;
     target: "player" | "game";
     question: string;
     passed: boolean;
     score: number;
     evidence: string;
   }

   export function runBondDesignGoals(input: {
     concept: { usp?: string | null };
     core_loop: { step_count: number; has_meaningful_choices: boolean };
     progression: { has_branching: boolean; has_unequal_outcomes: boolean };
     mda: { overall_match: number };
     narrative: { has_ending_variations: boolean };
   }): { goals: BondGoalResult[]; overall_score: number } {
     const goals: BondGoalResult[] = [];

     // === Player goals (P1-P4) ===

     // P1: Уважение (время и вложения)
     const hasRespect = input.progression.has_branching
                     || input.core_loop.step_count >= 5;
     goals.push({
       goal_id: "P1",
       goal_name: "Уважение",
       target: "player",
       question: "Ценится ли время и вложения игрока?",
       passed: hasRespect,
       score: hasRespect ? 0.8 : 0.4,
       evidence: hasRespect
         ? "Ветвление или достаточно длинный core loop"
         : "Короткий core loop без ветвления — игрок не чувствует вложения",
     });

     // P2: Магический круг (погружение)
     const hasImmersion = input.mda.overall_match > 0.6
                       && !!input.concept.usp;
     goals.push({
       goal_id: "P2",
       goal_name: "Магический круг",
       target: "player",
       question: "Не нарушается ли погружение?",
       passed: hasImmersion,
       score: hasImmersion ? 0.8 : 0.4,
       evidence: hasImmersion
         ? "MDA overall_match > 0.6 и USP задан — погружение согласовано"
         : "Слабое соответствие механик-эстетик или нет USP",
     });

     // P3: Поток (skill vs challenge)
     const hasFlow = input.core_loop.has_meaningful_choices;
     goals.push({
       goal_id: "P3",
       goal_name: "Поток",
       target: "player",
       question: "Сложность между скукой и разочарованием?",
       passed: hasFlow,
       score: hasFlow ? 0.8 : 0.4,
       evidence: hasFlow
         ? "Core loop имеет осмысленные выборы — поток достижим"
         : "Core loop не имеет выборов — поток под угрозой",
     });

     // P4: Интересные решения
     const hasInterestingDecisions = input.core_loop.has_meaningful_choices
                                  && input.progression.has_unequal_outcomes;
     goals.push({
       goal_id: "P4",
       goal_name: "Интересные решения",
       target: "player",
       question: "Есть ли обоюдоострые выборы с последствиями?",
       passed: hasInterestingDecisions,
       score: hasInterestingDecisions ? 0.8 : 0.4,
       evidence: hasInterestingDecisions
         ? "Выборы есть и ведут к неравным исходам"
         : "Либо нет выборов, либо выборы не влияют на исход",
     });

     // === Game goals (G1-G3) ===

     // G1: Формальная система
     const hasFormalSystem = input.core_loop.step_count >= 3;
     goals.push({
       goal_id: "G1",
       goal_name: "Формальная система",
       target: "game",
       question: "Чёткие правила, определяющие структуру?",
       passed: hasFormalSystem,
       score: hasFormalSystem ? 0.8 : 0.4,
       evidence: `core_loop.step_count = ${input.core_loop.step_count}`,
     });

     // G2: Неопределённость (исход неизвестен заранее)
     const hasUncertainty = input.progression.has_unequal_outcomes
                         || input.narrative.has_ending_variations;
     goals.push({
       goal_id: "G2",
       goal_name: "Неопределённость",
       target: "game",
       question: "Исход неизвестен заранее?",
       passed: hasUncertainty,
       score: hasUncertainty ? 0.8 : 0.4,
       evidence: hasUncertainty
         ? "Есть неравные исходы или вариации концовок"
         : "Исход детерминирован",
     });

     // G3: Неравноценность результатов
     const hasGraduatedSuccess = input.progression.has_unequal_outcomes;
     goals.push({
       goal_id: "G3",
       goal_name: "Неравноценность результатов",
       target: "game",
       question: "Есть градации успеха?",
       passed: hasGraduatedSuccess,
       score: hasGraduatedSuccess ? 0.8 : 0.4,
       evidence: hasGraduatedSuccess
         ? "Прогрессия имеет неравные исходы"
         : "Бинарный успех/провал — нет градаций",
     });

     const overall = goals.reduce((s, g) => s + g.score, 0) / goals.length;
     return { goals, overall_score: overall };
   }
   ```

3. **Создать `src/lib/experience-validator.ts`** — Level 8 full validator:

   ```ts
   import { runFullertonPleasureKillers } from "./fullerton-pleasure-killers";
   import { runBondDesignGoals } from "./bond-design-goals";

   /**
    * Level 8: Experience validation (Bible 11.6.1).
    * Включает 5 убийц удовольствия Фуллертон (Bible 11.5.6)
    * и 4+3 цели Бонд (Bible 11.5.7).
    */
   export function runExperienceCheck(project: ProjectData): {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_experience_score: number;
     pleasure_killers?: PleasureKillerResult[];
     bond_goals?: BondGoalResult[];
   } {
     // Parse data
     const coreLoopData = project.coreLoop?.stepsData
       ? safeJsonParse<any>(project.coreLoop.stepsData, {})
       : {};
     const progressionData = project.progression?.fullProfile
       ? safeJsonParse<any>(project.progression.fullProfile, {})
       : {};
     const economyData = project.economy?.fullProfile
       ? safeJsonParse<any>(project.economy.fullProfile, {})
       : {};

     const killerInput = {
       core_loop: {
         step_count: project.coreLoop?.stepCount ?? 0,
         steps: coreLoopData.steps || [],
       },
       progression: {
         total_levels: project.progression?.totalLevels ?? 0,
         perceived_difficulty_variance: progressionData.curve?.perceived_difficulty_variance ?? 0.2,
         has_branching: !!progressionData.unlock_tree?.branches,
         has_alternative_paths: !!progressionData.macro_model?.alternative_paths,
         has_secrets: !!progressionData.unlock_tree?.secrets,
       },
       economy: {
         has_randomness: economyData.simulation_results?.has_randomness ?? true,
         has_player_agency_over_random: economyData.feedback_loops?.some(
           (fl: any) => fl.type === "balancing"
         ) ?? false,
       },
       balance: {
         has_insurmountable_obstacles: false,  // TODO: from Block 4
       },
     };

     const killerResult = runFullertonPleasureKillers(killerInput);

     const goalInput = {
       concept: { usp: project.concept?.usp },
       core_loop: {
         step_count: project.coreLoop?.stepCount ?? 0,
         has_meaningful_choices: (coreLoopData.steps || []).some(
           (s: any) => s.choice && s.choice.length > 1
         ),
       },
       progression: {
         has_branching: killerInput.progression.has_branching,
         has_unequal_outcomes: !!progressionData.tier_model?.graduated_success,
       },
       mda: { overall_match: project.mdaProfile?.overallMatch ?? 0 },
       narrative: {
         has_ending_variations: !!progressionData.macro_model?.endings,
       },
     };

     const goalResult = runBondDesignGoals(goalInput);

     const issues: ChecklistIssue[] = [];

     for (const k of killerResult.killers) {
       if (k.detected) {
         issues.push({
           severity: k.severity as "error" | "warning" | "info",
           issue_type: `pleasure_killer_${k.killer_id}_${k.killer_name.toLowerCase()}`,
           description: `Убийца удовольствия "${k.killer_name}": ${k.evidence}`,
           suggestion: k.solution,
         });
       }
     }

     for (const g of goalResult.goals) {
       if (!g.passed) {
         issues.push({
           severity: "warning",
           issue_type: `bond_goal_${g.goal_id}_${g.target}_${g.goal_name.toLowerCase()}`,
           description: `Цель Бонд "${g.goal_name}" (${g.target}): ${g.evidence}`,
           suggestion: `Пересмотрите ${g.goal_name.toLowerCase()}`,
         });
       }
     }

     if (issues.length === 0) {
       issues.push({
         severity: "info",
         issue_type: "experience_ok",
         description: "Experience validation пройдена: 0 убийц удовольствия, все 7 целей Бонд",
         suggestion: "Перепроверяйте при значимых изменениях",
       });
     }

     const overall = (killerResult.overall_score + goalResult.overall_score) / 2;

     return {
       skipped: false,
       issues,
       overall_experience_score: Number(clamp(overall).toFixed(3)),
       pleasure_killers: killerResult.killers,
       bond_goals: goalResult.goals,
     };
   }
   ```

4. **Добавить "experience" в `ALL_CHECKLISTS`** и `runExperienceCheck`
   в `runChecklistValidation` dispatcher.
5. **Обновить `ChecklistValidationProfile`** type с `experience_check?`.

**Тест-кейсы**:

- `runFullertonPleasureKillers({core_loop: {steps: [{micro: true, meaningful: false}, ...x5]}})`
  → killer #1 detected (Микроменеджмент).
- `runFullertonPleasureKillers({progression: {has_branching: false, has_alternative_paths: false, has_secrets: false}})`
  → killer #5 detected (Предсказуемые пути).
- `runBondDesignGoals({concept: {usp: "..."}, mda: {overall_match: 0.8}})`
  → goal P2 passed (Магический круг).
- `runExperienceCheck(project без coreLoop)` → killer #1 detected
  (0 шагов = все micro без meaningful), goal P3 failed.
- Pipeline regression: `08_checklist.json` теперь содержит
  `experience_check.pleasure_killers` (5 элементов) и
  `experience_check.bond_goals` (7 элементов).

**Риски**:

- **Зависимость от Block 5a**: `progression.has_branching`,
  `has_alternative_paths`, `has_secrets` — сейчас hardcoded false
  (см. Block 5a audit: `lock_key_model` binary). После Block 5a
  TASK-5a.7 (real params from upstream) эти поля станут реальными.
- **`has_insurmountable_obstacles`**: Block 4 не предоставляет этот флаг.
  Решение: вычислить из `balance.pathologies` (если есть pathology типа
  "Непреодолимое" — true).
- **Subjectivity**: "микроменеджмент" — субъективная оценка. Митигация:
  threshold 30% micro_steps (configurable в `src/constants/fullerton.ts`).

**Dependencies**: TASK-6b.1. Желательно Block 5a TASK-5a.7, Block 4 TASK-4.9.

---

### TASK-6b.8: Реализовать 12-point economy checklist (Bible 6.13.4) — расширить `runEconomyCheck`

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 5)
**Файлы**: новый `src/lib/economy-checklist.ts`, `src/lib/checklist-logic.ts` (переписать `runEconomyCheck`)

**Описание проблемы**:

Bible 6.13.4 (см. audit 6b.5) специфицирует **12-point economy checklist**
(подробности в `docs/bible/bible_2_6_economy_progression.md` раздел 6.13.4).
Audit Block 5b (RC-15) подтвердил: "12-point validation checklist (Bible
6.13.4) НЕ реализован вообще" в Block 5b. Block 6b должен его реализовать
в checklist layer.

Текущая реализация `runEconomyCheck` (checklist-logic.ts:394–452) имеет
только 3 generic checks:
1. `economy_pathologies` — `hasPathology === true`
2. `economy_unstable` — `simulationResults.quality.overall_pass === false`
3. `economy_low_stability` — `aggregated.stability_index < 0.5`

**Решение**:

1. **Создать `src/lib/economy-checklist.ts`**:

   ```ts
   /**
    * 12-point economy validation checklist (Bible 6.13.4).
    * Запускается из Block 6b (checklist layer), но также доступен
    * из Block 5b route как опциональная детальная валидация.
    */
   export interface EconomyCheckResult {
     check_id: number;        // 1..12
     check_name: string;
     question: string;
     passed: boolean;
     score: number;
     evidence: string;
     suggestion?: string;
   }

   export interface EconomyChecklistInput {
     economy: {
       system_type: string;
       resource_count: number;
       has_pathology: boolean;
       pathologies: Array<{ type: string; severity: string; affected_resources?: string[] }>;
       simulation_results: {
         quality: { overall_pass: boolean; critical_issues: string[] };
         aggregated: {
           stability_index: number;
           faucet_drain_ratio: Record<string, number>;
           stall_frequency: number;
           runaway_frequency: number;
         };
         feedback_loops: Array<{ type: string; strength: number }>;
       };
       resources: Array<{
         id: string;
         name: string;
         class: "currency" | "consumable" | "catalytic" | "subsidiary";
         faucet: number;
         drain: number;
       }>;
       conversion_chains: Array<{ from: string; to: string; profitability: number }>;
     };
   }

   export function runEconomyChecklist(input: EconomyChecklistInput): {
     checks: EconomyCheckResult[];
     overall_score: number;
   } {
     const checks: EconomyCheckResult[] = [];
     const econ = input.economy;

     // 1. Faucets/Drains равновесие (Bible 11.6.1 Level 5)
     const ratios = Object.values(econ.simulation_results.aggregated.faucet_drain_ratio);
     const avgRatio = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
     const c1Passed = avgRatio > 0.8 && avgRatio < 1.2;  // ±20% от 1.0
     checks.push({
       check_id: 1,
       check_name: "Faucets/Drains равновесие",
       question: "Сумма faucets ≈ сумма drains?",
       passed: c1Passed,
       score: c1Passed ? 0.9 : Math.max(0.1, 1 - Math.abs(avgRatio - 1)),
       evidence: `avg faucet/drain ratio = ${avgRatio.toFixed(2)}`,
       suggestion: c1Passed ? undefined : "Сбалансируйте faucets и drains",
     });

     // 2. Циклы конверсии прибыльны
     const unprofitableChains = econ.conversion_chains.filter(c => c.profitability < 0.9);
     const c2Passed = unprofitableChains.length === 0;
     checks.push({
       check_id: 2,
       check_name: "Циклы конверсии",
       question: "Циклы конверсии прибыльны?",
       passed: c2Passed,
       score: c2Passed ? 0.9 : Math.max(0.2, 1 - unprofitableChains.length * 0.2),
       evidence: `${unprofitableChains.length}/${econ.conversion_chains.length} unprofitable`,
       suggestion: c2Passed ? undefined : `${unprofitableChains.length} убыточных цепочек`,
     });

     // 3. Нет патологий (Инфляция, Стагнация, Арбитраж, Deadlock)
     const criticalPathologies = econ.pathologies.filter(p => p.severity === "critical");
     const c3Passed = criticalPathologies.length === 0;
     checks.push({
       check_id: 3,
       check_name: "Патологии",
       question: "Нет инфляции, стагнации, арбитража, deadlock?",
       passed: c3Passed,
       score: c3Passed ? 0.9 : Math.max(0, 1 - criticalPathologies.length * 0.3),
       evidence: `${criticalPathologies.length} critical патологий`,
       suggestion: c3Passed ? undefined : "Примените корректировки из economy.corrections",
     });

     // 4. Stability index > 0.7
     const stability = econ.simulation_results.aggregated.stability_index;
     const c4Passed = stability > 0.7;
     checks.push({
       check_id: 4,
       check_name: "Stability index",
       question: "Stability index > 0.7?",
       passed: c4Passed,
       score: stability,
       evidence: `stability_index = ${stability.toFixed(2)}`,
     });

     // 5. Stall frequency < 0.2
     const stall = econ.simulation_results.aggregated.stall_frequency;
     const c5Passed = stall < 0.2;
     checks.push({
       check_id: 5,
       check_name: "Stall frequency",
       question: "Stall frequency < 20%?",
       passed: c5Passed,
       score: Math.max(0, 1 - stall),
       evidence: `stall_frequency = ${stall.toFixed(2)}`,
     });

     // 6. Runaway frequency < 0.1
     const runaway = econ.simulation_results.aggregated.runaway_frequency;
     const c6Passed = runaway < 0.1;
     checks.push({
       check_id: 6,
       check_name: "Runaway frequency",
       question: "Runaway frequency < 10%?",
       passed: c6Passed,
       score: Math.max(0, 1 - runaway * 2),
       evidence: `runaway_frequency = ${runaway.toFixed(2)}`,
     });

     // 7. Balancing loops сильнее reinforcing
     const balancing = econ.simulation_results.feedback_loops
       .filter(fl => fl.type === "balancing")
       .reduce((s, fl) => s + fl.strength, 0);
     const reinforcing = econ.simulation_results.feedback_loops
       .filter(fl => fl.type === "reinforcing")
       .reduce((s, fl) => s + fl.strength, 0);
     const c7Passed = balancing >= reinforcing * 0.5;
     checks.push({
       check_id: 7,
       check_name: "Balancing loops",
       question: "Balancing loops сильнее reinforcing?",
       passed: c7Passed,
       score: c7Passed ? 0.8 : 0.3,
       evidence: `balancing=${balancing.toFixed(2)}, reinforcing=${reinforcing.toFixed(2)}`,
     });

     // 8. Resource count соответствует жанру (5-8 ресурсов типично)
     const c8Passed = econ.resource_count >= 3 && econ.resource_count <= 12;
     checks.push({
       check_id: 8,
       check_name: "Resource count",
       question: "Количество ресурсов в разумных пределах (3-12)?",
       passed: c8Passed,
       score: c8Passed ? 0.8 : 0.4,
       evidence: `resource_count = ${econ.resource_count}`,
     });

     // 9. No dead resources (drain = 0 AND faucet = 0)
     const deadResources = econ.resources.filter(r => r.faucet === 0 && r.drain === 0);
     const c9Passed = deadResources.length === 0;
     checks.push({
       check_id: 9,
       check_name: "No dead resources",
       question: "Все ресурсы имеют faucet или drain?",
       passed: c9Passed,
       score: c9Passed ? 0.9 : Math.max(0.1, 1 - deadResources.length * 0.2),
       evidence: deadResources.length > 0
         ? `Dead resources: ${deadResources.map(r => r.name).join(", ")}`
         : "Все ресурсы активны",
     });

     // 10. Simulation overall_pass
     const c10Passed = econ.simulation_results.quality.overall_pass;
     checks.push({
       check_id: 10,
       check_name: "Simulation pass",
       question: "Симуляция экономики прошла?",
       passed: c10Passed,
       score: c10Passed ? 0.9 : 0.2,
       evidence: c10Passed
         ? "Симуляция прошла"
         : `Critical issues: ${econ.simulation_results.quality.critical_issues.join("; ")}`,
     });

     // 11. No single-point-of-failure (один ресурс не должен быть единственным faucet для всех остальных)
     // Эвристика: максимум 60% ресурсов зависят от одного faucet
     // (упрощённая проверка, подробная требует dependency graph)
     const c11Passed = true;  // placeholder — требует Block 5b expansion
     checks.push({
       check_id: 11,
       check_name: "Single point of failure",
       question: "Нет единой точки отказа в экономике?",
       passed: c11Passed,
       score: 0.7,
       evidence: "Проверка требует dependency graph (Block 5b expansion)",
     });

     // 12. Conversion chain diversity (>=2 independent chains)
     const chainCount = econ.conversion_chains.length;
     const c12Passed = chainCount >= 2;
     checks.push({
       check_id: 12,
       check_name: "Conversion chain diversity",
       question: ">=2 независимых циклов конверсии?",
       passed: c12Passed,
       score: c12Passed ? 0.8 : 0.4,
       evidence: `${chainCount} chains`,
     });

     const overall = checks.reduce((s, c) => s + c.score, 0) / checks.length;
     return { checks, overall_score: overall };
   }
   ```

2. **Переписать `runEconomyCheck` в `checklist-logic.ts`**:

   ```ts
   import { runEconomyChecklist } from "@/lib/economy-checklist";

   function runEconomyCheck(project: ProjectData): {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_economy_score: number;  // NEW (раньше не было)
     economy_checks?: EconomyCheckResult[];  // NEW
   } {
     const economy = project.economy;
     if (!economy) {
       return { skipped: true, issues: [], overall_economy_score: 0 };
     }

     const fullProfile = economy.fullProfile
       ? safeJsonParse<any>(economy.fullProfile, {})
       : {};
     const simResults = economy.simulationResults
       ? safeJsonParse<any>(economy.simulationResults, {})
       : {};
     const pathologies = economy.pathologies
       ? safeJsonParse<any[]>(economy.pathologies, [])
       : [];

     const result = runEconomyChecklist({
       economy: {
         system_type: economy.systemType ?? "default",
         resource_count: economy.resourceCount ?? 0,
         has_pathology: economy.hasPathology,
         pathologies,
         simulation_results: {
           quality: simResults.quality || { overall_pass: !economy.hasPathology, critical_issues: [] },
           aggregated: simResults.aggregated || {
             stability_index: 0.5,
             faucet_drain_ratio: {},
             stall_frequency: 0,
             runaway_frequency: 0,
           },
           feedback_loops: fullProfile.feedback_loops || [],
         },
         resources: fullProfile.resources || [],
         conversion_chains: fullProfile.conversion_chains || [],
       },
     });

     const issues: ChecklistIssue[] = result.checks
       .filter(c => !c.passed)
       .map(c => ({
         severity: c.score < 0.3 ? "error" : "warning",
         issue_type: `economy_check_${c.check_id}_${c.check_name.toLowerCase().replace(/\s/g, "_")}`,
         description: `${c.check_name}: ${c.evidence}`,
         suggestion: c.suggestion || `Пересмотрите ${c.check_name}`,
       }));

     if (issues.length === 0) {
       issues.push({
         severity: "info",
         issue_type: "economy_12pt_ok",
         description: "Все 12 checks экономики пройдены",
         suggestion: "Контролируйте при live-ops изменениях",
       });
     }

     return {
       skipped: false,
       issues,
       overall_economy_score: Number(clamp(result.overall_score).toFixed(3)),
       economy_checks: result.checks,
     };
   }
   ```

3. **Обновить `ChecklistValidationProfile`** type: `economy_check?`
   теперь содержит `overall_economy_score` и `economy_checks`.

**Тест-кейсы**:

- `runEconomyChecklist({economy: {simulation_results: {aggregated: {stability_index: 0.3}}}})`
  → check #4 не passed.
- `runEconomyChecklist({economy: {resources: [{faucet: 0, drain: 0}]}})`
  → check #9 не passed (dead resource).
- `runEconomyChecklist({economy: {pathologies: [{severity: "critical"}]}})`
  → check #3 не passed.
- Pipeline regression: `08_checklist.json` теперь содержит
  `economy_check.economy_checks` массив из 12 элементов.

**Риски**:

- **Зависимость от Block 5b**: `resources`, `conversion_chains`,
  `feedback_loops`, `aggregated.faucet_drain_ratio` — сейчас частично
  захардкожены или некорректны (см. Block 5b audit). После Block 5b
  рефакторинга значения станут реальными.
- **Bible 6.13.4 точные 12 checks**: спецификация в `bible_2_6_economy_progression.md`
  должна быть сверена с реализацией. Если в Bible указаны другие 12 checks,
  скорректировать `check_name`/`question`.

**Dependencies**: TASK-6b.1. Желательно Block 5b TASK-5b.9 (который тоже
реализует 12-point checklist в Block 5b route — нужно решить, кто owner:
`runEconomyCheck` в Block 6b OR `validateEconomy` в Block 5b. Решение:
Block 5b генерирует данные, Block 6b валидирует — оба вызывают общую
`runEconomyChecklist` из `src/lib/economy-checklist.ts`).

---

### TASK-6b.9: Реализовать 11 narrative document types validation (Bible 11.4.1) — расширить `runNarrativeCheck`

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-6b.11 Level 6)
**Файлы**: новый `src/lib/narrative-checklist.ts`, `src/lib/checklist-logic.ts` (переписать `runNarrativeCheck`)

**Описание проблемы**:

Bible 11.4.1 специфицирует **11 narrative document types** (см. audit 6b.4):
1. Логлайн истории
2. Тип нарратива (linear/branching/open)
3. Структура сюжета (3-act, 5-act, hero's journey)
4. Трёхактная арка (завязка/нарастание/кульминация)
5. Библия персонажа
6. Матрица квестов
7. Лудонарративная валидация (гармония/ирония/диссонанс)
8. Triangle of Weirdness (Роджерс)
9. Драматическая арка (завязка→нарастание→кульминация)
10. Агентивность (3 уровня: выбор→влияние→смысл)
11. Тон и голос (tone/voice consistency)

Текущая реализация `runNarrativeCheck` (checklist-logic.ts:326–392) имеет
только 3 generic checks:
1. `ludonarrative_dissonance` — `ludonarrativeCheck.issues.length > 0`
2. `narrative_no_usp` — `!concept.usp`
3. `narrative_no_gdd` — для `narrative_bible`/`visual_novel` жанров

**Решение**:

1. **Создать `src/lib/narrative-checklist.ts`**:

   ```ts
   export interface NarrativeCheckResult {
     check_id: number;        // 1..11
     check_name: string;
     question: string;
     passed: boolean;
     score: number;
     evidence: string;
     suggestion?: string;
   }

   export interface NarrativeChecklistInput {
     gdd: {
       sections: {
         narrative?: { content: string };
         world_overview?: { content: string };
         characters?: { content: string };
         plot_arcs?: { content: string };
         themes?: { content: string };
         tone_voice?: { content: string };
         story_mechanics?: { content: string };
         branching_structure?: { content: string };
       };
     };
     concept: { usp?: string | null; primary_aesthetic?: string | null };
     mda: {
       ludonarrative_check?: {
         result?: string;       // "Гармония" | "Ирония" | "Диссонанс"
         issues?: unknown[];
         agency?: number;       // 0..3
       };
     };
     genre?: string | null;
   }

   export function runNarrativeChecklist(input: NarrativeChecklistInput): {
     checks: NarrativeCheckResult[];
     overall_score: number;
   } {
     const checks: NarrativeCheckResult[] = [];
     const sections = input.gdd.sections;

     // 1. Логлайн истории
     const hasLogline = /логлайн|logline|одн.*предложени|one.?sentence/i.test(
       sections.narrative?.content || ""
     );
     checks.push({
       check_id: 1,
       check_name: "Логлайн истории",
       question: "Сформулирован логлайн истории?",
       passed: hasLogline,
       score: hasLogline ? 0.8 : 0.3,
       evidence: hasLogline ? "Логлайн найден в narrative секции" : "Логлайн отсутствует",
     });

     // 2. Тип нарратива
     const hasNarrativeType = /linear|branching|open|линейн|ветвящ|открыт/i.test(
       sections.story_mechanics?.content || ""
     );
     checks.push({
       check_id: 2,
       check_name: "Тип нарратива",
       question: "Определён тип нарратива (linear/branching/open)?",
       passed: hasNarrativeType,
       score: hasNarrativeType ? 0.8 : 0.3,
       evidence: hasNarrativeType ? "Тип нарратива указан" : "Тип нарратива не определён",
     });

     // 3. Структура сюжета
     const hasPlotStructure = /3.?act|5.?act|hero.?s.?journey|three.?act|пятиакт|трёхакт|путь.*героя/i.test(
       sections.plot_arcs?.content || ""
     );
     checks.push({
       check_id: 3,
       check_name: "Структура сюжета",
       question: "Определена структура сюжета (3-act/5-act/hero's journey)?",
       passed: hasPlotStructure,
       score: hasPlotStructure ? 0.8 : 0.3,
       evidence: hasPlotStructure ? "Структура сюжета описана" : "Структура сюжета не указана",
     });

     // 4. Трёхактная арка
     const hasThreeActArc = /завязк|нарастан|кульминац|act.?i|act.?ii|act.?iii|setup|confrontation|resolution/i.test(
       sections.plot_arcs?.content || ""
     );
     checks.push({
       check_id: 4,
       check_name: "Трёхактная арка",
       question: "Описана трёхактная арка?",
       passed: hasThreeActArc,
       score: hasThreeActArc ? 0.8 : 0.3,
       evidence: hasThreeActArc ? "Трёхактная арка описана" : "Трёхактная арка отсутствует",
     });

     // 5. Библия персонажа
     const hasCharacterBible = !!sections.characters?.content
                            && sections.characters.content.length > 100;
     checks.push({
       check_id: 5,
       check_name: "Библия персонажа",
       question: "Создана библия персонажа?",
       passed: hasCharacterBible,
       score: hasCharacterBible ? 0.8 : 0.3,
       evidence: hasCharacterBible
         ? `characters секция: ${sections.characters.content.length} символов`
         : "characters секция пуста или слишком короткая",
     });

     // 6. Матрица квестов
     const hasQuestMatrix = /квест|quest|мисси|mission|матрица/i.test(
       sections.plot_arcs?.content || ""
     );
     checks.push({
       check_id: 6,
       check_name: "Матрица квестов",
       question: "Описана матрица квестов?",
       passed: hasQuestMatrix,
       score: hasQuestMatrix ? 0.8 : 0.3,
       evidence: hasQuestMatrix ? "Квесты упомянуты" : "Квесты не описаны",
     });

     // 7. Лудонарративная валидация (Гармония/Ирония/Диссонанс)
     const ln = input.mda.ludonarrative_check;
     const harmonyScore = ln?.result === "Гармония" ? 0.9
                       : ln?.result === "Ирония" ? 0.6
                       : ln?.result === "Диссонанс" ? 0.2
                       : 0.5;
     checks.push({
       check_id: 7,
       check_name: "Лудонарративная валидация",
       question: "Гармония/Ирония/Диссонанс (Адамс/Дорманс)?",
       passed: harmonyScore >= 0.5,
       score: harmonyScore,
       evidence: `result = ${ln?.result || "не определён"}, issues = ${ln?.issues?.length || 0}`,
     });

     // 8. Triangle of Weirdness (Роджерс)
     const hasTriangle = /triangle.*weird|треугольник.*странност|weirdness/i.test(
       sections.themes?.content || ""
     );
     checks.push({
       check_id: 8,
       check_name: "Triangle of Weirdness",
       question: "Описан Triangle of Weirdness (Роджерс)?",
       passed: hasTriangle,
       score: hasTriangle ? 0.8 : 0.3,
       evidence: hasTriangle ? "Triangle of Weirdness упомянут" : "Triangle of Weirdness отсутствует",
     });

     // 9. Драматическая арка (отдельно от 3-act — для не-3-act структур)
     const hasDramaticArc = /драматическ|dramatic.?arc|напряжен|tension|conflict|конфликт/i.test(
       sections.plot_arcs?.content || ""
     );
     checks.push({
       check_id: 9,
       check_name: "Драматическая арка",
       question: "Описана драматическая арка (tension/conflict)?",
       passed: hasDramaticArc,
       score: hasDramaticArc ? 0.8 : 0.3,
       evidence: hasDramaticArc ? "Драматическая арка описана" : "Драматическая арка отсутствует",
     });

     // 10. Агентивность (3 уровня: выбор → влияние → смысл)
     const agency = ln?.agency ?? 0;
     checks.push({
       check_id: 10,
       check_name: "Агентивность",
       question: "3 уровня (выбор → влияние → смысл)?",
       passed: agency >= 2,
       score: agency / 3,
       evidence: `agency level = ${agency}/3`,
       suggestion: agency < 3
         ? "Усилите агентивность: добавьте выборы с влиянием и смыслом"
         : undefined,
     });

     // 11. Тон и голос (tone/voice consistency)
     const hasToneVoice = !!sections.tone_voice?.content
                       && sections.tone_voice.content.length > 50;
     checks.push({
       check_id: 11,
       check_name: "Тон и голос",
       question: "Описаны тон и голос (tone/voice)?",
       passed: hasToneVoice,
       score: hasToneVoice ? 0.8 : 0.3,
       evidence: hasToneVoice
         ? `tone_voice секция: ${sections.tone_voice.content.length} символов`
         : "tone_voice секция пуста",
     });

     const overall = checks.reduce((s, c) => s + c.score, 0) / checks.length;
     return { checks, overall_score: overall };
   }
   ```

2. **Переписать `runNarrativeCheck` в `checklist-logic.ts`** — использовать
   `runNarrativeChecklist` + сохранить genre-specific logic:

   ```ts
   import { runNarrativeChecklist } from "@/lib/narrative-checklist";

   function runNarrativeCheck(project: ProjectData): {
     skipped: boolean;
     issues: ChecklistIssue[];
     overall_narrative_score: number;
     narrative_checks?: NarrativeCheckResult[];  // NEW
   } {
     const mda = project.mdaProfile;
     const concept = project.concept;
     if (!mda && !concept) {
       return { skipped: true, issues: [], overall_narrative_score: 0 };
     }

     const gddSections = project.gdd?.fullProfile
       ? safeJsonParse<{ sections?: Record<string, any> }>(project.gdd.fullProfile, {}).sections || {}
       : {};

     const ludonarrativeCheck = mda?.ludonarrativeCheck
       ? safeJsonParse<any>(mda.ludonarrativeCheck, {})
       : null;

     const result = runNarrativeChecklist({
       gdd: { sections: gddSections },
       concept: { usp: concept?.usp, primary_aesthetic: concept?.primaryAesthetic },
       mda: { ludonarrative_check: ludonarrativeCheck },
       genre: project.genre,
     });

     const issues: ChecklistIssue[] = result.checks
       .filter(c => !c.passed)
       .map(c => ({
         severity: c.score < 0.3 ? "error" : "warning",
         issue_type: `narrative_check_${c.check_id}_${c.check_name.toLowerCase().replace(/\s/g, "_")}`,
         description: `${c.check_name}: ${c.evidence}`,
         suggestion: c.suggestion || `Пересмотрите ${c.check_name}`,
       }));

     // Genre-specific: narrative_bible / visual_novel требуют GDD
     if (project.genre === "narrative_bible" || project.genre === "visual_novel") {
       if (!project.gdd) {
         issues.push({
           severity: "warning",
           issue_type: "narrative_no_gdd",
           description: "Нарративно-ориентированной игре нужен narrative bible",
           suggestion: "Сгенерируйте GDD с форматом narrative_bible",
         });
       }
     }

     if (issues.length === 0) {
       issues.push({
         severity: "info",
         issue_type: "narrative_11pt_ok",
         description: "Все 11 narrative checks пройдены",
         suggestion: "Перепроверяйте после изменений сюжета",
       });
     }

     return {
       skipped: false,
       issues,
       overall_narrative_score: Number(clamp(result.overall_score).toFixed(3)),
       narrative_checks: result.checks,
     };
   }
   ```

3. **Обновить `ChecklistValidationProfile`** type: `narrative_check?`
   теперь содержит `narrative_checks` массив.

**Тест-кейсы**:

- `runNarrativeChecklist({gdd: {sections: {}}})` → все 11 checks не passed.
- `runNarrativeChecklist({mda: {ludonarrative_check: {result: "Гармония", agency: 3}}})`
  → checks #7, #10 passed.
- `runNarrativeChecklist({gdd: {sections: {tone_voice: {content: "..."}}}})`
  → check #11 passed.
- Pipeline regression: `08_checklist.json` теперь содержит
  `narrative_check.narrative_checks` массив из 11 элементов.

**Риски**:

- **Зависимость от Block 6 GDD секций**: `narrative`, `world_overview`,
  `characters`, `plot_arcs`, `themes`, `tone_voice`, `story_mechanics`,
  `branching_structure` — сейчас все 8 возвращают один и тот же
  ludonarrativeCheck JSON (Block 6 audit RC-3). После Block 6 TASK-6.3
  секции получат разный контент, и narrative checks станут точнее.
- **`agency` field**: `ludonarrativeCheck.agency` сейчас всегда `undefined`
  (Block 3 не выставляет). Решение: дефолт `0` + warning.
- **`result` field**: сейчас всегда "Гармония" (Block 3 hardcoded). После
  Block 3 рефакторинга станет реальным.

**Dependencies**: TASK-6b.1. Желательно Block 6 TASK-6.3 (derive narrative
sections separately), Block 3 TASK-3.4 (Reverse MDA + real ludonarrative).

---

### TASK-6b.10: Реализовать Universal Design Validator 10 уровней (Bible 11.6.1)

**Сложность**: XL
**Приоритет**: 🔴 (после TASK-6b.2, 6b.3, 6b.4, 6b.5, 6b.6, 6b.7, 6b.8, 6b.9)
**Файлы**: новый `src/lib/universal-design-validator.ts`, новый `src/constants/validator-levels.ts`, `src/lib/checklist-logic.ts` (вызывать UD validator из `runChecklistValidation`)

**Описание проблемы**:

Bible 11.6.1 специфицирует **Universal Design Validator** — 10 уровней
валидации, каждый с 5-10 checks (~80+ total):

```
УРОВЕНЬ 1: ВАЛИДАЦИЯ КОНЦЕПЦИИ (8 фильтров Шелла + 5 sub-checks)
УРОВЕНЬ 2: ВАЛИДАЦИЯ МЕХАНИК (6 эвристик Аптона + 5 sub-checks)
УРОВЕНЬ 3: ВАЛИДАЦИЯ CORE LOOP (5 sub-checks)
УРОВЕНЬ 4: ВАЛИДАЦИЯ БАЛАНСА (7-point Rolling/Morris + 6 sub-checks)
УРОВЕНЬ 5: ВАЛИДАЦИЯ ЭКОНОМИКИ И ПРОГРЕССИИ (12-point + 5 sub-checks)
УРОВЕНЬ 6: ВАЛИДАЦИЯ НАРРАТИВА (11 narrative checks + 5 sub-checks)
УРОВЕНЬ 7: ВАЛИДАЦИЯ LEVEL DESIGN (5 sub-checks + 7 Бонд методов)
УРОВЕНЬ 8: ВАЛИДАЦИЯ ОПЫТА (5 Фуллертон + 4+3 Бонд + 5 sub-checks)
УРОВЕНЬ 9: ВАЛИДАЦИЯ ИНТЕРФЕЙСА (6 принципов UI Фуллертон + 4 sub-checks)
УРОВЕНЬ 10: ВАЛИДАЦИЯ ДОКУМЕНТАЦИИ (5 sub-checks)
```

Текущая реализация `checklist-logic.ts` покрывает (частично):
- Level 2 (MDA check) — 3 checks вместо ~11
- Level 3 (no core loop check) — 0
- Level 4 (balance check) — 4 checks вместо ~13
- Level 5 (economy check) — 3 checks вместо ~17
- Level 6 (narrative check) — 3 checks вместо ~16

**Отсутствуют полностью**: Levels 1, 7, 8, 9, 10.

**Решение**:

1. **Создать `src/constants/validator-levels.ts`** — конфигурация 10
   уровней:

   ```ts
   export interface ValidatorLevelConfig {
     level: number;           // 1..10
     name: string;
     description: string;
     // Bible 11.6.2 adaptive prioritization
     default_weight: number;  // 0..1, сумма = 1.0
     // Per-genre weight overrides (Bible 11.6.2 таблица)
     genre_weights?: Partial<Record<string, number>>;
     // Источник данных и функция-исполнитель
     check_runner: "concept" | "mechanics" | "core_loop" | "balance"
                 | "economy_progression" | "narrative" | "level_design"
                 | "experience" | "interface" | "documentation";
   }

   export const VALIDATOR_LEVELS: ValidatorLevelConfig[] = [
     {
       level: 1,
       name: "ВАЛИДАЦИЯ КОНЦЕПЦИИ",
       description: "8 фильтров Шелла, логлайн, эстетика, аудитория, USP, реализуемость",
       default_weight: 0.10,
       genre_weights: {
         narrative: 0.15,
         rpg: 0.12,
         pvp_shooter: 0.06,
         mobile_f2p: 0.08,
       },
       check_runner: "concept",
     },
     {
       level: 2,
       name: "ВАЛИДАЦИЯ МЕХАНИК",
       description: "6 эвристик Аптона, тетрада, MechanicsDB, метафора, пространство состояний",
       default_weight: 0.10,
       genre_weights: {
         strategy: 0.15,
         pvp_shooter: 0.12,
         rpg: 0.10,
       },
       check_runner: "mechanics",
     },
     {
       level: 3,
       name: "ВАЛИДАЦИЯ CORE LOOP",
       description: "5 вопросов кор-геймплея, 30 секунд веселья, концентрические схемы",
       default_weight: 0.12,
       genre_weights: {
         pvp_shooter: 0.18,
         mobile_f2p: 0.15,
         rpg: 0.10,
       },
       check_runner: "core_loop",
     },
     {
       level: 4,
       name: "ВАЛИДАЦИЯ БАЛАНСА",
       description: "3 типа баланса, Q-фактор, SPS, золотое правило, cost-power, масштабируемость",
       default_weight: 0.12,
       genre_weights: {
         pvp_shooter: 0.18,
         strategy: 0.18,
         rpg: 0.08,
         narrative: 0.05,
       },
       check_runner: "balance",
     },
     {
       level: 5,
       name: "ВАЛИВАЦИЯ ЭКОНОМИКИ И ПРОГРЕССИИ",
       description: "Faucets/Drains, конверсии, патологии, кривая, эмерджентная прогрессия",
       default_weight: 0.10,
       genre_weights: {
         mobile_f2p: 0.18,
         strategy: 0.15,
         mmo: 0.15,
         rpg: 0.10,
         narrative: 0.05,
       },
       check_runner: "economy_progression",
     },
     {
       level: 6,
       name: "ВАЛИДАЦИЯ НАРРАТИВА",
       description: "Лудонарратив, гармония/ирония/диссонанс, агентивность, арка, Triangle of Weirdness",
       default_weight: 0.08,
       genre_weights: {
         narrative: 0.18,
         rpg: 0.12,
         pvp_shooter: 0.04,
         mobile_f2p: 0.03,
       },
       check_runner: "narrative",
     },
     {
       level: 7,
       name: "ВАЛИДАЦИЯ LEVEL DESIGN",
       description: "Читаемость, навигация, Combat Fronts, темп 3×3, Beat Chart + 7 Бонд методов",
       default_weight: 0.08,
       genre_weights: {
         pvp_shooter: 0.12,
         rpg: 0.10,
         platformer: 0.15,
         narrative: 0.10,
       },
       check_runner: "level_design",
     },
     {
       level: 8,
       name: "ВАЛИДАЦИЯ ОПЫТА",
       description: "Поток, кривая интереса, 5 убийц Фуллертон, 4+3 цели Бонд, мотивация",
       default_weight: 0.10,
       genre_weights: {
         narrative: 0.15,
         rpg: 0.12,
         mobile_f2p: 0.12,
         pvp_shooter: 0.08,
       },
       check_runner: "experience",
     },
     {
       level: 9,
       name: "ВАЛИДАЦИЯ ИНТЕРФЕЙСА",
       description: "6 принципов UI Фуллертон, сочность, время отклика, доступность, типы решений",
       default_weight: 0.10,
       genre_weights: {
         pvp_shooter: 0.15,
         mobile_f2p: 0.12,
         strategy: 0.12,
         rpg: 0.08,
       },
       check_runner: "interface",
     },
     {
       level: 10,
       name: "ВАЛИДАЦИЯ ДОКУМЕНТАЦИИ",
       description: "Полнота 38 секций, актуальность, обоснование, трассировка, аудитория",
       default_weight: 0.10,
       genre_weights: {
         // documentation важна для всех одинаково
       },
       check_runner: "documentation",
     },
   ];

   // Verify weights sum to 1.0
   export function validateWeights(): { ok: boolean; total: number; perGenre: Record<string, number> } {
     const total = VALIDATOR_LEVELS.reduce((s, l) => s + l.default_weight, 0);
     const perGenre: Record<string, number> = {};
     const allGenres = new Set<string>();
     VALIDATOR_LEVELS.forEach(l => {
       Object.keys(l.genre_weights || {}).forEach(g => allGenres.add(g));
     });
     for (const g of allGenres) {
       perGenre[g] = VALIDATOR_LEVELS.reduce(
         (s, l) => s + (l.genre_weights?.[g] ?? l.default_weight), 0
       );
     }
     return { ok: Math.abs(total - 1.0) < 0.001, total, perGenre };
   }
   ```

2. **Создать `src/lib/universal-design-validator.ts`** — main orchestrator:

   ```ts
   import { VALIDATOR_LEVELS, ValidatorLevelConfig } from "@/constants/validator-levels";
   import { runSchellIdeaFilters } from "./schell-idea-filters";
   import { runUptonHeuristics } from "./upton-heuristics";
   import { runRollingMorrisChecklist } from "./rolling-morris-checklist";
   import { runEconomyChecklist } from "./economy-checklist";
   import { runNarrativeChecklist } from "./narrative-checklist";
   import { runLevelDesignCheck } from "./level-design-validator";
   import { runExperienceCheck } from "./experience-validator";
   // + новые check functions для Levels 3, 9, 10

   export interface ValidatorLevelResult {
     level: number;
     name: string;
     weight: number;          // actual weight (after adaptive adjustment)
     score: number;           // 0..1
     passed: boolean;
     check_count: number;
     issues: ChecklistIssue[];
     details: Record<string, unknown>;  // level-specific data
   }

   export interface UniversalValidatorResult {
     levels: ValidatorLevelResult[];
     overall_score: number;   // weighted average
     readiness: "ready" | "almost" | "not_ready";
     // Bible 11.6.2 adaptive prioritization
     genre: string;
     weights_applied: Record<number, number>;  // level → weight
     // Bible 11.6.3 format
     summary: {
       critical_count: number;
       warning_count: number;
       info_count: number;
       top_5_issues: Array<{ severity: string; level: number; description: string }>;
       quick_wins: Array<{ description: string; effort: string }>;
     };
   }

   /**
    * Run Universal Design Validator (Bible 11.6.1).
    * Adaptive prioritization per genre (Bible 11.6.2).
    */
   export async function runUniversalDesignValidator(
     project: ProjectData,
     options: { genre?: string; levels?: number[] } = {}
   ): Promise<UniversalValidatorResult> {
     const genre = normalizeGenre(options.genre || project.genre);
     const requestedLevels = options.levels ?? VALIDATOR_LEVELS.map(l => l.level);

     // 1. Compute adaptive weights for genre
     const weights: Record<number, number> = {};
     let totalWeight = 0;
     for (const level of VALIDATOR_LEVELS) {
       if (!requestedLevels.includes(level.level)) continue;
       const w = level.genre_weights?.[genre] ?? level.default_weight;
       weights[level.level] = w;
       totalWeight += w;
     }
     // Normalize (in case requestedLevels is subset)
     for (const lvl in weights) {
       weights[lvl] = weights[lvl] / totalWeight;
     }

     // 2. Run each level's check_runner
     const levelResults: ValidatorLevelResult[] = [];
     for (const level of VALIDATOR_LEVELS) {
       if (!requestedLevels.includes(level.level)) continue;
       const result = await runLevelCheck(level, project, genre);
       levelResults.push({
         ...result,
         weight: weights[level.level],
       });
     }

     // 3. Weighted average
     const overall = levelResults.reduce(
       (s, r) => s + r.score * r.weight, 0
     );

     // 4. Aggregate issues
     const allIssues = levelResults.flatMap(r => r.issues);
     const critical = allIssues.filter(i => i.severity === "error");
     const warnings = allIssues.filter(i => i.severity === "warning");
     const infos = allIssues.filter(i => i.severity === "info");

     // 5. Readiness: ready if overall >= 0.8 AND no critical issues
     const readiness = overall >= 0.8 && critical.length === 0
       ? "ready"
       : overall >= 0.5
         ? "almost"
         : "not_ready";

     // 6. Top 5 issues (sorted by severity, then by level weight)
     const sevRank = { error: 0, warning: 1, info: 2 };
     const top5 = [...allIssues]
       .sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]))
       .slice(0, 5)
       .map(i => ({
         severity: i.severity,
         level: findLevelForIssue(i, levelResults),
         description: i.description,
       }));

     // 7. Quick wins (info/warning with easy effort)
     const quickWins = allIssues
       .filter(i => i.severity === "info" || i.severity === "warning")
       .slice(0, 3)
       .map(i => ({
         description: i.suggestion,
         effort: i.severity === "info" ? "easy" : "moderate",
       }));

     return {
       levels: levelResults,
       overall_score: Number(overall.toFixed(3)),
       readiness,
       genre,
       weights_applied: weights,
       summary: {
         critical_count: critical.length,
         warning_count: warnings.length,
         info_count: infos.length,
         top_5_issues: top5,
         quick_wins: quickWins,
       },
     };
   }

   async function runLevelCheck(
     level: ValidatorLevelConfig,
     project: ProjectData,
     genre: string
   ): Promise<Omit<ValidatorLevelResult, "weight">> {
     switch (level.check_runner) {
       case "concept":
         return runConceptLevel(project);
       case "mechanics":
         return runMechanicsLevel(project);
       case "core_loop":
         return runCoreLoopLevel(project);
       case "balance":
         return runBalanceLevel(project);
       case "economy_progression":
         return runEconomyProgressionLevel(project);
       case "narrative":
         return runNarrativeLevel(project);
       case "level_design":
         return runLevelDesignLevel(project);
       case "experience":
         return runExperienceLevel(project);
       case "interface":
         return runInterfaceLevel(project);   // NEW: Level 9
       case "documentation":
         return runDocumentationLevel(project); // NEW: Level 10
     }
   }

   // Level 9: Interface validation (Bible 11.6.1 УРОВЕНЬ 9)
   // 6 принципов UI Фуллертон, сочность, время отклика < 1/10s,
   // доступность, типы решений
   async function runInterfaceLevel(project: ProjectData) {
     const gddSections = project.gdd?.fullProfile
       ? safeJsonParse<any>(project.gdd.fullProfile, {}).sections || {}
       : {};

     const uiContent = (gddSections.hud_ui?.content || "")
                     + " " + (gddSections.menus_navigation?.content || "");

     const principles = [
       { id: 1, name: "Видимость", regex: /видим|visib|feedback|фидбэк/i },
       { id: 2, name: "Отзывчивость", regex: /ответ|respons|<.*1.*0.*sec|100ms|latency/i },
       { id: 3, name: "Консистентность", regex: /консистент|consistent|единый.*стиль/i },
       { id: 4, name: "Простота", regex: /простот|simpli|minimal|ясн/i },
       { id: 5, name: "Доступность", regex: /доступн|accessib|color.*blind|colorblind|motor|когнитив/i },
       { id: 6, name: "Эргономика", regex: /эргоном|ergonom|fitts.*law|закон.*фитса/i },
     ];

     const checks = principles.map(p => {
       const found = p.regex.test(uiContent);
       return {
         check_id: p.id,
         check_name: `Принцип UI Фуллертон #${p.id}: ${p.name}`,
         passed: found,
         score: found ? 0.8 : 0.3,
         evidence: found ? `Найдено в hud_ui/menus_navigation` : "Не описано в GDD",
       };
     });

     const issues = checks.filter(c => !c.passed).map(c => ({
       severity: "warning" as const,
       issue_type: `interface_principle_${c.check_id}`,
       description: c.evidence,
       suggestion: `Добавьте описание ${c.check_name} в hud_ui секцию`,
     }));

     const overall = checks.reduce((s, c) => s + c.score, 0) / checks.length;

     return {
       level: 9,
       name: "ВАЛИДАЦИЯ ИНТЕРФЕЙСА",
       score: Number(clamp(overall).toFixed(3)),
       passed: overall >= 0.5,
       check_count: checks.length,
       issues,
       details: { principles: checks },
     };
   }

   // Level 10: Documentation validation (Bible 11.6.1 УРОВЕНЬ 10)
   async function runDocumentationLevel(project: ProjectData) {
     const gdd = project.gdd;
     if (!gdd) {
       return {
         level: 10,
         name: "ВАЛИДАЦИЯ ДОКУМЕНТАЦИИ",
         score: 0,
         passed: false,
         check_count: 5,
         issues: [{
           severity: "error" as const,
           issue_type: "doc_no_gdd",
           description: "GDD не сгенерирован",
           suggestion: "Сгенерируйте GDD в Block 6",
         }],
         details: {},
       };
     }

     // 5 checks: completeness (38 sections), freshness, justification, traceability, audience
     const sectionCount = gdd.sectionCount ?? 0;
     const completenessScore = Math.min(1, sectionCount / 38);

     const fullProfile = gdd.fullProfile
       ? safeJsonParse<any>(gdd.fullProfile, {})
       : {};

     // Justification: % секций с "почему"
     const sections = fullProfile.sections || {};
     const sectionValues = Object.values(sections) as Array<{ content?: string }>;
     const justifiedSections = sectionValues.filter(s =>
       /почему|why|обоснован|justification|rationale/i.test(s.content || "")
     ).length;
     const justificationScore = sectionValues.length > 0
       ? justifiedSections / sectionValues.length
       : 0;

     // Freshness: updatedAt в пределах 30 дней
     const freshnessScore = 1.0;  // TODO: проверить gdd.updatedAt

     // Traceability: наличие source field в секциях
     const tracedSections = sectionValues.filter(s =>
       s && typeof s === "object" && "source" in s
     ).length;
     const traceabilityScore = sectionValues.length > 0
       ? tracedSections / sectionValues.length
       : 0;

     // Audience: docAudience field
     const audienceScore = fullProfile.doc_audience ? 1.0 : 0.5;

     const checks = [
       { id: 1, name: "Полнота (38 секций)", score: completenessScore, evidence: `${sectionCount}/38 секций` },
       { id: 2, name: "Актуальность", score: freshnessScore, evidence: "GDD обновлён недавно" },
       { id: 3, name: "Обоснование", score: justificationScore, evidence: `${justifiedSections}/${sectionValues.length} секций с "почему"` },
       { id: 4, name: "Трассировка", score: traceabilityScore, evidence: `${tracedSections}/${sectionValues.length} секций с source` },
       { id: 5, name: "Аудитория", score: audienceScore, evidence: fullProfile.doc_audience || "не указана" },
     ];

     const issues = checks.filter(c => c.score < 0.5).map(c => ({
       severity: c.score < 0.3 ? "error" : "warning" as const,
       issue_type: `doc_check_${c.id}`,
       description: `${c.name}: ${c.evidence}`,
       suggestion: `Улучшите ${c.name.toLowerCase()}`,
     }));

     const overall = checks.reduce((s, c) => s + c.score, 0) / checks.length;

     return {
       level: 10,
       name: "ВАЛИДАЦИЯ ДОКУМЕНТАЦИИ",
       score: Number(clamp(overall).toFixed(3)),
       passed: overall >= 0.5,
       check_count: checks.length,
       issues,
       details: { checks },
     };
   }

   // Level 3: Core Loop validation (Bible 11.6.1 УРОВЕНЬ 3)
   // 5 вопросов кор-геймплея, 30 секунд веселья, концентрические схемы,
   // 4 главные петли Селлерса, микро→мезо→макро→мета
   async function runCoreLoopLevel(project: ProjectData) {
     // TODO: implement (5 checks)
     // ...
   }
   ```

3. **Интегрировать в `runChecklistValidation`** (checklist-logic.ts) —
   добавить UD validator как superset:

   ```ts
   import { runUniversalDesignValidator } from "@/lib/universal-design-validator";

   export async function runChecklistValidation(
     project: ProjectData,
     action: string,
     options: RunOptions = {}
   ): Promise<ChecklistResult> {
     // ... existing 5 checks ...

     // NEW: Universal Design Validator (Bible 11.6.1)
     const udResult = await runUniversalDesignValidator(project, {
       genre: project.genre || project.concept?.genre || undefined,
       levels: action === "validate" ? undefined : undefined,  // all levels
     });

     // Use UD validator's overall_score as the authoritative score
     // (replaces buildSummary's hardcoded weights, see TASK-6b.12)
     const profile = {
       scope: { ... },
       mda_check: mdaCheck,
       balance_check: balanceCheck,
       narrative_check: narrativeCheck,
       economy_check: economyCheck,
       lens_check: lensCheck,
       concept_check: conceptCheck,         // NEW (TASK-6b.3)
       level_design_check: ldCheck,         // NEW (TASK-6b.6)
       experience_check: experienceCheck,   // NEW (TASK-6b.7)
       universal_design_validator: udResult, // NEW (Bible 11.6)
       summary: {
         overall_score: udResult.overall_score,
         readiness: udResult.readiness,
         top_5_issues: udResult.summary.top_5_issues,
         quick_wins: udResult.summary.quick_wins,
       },
       stages_completed: computeStagesCompleted(project),  // TASK-6b.12
       latency_ms: Date.now() - startedAt,
     };

     // ... persist (см. TASK-6b.14 для расширения DB schema) ...
   }
   ```

4. **Обновить `ChecklistValidationProfile`** type с `universal_design_validator?`
   полем и `concept_check?`, `level_design_check?`, `experience_check?`.

**Тест-кейсы**:

- `runUniversalDesignValidator(project без gdd)` → Level 10 score=0,
  Level 7/8/9 низкие (нет секций для проверки), overall < 0.4.
- `runUniversalDesignValidator(project с gdd, genre: "rpg")` →
  weights_applied: Level 6 (narrative) = 0.12, Level 4 (balance) = 0.08.
- `runUniversalDesignValidator(project, {genre: "pvp_shooter"})` →
  Level 3 (core_loop) weight=0.18, Level 4 (balance) weight=0.18.
- `runUniversalDesignValidator(project, {levels: [1, 2]})` → только
  Levels 1, 2 запущены, weights normalized to sum=1.
- `validateWeights()` → `ok: true, total: 1.0`.
- Pipeline regression: `08_checklist.json` теперь содержит
  `universal_design_validator.levels` массив из 10 элементов.

**Риски**:

- **Performance**: 10 levels × ~10 checks each = ~100 checks, включая
  GDD content regex matching — может занять 200–500ms на проект.
  Митигация: parallel execution (Promise.all для level checks), кэш
  по project.id+version.
- **Coverage gaps**: Levels 3 (Core Loop) и 9 (Interface) частично
  зависят от Block 2 и Block 6 секций. Если Block 6 имеет только 21
  секцию (не 38), Level 10 score будет низкий — это правильно.
- **Adaptive weights**: Bible 11.6.2 таблица жанров может требовать
  расширения (15+ жанров). Митигация: default weight если жанр не
  найден, документировать в `validator-levels.ts`.

**Dependencies**: TASK-6b.1 (route integration), TASK-6b.2 (113 lenses),
TASK-6b.3 (8 filters), TASK-6b.4 (6 Upton), TASK-6b.5 (7 Rolling/Morris),
TASK-6b.6 (7 Bond + Level 7), TASK-6b.7 (5 Fullerton + 4+3 Bond + Level 8),
TASK-6b.8 (12-point economy), TASK-6b.9 (11 narrative).

---

### TASK-6b.11: Реализовать adaptive prioritization по жанру (Bible 11.6.2)

**Сложность**: M
**Приоритет**: 🔴 (после TASK-6b.10)
**Файлы**: `src/constants/validator-levels.ts` (расширить genre_weights), `src/lib/universal-design-validator.ts` (расширить жанровый маппинг), новый `src/constants/genre-priority-matrix.ts`

**Описание проблемы**:

Bible 11.6.2 специфицирует **адаптивную приоритизацию** валидатора по
жанру и типу Core Loop:

| Жанр / Тип | Критичные уровни | Важные уровни | Второстепенные |
|-------------|-----------------|---------------|----------------|
| PvP-экшн (FPS, MOBA) | 3 (Core Loop), 4 (Баланс), 9 (Интерфейс) | 2 (Механики), 7 (LD), 8 (Опыт) | 6 (Нарратив), 5 (Экономика) |
| Single-player RPG | 6 (Нарратив), 5 (Прогрессия), 8 (Опыт) | 2 (Механики), 3 (Core Loop), 7 (LD) | 4 (Баланс PvP), 9 (Интерфейс) |
| Стратегия | 4 (Баланс), 5 (Экономика), 2 (Механики) | 3 (Core Loop), 8 (Опыт) | 6 (Нарратив), 7 (LD) |
| Нарративная игра | 6 (Нарратив), 8 (Опыт), 1 (Концепция) | 7 (LD), 2 (Механики) | 4 (Баланс), 5 (Экономика) |
| Мобильная F2P | 5 (Экономика), 3 (Core Loop), 8 (Опыт) | 1 (Концепция), 9 (Интерфейс) | 6 (Нарратив), 7 (LD) |

Текущая реализация `buildSummary` (checklist-logic.ts:511–513):
```ts
const overall = Number(
  clamp(mdaScore * 0.3 + balanceScore * 0.3 + narrativeScore * 0.3 + 0.1).toFixed(3)
);
```

Hardcoded weights `0.3/0.3/0.3/0.1` — не зависят от жанра.
`+0.1` baseline boost делает score всегда ≥ 0.1 даже при всех критических issues.

**Решение**:

1. **Создать `src/constants/genre-priority-matrix.ts`** — explicit mapping
   из Bible 11.6.2:

   ```ts
   export type PriorityTier = "critical" | "important" | "secondary";

   export interface GenrePriorityConfig {
     genre: string;
     // Bible 11.6.2 tiers
     critical_levels: number[];    // weight × 1.5
     important_levels: number[];   // weight × 1.0
     secondary_levels: number[];   // weight × 0.5
   }

   export const GENRE_PRIORITY_MATRIX: GenrePriorityConfig[] = [
     {
       genre: "pvp_shooter",
       critical_levels: [3, 4, 9],     // Core Loop, Balance, Interface
       important_levels: [2, 7, 8],   // Mechanics, LD, Experience
       secondary_levels: [6, 5],      // Narrative, Economy
     },
     {
       genre: "single_player_rpg",
       critical_levels: [6, 5, 8],     // Narrative, Progression, Experience
       important_levels: [2, 3, 7],   // Mechanics, Core Loop, LD
       secondary_levels: [4, 9],      // PvP Balance, Interface
     },
     {
       genre: "strategy",
       critical_levels: [4, 5, 2],     // Balance, Economy, Mechanics
       important_levels: [3, 8],       // Core Loop, Experience
       secondary_levels: [6, 7],       // Narrative, LD
     },
     {
       genre: "narrative",
       critical_levels: [6, 8, 1],     // Narrative, Experience, Concept
       important_levels: [7, 2],       // LD, Mechanics
       secondary_levels: [4, 5],       // Balance, Economy
     },
     {
       genre: "mobile_f2p",
       critical_levels: [5, 3, 8],     // Economy, Core Loop, Experience
       important_levels: [1, 9],       // Concept, Interface
       secondary_levels: [6, 7],       // Narrative, LD
     },
     // Default для unknown жанров — equal weights
     {
       genre: "default",
       critical_levels: [],
       important_levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
       secondary_levels: [],
     },
   ];

   // Маппинг runtime жанра → canonical genre key
   export const GENRE_CANONICAL_MAP: Record<string, string> = {
     // PvP shooters
     "fps": "pvp_shooter",
     "shooter": "pvp_shooter",
     "pvp_shooter": "pvp_shooter",
     "moba": "pvp_shooter",
     "battle_royale": "pvp_shooter",
     "fighting": "pvp_shooter",
     // Single-player RPG
     "rpg": "single_player_rpg",
     "single_player_rpg": "single_player_rpg",
     "action_rpg": "single_player_rpg",
     "jrpg": "single_player_rpg",
     "wrpg": "single_player_rpg",
     // Strategy
     "strategy": "strategy",
     "rts": "strategy",
     "tbs": "strategy",
     "4x": "strategy",
     "tower_defense": "strategy",
     // Narrative
     "narrative": "narrative",
     "visual_novel": "narrative",
     "narrative_bible": "narrative",
     "adventure": "narrative",
     "walking_sim": "narrative",
     // Mobile F2P
     "mobile_f2p": "mobile_f2p",
     "hyper_casual": "mobile_f2p",
     "casual": "mobile_f2p",
     // Не указаны явно → default
     // puzzle, platformer, racing, simulation, sandbox, metroidvania,
     // rhythm, roguelike, horror — все используют default
   };

   export function getGenrePriority(genre?: string | null): GenrePriorityConfig {
     if (!genre) return GENRE_PRIORITY_MATRIX.find(g => g.genre === "default")!;
     const canonical = GENRE_CANONICAL_MAP[genre.toLowerCase()]
                    || GENRE_CANONICAL_MAP[genre.toLowerCase().replace(/[\s-]/g, "_")]
                    || "default";
     return GENRE_PRIORITY_MATRIX.find(g => g.genre === canonical)
         || GENRE_PRIORITY_MATRIX.find(g => g.genre === "default")!;
   }
   ```

2. **Расширить `validator-levels.ts`** — auto-compute `genre_weights`
   из priority matrix:

   ```ts
   import { getGenrePriority, PriorityTier } from "./genre-priority-matrix";

   /**
    * Compute adaptive weights for a genre.
    * Bible 11.6.2: critical=×1.5, important=×1.0, secondary=×0.5.
    */
   export function computeAdaptiveWeights(genre?: string | null): Record<number, number> {
     const priority = getGenrePriority(genre);
     const weights: Record<number, number> = {};

     for (const level of VALIDATOR_LEVELS) {
       const baseWeight = level.default_weight;
       let multiplier = 1.0;
       if (priority.critical_levels.includes(level.level)) multiplier = 1.5;
       else if (priority.secondary_levels.includes(level.level)) multiplier = 0.5;
       else if (!priority.important_levels.includes(level.level)) multiplier = 1.0;
       weights[level.level] = baseWeight * multiplier;
     }

     // Normalize to sum=1.0
     const total = Object.values(weights).reduce((a, b) => a + b, 0);
     for (const lvl in weights) {
       weights[lvl] = weights[lvl] / total;
     }
     return weights;
   }
   ```

3. **Обновить `universal-design-validator.ts`** — использовать
   `computeAdaptiveWeights` вместо `level.genre_weights`:

   ```ts
   import { computeAdaptiveWeights } from "@/constants/validator-levels";

   export async function runUniversalDesignValidator(
     project: ProjectData,
     options: { genre?: string; levels?: number[] } = {}
   ): Promise<UniversalValidatorResult> {
     const genre = options.genre || project.genre || "default";
     const requestedLevels = options.levels ?? VALIDATOR_LEVELS.map(l => l.level);

     // NEW: adaptive weights from genre priority matrix
     const allWeights = computeAdaptiveWeights(genre);
     const weights: Record<number, number> = {};
     let totalWeight = 0;
     for (const lvl of requestedLevels) {
       weights[lvl] = allWeights[lvl] || 0;
       totalWeight += weights[lvl];
     }
     // Normalize for subset
     for (const lvl in weights) {
       weights[lvl] = weights[lvl] / totalWeight;
     }
     // ... rest unchanged ...
   }
   ```

4. **Удалить `genre_weights` из `VALIDATOR_LEVELS`** — теперь
   единственный источник правды это `genre-priority-matrix.ts`.

5. **Обновить `buildSummary`** — использовать UD validator overall_score
   (см. TASK-6b.10 step 3) вместо hardcoded `0.3/0.3/0.3/0.1`.

**Тест-кейсы**:

- `computeAdaptiveWeights("fps")` → Level 3 (Core Loop) weight
  нормализованный > Level 6 (Narrative) weight (т.к. Level 3 critical,
  Level 6 secondary).
- `computeAdaptiveWeights("rpg")` → Level 6 (Narrative) weight
  нормализованный > Level 4 (PvP Balance) weight.
- `computeAdaptiveWeights(undefined)` → все levels имеют equal weight
  (= default_weight, normalized).
- `computeAdaptiveWeights("unknown_genre")` → fallback на default
  (equal weights).
- `getGenrePriority("MOBA")` (uppercase) → `pvp_shooter` config.
- `getGenrePriority("tower defense")` (with space) → `strategy` config.
- Pipeline regression: 10 test_projects с разными жанрами теперь
  дают **разные** `weights_applied` и разные `overall_score`.

**Риски**:

- **Жанровый маппинг**: 10 test_projects используют жанры "RPG",
  "Tower Defense", "Rhythm", "Puzzle", "Metroidvania", "Strategy",
  "Sandbox", "Shooter", "Simulation", "Racing". Из них:
  - RPG → single_player_rpg ✓
  - Tower Defense → strategy ✓
  - Rhythm → default (не указан в Bible 11.6.2)
  - Puzzle → default
  - Metroidvania → default
  - Strategy → strategy ✓
  - Sandbox → default
  - Shooter → pvp_shooter ✓
  - Simulation → default
  - Racing → default
  Только 3/10 имеют canonical mapping. Митигация: расширить
  `GENRE_CANONICAL_MAP` с implicit mappings (Rhythm → mobile_f2p или
  default; Puzzle → default; Metroidvania → single_player_rpg).
- **Bible 11.6.2 не покрывает все жанры**: Bible указывает только 5
  жанровых категорий. Решение: для uncovered жанров использовать
  default equal weights, но документировать как known limitation.

**Dependencies**: TASK-6b.10 (UD validator infrastructure).

---

### TASK-6b.12: Починить hardcoded weights, clamp baseline, dynamic stages_completed

**Сложность**: S
**Приоритет**: 🔴 (после TASK-6b.10)
**Файлы**: `src/lib/checklist-logic.ts` (строки 511–513, 679)

**Описание проблемы**:

Три захардкоженных значения в `checklist-logic.ts`:

1. **Строки 511–513** — `buildSummary`:
   ```ts
   const overall = Number(
     clamp(mdaScore * 0.3 + balanceScore * 0.3 + narrativeScore * 0.3 + 0.1).toFixed(3)
   );
   ```
   - Weights `0.3/0.3/0.3` не зависят от жанра (нарушение Bible 11.6.2).
   - `+0.1` baseline boost → score всегда ≥ 0.1, даже если все checks failed.
   - Не учитывает economy_check, lens_check, concept_check, ld_check,
     experience_check.

2. **Строка 679** — `stages_completed: [1, 2, 3, 4, 5, 6]` hardcoded.

3. **clamp** (строки 179–181):
   ```ts
   function clamp(n: number, min = 0, max = 1): number {
     return Math.max(min, Math.min(max, n));
   }
   ```
   Score всегда в [0, 1]. 5 critical issues всё равно дают score ≥ 0
   (не negative penalty).

**Решение**:

1. **Заменить `buildSummary`** — делегировать в `runUniversalDesignValidator`
   (TASK-6b.10):

   ```ts
   // OLD (удалить):
   function buildSummary(mdaScore, balanceScore, narrativeScore, allIssues) {
     const overall = Number(
       clamp(mdaScore * 0.3 + balanceScore * 0.3 + narrativeScore * 0.3 + 0.1).toFixed(3)
     );
     // ...
   }

   // NEW: использовать UD validator's overall_score (computed в TASK-6b.10)
   // buildSummary остаётся только для fallback если UD validator не запущен
   function buildSummary(
     scores: { mda: number; balance: number; narrative: number;
               economy?: number; lens?: number; concept?: number;
               ld?: number; experience?: number },
     weights: Record<string, number>,
     allIssues: ChecklistIssue[]
   ) {
     // Weighted average без baseline boost
     const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
     const overall = Object.entries(scores).reduce(
       (sum, [key, score]) => sum + score * (weights[key] || 0), 0
     ) / weightSum;

     // Penalty за critical issues: -0.1 per critical (но не ниже 0)
     const criticalCount = allIssues.filter(i => i.severity === "error").length;
     const penalizedScore = Math.max(0, overall - criticalCount * 0.05);

     const readiness =
       penalizedScore >= 0.8 ? "ready"
       : penalizedScore >= 0.5 ? "almost"
       : "not_ready";
     // ... rest unchanged ...
     return { overall_score: penalizedScore, readiness, top_5_issues, quick_wins };
   }
   ```

2. **Динамический `stages_completed`** — вычислять из actual upstream
   block status:

   ```ts
   function computeStagesCompleted(project: ProjectData): number[] {
     const stages: number[] = [];
     if (project.concept) stages.push(1);
     if (project.coreLoop) stages.push(2);
     if (project.mdaProfile) stages.push(3);
     if (project.balanceResult) stages.push(4);
     if (project.progression || project.economy) stages.push(5);
     if (project.gdd) stages.push(6);
     // 7 = validation (текущий блок, всегда добавляем если запущен)
     stages.push(7);
     // 8 = prototypes (если есть prototype data — TODO)
     return stages;
   }
   ```

   Заменить `stages_completed: [1, 2, 3, 4, 5, 6]` на
   `stages_completed: computeStagesCompleted(project)`.

3. **Расширить `clamp`** — добавить optional penalty mode:

   ```ts
   function clamp(n: number, min = 0, max = 1): number {
     return Math.max(min, Math.min(max, n));
   }

   // NEW: clamp с penalty (для critical issues)
   function clampWithPenalty(n: number, penalty: number, min = 0, max = 1): number {
     return Math.max(min, Math.min(max, n - penalty));
   }
   ```

4. **Удалить `+0.1` baseline boost** — теперь UD validator считает
   real weighted average, нет нужды в artificial floor.

**Тест-кейсы**:

- `buildSummary({mda: 0, balance: 0, narrative: 0}, {mda: 0.3, balance: 0.3, narrative: 0.3, economy: 0.1}, [5 error issues])`
  → overall_score = 0 (не 0.1+ как раньше).
- `computeStagesCompleted({concept: ...})` → `[1, 7]` (только concept
  и validation).
- `computeStagesCompleted({concept: ..., coreLoop: ..., mdaProfile: ..., gdd: ...})`
  → `[1, 2, 3, 6, 7]`.
- Pipeline regression: 10 test_projects теперь имеют разные
  `stages_completed` (некоторые без balanceResult → без stage 4).

**Риски**:

- **Backward compat**: существующие UI/clients могут ожидать
  `stages_completed = [1,2,3,4,5,6]`. Митигация: обновить
  `ChecklistPanel.tsx` (если он использует stages_completed).
  Проверка: grep `stages_completed` в `src/` — найти consumers.
- **Penalty formula**: `-0.05 per critical issue` субъективна.
  Митигация: вынести в `src/constants/checklist.ts` как
  `CRITICAL_ISSUE_PENALTY = 0.05`, сделать configurable.

**Dependencies**: TASK-6b.10 (UD validator), TASK-6b.11 (adaptive weights).

---

### TASK-6b.13: Создать `enrichChecklist` в ai-service.ts + persist ai_insights

**Сложность**: M
**Приоритет**: 🟡 (после TASK-6b.10)
**Файлы**: `src/lib/ai-service.ts` (добавить `enrichChecklist`), `src/lib/checklist-logic.ts` (вызывать enrichChecklist до persist)

**Описание проблемы**:

В `ai-service.ts` есть `enrichConcept`, `enrichCoreLoop`, `enrichMda`,
`enrichBalance`, `enrichProgression`, `enrichGdd`, `enrichGddSection`,
`generatePrototypeInsights`, `generateGraphFromText` — НО НЕТ
`enrichChecklist` / `enrichValidation` / `enrichValidator`.

Подтверждено grep:
```
$ grep -n "enrichChecklist\|enrichValidation\|enrichValidator" src/lib/ai-service.ts
(нет matches)
```

`checklist-logic.ts` НИКОГДА не вызывает AI enrichment — persist
`fullResults` без `ai_insights`.

**Решение**:

1. **Добавить `enrichChecklist` в `ai-service.ts`** (после `enrichGdd`):

   ```ts
   // ============================================================
   // AI enrichment for Block 6b (Checklist validation)
   // ============================================================

   export interface ChecklistAiInput {
     projectName: string;
     genre: string;
     overallScore: number;
     readiness: string;
     criticalCount: number;
     warningCount: number;
     topIssues: Array<{
       severity: string;
       level: number;
       description: string;
     }>;
     // Перечисление levels с scores
     levelScores: Array<{ level: number; name: string; score: number }>;
   }

   export interface ChecklistAiResult {
     overall_assessment: string;       // общий вердикт
     priority_actions: string[];        // топ-3 действия
     genre_specific_advice: string;     // советы по жанру
     risk_assessment: string;           // оценка рисков
     next_steps: string[];              // конкретные следующие шаги
   }

   export async function enrichChecklist(
     ctx: ChecklistAiInput
   ): Promise<ChecklistAiResult | null> {
     const zai = await getZai();
     if (!zai) return null;
     try {
       const prompt = `Ты — AI-аудитор геймдизайна. Проанализируй результат Universal Design Validator и дай рекомендации.

   Проект: ${ctx.projectName}
   Жанр: ${ctx.genre}
   Overall score: ${(ctx.overallScore * 100).toFixed(0)}%
   Readiness: ${ctx.readiness}
   Critical issues: ${ctx.criticalCount}
   Warnings: ${ctx.warningCount}

   Топ-проблемы:
   ${ctx.topIssues.map(i => `  - [${i.severity}] L${i.level}: ${i.description}`).join("\n")}

   Scores по уровням:
   ${ctx.levelScores.map(l => `  L${l.level} ${l.name}: ${(l.score * 100).toFixed(0)}%`).join("\n")}

   Дай ответ СТРОГО в JSON-формате:
   {
     "overall_assessment": "Общий вердикт (1-2 предложения)",
     "priority_actions": ["Действие 1", "Действие 2", "Действие 3"],
     "genre_specific_advice": "Совет по жанру ${ctx.genre} (1-2 предложения)",
     "risk_assessment": "Главный риск проекта (1 предложение)",
     "next_steps": ["Шаг 1", "Шаг 2", "Шаг 3"]
   }

   Все тексты — на русском языке. Будь конкретен, не общие фразы.`;

       const response = await zai.chat.completions.create({
         messages: [
           {
             role: "system",
             content: "Ты — AI-аудитор геймдизайна, эксперт по Universal Design Validator (Bible 11.6). Отвечай только валидным JSON.",
           },
           { role: "user", content: prompt },
         ],
         stream: false,
         thinking: { type: "disabled" },
         response_format: { type: "json_object" },
       });

       const text = response.choices?.[0]?.message?.content?.trim();
       if (!text || text.length < 30) return null;

       try {
         const parsed = JSON.parse(text);
         return {
           overall_assessment: String(parsed.overall_assessment || "").slice(0, 500),
           priority_actions: Array.isArray(parsed.priority_actions)
             ? parsed.priority_actions.slice(0, 5).map(String)
             : [],
           genre_specific_advice: String(parsed.genre_specific_advice || "").slice(0, 500),
           risk_assessment: String(parsed.risk_assessment || "").slice(0, 500),
           next_steps: Array.isArray(parsed.next_steps)
             ? parsed.next_steps.slice(0, 5).map(String)
             : [],
         };
       } catch (parseErr) {
         console.error("[ai-service] enrichChecklist JSON parse failed:", parseErr);
         return null;
       }
     } catch (e) {
       console.error("[ai-service] enrichChecklist failed:", e instanceof Error ? e.message : e);
       return null;
     }
   }
   ```

2. **Вызывать `enrichChecklist` ДО persist** в `checklist-logic.ts`
   (когда `use_ai: true`):

   ```ts
   import { enrichChecklist } from "@/lib/ai-service";

   export async function runChecklistValidation(
     project: ProjectData,
     action: string,
     options: RunOptions = {}
   ): Promise<ChecklistResult> {
     // ... existing checks ...
     // ... UD validator ...

     // NEW: AI enrichment (если requested)
     let aiInsights: ChecklistAiResult | null = null;
     if (options.useAi) {
       aiInsights = await enrichChecklist({
         projectName: project.name,
         genre: project.genre || project.concept?.genre || "unknown",
         overallScore: udResult.overall_score,
         readiness: udResult.readiness,
         criticalCount: udResult.summary.critical_count,
         warningCount: udResult.summary.warning_count,
         topIssues: udResult.summary.top_5_issues,
         levelScores: udResult.levels.map(l => ({
           level: l.level,
           name: l.name,
           score: l.score,
         })),
       });
     }

     const profile = {
       scope: { ... },
       // ... existing fields ...
       universal_design_validator: udResult,
       ai_insights: aiInsights,  // NEW
       models_used: ["upton_heuristics", "rolling_morris", "bond_indirect_guidance",
                    "fullerton_pleasure_killers", "bond_design_goals",
                    "schell_idea_filters", "economy_12pt", "narrative_11pt",
                    "schell_lenses_v2", "universal_design_validator_v1"]
                    .concat(aiInsights ? ["enrichChecklist"] : []),
       stages_completed: computeStagesCompleted(project),
       latency_ms: Date.now() - startedAt,
     };

     // Persist (с ai_insights — см. TASK-6b.14 для DB schema)
     await db.projectChecklist.upsert({
       where: { projectId: project.id },
       create: {
         // ... existing fields ...
         aiInsights: aiInsights ? JSON.stringify(aiInsights) : null,  // NEW
         modelsUsed: JSON.stringify(profile.models_used),  // NEW
         universalValidatorResult: JSON.stringify(udResult),  // NEW
         fullResults: JSON.stringify(profile),
       },
       update: { /* same */ },
     });

     return { /* ... */ };
   }
   ```

3. **Передавать `useAi` через route** — обновить `gdd/checklist/route.ts`
   (TASK-6b.1) и `checklists/[action]/route.ts`:

   ```ts
   const useAi = body?.use_ai === true || body?.use_ai === "true";
   const result = await runChecklistValidation(project, action, {
     depth,
     checklistTypes,
     useAi,  // NEW
   });
   ```

4. **Обновить `RunOptions` interface** в `checklist-logic.ts`:
   ```ts
   interface RunOptions {
     depth?: string;
     checklistTypes?: string[];
     useAi?: boolean;  // NEW
   }
   ```

5. **Обновить pipeline runner** — передавать `use_ai`:
   ```ts
   // run-full-pipeline/route.ts STAGES
   {
     stage: "validation",
     block_id: 6,
     endpoint: "/api/v1/checklist/validate",  // TASK-6b.16
     buildBody: (i) => ({ use_ai: i.useAi }),  // NEW
   },
   ```

**Тест-кейсы**:

- `enrichChecklist({projectName: "Test", genre: "rpg", overallScore: 0.6, ...})`
  → возвращает `{overall_assessment, priority_actions: [3 items], ...}`.
- `enrichChecklist` без AI доступности → `null`.
- `enrichChecklist` с invalid JSON ответ → `null` (parse error handled).
- `runChecklistValidation(project, "validate", {useAi: true})` →
  `profile.ai_insights` не null, `profile.models_used` содержит "enrichChecklist".
- `runChecklistValidation(project, "validate", {useAi: false})` →
  `profile.ai_insights` null.
- Pipeline regression: `08_checklist.json` теперь содержит `ai_insights`
  с real LLM advice.

**Риски**:

- **LLM cost**: каждый pipeline run теперь делает 1 LLM call для
  checklist enrichment. Митигация: `use_ai: false` по умолчанию в
  pipeline runner, `use_ai: true` только когда пользователь явно
  запросил.
- **JSON parsing**: LLM может вернуть invalid JSON. Митигация:
  `response_format: { type: "json_object" }` + try/catch fallback.
- **Russian language**: LLM должна отвечать на русском. Митигация:
  явное требование в prompt, fallback на English если не получается.

**Dependencies**: TASK-6b.10 (UD validator output), TASK-6b.14 (DB schema).

---

### TASK-6b.14: Расширить Prisma `ProjectChecklist` + types/gdd.ts

**Сложность**: M
**Приоритет**: 🟡 (после TASK-6b.13)
**Файлы**: `prisma/schema.prisma` (строки 310–333), `src/types/gdd.ts` (строки 140–177)

**Описание проблемы**:

Текущая Prisma-модель `ProjectChecklist` (schema.prisma:310–333):
```prisma
model ProjectChecklist {
  id                String   @id @default(cuid())
  projectId         String   @unique
  overallScore      Float?
  readinessLevel    String?
  criticalIssueCount Int     @default(0)
  totalIssueCount   Int      @default(0)
  inputData         String?
  mdaCheck          String?
  balanceCheck      String?
  narrativeCheck    String?
  economyCheck      String?
  lensCheck         String?
  issues            String?
  remediationPlan   String?
  fullResults       String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  // ... relations
}
```

**Отсутствуют**:
- `conceptCheck` (Bible 11.5.2)
- `levelDesignCheck` (Bible 11.5.5, 11.6.1 L7)
- `experienceCheck` (Bible 11.5.6, 11.5.7, 11.6.1 L8)
- `interfaceCheck` (Bible 11.6.1 L9)
- `documentationCheck` (Bible 11.6.1 L10)
- `aiInsights` (TASK-6b.13)
- `modelsUsed` (TASK-6b.13)
- `universalValidatorResult` (TASK-6b.10)
- `adaptiveWeights` (TASK-6b.11)
- `genreSnapshot` (для воспроизводимости adaptive prioritization)

`ChecklistValidationProfile` type (types/gdd.ts:140–177) не описывает
`universal_design_validator`, `ai_insights`, `models_used`,
`concept_check`, `level_design_check`, `experience_check`,
`interface_check`, `documentation_check`.

**Решение**:

1. **Расширить Prisma schema** — добавить недостающие поля:

   ```prisma
   model ProjectChecklist {
     id                 String   @id @default(cuid())
     projectId          String   @unique
     overallScore       Float?
     readinessLevel     String?
     criticalIssueCount Int      @default(0)
     totalIssueCount    Int      @default(0)
     inputData          String?
     // Existing 5 checks
     mdaCheck           String?
     balanceCheck       String?
     narrativeCheck     String?
     economyCheck       String?
     lensCheck          String?
     // NEW checks (Bible 11.5.x, 11.6.1)
     conceptCheck       String?  // Bible 11.5.2 (8 Schell filters)
     levelDesignCheck   String?  // Bible 11.5.5 + 11.6.1 L7
     experienceCheck    String?  // Bible 11.5.6, 11.5.7 + 11.6.1 L8
     interfaceCheck     String?  // Bible 11.6.1 L9
     documentationCheck String?  // Bible 11.6.1 L10
     // NEW: Universal Design Validator (Bible 11.6)
     universalValidatorResult String?  // JSON с UD validator output
     adaptiveWeights    String?  // JSON с weights per genre (Bible 11.6.2)
     genreSnapshot      String?  // жанр на момент валидации (для воспроизводимости)
     // NEW: AI enrichment + models (TASK-6b.13)
     aiInsights         String?  // JSON с enrichChecklist output
     modelsUsed         String?  // JSON array of model identifiers
     // Existing
     issues             String?
     remediationPlan    String?
     fullResults        String?
     createdAt          DateTime @default(now())
     updatedAt          DateTime @updatedAt

     project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

     @@index([readinessLevel])
     @@map("project_checklists")
   }
   ```

2. **Создать migration**:
   ```bash
   bunx prisma migrate dev --name add_checklist_validator_fields
   ```

3. **Расширить `ChecklistValidationProfile`** type (types/gdd.ts):

   ```ts
   export interface ChecklistValidationProfile {
     scope: {
       active_checklists: string[];
       depth: string;
       estimated_checks: number;
     };
     // Existing 5 checks
     mda_check?: {
       skipped: boolean;
       issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
       overall_mda_score: number;
       upton_heuristics?: Array<{
         heuristic_id: number;
         heuristic_name: string;
         question: string;
         passed: boolean;
         score: number;
         evidence: string;
         suggestion?: string;
       }>;
     };
     balance_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_balance_score: number;
       rolling_morris_checks?: Array<{
         check_id: number;
         check_name: string;
         question: string;
         passed: boolean;
         score: number;
         evidence: string;
         suggestion?: string;
       }>;
     };
     narrative_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_narrative_score: number;
       narrative_checks?: Array<{
         check_id: number;
         check_name: string;
         question: string;
         passed: boolean;
         score: number;
         evidence: string;
         suggestion?: string;
       }>;
     };
     economy_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_economy_score?: number;
       economy_checks?: Array<{
         check_id: number;
         check_name: string;
         question: string;
         passed: boolean;
         score: number;
         evidence: string;
         suggestion?: string;
       }>;
     };
     lens_check?: {
       skipped: boolean;
       issues: Array<{...}>;
     };
     // NEW checks (Bible 11.5.x, 11.6.1)
     concept_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_concept_score: number;
       filter_results: Array<{
         filter_id: number;
         filter_name: string;
         key_question: string;
         passed: boolean;
         score: number;
         red_flag?: string;
         note: string;
       }>;
     };
     level_design_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_ld_score: number;
       readability: { score: number; passed: boolean; evidence: string };
       navigation: {
         bond_methods: Array<{...}>;
         overall_score: number;
       };
       combat_spaces: { score: number; passed: boolean; evidence: string };
       pacing: { score: number; passed: boolean; evidence: string };
       beat_chart: { score: number; passed: boolean; evidence: string };
     };
     experience_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_experience_score: number;
       pleasure_killers: Array<{...}>;
       bond_goals: Array<{...}>;
     };
     interface_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_interface_score: number;
       principles: Array<{...}>;
     };
     documentation_check?: {
       skipped: boolean;
       issues: Array<{...}>;
       overall_documentation_score: number;
       checks: Array<{...}>;
     };
     // NEW: Universal Design Validator (Bible 11.6)
     universal_design_validator?: {
       levels: Array<{
         level: number;
         name: string;
         weight: number;
         score: number;
         passed: boolean;
         check_count: number;
         issues: Array<{...}>;
       }>;
       overall_score: number;
       readiness: string;
       genre: string;
       weights_applied: Record<number, number>;
       summary: {
         critical_count: number;
         warning_count: number;
         info_count: number;
         top_5_issues: Array<{ severity: string; level: number; description: string }>;
         quick_wins: Array<{ description: string; effort: string }>;
       };
     };
     // NEW: AI enrichment + models
     ai_insights?: {
       overall_assessment: string;
       priority_actions: string[];
       genre_specific_advice: string;
       risk_assessment: string;
       next_steps: string[];
     };
     models_used?: string[];
     // Existing
     summary?: {
       overall_score: number;
       readiness: string;
       top_5_issues: Array<{ severity: string; issue_type: string; description: string }>;
       quick_wins: Array<{ description: string; effort: string }>;
     };
     stages_completed: number[];
     latency_ms: number;
   }
   ```

4. **Обновить persist в `checklist-logic.ts`** — писать во все новые поля.

5. **Обновить `ChecklistPanel.tsx`** — отрендерить новые секции
   (`universal_design_validator`, `concept_check`, `level_design_check`,
   `experience_check`, `ai_insights`).

**Тест-кейсы**:

- `bunx prisma migrate dev` проходит без ошибок.
- `db.projectChecklist.upsert` с новыми полями (conceptCheck, ldCheck, etc.)
  работает.
- `GET /checklist/[projectId]` возвращает JSON со всеми новыми полями.
- Frontend `ChecklistPanel` рендерит UD validator levels (10 уровней)
  и AI insights.
- Pipeline regression: `08_checklist.json` содержит `universal_design_validator`,
  `ai_insights`, `models_used` поля.

**Риски**:

- **Migration на production**: добавление 9 nullable полей — безопасно
  (старые записи имеют NULL). Митигация: backward compatible.
- **Type bloat**: `ChecklistValidationProfile` становится ~150 строк.
  Митигация: вынести под-типы в `src/types/checklist.ts` (новый файл),
  импортировать в `gdd.ts`.
- **Frontend rendering**: `ChecklistPanel` сейчас рендерит только 5 checks
   (mda, balance, narrative, economy, lens). Нужно расширить до 10 секций.
   Митигация: вынести в отдельные компоненты `ConceptCheckBlock`,
   `LdCheckBlock`, `ExperienceCheckBlock`, `UdValidatorPanel`, `AiInsightsCard`.

**Dependencies**: TASK-6b.10, TASK-6b.13.

---

### TASK-6b.15: Унифицировать response shape + удалить дублирующий endpoint

**Сложность**: S
**Приоритет**: 🟡 (после TASK-6b.1, TASK-6b.14)
**Файлы**: `src/app/api/v1/gdd/checklist/route.ts` (alias), `src/app/api/v1/checklists/[action]/route.ts`, `src/app/api/v1/checklist/[action]/route.ts`, `src/components/gidede/gdd/ChecklistPanel.tsx`

**Описание проблемы**:

После TASK-6b.1 `/gdd/checklist` и `/checklist/validate` оба возвращают
`ChecklistValidationProfile` — но это два разных файла route, две точки
maintenance. Bible-style архитектура — один endpoint, один route.

Также `/checklists/[action]` (plural) и `/checklist/[action]` (singular)
— два идентичных файла (87 + 70 = 157 строк дублированного кода).

**Решение**:

1. **Унифицировать на `/checklist/[action]`** (singular) — это то, что
   frontend уже вызывает (`blocks/6/page.tsx:163`):

   - Оставить `src/app/api/v1/checklist/[action]/route.ts` как
     **единственный** rich impl route.
   - Удалить `src/app/api/v1/checklists/[action]/route.ts` (plural) —
     или сделать его тонким re-export:

     ```ts
     // src/app/api/v1/checklists/[action]/route.ts
     // DEPRECATED: use /api/v1/checklist/[action] (singular) instead.
     // Этот файл оставлен только для backward compat.
     export { POST } from "../../checklist/[action]/route";
     ```

   - `/gdd/checklist/route.ts` (TASK-6b.1) — alias для pipeline runner,
     который исторически вызывает этот path. Оставить как тонкий wrapper
     вокруг `runChecklistValidation` (как в TASK-6b.1).

2. **Документировать endpoint hierarchy** в комментарии route файлов:

   ```ts
   /**
    * Endpoint hierarchy for Block 6b validation:
    *
    *   /api/v1/checklist/[action]     ← PRIMARY (frontend, UI)
    *   /api/v1/checklists/[action]    ← DEPRECATED alias (plural)
    *   /api/v1/gdd/checklist          ← Pipeline runner alias (no [action])
    *
    * All three call the same lib/checklist-logic.ts:runChecklistValidation.
    */
   ```

3. **Обновить frontend** — `ChecklistPanel.tsx` должен корректно
   рендерить новый `ChecklistValidationProfile` (с UD validator, AI
   insights, новыми checks). См. TASK-6b.14 step 5.

4. **Обновить API client** — если есть typed API client, обновить
   return type с `ChecklistValidationProfile` (старая версия) на
   новую (с `universal_design_validator?`, `ai_insights?`).

5. **Обновить OpenAPI/Swagger** (если есть) — задокументировать
   новый response shape.

**Тест-кейсы**:

- `POST /checklist/validate` и `POST /gdd/checklist` возвращают
  идентичный JSON shape (diff = 0).
- `POST /checklists/validate` (plural) возвращает тот же shape (через
  re-export).
- Frontend `ChecklistPanel` рендерит результат pipeline run (из БД)
  так же, как результат ручного клика.
- `grep -r "gdd/checklist\|checklists/\[action\]" src/` показывает
  только pipeline runner + alias re-export, никаких отдельных handlers.

**Риски**:

- **External API consumers**: если кто-то вне repo вызывает
  `/checklists/[action]` (plural), после deletion получит 404.
  Митигация: оставить re-export с deprecation header
  `X-Deprecated: Use /api/v1/checklist/[action] (singular) instead`.
- **Frontend regression**: если `ChecklistPanel` не обновить, новые
  поля (`universal_design_validator`, `ai_insights`) не отобразятся,
  но и не сломают existing UI. Митигация: optional fields в type,
  progressive enhancement.

**Dependencies**: TASK-6b.1 (route), TASK-6b.14 (types).

---

### TASK-6b.16: Pipeline runner — вызывать `/checklist/validate` вместо `/gdd/checklist`

**Сложность**: S
**Приоритет**: 🔴 (после TASK-6b.1)
**Файлы**: `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (строки 163–168), `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts` (строки 92–98), `scripts/run_pipeline_test.sh` (строка 144)

**Описание проблемы**:

`run-full-pipeline/route.ts:163–168`:
```ts
{
  stage: "validation",
  block_id: 6,
  endpoint: "/api/v1/gdd/checklist",   // ← STUB (теперь rich impl после TASK-6b.1)
  buildBody: () => ({}),
},
```

`run-pipeline/route.ts:92–98`:
```ts
{
  stage: "validation",
  block_id: 6,
  endpoint: "/api/v1/gdd/checklist",
  buildBody: () => ({}),
},
```

`run_pipeline_test.sh:144`:
```bash
R=$(curl -s -X POST $API/gdd/checklist \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PID\"}" \
  --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
```

После TASK-6b.1 STUB уже заменён на rich impl, но endpoint path
остался `/gdd/checklist` (alias). Лучшая практика — вызывать
**canonical** endpoint `/checklist/validate` для согласованности с
frontend.

**Решение**:

1. **Обновить `run-full-pipeline/route.ts`** STAGES:
   ```ts
   {
     stage: "validation",
     block_id: 6,
     endpoint: "/api/v1/checklist/validate",  // canonical
     buildBody: (i) => ({
       use_ai: i.useAi,  // NEW (TASK-6b.13)
       // depth: "standard",  // optional
     }),
   },
   ```

2. **Обновить `run-pipeline/route.ts`** BLOCK_STAGES:
   ```ts
   {
     stage: "validation",
     block_id: 6,
     endpoint: "/api/v1/checklist/validate",
     buildBody: () => ({}),
   },
   ```
   Note: `buildBody: () => ({})` для partial pipeline (без `use_ai`).

3. **Обновить `run_pipeline_test.sh`**:
   ```bash
   R=$(curl -s -X POST $API/checklist/validate \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d "{\"project_id\":\"$PID\",\"use_ai\":true}" \
     --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
   ```
   Увеличить `--max-time` с 30 до 60 (UD validator + AI enrichment
   требуют больше времени).

4. **Сохранить `/gdd/checklist` alias** — для backward compat с
   любыми внешними скриптами. После TASK-6b.1 это уже rich impl, не
   STUB.

**Тест-кейсы**:

- Pipeline runner с `use_ai: true` → `08_checklist.json` содержит
  `ai_insights` (не null).
- Pipeline runner с `use_ai: false` → `ai_insights` null, но
  `universal_design_validator` всё равно заполнен.
- `run_pipeline_test.sh` успешно завершается для всех 10 проектов.
- 10 test_projects теперь имеют **разные** `overall_score` (зависят
  от жанра,concept,gdd content).

**Риски**:

- **Latency**: `use_ai: true` в pipeline добавит ~5-15s LLM call к
  validation stage. Митигация: `use_ai: false` по умолчанию, явно
  `use_ai: true` только в test script (где хотим проверить full flow).
- **External scripts**: другие скрипты вне repo могут вызывать
  `/gdd/checklist`. После TASK-6b.1 alias продолжает работать (rich impl),
  так что regression нет. Но документировать deprecation.

**Dependencies**: TASK-6b.1 (route replacement), TASK-6b.13 (use_ai flag).

---

### TASK-6b.17: Unit + integration тесты

**Сложность**: L
**Приоритет**: 🟢 (после всех остальных задач)
**Файлы**: новый `test/lib/checklist-logic.test.ts`, новый `test/lib/schell-lenses.test.ts`, новый `test/lib/universal-design-validator.test.ts`, новый `test/api/checklist-route.test.ts`, новый `test/api/gdd-checklist-route.test.ts`, новый `test/integration/pipeline-checklist.test.ts`

**Описание проблемы**:

Покрытие тестами Block 6b на момент аудита — практически отсутствует.
Нет unit тестов для `checklist-logic.ts`, нет integration тестов для
`/gdd/checklist` route, нет regression тестов для pipeline.

**Решение**:

1. **Unit тесты для `schell-lenses.ts`**:
   ```ts
   // test/lib/schell-lenses.test.ts
   import { SCHELL_LENSES, selectRelevantLenses, applyLenses } from "@/lib/schell-lenses";

   describe("SCHELL_LENSES", () => {
     it("should have exactly 113 lenses", () => {
       expect(SCHELL_LENSES.length).toBe(113);
     });

     it("should have unique IDs 1..113", () => {
       const ids = SCHELL_LENSES.map(l => l.id).sort((a, b) => a - b);
       expect(ids).toEqual(Array.from({length: 113}, (_, i) => i + 1));
     });

     it("should cover all 16 categories", () => {
       const categories = new Set(SCHELL_LENSES.map(l => l.category));
       expect(categories.size).toBe(16);
     });
   });

   describe("selectRelevantLenses", () => {
     it("filters out low-relevance lenses for puzzle", () => {
       const lenses = selectRelevantLenses({genre: "puzzle"});
       // Lens 37 (Fairness) should be excluded for puzzle
       expect(lenses.find(l => l.id === 37)).toBeUndefined();
     });

     it("includes high-relevance lenses for fighting", () => {
       const lenses = selectRelevantLenses({genre: "fighting"});
       expect(lenses.find(l => l.id === 37)?.genre_relevance.fighting).toBe("high");
     });
   });
   ```

2. **Unit тесты для `universal-design-validator.ts`**:
   ```ts
   // test/lib/universal-design-validator.test.ts
   import { runUniversalDesignValidator } from "@/lib/universal-design-validator";

   describe("runUniversalDesignValidator", () => {
     it("returns 10 levels for full validation", async () => {
       const result = await runUniversalDesignValidator(mockProject);
       expect(result.levels.length).toBe(10);
     });

     it("adaptive weights differ per genre", async () => {
       const rpgResult = await runUniversalDesignValidator(mockProject, {genre: "rpg"});
       const fpsResult = await runUniversalDesignValidator(mockProject, {genre: "fps"});
       expect(rpgResult.weights_applied[6]).not.toBe(fpsResult.weights_applied[6]);
     });

     it("readiness is not_ready when critical issues exist", async () => {
       const result = await runUniversalDesignValidator(mockProjectWithCriticalIssues);
       expect(result.readiness).toBe("not_ready");
     });
   });
   ```

3. **Unit тесты для `checklist-logic.ts`**:
   ```ts
   // test/lib/checklist-logic.test.ts
   import { runChecklistValidation } from "@/lib/checklist-logic";

   describe("runChecklistValidation", () => {
     it("returns ChecklistValidationProfile shape", async () => {
       const result = await runChecklistValidation(mockProject, "validate", {});
       expect(result.profile).toHaveProperty("scope");
       expect(result.profile).toHaveProperty("summary");
       expect(result.profile).toHaveProperty("universal_design_validator");
     });

     it("action='mda-check' skips other checks", async () => {
       const result = await runChecklistValidation(mockProject, "mda-check", {});
       expect(result.profile.balance_check?.skipped).toBe(true);
       expect(result.profile.mda_check?.skipped).toBe(false);
     });

     it("useAi: true populates ai_insights", async () => {
       const result = await runChecklistValidation(mockProject, "validate", {useAi: true});
       expect(result.profile.ai_insights).not.toBeNull();
     });
   });
   ```

4. **Integration тесты для routes**:
   ```ts
   // test/api/gdd-checklist-route.test.ts
   describe("POST /api/v1/gdd/checklist", () => {
     it("returns ChecklistValidationProfile shape", async () => {
       const res = await POST(mockRequest({project_id: "P01"}));
       const data = await res.json();
       expect(data).toHaveProperty("scope");
       expect(data).toHaveProperty("universal_design_validator");
     });

     it("404 for nonexistent project", async () => {
       const res = await POST(mockRequest({project_id: "nonexistent"}));
       expect(res.status).toBe(404);
     });

     it("400 for missing project_id", async () => {
       const res = await POST(mockRequest({}));
       expect(res.status).toBe(400);
     });
   });
   ```

5. **Integration тест для pipeline**:
   ```ts
   // test/integration/pipeline-checklist.test.ts
   describe("Pipeline run-full-pipeline validation stage", () => {
     it("calls /checklist/validate, not /gdd/checklist", async () => {
       const fetchSpy = jest.spyOn(global, "fetch");
       await runFullPipeline({idea: "test", use_ai: false});
       const validationCall = fetchSpy.mock.calls.find(
         ([url]) => typeof url === "string" && url.includes("/api/v1/")
       );
       expect(validationCall?.[0]).toContain("/checklist/validate");
       expect(validationCall?.[0]).not.toContain("/gdd/checklist");
     });

     it("10 different genres produce 10 different overall_scores", async () => {
       const scores: number[] = [];
       for (const genre of ["rpg", "shooter", "strategy", "puzzle", "racing",
                            "fighting", "platformer", "simulation",
                            "adventure", "tower_defense"]) {
         const result = await runFullPipeline({idea: "test", genre, use_ai: false});
         const checklist = await db.projectChecklist.findUnique({where: {...}});
         scores.push(checklist?.overallScore ?? 0);
       }
       // At least 5 unique scores (genres should produce different scores)
       expect(new Set(scores).size).toBeGreaterThanOrEqual(5);
     });
   });
   ```

6. **Regression test** — `08_checklist.json` не STUB:
   ```ts
   // test/integration/regression-stub.test.ts
   describe("Block 6b STUB regression", () => {
     it("/gdd/checklist does not return STUB shape", async () => {
       const res = await POST(mockRequest({project_id: "P01"}));
       const data = await res.json();
       // STUB had: { overall_score, readiness_level, checks: {mda_check: {passed, score, message}} }
       // Rich impl has: { scope, summary, mda_check: {skipped, issues, overall_mda_score} }
       expect(data).not.toHaveProperty("checks.mda_check.passed");
       expect(data).toHaveProperty("scope.active_checklists");
       expect(data).toHaveProperty("universal_design_validator");
     });

     it("overall_score is not always 53", async () => {
       const scores: number[] = [];
       for (const project of mockProjects) {
         const res = await POST(mockRequest({project_id: project.id}));
         const data = await res.json();
         scores.push(data.summary.overall_score);
       }
       expect(new Set(scores).size).toBeGreaterThan(1);
     });
   });
   ```

**Тест-кейсы покрытия**:

- 113 Schell lenses (unit) — 10 тестов
- 8 idea filters (unit) — 8 тестов
- 6 Upton heuristics (unit) — 6 тестов
- 7 Rolling/Morris checks (unit) — 7 тестов
- 12 economy checks (unit) — 12 тестов
- 11 narrative checks (unit) — 11 тестов
- 7 Bond methods (unit) — 7 тестов
- 5 Fullerton killers (unit) — 5 тестов
- 4+3 Bond goals (unit) — 7 тестов
- UD validator 10 levels (unit) — 10 тестов
- Adaptive weights (unit) — 5 тестов
- Routes (integration) — 15 тестов
- Pipeline (integration) — 10 тестов
- Regression (integration) — 5 тестов

**Итого**: ~120 тестов.

**Риски**:

- **Mocking**: Prisma, AI service, internal fetch — нужны качественные
  моки. Митигация: `jest.mock("@/lib/db")`, `jest.mock("@/lib/ai-service")`,
  `jest.spyOn(global, "fetch")`.
- **Test data**: нужны реалистичные mock-проекты со всеми блоками
  (concept, coreLoop, mdaProfile, balanceResult, etc.). Митигация:
  `test/fixtures/projects.ts` с 10 mock-проектами (по одному на жанр).

**Dependencies**: все остальные задачи (тесты покрывают всё).

---

## Сводная таблица задач

| # | Задача | Сложность | Приоритет | Зависимости |
|---|--------|-----------|-----------|-------------|
| 6b.1 | Унифицировать `/gdd/checklist` (заменить STUB) | M | 🔴 | — |
| 6b.2 | 113 линз Шелла (Bible 11.5.1) | XL | 🔴 | — |
| 6b.3 | 8 фильтров идеи Шелла (Bible 11.5.2) | L | 🔴 | 6b.1 |
| 6b.4 | 6 эвристик Аптона (Bible 11.5.4) | M | 🔴 | 6b.1 |
| 6b.5 | 7-point Rolling/Morris balance (Bible 11.5.3) | L | 🔴 | 6b.1 |
| 6b.6 | 7 методов Бонд + Level 7 LD validator (Bible 11.5.5) | M | 🔴 | 6b.1 |
| 6b.7 | 5 убийц Фуллертон + 4+3 цели Бонд (Bible 11.5.6, 11.5.7) | M | 🔴 | 6b.1 |
| 6b.8 | 12-point economy checklist (Bible 6.13.4) | L | 🔴 | 6b.1 |
| 6b.9 | 11 narrative document types (Bible 11.4.1) | L | 🔴 | 6b.1 |
| 6b.10 | Universal Design Validator 10 уровней (Bible 11.6.1) | XL | 🔴 | 6b.2–6b.9 |
| 6b.11 | Adaptive prioritization по жанру (Bible 11.6.2) | M | 🔴 | 6b.10 |
| 6b.12 | Починить hardcoded weights, clamp, stages_completed | S | 🔴 | 6b.10, 6b.11 |
| 6b.13 | `enrichChecklist` в ai-service.ts + persist | M | 🟡 | 6b.10, 6b.14 |
| 6b.14 | Расширить Prisma `ProjectChecklist` + types/gdd.ts | M | 🟡 | 6b.10, 6b.13 |
| 6b.15 | Унифицировать response shape + dedup endpoints | S | 🟡 | 6b.1, 6b.14 |
| 6b.16 | Pipeline runner → `/checklist/validate` | S | 🔴 | 6b.1, 6b.13 |
| 6b.17 | Unit + integration тесты | L | 🟢 | все |

**Итого**: 17 задач
- 🔴 Критичных: 12 (6b.1, 6b.2, 6b.3, 6b.4, 6b.5, 6b.6, 6b.7, 6b.8, 6b.9, 6b.10, 6b.11, 6b.12, 6b.16)
- 🟡 Средних: 3 (6b.13, 6b.14, 6b.15)
- 🟢 Низких: 1 (6b.17)

**Оценка effort**:
- 6b.1 (M): 6–8ч
- 6b.2 (XL): 24–32ч (113 lenses × 7 fields × 15 genres)
- 6b.3 (L): 10–14ч
- 6b.4 (M): 6–8ч
- 6b.5 (L): 10–14ч
- 6b.6 (M): 8–10ч
- 6b.7 (M): 8–10ч
- 6b.8 (L): 10–14ч
- 6b.9 (L): 10–14ч
- 6b.10 (XL): 20–28ч (orchestrator + 10 level checks)
- 6b.11 (M): 6–8ч
- 6b.12 (S): 2–4ч
- 6b.13 (M): 6–8ч
- 6b.14 (M): 4–6ч
- 6b.15 (S): 2–3ч
- 6b.16 (S): 1–2ч
- 6b.17 (L): 16–24ч

**Итого**: ~150–210ч (без тестов), ~166–234ч (с тестами).

---

## План реализации (Phases)

### Phase 1: Foundation (1 неделя)
- TASK-6b.1 (заменить STUB) — критично, разблокирует pipeline
- TASK-6b.16 (pipeline runner fix) — критично, разблокирует E2E
- TASK-6b.12 (починить hardcoded weights, clamp, stages_completed)

### Phase 2: Bible 11.5.x checklists (2–3 недели, параллельно)
- TASK-6b.2 (113 Schell lenses) — XL, longest
- TASK-6b.3 (8 idea filters)
- TASK-6b.4 (6 Upton heuristics)
- TASK-6b.5 (7 Rolling/Morris)
- TASK-6b.6 (7 Bond methods + Level 7)
- TASK-6b.7 (5 Fullerton + 4+3 Bond)
- TASK-6b.8 (12-point economy)
- TASK-6b.9 (11 narrative)

### Phase 3: Universal Design Validator (2 недели)
- TASK-6b.10 (10 levels orchestrator)
- TASK-6b.11 (adaptive prioritization)

### Phase 4: AI + DB (1 неделя)
- TASK-6b.13 (enrichChecklist)
- TASK-6b.14 (Prisma + types)

### Phase 5: Polish (1 неделя)
- TASK-6b.15 (dedup endpoints)
- TASK-6b.17 (tests)

**Общая длительность**: 7–9 недель (1–2 разработчика).

---

## Приложение A: Соответствие Bible разделам

| Bible раздел | Реализуется в TASK | Проверка |
|--------------|-------------------|----------|
| 11.4.1 (11 narrative document types) | TASK-6b.9 | `runNarrativeChecklist` |
| 11.5.1 (113 Schell lenses) | TASK-6b.2 | `SCHELL_LENSES.length === 113` |
| 11.5.2 (8 idea filters) | TASK-6b.3 | `runSchellIdeaFilters` |
| 11.5.3 (7-point Rolling/Morris) | TASK-6b.5 | `runRollingMorrisChecklist` |
| 11.5.4 (6 Upton heuristics) | TASK-6b.4 | `runUptonHeuristics` |
| 11.5.5 (7 Bond indirect guidance) | TASK-6b.6 | `runBondIndirectGuidance` |
| 11.5.6 (5 Fullerton pleasure killers) | TASK-6b.7 | `runFullertonPleasureKillers` |
| 11.5.7 (4+3 Bond design goals) | TASK-6b.7 | `runBondDesignGoals` |
| 11.6.1 (UDV 10 levels) | TASK-6b.10 | `runUniversalDesignValidator` |
| 11.6.2 (adaptive prioritization) | TASK-6b.11 | `computeAdaptiveWeights` |
| 11.6.3 (3 severity levels) | existing | `error\|warning\|info` (уже соответствует) |
| 6.13.4 (12-point economy) | TASK-6b.8 | `runEconomyChecklist` |

---

## Приложение B: Существующий код, подлежащий удалению/замене

| Файл/строки | Что удалить | Чем заменить |
|-------------|-------------|--------------|
| `gdd/checklist/route.ts:25–82` | STUB checks (80/0/40/70/75) | TASK-6b.1: вызов `runChecklistValidation` |
| `checklists/[action]/route.ts` (87 строк) | Дублированный handler | TASK-6b.15: re-export из `checklist/[action]/route.ts` |
| `checklist-logic.ts:511–513` | hardcoded `0.3/0.3/0.3/0.1` | TASK-6b.12: UD validator overall_score |
| `checklist-logic.ts:679` | `stages_completed: [1,2,3,4,5,6]` | TASK-6b.12: `computeStagesCompleted(project)` |
| `checklist-logic.ts:259–324` | `runBalanceCheck` (4 checks) | TASK-6b.5: 7-point Rolling/Morris |
| `checklist-logic.ts:326–392` | `runNarrativeCheck` (3 checks) | TASK-6b.9: 11 narrative checks |
| `checklist-logic.ts:394–452` | `runEconomyCheck` (3 checks) | TASK-6b.8: 12-point economy |
| `checklist-logic.ts:454–493` | `runLensCheck` (1 check, read-only) | TASK-6b.2: 113 lenses apply |
| `run-full-pipeline/route.ts:166` | `endpoint: "/api/v1/gdd/checklist"` | TASK-6b.16: `/api/v1/checklist/validate` |
| `run-pipeline/route.ts:95` | `endpoint: "/api/v1/gdd/checklist"` | TASK-6b.16: `/api/v1/checklist/validate` |
| `run_pipeline_test.sh:144` | `$API/gdd/checklist` | TASK-6b.16: `$API/checklist/validate` |
| `types/gdd.ts:140–177` | узкий `ChecklistValidationProfile` | TASK-6b.14: расширенный тип |
| `prisma/schema.prisma:310–333` | нет новых полей | TASK-6b.14: 9 новых полей |

---

## Приложение C: Ожидаемый результат после рефакторинга

После выполнения всех 17 задач:

1. **Pipeline runner** вызывает `/checklist/validate` (rich impl).
2. **`08_checklist.json`** содержит полный `ChecklistValidationProfile`:
   - `scope.active_checklists: ["concept", "mda", "balance", "narrative", "economy", "lenses", "level_design", "experience", "interface", "documentation"]`
   - `universal_design_validator.levels` — 10 элементов с scores
   - `universal_design_validator.weights_applied` — adaptive per genre
   - `ai_insights` — LLM-generated advice (если `use_ai: true`)
   - `models_used` — массив из ~10 model identifiers
3. **10 test_projects** дают **разные** `overall_score` (зависят от жанра,
   concept, GDD content), а не одинаковый 53.
4. **Bible compliance**: ~220 checks реализованы (vs 15 сейчас).
5. **Frontend `ChecklistPanel`** рендерит 10 check секций + UD validator
   panel + AI insights card.
6. **DB schema** имеет 9 новых полей в `ProjectChecklist`.
7. **Тесты**: ~120 unit + integration тестов покрывают all checks.

---

**Конец плана**.
