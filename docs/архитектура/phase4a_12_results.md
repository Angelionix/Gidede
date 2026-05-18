# Gidede — Результаты Фазы 4.A.12

> **Задача**: 4.A.12 — Shared-модели и типы (TypeScript + Python)  
> **Дата**: 2026-05-18  
> **Ссылка**: алгоритмы 3.1–3.10 (все интерфейсы)

---

## 4.A.12 — Shared-модели и типы

### Реализованные компоненты

#### 1. Структура директории /shared/types/

```
shared/types/
├── typescript/
│   ├── enums.ts          # 25+ enum-типов
│   ├── interfaces.ts     # 27+ интерфейсов
│   └── index.ts          # Точка входа
├── python/
│   ├── enums.py          # 25+ enum-классов
│   ├── models.py         # 27+ Pydantic-моделей
│   └── __init__.py       # Точка входа
└── sync_types.py         # Скрипт синхронизации TS↔PY
```

#### 2. TypeScript: enums.ts

25+ типов-перечислений, покрывающих все доменные концепции:

| Группа | Типы | Количество |
|--------|------|-----------|
| MDA/Эстетика | AestheticType | 8 значений |
| Жанры | Genre | 29 значений |
| Мотивации | YeeMotivation, BartleType | 12+4 значений |
| Core Loop | LoopStructuralType, LoopSubType, EmergencePotential | 4+7+4 значений |
| Баланс | BalanceType, BalanceObjectType, GameMode | 4+6+3 значений |
| Прогрессия | ProgressionType, FlowTarget, ContentBudget | 6+3+3 значений |
| Экономика | EconomyMonetizationType, EconomyOpenness, ResourceClass, ResourceType | 5+3+5+5 значений |
| GDD | GDDFormat, DocAudience, DetailLevel | 8+5+4 значений |
| Чек-листы | ChecklistType, FocusArea | 6+7 значений |
| Статусы | ProjectStageName, ProjectStatus, UserPlan, BudgetLevel, ScopeLevel, ExperienceLevel | 5+4+2+3+3+3 значений |
| Экспорт | ExportFormat, CitationStyle | 4+3 значений |

#### 3. TypeScript: interfaces.ts

27+ интерфейсов, организованных по блокам:

**Блок 1 — Концепция (алгоритм 3.1):**
- `ConceptInput`, `GenreInput`, `AudienceInput`, `ConstraintsInput`
- `AestheticProfile`, `DynamicsProfile`, `MechanicSet`
- `CoreLoopCandidate`, `USPCandidate`, `ValidationReport`
- `OnePager`

**Блок 2 — Core Loop (алгоритм 3.2):**
- `CoreLoopInput`, `CoreLoopStep`, `StructuralType`
- `ResourceProfile`, `LoopProfile`, `RiskProfile`
- `InnerLoop`, `OuterLoop`, `MetaLoop`
- `PathologyReport`, `Pathology`, `Recommendation`
- `CoreLoopProfile`, `LoopHierarchy`, `CoreLoopValidation`

**Блок 3 — MDA (алгоритм 3.3):**
- `MDAGenerationInput`, `GenreProfile`
- `DynamicsTarget`, `StructuredMechanicSet`, `MechanicGroup`
- `LensValidation`, `LensResult`, `BondValidation`
- `MachinationsGraph`, `MachinationsNode`, `MachinationsEdge`
- `Issue`, `Suggestion`, `MDAProfile`

**Блок 4 — Баланс (алгоритм 3.4):**
- `BalanceInput`, `BalanceObject`, `TransitiveResult`, `CostPowerCurve`
- `IntransitiveResult`, `SituationalResult`, `MonteCarloResult`
- `BalancePathology`, `CorrectionProposal`, `CurveSpec`
- `BalanceResult`

**Блок 5 — Прогрессия (алгоритм 3.5):**
- `ProgressionInput`, `ProgressionConstraints`
- `ProgressionMacroModel`, `TierModel`, `Tier`
- `ProgressionCurves`, `ContentPlan`, `UnlockEntry`
- `ProgressionEconomyLink`, `EconomicPhase`, `ProgressionValidation`
- `ProgressionProfile`

**Блок 5 — Экономика (алгоритм 3.6):**
- `EconomyInput`, `ResourceDefinition`, `EconomyConstraints`
- `ResourceInventory`, `EconomicClassification`, `ConversionGraph`
- `EconomyPathology`, `EconomyCorrection`, `SimulationResult`
- `MonetizationSpec`, `EconomyProfile`

**Блок 6 — GDD (алгоритм 3.7):**
- `GDDGenerationInput`, `GDDConstraints`
- `GDDSection`, `VisualElement`, `ConsistencyIssue`, `CompletenessReport`
- `GDDProfile`

**Блок 6 — Валидация (алгоритм 3.8):**
- `ChecklistInput`, `ValidationIssue`, `RemediationItem`
- `MDACheckResult`, `BalanceCheckResult`, `NarrativeCheckResult`
- `EconomyCheckResult`, `LensCheckResult`, `ChecklistResult`

**Project State (алгоритм 3.10):**
- `ProjectState` — единая модель проекта

#### 4. Python: enums.py + models.py

Полные Pydantic-модели, зеркально отражающие TypeScript-интерфейсы. Каждый Python-класс использует те же имена полей (в snake_case) и те же типы (через Enum-классы).

Ключевые модели:
- `ConceptInput`, `OnePager`, `AestheticProfile`
- `CoreLoopProfile`, `MDAProfile`, `BalanceResult`
- `ProgressionProfile`, `EconomyProfile`, `GDDProfile`
- `ChecklistResult`, `ProjectState`

#### 5. Скрипт синхронизации: sync_types.py

Проверяет, что TypeScript и Python типы остаются синхронизированными:

```bash
# Проверка
python shared/types/sync_types.py --check

# Отчёт
python shared/types/sync_types.py --report
```

Функции:
- Сравнение enum-значений между TS и PY
- Сравнение полей интерфейсов (с учётом camelCase→snake_case)
- Отчёт о расхождениях

---

## Статистика

| Метрика | Значение |
|---------|----------|
| TypeScript enum-типов | 25+ |
| TypeScript интерфейсов | 27+ |
| Python enum-классов | 25+ |
| Python Pydantic-моделей | 27+ |
| Общих полей данных | 300+ |
| Строк кода (TS) | ~650 |
| Строк кода (PY) | ~550 |
| Скрипт синхронизации | ~150 строк |

---

## Изменённые файлы

### Новые файлы (8)

| Файл | Описание |
|------|----------|
| `shared/types/typescript/enums.ts` | TypeScript перечисления |
| `shared/types/typescript/interfaces.ts` | TypeScript интерфейсы |
| `shared/types/typescript/index.ts` | TS точка входа |
| `shared/types/python/enums.py` | Python перечисления |
| `shared/types/python/models.py` | Python Pydantic-модели |
| `shared/types/python/__init__.py` | PY точка входа |
| `shared/types/sync_types.py` | Скрипт синхронизации TS↔PY |
| `docs/тестирование/test_infrastructure.md` | Документ тестовой инфраструктуры |
| `docs/тестирование/local_setup_and_running.md` | Документ подготовки и запуска тестов |
