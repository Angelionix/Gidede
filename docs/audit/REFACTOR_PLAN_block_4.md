# Рефакторинг Блока 4 — Баланс и симуляция

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-4 (sub-agent)
**Связанные документы**: `docs/audit/AUDIT_REPORT.md` (раздел 4), `docs/bible/bible_2_5_balance.md`, `docs/audit/REFACTOR_PLAN_block_1.md`, `docs/audit/REFACTOR_PLAN_block_3.md` (TASK-3.16 machinationsModel)
**Объект рефакторинга**:
- `src/app/api/v1/balance/analyze/route.ts` (1063 строки)
- `src/app/api/v1/balance/[projectId]/route.ts` (46 строк)
- `src/lib/ai-service.ts` (функция `enrichBalance`, строки 589–627)
- `src/types/balance.ts` (175 строк)
- `src/constants/balance.ts` (87 строк)
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (STAGES[3].buildBody, строки 118–136)
- `scripts/run_pipeline_test.sh` (строка 114 — баг `elements` vs `objects`)
- `prisma/schema.prisma` (модель `ProjectBalanceResult`, строки 198–223)
- `src/lib/pipeline-helpers.ts` (`buildPreparedInput` для blockId=4, строки 360–369)

---

## Контекст

Блок 4 (Balance & Simulation) — четвёртый этап пайплайна Gidede. Принимает на вход массив объектов `BalanceObject[]` (с `attributes`, `cost`, `tier`, `tags`) + параметры (game_mode, genre, balance_type, флаги запуска анализа), выполняет заявленный **6-стадийный алгоритм** (Bible 5):

1. **Balance map** — primary/secondary model, anchor (фулкрум), feedback-тип
2. **Transitive analysis** — attribute weights, cost-power curve, per-object status (Bible 5.3.1, 5.4, 5.5)
3. **Intransitive analysis** — payoff matrix, Nash equilibrium, RPS cycles (Bible 5.3.2)
4. **Situational + Q-factor** — опционально (Bible 5.3.3, 5.6.3)
5. **Monte Carlo simulation** — win rates, matchup matrix, verdict (Bible 5.7)
6. **Machinations + Stability** — graph, feedback loops, pathologies (Bible 5.6, 5.13)

Фактическая реализация в `route.ts` (1063 строки, 6 стадий) структурно проходит все 6 шагов, но **полностью не выполняет** заявленную работу:

- **0/10 test_projects** успешно завершают Block 4 (все 10 возвращают 422-ошибку из-за бага в `run_pipeline_test.sh`).
- Transitive analysis использует **захардкоженную** cost-power curve `0.6 * cost^0.8` — не входит в список 7 Schreiber curves (Bible 5.4.3).
- Intransitive analysis **искусственно инжектирует** RPS-структуру через `cyclicalBias = 0.4` (строка 242), делая `is_intransitive=true` артефактом алгоритма.
- Nash equilibrium **не вычисляется** — всегда возвращает uniform distribution `1/n`.
- Monte Carlo использует **`Math.random()`** — результаты не воспроизводимы.
- Machinations graph добавляет **захардкоженные HP/damage узлы** к любым объектам (даже экономическим).
- AI enrichment **не персистится** в БД (вызывается после `db.upsert`).
- `feedback_loops` доступны в `machinationsResult.graph.feedback_loops`, но `buildStability` ожидает их на верхнем уровне → `as unknown as` cast → всегда 0 reinforcing/0 balancing loops.
- 6 из 8 патологий Bible 5.13 **не детектируются**.

### Подтверждённые дефекты (проверены на всех 10 test_projects)

Все 10 файлов `test_projects/*/04_balance.json` **байт-в-байт идентичны** и содержат только 422-ошибку:

```json
{"detail":"Поле 'objects' обязательно и должно содержать минимум 2 объекта"}
```

```bash
$ for i in 01_Shadow_Depths 02_Sky_Fortress 03_Rhythm_of_War 04_Crystal_Cascade 05_Void_Runner 06_Card_Lords 07_Frostbite 08_Star_Blazers 09_Harvest_Moonlight 10_Nitro_Rush; do
    head -c 100 "/home/z/my-project/repos/Gidede/test_projects/$i/04_balance.json"; echo
  done
{"detail":"Поле 'objects' обязательно и должно содержать минимум 2 объекта"}
{"detail":"Поле 'objects' обязательно и должно содержать минимум 2 объекта"}
... (10 раз одинаково)
```

**Block 4 НИКОГДА не тестировался end-to-end.** База данных не содержит ни одной записи в `ProjectBalanceResult` для 10 test_projects. Это означает, что:
- Downstream-блоки (Progression, Economy, GDD) получают `upstream.balance = null` от `buildPreparedInput`.
- Pipeline runner (`run-full-pipeline`) использует hardcoded 4 объекта (строки 126–131) — успешно, но **бессмысленно** для бизнес-логики.

---

## Корневые причины (root causes)

### RC-1: Pipeline test script передаёт `elements` вместо `objects`

`scripts/run_pipeline_test.sh:114`:
```bash
-d "{\"project_id\":\"$PID\",\"elements\":[{\"name\":\"sword\",\"cost\":100,\"power\":50}],\"use_ai\":true}" \
```

Три проблемы в одной строке:
1. **Поле `elements` вместо `objects`** — route `balance/analyze/route.ts:822` читает `body?.objects`, а `body?.elements` молча игнорируется → `objectsRaw = undefined` → `Array.isArray(undefined) === false` → 422 VALIDATION_ERROR.
2. **Только 1 объект** — даже если переименовать `elements` → `objects`, валидация `objectsRaw.length < 2` (route.ts:834) всё равно вернёт 422.
3. **Неверный shape объекта** — `{name, cost, power}` вместо `BalanceObject`:
   ```ts
   interface BalanceObject {
     id: string;
     name: string;
     type: string;
     attributes: Record<string, number>;
     cost?: number;
     tier?: number;
     tags?: string[];
   }
   ```
   Поле `power: 50` отправляется на верхнем уровне, но route ожидает `attributes: { power: 50 }`. Route fallback на `attributes: { power: 50, hp: 100 }` (route.ts:853-855) скрывает ошибку, но данные бессмысленны.

Frontend `src/app/blocks/4/page.tsx:107-125` отправляет **правильный** shape:
```ts
const payload: FullBalanceRequest = {
  objects: objects.map((o) => ({
    id: o.id,
    name: o.name.trim(),
    type: o.type,
    attributes: o.attributes,
    cost: o.cost,
    tier: o.tier,
    tags: o.tags,
  })),
  // ...
};
```
→ Frontend работает корректно, но **никто не тестировал его через pipeline**.

### RC-2: `buildBalanceMap` возвращает бессмысленные поля

`route.ts:57-91`:
```ts
function buildBalanceMap(balanceType, gameMode, objects) {
  const firstAttrs = objects[0]?.attributes || {};
  const anchor = Object.keys(firstAttrs)[0] || "power";

  const primaryModel = balanceType;
  const secondaryModel =
    balanceType === "transitive"
      ? "intransitive"
      : balanceType === "intransitive"
        ? "transitive"
        : "transitive";  // ← BUG: "situational" и "mixed" оба возвращают "transitive"

  const gameSum = `${objects.length} objects in ${gameMode} conflict space`;
  // ...
}
```

| Поле | Текущее значение | Ожидаемое (Bible 5.5.2) |
|------|------------------|-------------------------|
| `anchor` | Первый ключ атрибутов первого объекта (случайный) | Fulcrum — референсный объект, относительно которого калибруются остальные |
| `secondaryModel` | "transitive" для `mixed`/`situational` | Должна быть осмысленная пара: transitive↔intransitive, mixed→situational |
| `gameSum` | Строка "N objects in PvP conflict space" | Zero-sum / positive-sum / negative-sum (Bible 5.6.2) |

### RC-3: `buildTransitiveResult` — равные веса + hardcoded curve

`route.ts:102-205`:

**3a. Равные веса атрибутов** (строки 109-111):
```ts
const attrList = Array.from(allAttrs);
const weights: Record<string, number> = {};
const equalWeight = 1 / Math.max(1, attrList.length);
for (const a of attrList) weights[a] = Number(equalWeight.toFixed(3));
```
Каждый атрибут получает вес `1/N` (например, для 4 атрибутов — `0.25` каждый). Это прямо нарушает Bible 5.5.3:
> «Чем важнее атрибут, тем выше его вес — и, следовательно, тем **ниже** сырые значения у сбалансированных объектов по этому атрибуту.»

Bible говорит: важный атрибут = высокий вес → низкие сырые значения. Реализация игнорирует важность.

**3b. Hardcoded cost-power curve** (строки 135, 139):
```ts
const costCurveModel = "power = 0.6 * cost^0.8";
// ...
const expectedPower = 0.6 * Math.pow(p.effective_cost, 0.8);
const distance = Number((p.power / Math.max(1, expectedPower) - 1).toFixed(3));
```

Константы `0.6` (амплитуда) и `0.8` (степень) выбраны **произвольно**. Эта polynomial curve **не входит** в список 7 Schreiber curves (Bible 5.4.3):
1. Identity: `y = x`
2. Linear: `y = mx`
3. Exponential: `y = C × bˣ`
4. Logarithmic: `y = log_b(x)`
5. **Triangular: `y = (x² − x) / 2`** ← "наиболее используемая формула возрастающей отдачи"
6. Custom
7. Obfuscation

Bible 5.4.1 требует **reverse-engineering** из "ванильных" карт через систему уравнений. Реализация не делает ничего подобного.

**3c. Hardcoded tier multiplier** (строка 121):
```ts
const tierMult = (tier?: number) => (tier ? 1 + (tier - 1) * 0.5 : 1);
```
Tier 1 → ×1.0, Tier 2 → ×1.5, Tier 3 → ×2.0, Tier 4 → ×2.5. Нет обоснования; Bible не упоминает tier multipliers.

**3d. Status thresholds** (строки 143-146):
```ts
let status = "balanced";
if (distance > 0.25) status = "overpowered";
else if (distance < -0.25) status = "underpowered";
else if (Math.abs(distance) > 0.1) status = "ideal_imbalance";
```
Пороги 25%/10% **соответствуют** Bible 5.3.4 (~10-15% идеального дисбаланса) — единственная корректная часть.

**3e. Warnings only use first OP/UP object** (строки 175-179):
```ts
if (overpowered.length > 0) {
  warnings.push(`Overpowered: ${overpowered.join(", ")} — reduce power or increase cost`);
  suggestions.push(`Increase cost of ${overpowered[0]} by 15-20%`);
}
```
Если 3 объекта overpowered, suggestion предлагается только для `overpowered[0]`. Остальные 2 игнорируются в рекомендациях.

### RC-4: `buildIntransitiveResult` — искусственный RPS + fake Nash

`route.ts:207-344`:

**4a. Cyclical bias force-injects RPS** (строка 242):
```ts
const cyclicalBias = ((j - i + n) % n === 1 ? 0.4 : (i - j + n) % n === 1 ? -0.4 : 0);
```
Object i **всегда** выигрывает у object (i+1)%n с bias +0.4, и проигрывает object (i-1)%n с bias -0.4. Это **гарантирует** RPS-цикл для n>=3 — но это **артефакт алгоритма**, не реальный анализ.

Bible 5.3.2 требует:
> «Построить матрицу выигрышей, записать уравнения, приравнять выигрыши, решить систему.»

Реальный RPS должен **возникать** из атрибутов объектов (например, Mage имеет высокий damage, но низкий HP → проигрывает Tank; Tank медленный → проигрывает Rogue; Rogue хрупкий → проигрывает Mage). Реализация использует `powerDiff = (powers[i] - powers[j]) / 100` (строка 243), но bias 0.4 доминирует над powerDiff (который обычно ~0.1-0.5).

**4b. Nash equilibrium не вычисляется** (строки 272-274):
```ts
const nash: number[] = hasDominant
  ? names.map((name) => (dominatedStrategies.includes(name) ? 0 : 1 / (n - dominatedStrategies.length)))
  : names.map(() => 1 / n);
```

Возвращает **uniform** `1/n` (или `1/(n-dominated)` если есть доминанта). Bible 5.3.2 даёт явную формулу:
> «Matrix solution: `c = M⁻¹ × p`, где M — матрица выигрышей, c — вектор вероятностей, p — вектор выигрышей.»

Реализация **не решает** систему уравнений. Для RPS (3 объекта, циклическая матрица) правильный Nash — `[1/3, 1/3, 1/3]` (что совпадает с uniform), но для асимметричной матрицы правильный Nash может быть `[0.5, 0.3, 0.2]` — реализация всегда вернёт `[1/3, 1/3, 1/3]`.

**4c. RPS cycles only finds ONE cycle** (строка 307):
```ts
if (payoffMatrix[i][j] > 0.1 && payoffMatrix[j][k] > 0.1 && payoffMatrix[k][i] > 0.1) {
  rpsCycles.push({ cycle: [names[i], names[j], names[k]], strength: ... });
  break;  // ← BUG: выходит после первого найденного цикла
}
```
Также проверяет только последовательные тройки `i → (i+1) → (i+2)`, а не все `C(n,3)` комбинаций. Для n=5 может пропустить цикл `0 → 2 → 4 → 0`.

**4d. Dominated strategies — only one round** (строки 254-270):
```ts
for (let i = 0; i < n; i++) {
  for (let k = 0; k < n; k++) {
    if (i === k) continue;
    let dominated = true;
    for (let j = 0; j < n; j++) {
      if (payoffMatrix[k][j] <= payoffMatrix[i][j]) {
        dominated = false;
        break;
      }
    }
    if (dominated) {
      dominatedStrategies.push(names[i]);
      hasDominant = true;
      break;
    }
  }
}
```
Нет iterative elimination (Bible: после удаления доминируемой стратегии, другие могут стать доминируемыми). Также проверяется только strict domination (`<=`), не weak domination (`<`).

**4e. Strategy balance metrics — Gini formula is wrong** (строки 282-288):
```ts
const sortedNash = [...nash].sort((a, b) => a - b);
const gini = sortedNash.length > 0
  ? Number(
      (sortedNash.reduce((s, p, i) => s + (2 * (i + 1) - n - 1) * p, 0) /
        (n * sortedNash.reduce((s, p) => s + p, 0))).toFixed(3)
    )
  : 0;
```

Gini formula: `G = (Σᵢ (2i - n - 1) × xᵢ) / (n × Σxᵢ)` где `x` отсортирован по возрастанию, `i` от 1 до n. Реализация использует `(2 * (i + 1) - n - 1)` — это правильно для 0-indexed массива (i+1 даёт 1-indexed). НО: `sortedNash.reduce((s, p) => s + p, 0)` в знаменателе — это сумма ВСЕХ nash values, включая 0. Для uniform `1/n`: sum = 1, G = 0 (correct). Для `[0.5, 0.3, 0.2]`: sorted = `[0.2, 0.3, 0.5]`, sum = 1.0, G = ((2*1-3-1)*0.2 + (2*2-3-1)*0.3 + (2*3-3-1)*0.5) / (3*1) = (-2*0.2 + 0*0.3 + 2*0.5) / 3 = (-0.4 + 0 + 1.0) / 3 = 0.6/3 = 0.2 (correct). OK, Gini formula is actually right.

But for `[0, 0.5, 0.5]` (dominated strategy): sorted = `[0, 0.5, 0.5]`, sum = 1.0, G = ((2-4)*0 + (4-4)*0.5 + (6-4)*0.5) / 3 = (0 + 0 + 1.0) / 3 = 0.333. That seems correct.

OK Gini is fine. Let me note: actually the formula uses `n` in denominator but should use `n` only if all values are non-zero. For nash with zeros, the formula is still mathematically valid but the interpretation differs.

### RC-5: `buildSituationalResult` — canned hash-based values

`route.ts:346-373`:
```ts
const situations = ["open_field", "urban", "night", "rain", "indoor"];
const situationalValues = objects.map((o) => {
  const values: Record<string, number> = {};
  for (const s of situations) {
    const hash = (o.name.charCodeAt(0) || 65) + s.charCodeAt(0);
    values[s] = Number((0.7 + ((hash % 30) / 100)).toFixed(2));
  }
  return { name: o.name, values };
});
```

Значения вычисляются из `charCodeAt(0)` имени объекта + первой буквы ситуации. Полностью **отделено** от атрибутов объекта. Bible 5.3.3:
> «EV_ситуационный = Σ P(ситуация_i) × Ценность(объект в ситуации_i)»

Реализация не использует `P(situation_i)` (вероятности ситуаций) и не вычисляет `Ценность(object, situation)`. Все situational values в диапазоне `[0.7, 1.0]` — бесполезны.

Список ситуаций `["open_field", "urban", "night", "rain", "indoor"]` — hardcoded для боевых игр. Для экономической игры (где объекты — ресурсы) эти ситуации бессмысленны.

### RC-6: `buildQFactorResult` — `Math.random()` в детерминированных вычислениях

`route.ts:375-396`:
```ts
const qFactors = objects.map((o) => ({
  name: o.name,
  q_factor: Number((1 + (o.attributes ? Object.values(o.attributes).reduce((s, v) => s + v, 0) / 200 : 0)).toFixed(3)),
  synergy_score: Number((0.6 + Math.random() * 0.3).toFixed(2)),  // ← NON-DETERMINISTIC
}));
```

`synergy_score` — случайное число `[0.6, 0.9]` при каждом вызове. Bible 5.6.3:
> «Q-фактор — субъективная оценка компонента от 1 до 10 по каждому атрибуту. Сортирует компоненты в Q-иерархию.»

Реализация:
1. Возвращает Q-factor в диапазоне `[1, ~2]` (для типичных атрибутов 0-100, sum/200 ~0.5, +1 = 1.5) — не 1-10.
2. `synergy_score` случаен — не воспроизводим.
3. Нет Q-иерархии (Bible: «сортирует компоненты»).

### RC-7: `buildMonteCarloResult` — `Math.random()` + неверная формула winProb

`route.ts:398-553`:

**7a. Non-deterministic simulation** (строки 442-444, 452, 465):
```ts
const i = Math.floor(Math.random() * n);
let j = Math.floor(Math.random() * n);
while (j === i) j = Math.floor(Math.random() * n);
// ...
const iWins = Math.random() < winProb;
const duration = Math.round(60 + (10 / Math.max(1, iSpeed + jSpeed)) * 50 + (Math.random() - 0.5) * 20);
```

`seed: "Math.random"` (строка 542) — это просто строка-метка, не реальный seed. Bible 5.7 ожидает воспроизводимые результаты (для regression testing).

**7b. winProb formula unclamped** (строка 451):
```ts
const bias = matrix.length > 0 ? (matrix[i]?.[j] || 0) : 0;
const winProb = 0.5 + bias * 0.4;
```

`bias` из payoff matrix включает `cyclicalBias` ±0.4 (RC-4a) + `powerDiff`. Для extreme cases:
- Если `bias = 2.0` (маловероятно, но возможно), `winProb = 1.3` — `Math.random() < 1.3` всегда true (i всегда выигрывает).
- Если `bias = -2.0`, `winProb = -0.3` — `Math.random() < -0.3` всегда false (j всегда выигрывает).

Нет clamp к `[0.05, 0.95]` или `[0, 1]`.

**7c. Constant 200 iterations** (строка 417):
```ts
const iterations = 200;
```
Bible 5.7 не указывает конкретное число, но 200 итераций для n=4 объектов = 50 матчей на пару — статистически слабо (погрешность ~14%). Для n=10 = 4 матчей на пару — вообще бесполезно. Должно зависеть от `n`.

**7d. rankingCorrelation is Kendall tau, not Spearman** (строки 502-516):
```ts
let concordant = 0;
let discordant = 0;
for (let i = 0; i < mcRank.length; i++) {
  for (let k = i + 1; k < mcRank.length; k++) {
    // ...
    if ((powA - powB) * (i - k) > 0) concordant++;
    else discordant++;
  }
}
const rankingCorrelation = concordant + discordant > 0
  ? Number((concordant / (concordant + discordant)).toFixed(3))
  : 0;
```

Формула `concordant / (concordant + discordant)` — это **Kendall tau W** (не tau-a, tau-b, tau-c). Spearman's rho:
```
ρ = 1 - (6 × Σdᵢ²) / (n × (n² - 1))
```
где `dᵢ` — разница рангов i-го элемента.

Переменная названа `ranking_correlation` — вводит в заблуждение. Должна быть либо переименована в `kendall_tau`, либо реализован правильный Spearman.

**7e. verdict thresholds arbitrary** (строки 518-520):
```ts
let verdict = "GOOD";
if (winRateSpread > 30 || rankingCorrelation < 0.5) verdict = "POOR";
else if (winRateSpread > 15 || rankingCorrelation < 0.75) verdict = "MODERATE";
```
Пороги 30%/15%/0.5/0.75 не обоснованы Bible. Bible 5.12 даёт 6 признаков баланса (время выбора, разногласие, разнообразие, симметрия жалоб, нестабильность тир-листов, разногласие экспертов) — none используются.

**7f. totalGames double-counts** (строка 484):
```ts
for (const name of names) {
  // ...
  for (const other of names) {
    // ...
    totalGames += games;  // ← BUG: each game counted in BOTH [name][other] AND [other][name]
  }
}
```
Каждая игра засчитывается дважды (один раз в `matchupGames[A][B]`, второй раз в `matchupGames[B][A]`). `totalGames` не используется downstream, но метрика неверна. Должно быть `totalGames / 2` или итерация только по `i < j`.

**7g. Game duration formula arbitrary** (строка 465):
```ts
const duration = Math.round(60 + (10 / Math.max(1, iSpeed + jSpeed)) * 50 + (Math.random() - 0.5) * 20);
```
- База 60 секунд.
- Speed adjustment: `10 / (iSpeed + jSpeed) × 50` — для speed=5+5=10: `10/10*50 = 50` → duration = 110 ± 10.
- Для speed=1+1=2: `10/2*50 = 250` → duration = 310 ± 10 (5+ минут — может быть разумно для медленных юнитов).
- Для speed=20+20=40: `10/40*50 = 12.5` → duration = 72.5 ± 10.

Формула не выведена из game design. Bible не специфицирует длительность, но random component делает метрику невоспроизводимой.

### RC-8: `buildMachinationsResult` — hardcoded HP/damage + fake runs count

`route.ts:555-750`:

**8a. Hardcoded HP/damage nodes** (строки 602-603):
```ts
nodes.push({ id: "hp", name: "HP", type: "pool", value: 100, capacity: 200 });
nodes.push({ id: "damage", name: "Damage", type: "source", value: 10 });
```

Эти узлы **никак не связаны** с пользовательскими объектами. Для экономической игры (где объекты — `gold`, `wood`, `stone`) добавление HP/damage pools бессмысленно.

Bible 5.6 говорит, что Machinations graph должен отражать **реальную экономику/динамику игры**: source → pool → converter → drain. Реализация не строит граф из объектов.

**8b. Hardcoded resource flows for every object** (строки 611-624):
```ts
for (const o of objects) {
  resourceFlows.push({
    from: "damage",
    to: o.name,
    rate: o.attributes.damage || 10,  // ← fallback to 10 if no damage attr
    label: "applies_damage",
  });
  resourceFlows.push({
    from: o.name,
    to: "hp",
    rate: 0.1,
    label: "heal",
  });
}
```

Каждый объект получает:
1. Поток `damage → obj` (если у объекта нет `attributes.damage`, fallback на `10`).
2. Поток `obj → hp` с rate 0.1 (heal).

Если объект — `Wood` (`attributes: { lumber: 5 }`), он получит `damage: 10` (fallback) и `heal: 0.1` — граф показывает "Damage → Wood (10/sec)" и "Wood → HP (0.1/sec)" — **бессмыслица**.

**8c. Hardcoded feedback loops** (строки 632-645):
```ts
const feedbackLoops = [
  {
    nodes: ["damage", objects[0]?.name || "obj", "hp"],
    type: "positive",
    strength: 0.7,
    description: "Combat escalation: more damage → faster kills → more rewards",
  },
  {
    nodes: ["hp", "rest", "hp"],  // ← "rest" node doesn't exist in graph
    type: "negative",
    strength: 0.5,
    description: "Balancing loop: HP drain forces healing",
  },
];
```

Две canned петли:
1. "Combat escalation" — описывает бой, но не отражает структуру графа.
2. "Balancing loop" через "rest" node — **"rest" не существует** в `nodes` массиве! Только `objects` + "hp" + "damage" есть в графе. Bible 5.6.1 требует 8 характеристик петли (тип, эффект, инвестиция, отдача, скорость, длительность, косвенность, определённость) — ни одна не вычисляется.

**8d. Simulation uses `o.attributes.HP` and `o.attributes.damage`** (строки 662-663):
```ts
const hp = o.attributes.HP || 100;
const dmg = o.attributes.damage || 10;
let value = hp;
const series: number[] = [hp];
let rMax = hp;
let rMin = hp;
for (let t = 1; t < ticks; t++) {
  const noise = (Math.random() - 0.5) * dmg * 0.3;
  value = value - dmg + hp * 0.05 + noise;
  value = Math.max(0, Math.min(hp * 2, value));
  // ...
}
```

Hardcoded имена атрибутов `HP` и `damage`. Default objects в `run-full-pipeline` (строки 126-131) имеют `attributes: { power, range, speed }` (weapon) или `{ defense, mobility }` (armor) — **ни HP, ни damage**! Все 4 объекта получают `hp=100, dmg=10` → **идентичные кривые**.

**8e. `runs: 10` is a lie** (строка 737):
```ts
return {
  graph,
  runs: 10,  // ← hardcoded, но реальное число запусков = 1 (по одному на объект)
  // ...
};
```
В коде только **1 simulation per object** (50 ticks каждый). Bible 5.6 + Machinations tool обычно запускают 100+ симуляций с разным seed, чтобы получить distribution of outcomes. Реализация запускает 1 раз имена результаты "aggregated".

**8f. Runaway/Stall thresholds arbitrary** (строки 679-680):
```ts
if (rMax >= hp * 1.8) runawayCount++;
if (rMax <= hp * 0.2) stallCount++;
```
Пороги 1.8× и 0.2× от начального HP. Bible 5.13.7 (хрупкость экологии):
> «Если ресурс отклоняется на 3+ сигмы от среднего — система "вышла из-под контроля".»

Реализация не вычисляет σ (стандартное отклонение) и не использует 3σ правило.

**8g. buildGap formula is broken** (строки 697-699):
```ts
const buildGap = Number(
  Math.abs(runawayFreq - stallFreq / 2).toFixed(3)
);
```

Из-за precedence: `runawayFreq - (stallFreq / 2)`, потом `abs`. Для `runawayFreq=0.5, stallFreq=0.3`: `|0.5 - 0.15| = 0.35`. Для `runawayFreq=0.1, stallFreq=0.9`: `|0.1 - 0.45| = 0.35` — то же значение! Формула **не различает** эти два случая, хотя они концептуально разные (один — runaway доминирует, другой — stall доминирует).

Bible 5.13.5:
> «Δ(t) = Power_optimal(t) − Power_competitive(t). Если Δ монотонно возрастает — дисбаланс растёт с уровнем.»

Реализация не вычисляет Δ по уровням. `buildGap` — это просто `|runawayFreq - stallFreq/2|`, не имеет отношения к Bible.

**8h. HP/damage curves are decorative** (строки 683-690):
```ts
curves["hp"] = Array.from({ length: ticks }, (_, t) =>
  Number((100 + Math.sin(t / 5) * 20).toFixed(2))
);
ranges["hp"] = { min: 80, max: 120 };
curves["damage"] = Array.from({ length: ticks }, (_, t) =>
  Number((10 + t * 0.1).toFixed(2))
);
ranges["damage"] = { min: 10, max: 15 };
```

`curves["hp"]` — чистый cosine от `t`, не имеет отношения к симуляции. `curves["damage"]` — линейный ramp `10 + 0.1×t`. Эти кривые **не выводятся** из графа или атрибутов объектов.

### RC-9: `buildStability` — type cast + missing feedback_loops

`route.ts:752-807`:

**9a. Type cast bypasses safety** (строки 897-905):
```ts
const stability = buildStability(
  machinationsResult as unknown as {
    aggregated: { runaway_frequency: number; stall_frequency: number; stability_index: number };
    quality: { critical_issues: string[] };
    detected_pathologies: string[];
    feedback_loops: Array<{ type: string }>;  // ← BUG: feedback_loops is at .graph.feedback_loops
  },
  transitiveResult
);
```

`feedback_loops` находится в `machinationsResult.graph.feedback_loops`, а не на верхнем уровне. Type cast заставляет TypeScript думать, что поле существует, но в рантайме оно `undefined`.

**9b. Guard masks the bug** (строки 763-764):
```ts
// Defensive: feedback_loops may be undefined when runMachinations is false
// (buildMachinationsResult omits the field in that case). Guard against
// TypeError so Block 4 does not crash the whole pipeline.
const feedbackLoops = machinationsResult.feedback_loops || [];
```

Комментарий признаёт проблему, но решение — `|| []` — маскирует баг. Результат:
```ts
const positiveLoops = feedbackLoops.filter((l) => l.type === "positive").length;  // 0
const negativeLoops = feedbackLoops.filter((l) => l.type === "negative").length;  // 0
```
**Всегда 0 и 0.** `analysis` (строка 797) всегда показывает "0 reinforcing and 0 balancing loops" — даже когда `feedback_loops` содержит 2 петли в `machinationsResult.graph.feedback_loops`.

**9c. `runMachinations=false` returns object missing `feedback_loops`** (строки 560-585):
```ts
if (!runMachinations) {
  return {
    graph: { nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] },
    // ...
  };
}
```

Когда `runMachinations=true`, `feedback_loops` находится в `graph.feedback_loops`. Когда `false`, тоже в `graph.feedback_loops` (пустой массив). Но `buildStability` ожидает `feedback_loops` **на верхнем уровне**. В обоих случаях — `undefined`.

### RC-10: AI enrichment не персистится

`route.ts:1000-1056`:

```ts
// Persist (line 1000-1037) — saves to DB WITHOUT ai_insights
await db.projectBalanceResult.upsert({
  where: { projectId: proj.id },
  create: { /* ... no ai_insights field ... */ },
  update: { /* ... no ai_insights field ... */ },
});

await updateProjectStage(proj.id, "balance");

// safeJsonParse is imported but unused — satisfy linter
void safeJsonParse;

// --- Optional AI enrichment (line 1045+) — adds to `result` AFTER DB save
if (useAi) {
  const aiInsights = await enrichBalance({
    projectName: proj.name || "Untitled",
    genre,
    balanceType,
    elementCount: objects.length,
  });
  if (aiInsights) {
    result.ai_insights = aiInsights;
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}

return NextResponse.json(result);
```

`ai_insights` попадает в HTTP response, но **не в БД**. На перезагрузку (GET `/balance/[projectId]`) — теряется.

Та же проблема в Block 1 (TASK-1.13) и Block 3 (TASK-3.12). Schema `ProjectBalanceResult` не имеет колонки `aiInsights` — нужно добавить.

### RC-11: DB persistence теряет поля + GET endpoint возвращает несогласованный shape

`route.ts:955-992` — 10 JSON-колонок сохраняются:
| Колонка | Что сохраняется | Что теряется |
|---------|-----------------|--------------|
| `inputData` | `{objects, game_mode, genre, balance_type, run_*}` | — |
| `elements` | `objects` | — |
| `costPowerCurves` | `transitiveResult.objects` | `attribute_weights`, `cost_curve_model`, `expected_cp`, `overpowered`, `underpowered`, `balanced`, `ideal_imbalance`, `warnings`, `suggestions` |
| `intransitiveMatrix` | `{matrix, names}` | `nash_equilibrium`, `is_intransitive`, `dominated_strategies`, `strategy_balance`, `rps_cycles`, `has_dominant_strategy`, `warnings`, `suggestions` |
| `nashEquilibrium` | `{equilibrium, strategy_balance}` | дублирует часть из `intransitiveMatrix` |
| `monteCarloResults` | `monteCarloResult` (full) | — |
| `machinationsResults` | `machinationsResult` (full) | — |
| `pathologies` | `{transitive_overpowered, transitive_underpowered, machinations_pathologies, stability_pathology_risks}` | — |
| `corrections` | `{transitive, intransitive, monte_carlo, machinations} suggestions` | — |
| `situationalValues` | `situationalResult` (full) | — |
| `fullResult` | весь `result` (JSON) | — |

**Что НЕ сохраняется отдельными колонками** (только в `fullResult`):
- `balance_map`
- `q_factor_result` ← **полностью потеряно** при reload (нет в GET)
- `stability` (только `pathology_risks` в `pathologies`)
- `ai_insights` (RC-10)
- `warnings`, `suggestions` (aggregated)

**GET endpoint** (`route.ts/[projectId]/route.ts:26-45`) возвращает:
```ts
{
  id, project_id, balance_type, overall_balance_score, imbalance_count, element_count,
  elements,            // ← objects
  cost_power_curves,   // ← transitiveResult.objects
  intransitive_matrix, // ← {matrix, names}
  nash_equilibrium,    // ← {equilibrium, strategy_balance}
  monte_carlo_results, // ← full
  machinations_results,// ← full
  pathologies,         // ← {transitive_op, transitive_up, mach_path, stab_path}
  corrections,         // ← {transitive, intransitive, mc, mach}
  input_data,          // ← full input
  full_result,         // ← everything
  created_at, updated_at
}
```

**Несоответствия fallback defaults** в GET:
- `safeJsonParse(b.monteCarloResults || "[]", [])` — fallback `[]` (массив), но сохраняется как **объект**. Если БД содержит `null` (старые записи), fallback `[]` — некорректный тип.
- `safeJsonParse(b.pathologies || "[]", [])` — fallback `[]`, но сохраняется как **объект** `{...}`.
- `safeJsonParse(b.corrections || "[]", [])` — fallback `[]`, но сохраняется как **объект** `{...}`.

Frontend `Block4Page` не использует GET `/balance/[projectId]` для отображения — всегда запускает новый `analyze`. Поэтому баги незаметны, но если кто-то вызывает GET напрямую — получит несогласованные типы.

### RC-12: `buildBalanceMap` `applicable_balance_types` для `mixed` возвращает 3 типа

`route.ts:78-81`:
```ts
const applicableTypes =
  balanceType === "mixed"
    ? ["transitive", "intransitive", "situational"]
    : [balanceType];
```

Для `mixed` — 3 типа. Но downstream stages (transitive, intransitive, situational) запускаются по **отдельным флагам** `run_intransitive`, `run_situational`, `run_q_factor`. Нет связи между `applicable_balance_types` и фактическим запуском. Метаданное поле, не влияющее на логику.

### RC-13: Object validation weak

`route.ts:847-860`:
```ts
const objects: BalanceObject[] = objectsRaw.map((o: unknown, i: number) => {
  const obj = o as Record<string, unknown>;
  return {
    id: String(obj.id ?? `obj_${i + 1}`),
    name: String(obj.name ?? `Object ${i + 1}`),
    type: String(obj.type ?? "generic"),
    attributes:
      (obj.attributes as Record<string, number>) ||
      { power: 50, hp: 100 },
    cost: typeof obj.cost === "number" ? obj.cost : undefined,
    tier: typeof obj.tier === "number" ? obj.tier : undefined,
    tags: Array.isArray(obj.tags) ? obj.tags as string[] : undefined,
  };
});
```

- **Нет валидации значений `attributes`** — если user отправляет `attributes: { power: "abc" }`, оно кастуется как `Record<string, number>`, но в рантайме `"abc" * 0.25 = NaN`. Весь downstream получит NaN → `power = NaN`, `winProb = 0.5 + NaN = NaN`, `Math.random() < NaN = false` → j всегда выигрывает.
- **Нет upper bound на `objects.length`** — если отправить 10000 объектов, Monte Carlo O(200 × 10000) = 2M ops, Machinations O(50 × 10000) = 500K ops — медленно, но не DoS. Intransitive payoff matrix O(n²) = 100M cells — **может упасть по памяти**.
- **`attributes` defaults to `{ power: 50, hp: 100 }`** — hardcoded, не имеет отношения к домену пользователя.
- **Нет валидации duplicate IDs** — два объекта с `id: "1"` могут сломать `matchupMatrix` (Record по name, не по id).

### RC-14: `stagesCompleted` — transitive всегда работает даже для чистого intransitive

`route.ts:923-929`:
```ts
const stagesCompleted = [1, 2, 3, 4, 5, 6].filter((s) => {
  if (s === 3 && !runIntransitive) return false;
  if (s === 4 && !runSituational && !runQFactor) return false;
  if (s === 5 && !runMonteCarlo) return false;
  if (s === 6 && !runMachinations) return false;
  return true;
});
```

Stage 1 (balance_map) и Stage 2 (transitive) **всегда** помечаются как completed, даже если `balanceType = "intransitive"` (для чистой RPS-игры транзитивный анализ нерелевантен). Bible 5.3.2:
> «Транзитивный баланс сужает воспринимаемое пространство возможностей... необходим, но недостаточен.»

Для чистого intransitive game (PvP, fight game) — транзитивный анализ не нужен. Stage 2 должен быть conditional по `balanceType !== "intransitive"`.

### RC-15: `enrichBalance` AI prompt generic

`ai-service.ts:596-627`:
```ts
const prompt = `Ты — эксперт по балансу игр. Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип баланса: ${ctx.balanceType}
Количество элементов: ${ctx.elementCount}

Дай 3 совета (на русском):
1. Какие метрики баланса наиболее важны для этого типа
2. Какие дисбалансы вероятны и как их предотвратить
3. Какие Monte-Carlo параметры рекомендуются (итерации, критерии победы)

Ответ — обычный текст с нумерованными пунктами.`;
```

Prompt не включает:
- Имена объектов и их атрибуты.
- Найденные imbalances (`transitiveResult.overpowered`, `underpowered`).
- `monteCarloResult.balance_verdict`.
- Machinations `detected_pathologies`.
- `stability.pathology_risks`.

AI даёт **generic** советы, не привязанные к конкретным данным. Bible 5.14 говорит о 4+1 методах балансировки — AI мог бы рекомендовать конкретный метод на основе detected pathologies.

### RC-16: Pipeline runner (`run-full-pipeline`) hardcoded 4 объекта

`run-full-pipeline/[projectId]/route.ts:118-136`:
```ts
{
  stage: "balance",
  block_id: 4,
  endpoint: "/api/v1/balance/analyze",
  buildBody: (i) => ({
    objects: [
      { id: "weapon_basic", name: "Базовое оружие", type: "weapon", attributes: { power: 30, range: 5, speed: 7 }, cost: 100, tier: 1 },
      { id: "weapon_advanced", name: "Продвинутое оружие", type: "weapon", attributes: { power: 60, range: 8, speed: 5 }, cost: 300, tier: 2 },
      { id: "armor_light", name: "Лёгкая броня", type: "armor", attributes: { defense: 20, mobility: 8 }, cost: 150, tier: 1 },
      { id: "armor_heavy", name: "Тяжёлая броня", type: "armor", attributes: { defense: 50, mobility: 3 }, cost: 400, tier: 3 },
    ],
    game_mode: "pve",
    genre: i.genre || "rpg",
    use_ai: i.useAi,
  }),
},
```

**Проблемы**:
1. **4 hardcoded объекта** для ВСЕХ проектов — независимо от жанра, концепции, механик. Frostbite (survival), Rhythm_of_War (rhythm), Harvest_Moonlight (farming) — все получают "Базовое оружие" и "Тяжёлую броню".
2. **`game_mode: "pve"` hardcoded** — для PvP-игры (Card_Lords, Star_Blazers) неверно.
3. **Объекты не связаны с upstream** (concept, core_loop, mda) — Bible 5.14: «клонирование — заимствовать числа из существующей сбалансированной игры с пониманием, почему она сбалансирована». Реализация не использует upstream.
4. **Атрибуты `power/range/speed` и `defense/mobility`** — неоднородные. У оружия нет `defense`, у брони нет `power`. В `buildTransitiveResult` `allAttrs = {power, range, speed, defense, mobility}` (5 attrs), веса = `0.2` каждый. Оружие получает `power*0.2 + range*0.2 + speed*0.2 = (30+5+7)*0.2 = 8.4`. Броня: `defense*0.2 + mobility*0.2 = (20+8)*0.2 = 5.6`. Cross-type сравнение **бессмысленно**.

Bible 5.5.2 (фулкрум):
> «Каждый объект тестируется только против фулкрума, что снижает сложность с O(n²) до O(n).»

Реализация не имеет фулкрума и тестирует все объекты в одной плоскости — неправильно для разнотипных объектов.

### RC-17: 8 патологий Bible 5.13 — реализованы только 2

Bible 5.13 каталог из 8 патологий:

| # | Патология | Реализовано? | Где |
|---|-----------|--------------|-----|
| 5.13.1 | Доминантная стратегия | ❌ Частично — `dominated_strategies` в intransitive, но не pathology list | `intransitiveResult.dominated_strategies` |
| 5.13.2 | Runaway | ✅ | `machinationsResult.detected_pathologies` (если `runawayFreq > 0.3`) |
| 5.13.3 | Мёртвая зона | ❌ Не реализовано | — |
| 5.13.4 | Обязательный выбор (божественный параметр) | ❌ Не реализовано | — |
| 5.13.5 | Разрыв билдов | ❌ Не реализовано (формула `buildGap` некорректна — RC-8g) | — |
| 5.13.6 | Инфляция/стагнация экономики | ❌ Stall = стагнация частично, инфляция — нет | — |
| 5.13.7 | Хрупкость экологии | ❌ Не реализовано (нет 3σ правила) | — |
| 5.13.8 | Воспринимаемая несправедливость | ❌ Не реализовано | — |

`detected_pathologies` массив содержит только `["Runaway accumulation", "Stall / stagnation", "Build gap too large"]` (строки 705-708). 5 из 8 патологий **полностью отсутствуют**.

### RC-18: Bible 5.4.3 — 7 Schreiber curves не реализованы

Bible 5.4.3 описывает 7 кривых стоимости Шрайбера:

| Кривая | Формула | Реализовано? |
|--------|---------|--------------|
| Identity | `y = x` | ❌ |
| Linear | `y = mx` | ❌ |
| Exponential | `y = C × bˣ` | ❌ |
| Logarithmic | `y = log_b(x)` | ❌ |
| Triangular | `y = (x² − x) / 2` | ❌ |
| Custom | Произвольная | ✅ `power = 0.6 * cost^0.8` (но hardcoded) |
| Obfuscation | Нелинейная с разрывами | ❌ |

Bible: «Triangular — наиболее используемая формула возрастающей отдачи». Реализация не использует triangular ни в одном месте.

### RC-19: Bible 5.6.1 — 8 характеристик петли ОС не реализованы

Bible 5.6.1: каждая петля ОС описывается 8 измерениями:
1. Тип (positive/negative)
2. Эффект (constructive/destructive)
3. Инвестиция (low/high)
4. Отдача (low/high)
5. Скорость (instant/delayed)
6. Длительность (one-shot/permanent)
7. Косвенность (direct/mediated)
8. Определённость (deterministic/probabilistic)

Реализация `feedbackLoops` (строки 632-645) содержит только:
- `nodes: string[]`
- `type: "positive" | "negative"` (только #1)
- `strength: number`
- `description: string`

Остальные 7 характеристик **отсутствуют**. Bible 5.13.2 (runaway diagnosis) использует 8-мерный профиль:
> «Положительная, конструктивная, низкая инвестиция, высокая отдача, мгновенная, постоянная, прямая, детерминированная петля — почти гарантированно вызовет runaway.»

Реализация не может диагностировать runaway по этому критерию — только по `runawayFreq > 0.3` (пороговый).

### RC-20: `run_pipeline_test.sh` — `game_mode` и `genre` не передаются

`run_pipeline_test.sh:114`:
```bash
-d "{\"project_id\":\"$PID\",\"elements\":[{\"name\":\"sword\",\"cost\":100,\"power\":50}],\"use_ai\":true}" \
```

Кроме `elements` vs `objects` (RC-1):
- Нет `game_mode` — route fallback на `"PvP"` (строка 824).
- Нет `genre` — route fallback на `"action"` (строка 825).
- Нет `balance_type` — route fallback на `"mixed"` (строка 826).
- Нет `run_intransitive`, `run_situational`, `run_q_factor`, `run_monte_carlo`, `run_machinations` — defaults: `runIntransitive=true`, `runSituational=false`, `runQFactor=false`, `runMonteCarlo=true`, `runMachinations=true` (строки 828-832).

Даже после фикса `elements`→`objects` и добавления 2+ объектов, тест будет запускать только базовый pipeline без situational/Q-factor.

---

## Цели рефакторинга

1. **Починить `run_pipeline_test.sh`** — переименовать `elements`→`objects`, передать 2+ объектов правильного shape, добавить `game_mode`/`genre`/`balance_type`/`run_*` флаги.
2. **Починить `run-full-pipeline` STAGES[3].buildBody** — derives objects from upstream (concept genre, core_loop mechanics) instead of 4 hardcoded.
3. **Реализовать 7 Schreiber curves** (Bible 5.4.3) — selectable via `cost_curve_type` parameter, default `triangular`.
4. **Реализовать weighted attribute importance** (Bible 5.5.3) — weights based on attribute type (e.g., `damage` weight > `speed` weight for combat objects), configurable.
5. **Реализовать real Nash equilibrium** — solve linear system `M × c = p` with `Σc = 1` constraint (Bible 5.3.2).
6. **Убрать artificial cyclicalBias** — RPS structure должна **возникать** из атрибутов, не инжектироваться.
7. **Реализовать real RPS cycle detection** — all `C(n,3)` triples, not just sequential.
8. **Сделать Monte Carlo deterministic** — use seeded PRNG (mulberry32 or similar), expose `seed` in config.
9. **Починить Machinations graph** — build from object types, not hardcoded HP/damage.
10. **Реализовать 8 feedback loop characteristics** (Bible 5.6.1) — proper loop profiling.
11. **Реализовать 8 balance pathologies** (Bible 5.13) — diagnostic for all 8, not just 2.
12. **Починить `buildStability`** — убрать `as unknown as` cast, правильно читать `feedback_loops` из `machinationsResult.graph.feedback_loops`.
13. **Persist `ai_insights` в БД** — добавить колонку `aiInsights` в schema, вызывать `enrichBalance` ДО persist.
14. **Расширить `enrichBalance` prompt** — include specific objects, imbalances, verdict, pathologies.
15. **Унифицировать DB schema и GET endpoint** — все поля сохраняются и возвращаются с правильными fallback типами.
16. **Реализовать Markov chains и recursive EV** (Bible 5.8.1, 5.8.2) — для продвинутого анализа.
17. **Реализовать fulcrum O(n) reference** (Bible 5.5.2) — выбрать референсный объект и калибровать остальные против него.
18. **Добавить валидацию objects** — bound on count (2..100), numeric attributes, unique IDs.

---

## Задачи

### TASK-4.1: Починить `scripts/run_pipeline_test.sh` — `elements` → `objects` + правильный shape

**Сложность**: S
**Приоритет**: 🔴 (блокирует весь end-to-end pipeline test)
**Файлы**: `scripts/run_pipeline_test.sh`

**Описание проблемы**:

`scripts/run_pipeline_test.sh:114`:
```bash
-d "{\"project_id\":\"$PID\",\"elements\":[{\"name\":\"sword\",\"cost\":100,\"power\":50}],\"use_ai\":true}" \
```

Три бага в одной строке (RC-1):
1. Поле `elements` вместо `objects` → route никогда не видит объекты → 422.
2. Только 1 объект → даже после фикса имени, валидация `length < 2` всё равно вернёт 422.
3. Неверный shape: `{name, cost, power}` вместо `BalanceObject` (`{id, name, type, attributes, cost?, tier?, tags?}`).

**Решение**:

Заменить строку 114 на:
```bash
-d "{\"project_id\":\"$PID\",\
\"objects\":[\
{\"id\":\"obj1\",\"name\":\"Warrior\",\"type\":\"melee\",\"attributes\":{\"HP\":100,\"damage\":15,\"speed\":5,\"armor\":10},\"cost\":100,\"tier\":1},\
{\"id\":\"obj2\",\"name\":\"Mage\",\"type\":\"ranged\",\"attributes\":{\"HP\":60,\"damage\":25,\"speed\":7,\"armor\":3},\"cost\":120,\"tier\":1},\
{\"id\":\"obj3\",\"name\":\"Rogue\",\"type\":\"melee\",\"attributes\":{\"HP\":70,\"damage\":20,\"speed\":12,\"armor\":5},\"cost\":110,\"tier\":1},\
{\"id\":\"obj4\",\"name\":\"Tank\",\"type\":\"melee\",\"attributes\":{\"HP\":200,\"damage\":8,\"speed\":3,\"armor\":20},\"cost\":150,\"tier\":2}\
],\
\"game_mode\":\"PvP\",\
\"genre\":\"$GENRE\",\
\"balance_type\":\"mixed\",\
\"run_intransitive\":true,\
\"run_situational\":true,\
\"run_q_factor\":true,\
\"run_monte_carlo\":true,\
\"run_machinations\":true,\
\"use_ai\":true}" \
```

В bash-формате (одной строкой с экранированием):
```bash
OBJECTS_PAYLOAD="{\"project_id\":\"$PID\",\"objects\":[{\"id\":\"obj1\",\"name\":\"Warrior\",\"type\":\"melee\",\"attributes\":{\"HP\":100,\"damage\":15,\"speed\":5,\"armor\":10},\"cost\":100,\"tier\":1},{\"id\":\"obj2\",\"name\":\"Mage\",\"type\":\"ranged\",\"attributes\":{\"HP\":60,\"damage\":25,\"speed\":7,\"armor\":3},\"cost\":120,\"tier\":1},{\"id\":\"obj3\",\"name\":\"Rogue\",\"type\":\"melee\",\"attributes\":{\"HP\":70,\"damage\":20,\"speed\":12,\"armor\":5},\"cost\":110,\"tier\":1},{\"id\":\"obj4\",\"name\":\"Tank\",\"type\":\"melee\",\"attributes\":{\"HP\":200,\"damage\":8,\"speed\":3,\"armor\":20},\"cost\":150,\"tier\":2}],\"game_mode\":\"PvP\",\"genre\":\"$GENRE\",\"balance_type\":\"mixed\",\"run_intransitive\":true,\"run_situational\":true,\"run_q_factor\":true,\"run_monte_carlo\":true,\"run_machinations\":true,\"use_ai\":true}"

# Step 4: Balance (AI)
echo "  [4/8] Balance (AI)..."
R=$(curl -s -X POST $API/balance/analyze \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$OBJECTS_PAYLOAD" \
  --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
echo "$R" > "$RUN_DIR/04_balance.json"
```

**Альтернатива** (рекомендуется): вынести payload в JSON-файл `test_projects/_payloads/balance.json` и использовать `curl -d @file`:
```bash
cat > "$RUN_DIR/_balance_payload.json" <<'EOF'
{
  "objects": [
    {"id":"obj1","name":"Warrior","type":"melee","attributes":{"HP":100,"damage":15,"speed":5,"armor":10},"cost":100,"tier":1},
    {"id":"obj2","name":"Mage","type":"ranged","attributes":{"HP":60,"damage":25,"speed":7,"armor":3},"cost":120,"tier":1},
    {"id":"obj3","name":"Rogue","type":"melee","attributes":{"HP":70,"damage":20,"speed":12,"armor":5},"cost":110,"tier":1},
    {"id":"obj4","name":"Tank","type":"melee","attributes":{"HP":200,"damage":8,"speed":3,"armor":20},"cost":150,"tier":2}
  ],
  "game_mode": "PvP",
  "genre": "@GENRE@",
  "balance_type": "mixed",
  "run_intransitive": true,
  "run_situational": true,
  "run_q_factor": true,
  "run_monte_carlo": true,
  "run_machinations": true,
  "use_ai": true
}
EOF
sed -i "s/@GENRE@/$GENRE/g" "$RUN_DIR/_balance_payload.json"

R=$(curl -s -X POST $API/balance/analyze \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @"$RUN_DIR/_balance_payload.json" \
  --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
echo "$R" > "$RUN_DIR/04_balance.json"
```

Этот подход:
- Устраняет экранирование (читаемость).
- Позволяет dynamically substitute `@GENRE@` для каждого проекта.
- Сохраняет payload в artifacts (для отладки).

**Тест-кейсы**:
- После фикса: `04_balance.json` содержит полный `FullBalanceResponse` (не 422-ошибка).
- `element_count: 4`, `balance_type: "mixed"`.
- `monte_carlo_result.balance_verdict` ∈ `{"GOOD", "MODERATE", "POOR"}`.
- `stability.overall_stability` — число в `[0, 1]`.
- Все 10 test_projects возвращают разные результаты (т.к. genre различается).

**Риски**:
- Если backend всё ещё содержит баги (RC-2…RC-19), 200 OK может вернуть некорректные данные. Митигация: этот фикс разблокирует end-to-end тестирование — последующие TASK-4.x правят логику.
- JSON-heredoc в bash может сломаться при наличии специальных символов в `$GENRE`. Митигация: использовать `sed` для подстановки или `jq` для генерации payload.

**Dependencies**: нет (стартовая задача, может выполняться параллельно с любыми другими).

---

### TASK-4.2: Починить `run-full-pipeline` STAGES[3].buildBody — derives objects from upstream

**Сложность**: L
**Приоритет**: 🔴 (после TASK-4.1)
**Файлы**: `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`, `src/lib/pipeline-helpers.ts`

**Описание проблемы**:

`run-full-pipeline/[projectId]/route.ts:118-136` (RC-16):
```ts
{
  stage: "balance",
  block_id: 4,
  endpoint: "/api/v1/balance/analyze",
  buildBody: (i) => ({
    objects: [
      { id: "weapon_basic", name: "Базовое оружие", type: "weapon", attributes: { power: 30, range: 5, speed: 7 }, cost: 100, tier: 1 },
      { id: "weapon_advanced", name: "Продвинутое оружие", type: "weapon", attributes: { power: 60, range: 8, speed: 5 }, cost: 300, tier: 2 },
      { id: "armor_light", name: "Лёгкая броня", type: "armor", attributes: { defense: 20, mobility: 8 }, cost: 150, tier: 1 },
      { id: "armor_heavy", name: "Тяжёлая броня", type: "armor", attributes: { defense: 50, mobility: 3 }, cost: 400, tier: 3 },
    ],
    game_mode: "pve",
    genre: i.genre || "rpg",
    use_ai: i.useAi,
  }),
},
```

4 hardcoded объекта + `game_mode: "pve"` для ВСЕХ проектов. Не зависит от жанра/концепции/механик.

**Решение**:

1. **Расширить `PipelineInput`** для upstream данных (route.ts:68-75):
```ts
interface PipelineInput {
  idea: string;
  genre?: string | null;
  useAi: boolean;
  targetAesthetics: string[];
  totalLevels: number;
  format: string;
  // New: upstream snapshots for deriving balance objects
  conceptGenre?: string;
  coreLoopMechanics?: string[];
  conceptAesthetic?: string;
}
```

2. **В POST handler** (route.ts:203+) — load upstream snapshots:
```ts
const snap = await loadProjectPipelineSnapshot(user.id, projectId);
if (!snap) return NOT_FOUND();

// Load upstream concept + core loop data for Block 4 derivation
const project = await db.project.findFirst({
  where: { id: projectId, userId: user.id, deletedAt: null },
  include: {
    concept: { select: { genre: true, primaryAesthetic: true, mechanicSet: true } },
    coreLoop: { select: { structuralType: true, stepsData: true } },
  },
});

const input: PipelineInput = {
  idea,
  genre: body?.genre ?? project?.concept?.genre ?? null,
  useAi: body?.use_ai === true || body?.use_ai === "true",
  targetAesthetics: Array.isArray(body?.target_aesthetics) ? ... : [],
  totalLevels: ... ,
  format: ...,
  // NEW
  conceptGenre: project?.concept?.genre ?? undefined,
  coreLoopMechanics: extractMechanicsFromCoreLoop(project?.coreLoop?.stepsData),
  conceptAesthetic: project?.concept?.primaryAesthetic ?? undefined,
};
```

3. **Helper для генерации balance objects из upstream**:
```ts
// Новый файл: src/lib/balance-objects-generator.ts
import type { BalanceObject } from "@/types/balance";

interface GenerationContext {
  genre?: string;
  mechanics?: string[];
  aesthetic?: string;
}

const GENRE_OBJECT_TEMPLATES: Record<string, BalanceObject[]> = {
  rpg: [
    { id: "warrior", name: "Warrior", type: "melee", attributes: { HP: 120, damage: 15, speed: 5, armor: 12 }, cost: 100, tier: 1 },
    { id: "mage", name: "Mage", type: "ranged", attributes: { HP: 60, damage: 25, speed: 7, armor: 3 }, cost: 120, tier: 1 },
    { id: "rogue", name: "Rogue", type: "melee", attributes: { HP: 70, damage: 20, speed: 12, armor: 5 }, cost: 110, tier: 1 },
    { id: "cleric", name: "Cleric", type: "support", attributes: { HP: 90, damage: 8, speed: 6, armor: 8, healing: 15 }, cost: 130, tier: 1 },
  ],
  shooter: [
    { id: "rifle", name: "Rifle", type: "weapon", attributes: { damage: 30, range: 50, accuracy: 80, fire_rate: 5 }, cost: 200, tier: 1 },
    { id: "shotgun", name: "Shotgun", type: "weapon", attributes: { damage: 50, range: 10, accuracy: 40, fire_rate: 2 }, cost: 180, tier: 1 },
    { id: "sniper", name: "Sniper", type: "weapon", attributes: { damage: 80, range: 100, accuracy: 95, fire_rate: 1 }, cost: 350, tier: 2 },
    { id: "pistol", name: "Pistol", type: "weapon", attributes: { damage: 15, range: 20, accuracy: 70, fire_rate: 8 }, cost: 80, tier: 1 },
  ],
  strategy: [
    { id: "infantry", name: "Infantry", type: "unit", attributes: { HP: 100, damage: 10, speed: 3, range: 1, cost: 50 }, cost: 50, tier: 1 },
    { id: "archer", name: "Archer", type: "unit", attributes: { HP: 60, damage: 15, speed: 2, range: 8, cost: 80 }, cost: 80, tier: 1 },
    { id: "cavalry", name: "Cavalry", type: "unit", attributes: { HP: 150, damage: 20, speed: 8, range: 1, cost: 150 }, cost: 150, tier: 2 },
    { id: "siege", name: "Siege Engine", type: "unit", attributes: { HP: 300, damage: 50, speed: 1, range: 12, cost: 400 }, cost: 400, tier: 3 },
  ],
  puzzle: [
    { id: "gem_red", name: "Red Gem", type: "collectible", attributes: { value: 10, rarity: 30, combo_potential: 80 }, cost: 50, tier: 1 },
    { id: "gem_blue", name: "Blue Gem", type: "collectible", attributes: { value: 15, rarity: 50, combo_potential: 60 }, cost: 75, tier: 1 },
    { id: "gem_purple", name: "Purple Gem", type: "collectible", attributes: { value: 30, rarity: 80, combo_potential: 90 }, cost: 200, tier: 2 },
    { id: "gem_rainbow", name: "Rainbow Gem", type: "collectible", attributes: { value: 100, rarity: 100, combo_potential: 100 }, cost: 500, tier: 3 },
  ],
  racing: [
    { id: "car_balanced", name: "Balanced Car", type: "vehicle", attributes: { speed: 70, accel: 70, handling: 70, weight: 70 }, cost: 100, tier: 1 },
    { id: "car_speed", name: "Speed Car", type: "vehicle", attributes: { speed: 95, accel: 80, handling: 50, weight: 50 }, cost: 150, tier: 2 },
    { id: "car_tank", name: "Heavy Car", type: "vehicle", attributes: { speed: 50, accel: 40, handling: 60, weight: 100 }, cost: 130, tier: 1 },
    { id: "car_drift", name: "Drift Car", type: "vehicle", attributes: { speed: 75, accel: 65, handling: 95, weight: 60 }, cost: 180, tier: 2 },
  ],
  // ... add more genres (simulation, rhythm, tower_defense, metroidvania, sandbox)
  default: [
    { id: "elem_a", name: "Element A", type: "generic", attributes: { power: 30, speed: 5, range: 5 }, cost: 100, tier: 1 },
    { id: "elem_b", name: "Element B", type: "generic", attributes: { power: 50, speed: 3, range: 8 }, cost: 150, tier: 1 },
    { id: "elem_c", name: "Element C", type: "generic", attributes: { power: 20, speed: 10, range: 3 }, cost: 120, tier: 1 },
    { id: "elem_d", name: "Element D", type: "generic", attributes: { power: 80, speed: 2, range: 12 }, cost: 300, tier: 2 },
  ],
};

const GAME_MODE_BY_GENRE: Record<string, "PvP" | "PvE" | "PvPvE"> = {
  rpg: "PvE",
  shooter: "PvP",
  strategy: "PvP",
  puzzle: "PvE",
  racing: "PvP",
  simulation: "PvE",
  rhythm: "PvE",
  tower_defense: "PvE",
  metroidvania: "PvE",
  sandbox: "PvE",
  default: "PvE" as const,
};

export function generateBalanceObjects(ctx: GenerationContext): BalanceObject[] {
  const genreKey = (ctx.genre || "default").toLowerCase().replace(/\s+/g, "_");
  // Try direct match first, then genre family, then default
  const templates = GENRE_OBJECT_TEMPLATES[genreKey]
    ?? GENRE_OBJECT_TEMPLATES.default;
  // Deep clone to avoid mutation
  return templates.map((o) => ({ ...o, attributes: { ...o.attributes } }));
}

export function inferGameMode(genre?: string | null): "PvP" | "PvE" | "PvPvE" {
  if (!genre) return "PvE";
  const g = genre.toLowerCase().replace(/\s+/g, "_");
  return GAME_MODE_BY_GENRE[g] ?? "PvE";
}

export function inferBalanceType(genre?: string | null): "transitive" | "intransitive" | "situational" | "mixed" {
  if (!genre) return "mixed";
  const g = genre.toLowerCase();
  // Pure intransitive games: fighting, card battler, RPS
  if (g.includes("fighting") || g.includes("card")) return "intransitive";
  // Pure transitive: RPG, progression-heavy
  if (g.includes("rpg") || g.includes("simulation")) return "transitive";
  // Situational: tactics, puzzle
  if (g.includes("puzzle") || g.includes("tactics")) return "situational";
  return "mixed";
}
```

4. **Обновить STAGES[3].buildBody**:
```ts
{
  stage: "balance",
  block_id: 4,
  endpoint: "/api/v1/balance/analyze",
  buildBody: (i) => {
    const objects = generateBalanceObjects({
      genre: i.conceptGenre,
      mechanics: i.coreLoopMechanics,
      aesthetic: i.conceptAesthetic,
    });
    return {
      objects,
      game_mode: inferGameMode(i.conceptGenre),
      genre: i.conceptGenre || i.genre || "rpg",
      balance_type: inferBalanceType(i.conceptGenre),
      run_intransitive: true,
      run_situational: true,
      run_q_factor: false,
      run_monte_carlo: true,
      run_machinations: true,
      use_ai: i.useAi,
    };
  },
},
```

5. **Helper `extractMechanicsFromCoreLoop`**:
```ts
function extractMechanicsFromCoreLoop(stepsData: string | null | undefined): string[] {
  if (!stepsData) return [];
  try {
    const parsed = JSON.parse(stepsData);
    if (Array.isArray(parsed)) {
      return parsed
        .map((step: unknown) => (step as { mechanic?: string })?.mechanic)
        .filter((m): m is string => typeof m === "string");
    }
  } catch {
    /* ignore */
  }
  return [];
}
```

**Тест-кейсы**:
- Pipeline run для Shadow_Depths (RPG) → 4 RPG objects (warrior, mage, rogue, cleric), `game_mode: "PvE"`, `balance_type: "transitive"`.
- Pipeline run для Card_Lords (Strategy, deck-building) → 4 strategy/card objects, `game_mode: "PvP"`, `balance_type: "intransitive"`.
- Pipeline run для Rhythm_of_War (Rhythm) → 4 rhythm objects (notes/beats), `game_mode: "PvE"`.
- Pipeline run для проекта без concept → fallback to `default` templates.
- 10 test_projects получают **разные** balance objects (не одинаковые 4 hardcoded).

**Риски**:
- `GENRE_OBJECT_TEMPLATES` требует ручного заполнения для каждого жанра. Митигация: начать с 10 базовых жанров (RPG, shooter, strategy, puzzle, racing, simulation, rhythm, tower_defense, metroidvania, sandbox), fallback на `default`.
- Внутренний fetch к `/balance/analyze` увеличивает latency pipeline. Митигация: таймаут 60 сек на stage (уже есть в `--max-time 60` для test script, для pipeline runner — implicit).
- Если `generateBalanceObjects` возвращает объекты с разными attribute sets (warrior has `armor`, mage has `armor`, но cleric has `healing`) — transitive analysis будет считать `healing` как 5-й атрибут с weight 0.2, давая cleric низкий `power` (т.к. healing не в формуле). Это OK для начальной версии, но требует TASK-4.4 для атрибутных весов.

**Dependencies**: TASK-4.1 (чтобы тест скрипт тоже работал). TASK-3.6 (Block 3 — load concept.aestheticProfile) — опционально, для `conceptAesthetic`.

---

### TASK-4.3: Реализовать 7 Schreiber curves (Bible 5.4.3)

**Сложность**: M
**Приоритет**: 🔴 (после TASK-4.2)
**Файлы**: `src/constants/balance.ts`, `src/app/api/v1/balance/analyze/route.ts` (`buildTransitiveResult`), `src/types/balance.ts`

**Описание проблемы**:

`route.ts:135, 139` (RC-3b):
```ts
const costCurveModel = "power = 0.6 * cost^0.8";
const expectedPower = 0.6 * Math.pow(p.effective_cost, 0.8);
```

Hardcoded polynomial `0.6 * cost^0.8` — не входит в список 7 Schreiber curves (Bible 5.4.3).

**Решение**:

1. **Расширить `src/constants/balance.ts`** — добавить 7 кривых:
```ts
export type CostCurveType =
  | "identity"
  | "linear"
  | "exponential"
  | "logarithmic"
  | "triangular"
  | "custom"
  | "obfuscation";

export interface CostCurveDef {
  type: CostCurveType;
  label: string;
  formula: string;       // Human-readable formula
  description: string;
  /** Compute expected power for given cost. */
  compute: (cost: number, params: CostCurveParams) => number;
}

export interface CostCurveParams {
  /** Linear slope m */
  m?: number;
  /** Exponential base b and amplitude C */
  b?: number;
  C?: number;
  /** Logarithm base */
  logBase?: number;
  /** Custom power-law exponent (replaces hardcoded 0.8) */
  exponent?: number;
  /** Custom amplitude (replaces hardcoded 0.6) */
  amplitude?: number;
}

export const COST_CURVES: Record<CostCurveType, CostCurveDef> = {
  identity: {
    type: "identity",
    label: "Identity (y=x)",
    formula: "y = x",
    description: "Прямой обмен 1:1; деревья навыков (Bible 5.4.3).",
    compute: (cost) => cost,
  },
  linear: {
    type: "linear",
    label: "Linear (y=mx)",
    formula: "y = m·x",
    description: "Стоимость от урона; HP от маны (Bible 5.4.3).",
    compute: (cost, p) => (p.m ?? 1) * cost,
  },
  exponential: {
    type: "exponential",
    label: "Exponential (y=C·b^x)",
    formula: "y = C·bˣ",
    description: "XP-кривая; ускоряющийся финал (Bible 5.4.3).",
    compute: (cost, p) => (p.C ?? 1) * Math.pow(p.b ?? 1.1, cost / 10),
  },
  logarithmic: {
    type: "logarithmic",
    label: "Logarithmic (y=log_b(x))",
    formula: "y = log_b(x)",
    description: "Кривая уровней (обратная к XP-кривой) (Bible 5.4.3).",
    compute: (cost, p) => {
      const base = p.logBase ?? Math.E;
      return Math.log(Math.max(1, cost)) / Math.log(base);
    },
  },
  triangular: {
    type: "triangular",
    label: "Triangular (y=(x²-x)/2)",
    formula: "y = (x² − x) / 2",
    description: "Наиболее используемая формула возрастающей отдачи (Bible 5.4.3). Рекомендуется как default.",
    compute: (cost) => (cost * cost - cost) / 2,
  },
  custom: {
    type: "custom",
    label: "Custom (y=A·x^k)",
    formula: "y = A·xᵏ",
    description: "Полиномиальная; A и k настраиваются (Bible 5.4.3).",
    compute: (cost, p) => (p.amplitude ?? 0.6) * Math.pow(Math.max(1, cost), p.exponent ?? 0.8),
  },
  obfuscation: {
    type: "obfuscation",
    label: "Obfuscation (piecewise nonlinear)",
    formula: "y = piecewise(x)",
    description: "F2P: сокрытие реальной стоимости через разрывы (Bible 5.4.3).",
    compute: (cost) => {
      // Example: step function with plateaus
      if (cost < 50) return cost;
      if (cost < 150) return 50 + (cost - 50) * 1.5;
      if (cost < 400) return 200 + (cost - 150) * 2.0;
      return 700 + (cost - 400) * 3.0;
    },
  },
};

export const DEFAULT_COST_CURVE: CostCurveType = "triangular";

export const COST_CURVE_LABELS: Record<CostCurveType, string> = Object.fromEntries(
  Object.entries(COST_CURVES).map(([k, v]) => [k, v.label])
) as Record<CostCurveType, string>;
```

2. **Расширить `BalanceObject` и `FullBalanceRequest`** в `src/types/balance.ts`:
```ts
export interface FullBalanceRequest {
  // ... existing fields ...
  cost_curve_type?: "identity" | "linear" | "exponential" | "logarithmic" | "triangular" | "custom" | "obfuscation";
  cost_curve_params?: {
    m?: number;
    b?: number;
    C?: number;
    logBase?: number;
    exponent?: number;
    amplitude?: number;
  };
}
```

3. **Обновить `buildTransitiveResult`** в `route.ts:102-205`:
```ts
import { COST_CURVES, DEFAULT_COST_CURVE, type CostCurveType, type CostCurveParams } from "@/constants/balance";

function buildTransitiveResult(
  objects: BalanceObject[],
  balanceType: string,
  costCurveType: CostCurveType = DEFAULT_COST_CURVE,
  costCurveParams: CostCurveParams = {}
) {
  // ... existing attrList + weights logic ...

  const curveDef = COST_CURVES[costCurveType] ?? COST_CURVES[DEFAULT_COST_CURVE];
  const costCurveModel = curveDef.formula;

  // Compute power per object (same as before)
  const powers = objects.map((o) => ({
    name: o.name,
    power: computePower(o.attributes, weights),
    cost: o.cost ?? 100,
  }));

  // ... existing effectiveCosts logic ...

  // Per-object status: distance from curve (Bible 5.3.4 — ideal imbalance ~10-15%)
  const transitiveObjects = effectiveCosts.map((p) => {
    const expectedPower = curveDef.compute(p.effective_cost, costCurveParams);
    // Normalize: distance = (actual_power - expected_power) / expected_power
    const distance = expectedPower > 0
      ? Number((p.power / expectedPower - 1).toFixed(3))
      : 0;
    let status = "balanced";
    if (distance > 0.25) status = "overpowered";
    else if (distance < -0.25) status = "underpowered";
    else if (Math.abs(distance) > 0.1) status = "ideal_imbalance";
    // ... same as before ...
  });

  // ... rest unchanged ...
}
```

4. **В route handler** — extract parameters from body (route.ts ~820-833):
```ts
const costCurveType = (body?.cost_curve_type as CostCurveType) || DEFAULT_COST_CURVE;
const costCurveParams = (body?.cost_curve_params as CostCurveParams) || {};
if (!COST_CURVES[costCurveType]) {
  return VALIDATION_ERROR(
    `Неверный cost_curve_type: ${costCurveType}. Допустимо: ${Object.keys(COST_CURVES).join(", ")}`
  );
}
```

5. **Pass to `buildTransitiveResult`** (route.ts:875):
```ts
const transitiveResult = buildTransitiveResult(objects, balanceType, costCurveType, costCurveParams);
```

6. **Expose `cost_curve_type` in response** — add to `FullBalanceResponse.transitive_result`:
```ts
export interface TransitiveResult {
  attribute_weights: Record<string, number>;
  cost_curve_model: string;
  cost_curve_type: CostCurveType;  // NEW
  expected_cp: number;
  // ... rest
}
```

**Тест-кейсы**:
- `cost_curve_type: "triangular"` (default) → `costCurveModel = "y = (x² − x) / 2"`. Для cost=100: `expectedPower = (10000 - 100)/2 = 4950`. Object with power=5000 → distance=0.01 → `balanced`.
- `cost_curve_type: "identity"` → `expectedPower = cost`. Для cost=100: `expectedPower = 100`. Object with power=120 → distance=0.2 → `ideal_imbalance`.
- `cost_curve_type: "linear"` with `m=0.5` → `expectedPower = 0.5 × cost`. Для cost=100: `expectedPower = 50`. Object with power=70 → distance=0.4 → `overpowered`.
- `cost_curve_type: "exponential"` with `b=1.1, C=1` → для cost=100: `expectedPower = 1.1^10 = 2.59`. Extreme curve.
- `cost_curve_type: "custom"` with `amplitude=0.6, exponent=0.8` → воспроизводит старое поведение `0.6 × cost^0.8` (backward compat).
- 10 test_projects используют default `triangular` → различные distance/status (раньше все получали одинаковую кривую).

**Риски**:
- `triangular` для больших cost (1000+) даёт огромные `expectedPower` (~500K) → все объекты `underpowered`. Митигация: документировать, что `triangular` подходит для cost < 100 (мелкие числа); для больших cost использовать `logarithmic` или `linear`.
- Reverse-engineering (Bible 5.4.1) — out of scope этой задачи. Реализация выбирает кривую из параметра, не вычисляет её из данных. Mark as TASK-4.18 (future).

**Dependencies**: нет. Может выполняться параллельно с TASK-4.4, TASK-4.5.

---

### TASK-4.4: Реализовать weighted attribute importance (Bible 5.5.3)

**Сложность**: M
**Приоритет**: 🔴 (после TASK-4.3)
**Файлы**: `src/constants/balance.ts`, `src/app/api/v1/balance/analyze/route.ts` (`buildTransitiveResult`), `src/types/balance.ts`

**Описание проблемы**:

`route.ts:109-111` (RC-3a):
```ts
const attrList = Array.from(allAttrs);
const weights: Record<string, number> = {};
const equalWeight = 1 / Math.max(1, attrList.length);
for (const a of attrList) weights[a] = Number(equalWeight.toFixed(3));
```

Равные веса `1/N` нарушают Bible 5.5.3:
> «Чем важнее атрибут, тем выше его вес — и, следовательно, тем **ниже** сырые значения у сбалансированных объектов по этому атрибуту.»

**Решение**:

1. **Добавить `ATTRIBUTE_IMPORTANCE` в `src/constants/balance.ts`**:
```ts
/**
 * Default importance weights for common attribute names (Bible 5.5.3).
 * Importance ∈ [0, 1]: 1 = critical, 0 = decorative.
 * Higher importance → higher weight → lower expected raw value (inverse relationship).
 */
export const ATTRIBUTE_IMPORTANCE: Record<string, number> = {
  // Combat attributes
  damage: 1.0,        // primary damage output
  dps: 1.0,           // derived DPS
  HP: 0.9,            // survivability
  hp: 0.9,
  armor: 0.8,         // mitigation
  defense: 0.8,
  speed: 0.7,         // turn order / mobility
  range: 0.7,         // engagement distance
  accuracy: 0.7,      // hit chance
  fire_rate: 0.7,
  crit_chance: 0.6,
  crit_mult: 0.6,
  mobility: 0.6,
  evasion: 0.6,
  // Support attributes
  healing: 0.7,
  mana: 0.5,
  mana_regen: 0.4,
  stamina: 0.4,
  // Economic attributes
  cost: 0.5,          // already used as cost; lower weight in power calc
  value: 0.6,
  rarity: 0.4,
  // Meta attributes
  combo_potential: 0.5,
  synergy: 0.4,
  weight: 0.5,
  // Default for unknown
  _default: 0.5,
};

/**
 * Get importance for an attribute, falling back to default.
 */
export function getAttributeImportance(attrName: string): number {
  return ATTRIBUTE_IMPORTANCE[attrName.toLowerCase()] ?? ATTRIBUTE_IMPORTANCE._default;
}

/**
 * Compute normalized weights from importance scores.
 * Higher importance → higher weight (Bible 5.5.3).
 * Weights sum to 1.0 across all attributes.
 */
export function computeAttributeWeights(attrList: string[]): Record<string, number> {
  if (attrList.length === 0) return {};
  const importances = attrList.map((a) => ({ name: a, imp: getAttributeImportance(a) }));
  const totalImportance = importances.reduce((s, { imp }) => s + imp, 0);
  if (totalImportance === 0) {
    // Fallback to equal weights if all importances are 0
    const equal = 1 / attrList.length;
    return Object.fromEntries(attrList.map((a) => [a, Number(equal.toFixed(3))]));
  }
  return Object.fromEntries(
    importances.map(({ name, imp }) => [name, Number((imp / totalImportance).toFixed(3))])
  );
}
```

2. **Обновить `buildTransitiveResult`** в `route.ts:102-205`:
```ts
import { computeAttributeWeights } from "@/constants/balance";

function buildTransitiveResult(
  objects: BalanceObject[],
  balanceType: string,
  costCurveType: CostCurveType = DEFAULT_COST_CURVE,
  costCurveParams: CostCurveParams = {},
  // NEW: optional user-supplied attribute weights override
  customAttributeWeights?: Record<string, number>
) {
  // Attribute weights: from custom override OR computed from importance (Bible 5.5.3)
  const allAttrs = new Set<string>();
  for (const obj of objects) {
    for (const k of Object.keys(obj.attributes)) allAttrs.add(k);
  }
  const attrList = Array.from(allAttrs);
  const weights = customAttributeWeights && Object.keys(customAttributeWeights).length > 0
    ? customAttributeWeights
    : computeAttributeWeights(attrList);

  // ... rest unchanged ...
}
```

3. **Расширить `FullBalanceRequest`** в `src/types/balance.ts`:
```ts
export interface FullBalanceRequest {
  // ... existing ...
  attribute_weights?: Record<string, number>;  // optional override
}
```

4. **В route handler** — extract & validate:
```ts
const customAttributeWeights = body?.attribute_weights as Record<string, number> | undefined;
if (customAttributeWeights) {
  // Validate: all values must be positive numbers
  for (const [k, v] of Object.entries(customAttributeWeights)) {
    if (typeof v !== "number" || v < 0 || !Number.isFinite(v)) {
      return VALIDATION_ERROR(
        `attribute_weights.${k} должно быть положительным числом`
      );
    }
  }
}
// Pass to buildTransitiveResult
const transitiveResult = buildTransitiveResult(
  objects,
  balanceType,
  costCurveType,
  costCurveParams,
  customAttributeWeights
);
```

5. **Expose weights in response** — already in `transitiveResult.attribute_weights`, no change needed.

**Тест-кейсы**:
- Объекты с attrs `{damage, HP, speed, armor}` → веса `{damage: 0.30, HP: 0.27, armor: 0.24, speed: 0.21}` (not equal 0.25 each).
- Объекты с attrs `{power, range, speed}` (weapon) vs `{defense, mobility}` (armor) — `power` weight (0.4), `range` (0.28), `speed` (0.28) vs `defense` (0.57), `mobility` (0.43). Cross-type comparison less biased toward whichever has more attributes.
- Custom override `{damage: 0.5, HP: 0.5}` → weights exactly `{damage: 0.5, HP: 0.5}` (other attrs ignored).
- Empty `attrList` → `{}` (no division by zero).
- Unknown attribute `lumber` → importance 0.5 (default).

**Риски**:
- Importance values are subjective — different game designers may disagree. Митигация: expose as constants, allow user override via `attribute_weights` param, document rationale in comments.
- For genres outside combat (e.g., rhythm game with attrs `{beat_strength, tempo_match, combo_bonus}`), all attrs fall to `_default: 0.5` → equal weights. Митигация: extend `ATTRIBUTE_IMPORTANCE` for non-combat genres in follow-up TASK.

**Dependencies**: TASK-4.3 (передаёт `costCurveType` через ту же функцию).

---

### TASK-4.5: Реализовать real Nash equilibrium + убрать artificial cyclicalBias

**Сложность**: L
**Приоритет**: 🔴 (после TASK-4.4)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts` (`buildIntransitiveResult`), `src/types/balance.ts`

**Описание проблемы**:

`route.ts:242` (RC-4a):
```ts
const cyclicalBias = ((j - i + n) % n === 1 ? 0.4 : (i - j + n) % n === 1 ? -0.4 : 0);
```
Искусственно инжектирует RPS-структуру.

`route.ts:272-274` (RC-4b):
```ts
const nash: number[] = hasDominant
  ? names.map((name) => (dominatedStrategies.includes(name) ? 0 : 1 / (n - dominatedStrategies.length)))
  : names.map(() => 1 / n);
```
Не решает систему уравнений — всегда uniform.

`route.ts:307` (RC-4c):
```ts
if (payoffMatrix[i][j] > 0.1 && payoffMatrix[j][k] > 0.1 && payoffMatrix[k][i] > 0.1) {
  rpsCycles.push(...);
  break;  // ← only first cycle
}
```
Только один цикл, только sequential тройки.

**Решение**:

1. **Убрать `cyclicalBias`** — payoff matrix должна вычисляться из атрибутов:
```ts
function buildIntransitiveResult(objects: BalanceObject[], runIntransitive: boolean) {
  if (!runIntransitive || objects.length < 2) {
    return { /* same skip result */ };
  }

  const names = objects.map((o) => o.name);
  const n = objects.length;

  // Build payoff matrix from real attribute differences (NO artificial cyclicalBias)
  // Use multiple combat-relevant attributes to create natural asymmetry
  const powers = objects.map((o) => {
    const attrs = o.attributes;
    // Combat power = damage * speed / (1 + armor) — incentivizes specialization
    const dmg = attrs.damage ?? attrs.power ?? 0;
    const spd = attrs.speed ?? 5;
    const arm = attrs.armor ?? attrs.defense ?? 0;
    const hp = attrs.HP ?? attrs.hp ?? 100;
    // Effective DPS = damage * speed / 10
    // Survivability = HP * (1 + armor/20)
    // Power = DPS * Survivability / 100
    return (dmg * spd / 10) * (hp * (1 + arm / 20)) / 100;
  });

  // Payoff matrix: row player's payoff = power_diff (clamped)
  // Symmetric zero-sum: M[i][j] = -M[j][i]
  const payoffMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(0);
        continue;
      }
      // Normalized power difference
      const pi = powers[i];
      const pj = powers[j];
      const denom = Math.max(1, Math.abs(pi) + Math.abs(pj));
      const payoff = Number(((pi - pj) / denom).toFixed(2));
      row.push(payoff);
    }
    payoffMatrix.push(row);
  }

  // ... rest ...
}
```

2. **Реализовать real Nash equilibrium solver** (Bible 5.3.2: `c = M⁻¹ × p`):
```ts
/**
 * Solve symmetric zero-sum game for Nash equilibrium.
 * For symmetric game with payoff matrix M (row player's payoff),
 * the Nash equilibrium strategy c satisfies:
 *   M × c = 0  (all strategies give equal payoff = 0)
 *   Σc = 1
 *   c_i >= 0 for all i
 *
 * Approach: solve linear system M × c = 0 with Σc = 1 constraint.
 * For symmetric zero-sum, this reduces to finding the null space of M
 * with the normalization Σc = 1.
 *
 * Implementation: Gaussian elimination on (M | ones) augmented matrix.
 */
function solveNashEquilibrium(
  payoffMatrix: number[][],
  n: number
): number[] {
  if (n === 0) return [];
  if (n === 1) return [1];

  // For 2x2 symmetric zero-sum: Nash = [0.5, 0.5] unless one strategy dominates.
  // Check for dominated strategies first (iterative elimination).
  const eliminated = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (eliminated.has(i)) continue;
      for (let k = 0; k < n; k++) {
        if (i === k || eliminated.has(k)) continue;
        // Check if k strictly dominates i
        let dominates = true;
        let strictlyBetter = false;
        for (let j = 0; j < n; j++) {
          if (eliminated.has(j) || j === i) continue;
          if (payoffMatrix[k][j] < payoffMatrix[i][j]) {
            dominates = false;
            break;
          }
          if (payoffMatrix[k][j] > payoffMatrix[i][j]) {
            strictlyBetter = true;
          }
        }
        if (dominates && strictlyBetter) {
          eliminated.add(i);
          changed = true;
          break;
        }
      }
    }
  }

  const activeIndices = Array.from({ length: n }, (_, i) => i).filter((i) => !eliminated.has(i));
  const activeN = activeIndices.length;

  if (activeN === 0) return new Array(n).fill(0);
  if (activeN === 1) {
    const result = new Array(n).fill(0);
    result[activeIndices[0]] = 1;
    return result;
  }

  // For active submatrix, solve M' × c' = 0 with Σc' = 1
  // Use submatrix of payoffMatrix with active rows/cols only
  const subMatrix: number[][] = activeIndices.map((i) =>
    activeIndices.map((j) => payoffMatrix[i][j])
  );

  // Build augmented matrix: each row is [subMatrix[i][0], ..., subMatrix[i][activeN-1], 0]
  // plus one more row: [1, 1, ..., 1, 1] for Σc = 1
  // Total: (activeN + 1) equations, activeN unknowns.
  // For symmetric zero-sum, rank(M') = activeN - 1, so this is solvable.

  const aug: number[][] = subMatrix.map((row) => [...row, 0]);
  aug.push([...new Array(activeN).fill(1), 1]);

  // Gaussian elimination
  const m = aug.length;
  const cols = activeN + 1;
  let rank = 0;
  for (let col = 0; col < activeN && rank < m; col++) {
    // Find pivot
    let pivotRow = -1;
    let maxVal = 1e-9;
    for (let row = rank; row < m; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        pivotRow = row;
      }
    }
    if (pivotRow === -1) continue;
    // Swap
    [aug[rank], aug[pivotRow]] = [aug[pivotRow], aug[rank]];
    // Eliminate
    for (let row = 0; row < m; row++) {
      if (row === rank) continue;
      const factor = aug[row][col] / aug[rank][col];
      for (let c = col; c < cols; c++) {
        aug[row][c] -= factor * aug[rank][c];
      }
    }
    rank++;
  }

  // Back-substitute to find c'
  const subC = new Array(activeN).fill(1 / activeN); // fallback
  // Find the equation that has Σc = 1 (last row of aug)
  // After elimination, the last row should be [0, 0, ..., 1, value]
  // Find a row with a single 1 in some column and use it to solve
  for (let r = 0; r < m; r++) {
    const ones = aug[r].filter((v) => Math.abs(v - 1) < 1e-9).length;
    const zeros = aug[r].filter((v) => Math.abs(v) < 1e-9).length;
    if (ones === 1 && zeros === activeN - 1) {
      // This row is c[col] = aug[r][cols-1]
      const colIdx = aug[r].findIndex((v) => Math.abs(v - 1) < 1e-9);
      subC[colIdx] = aug[r][cols - 1];
    }
  }

  // Reconstruct full nash vector
  const nash = new Array(n).fill(0);
  activeIndices.forEach((idx, k) => {
    nash[idx] = Math.max(0, Number(subC[k].toFixed(4)));
  });

  // Normalize to ensure Σ = 1 (handles floating-point drift)
  const sum = nash.reduce((s, v) => s + v, 0);
  if (sum > 0) {
    for (let i = 0; i < n; i++) nash[i] = Number((nash[i] / sum).toFixed(4));
  }

  return nash;
}
```

3. **Использовать solver в `buildIntransitiveResult`** (заменить строки 272-274):
```ts
const nash = solveNashEquilibrium(payoffMatrix, n);

// Dominated strategies (for the warnings)
const dominatedStrategies: string[] = names.filter((_, i) => nash[i] === 0);
const hasDominant = dominatedStrategies.length > 0 && dominatedStrategies.length < n;
```

4. **Реализовать real RPS cycle detection** (Bible 5.3.2) — все `C(n,3)` тройки:
```ts
// RPS cycles: find ALL i → j → k → i cycles (not just sequential)
const rpsCycles: Array<{ cycle: string[]; strength: number }> = [];
if (n >= 3) {
  const threshold = 0.05; // Minimum payoff to count as "beats"
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        // Check 2 possible cycle orientations: i→j→k→i and i→k→j→i
        const cycle1 = payoffMatrix[i][j] > threshold
          && payoffMatrix[j][k] > threshold
          && payoffMatrix[k][i] > threshold;
        const cycle2 = payoffMatrix[i][k] > threshold
          && payoffMatrix[k][j] > threshold
          && payoffMatrix[j][i] > threshold;
        if (cycle1) {
          rpsCycles.push({
            cycle: [names[i], names[j], names[k]],
            strength: Number(
              ((payoffMatrix[i][j] + payoffMatrix[j][k] + payoffMatrix[k][i]) / 3).toFixed(2)
            ),
          });
        }
        if (cycle2) {
          rpsCycles.push({
            cycle: [names[i], names[k], names[j]],
            strength: Number(
              ((payoffMatrix[i][k] + payoffMatrix[k][j] + payoffMatrix[j][i]) / 3).toFixed(2)
            ),
          });
        }
      }
    }
  }
}
// Cap at top 10 cycles by strength to avoid huge output
rpsCycles.sort((a, b) => b.strength - a.strength);
const topCycles = rpsCycles.slice(0, 10);
```

5. **Обновить `is_intransitive`**:
```ts
const is_intransitive = topCycles.length > 0 || !hasDominant;
```

**Тест-кейсы**:
- 3 объекта с реальным RPS (Mage beats Tank, Tank beats Rogue, Rogue beats Mage) → `rps_cycles.length >= 1`, `is_intransitive = true`, Nash ≈ `[0.33, 0.33, 0.33]`.
- 4 объекта с доминантной стратегией (Object A превосходит все) → `hasDominant = true`, `dominated_strategies.length = 3`, Nash ≈ `[1, 0, 0, 0]`.
- 2 объекта (symmetric duel) → no RPS cycle (n < 3), Nash = `[0.5, 0.5]`.
- 5 объектов с RPS-Lizard-Spock structure → `rps_cycles.length >= 2`.
- Random homogeneous objects (similar attrs) → payoff matrix near zero, Nash = uniform `[0.2, 0.2, 0.2, 0.2, 0.2]`, `is_intransitive = false` (no clear cycle).

**Риски**:
- **Gaussian elimination numerical stability** — для ill-conditioned matrices. Митигация: partial pivoting (реализован), fallback to uniform if `sum === 0`.
- **Cycle explosion for large n** — `C(50, 3) = 19600` cycles. Митигация: cap at top 10 by strength.
- **Removing cyclicalBias breaks existing test expectations** — `is_intransitive` may become false for previously "intransitive" objects. Митигация: обновить тесты, документировать, что старое поведение было артефактом.

**Dependencies**: TASK-4.4 (атрибутные веса влияют на `powers` расчёт — опционально, но желательно).

---

### TASK-4.6: Сделать Monte Carlo deterministic + исправить winProb clamp

**Сложность**: M
**Приоритет**: 🔴 (после TASK-4.5)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts` (`buildMonteCarloResult`), `src/types/balance.ts`

**Описание проблемы**:

`route.ts:442-444, 452, 465` (RC-7a): `Math.random()` everywhere.
`route.ts:451` (RC-7b): `winProb = 0.5 + bias * 0.4` — unclamped.
`route.ts:417` (RC-7c): `iterations = 200` hardcoded.
`route.ts:502-516` (RC-7d): Kendall tau mislabeled as Spearman.
`route.ts:518-520` (RC-7e): arbitrary verdict thresholds.
`route.ts:484` (RC-7f): `totalGames` double-counted.

**Решение**:

1. **Добавить seeded PRNG** — mulberry32 (lightweight, fast, deterministic):
```ts
// Inline at top of route.ts (or extract to src/lib/prng.ts)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

2. **Расширить `FullBalanceRequest`**:
```ts
export interface FullBalanceRequest {
  // ... existing ...
  seed?: number | string;       // PRNG seed (number or string hash)
  monte_carlo_iterations?: number;  // Override default 200
}
```

3. **Обновить `buildMonteCarloResult`**:
```ts
function buildMonteCarloResult(
  objects: BalanceObject[],
  intransitiveResult: { payoff_matrix: number[][]; object_names: string[] },
  runMonteCarlo: boolean,
  seed: number,
  iterations: number
) {
  if (!runMonteCarlo || objects.length < 2) {
    return { /* same skip result, but with seed in config */ };
  }

  const n = objects.length;
  const names = objects.map((o) => o.name);
  const rand = mulberry32(seed);

  // ... initialize counters ...

  // Adaptive iterations: at least 50 matchups per pair (Bible 5.7 statistical power)
  const pairsCount = (n * (n - 1)) / 2;
  const minIterations = Math.max(iterations, pairsCount * 50);

  for (let iter = 0; iter < minIterations; iter++) {
    // Seeded random pair selection
    const i = Math.floor(rand() * n);
    let j = Math.floor(rand() * n);
    while (j === i) j = Math.floor(rand() * n);

    matchupGames[names[i]][names[j]]++;
    matchupGames[names[j]][names[i]]++;

    // Win probability for i vs j — CLAMPED to [0.05, 0.95]
    const bias = matrix.length > 0 ? (matrix[i]?.[j] || 0) : 0;
    const rawWinProb = 0.5 + bias * 0.4;
    const winProb = Math.max(0.05, Math.min(0.95, rawWinProb));
    const iWins = rand() < winProb;

    // ... rest same, but use rand() instead of Math.random() ...

    // Duration: 30-180 seconds, deterministic with seeded noise
    const iSpeed = objects[i].attributes.speed || 5;
    const jSpeed = objects[j].attributes.speed || 5;
    const baseDuration = 60 + (10 / Math.max(1, iSpeed + jSpeed)) * 50;
    const noise = (rand() - 0.5) * 20;
    const duration = Math.round(baseDuration + noise);
    durationSums[names[i]] += duration;
    durationSums[names[j]] += duration;
  }

  // ... aggregates ...

  // Fix totalGames double-counting (RC-7f)
  let totalGames = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      totalGames += matchupGames[names[i]][names[j]];
    }
  }

  // Real Spearman's rho (RC-7d)
  const powers = objects.map((o) =>
    Object.values(o.attributes).reduce((s, v) => s + v, 0)
  );
  const mcRankIndices = names
    .map((_, i) => i)
    .sort((a, b) => winRates[names[b]] - winRates[names[a]]);
  const powerRankIndices = names
    .map((_, i) => i)
    .sort((a, b) => powers[b] - powers[a]);

  // Compute rank arrays (rank by index in sorted order)
  const mcRank = new Array(n);
  const powerRank = new Array(n);
  mcRankIndices.forEach((origIdx, rankPos) => { mcRank[origIdx] = rankPos; });
  powerRankIndices.forEach((origIdx, rankPos) => { powerRank[origIdx] = rankPos; });

  // Spearman: ρ = 1 - (6 × Σd²) / (n × (n² - 1))
  let sumDSquared = 0;
  for (let i = 0; i < n; i++) {
    const d = mcRank[i] - powerRank[i];
    sumDSquared += d * d;
  }
  const rankingCorrelation = n > 1
    ? Number((1 - (6 * sumDSquared) / (n * (n * n - 1))).toFixed(3))
    : 0;

  // Verdict — Bible 5.12 inspired (not just win rate spread)
  // GOOD: spread < 15% AND ranking correlation > 0.7
  // MODERATE: spread 15-30% OR correlation 0.5-0.7
  // POOR: spread > 30% OR correlation < 0.5
  let verdict = "GOOD";
  if (winRateSpread > 30 || rankingCorrelation < 0.5) verdict = "POOR";
  else if (winRateSpread > 15 || rankingCorrelation < 0.7) verdict = "MODERATE";

  return {
    config: {
      iterations: minIterations,
      skipped: false,
      game_mode: "auto",
      seed: `mulberry32:${seed}`,
      prng: "mulberry32",
    },
    // ... rest
  };
}
```

4. **В route handler** — extract seed and iterations:
```ts
const rawSeed = body?.seed;
const seed = typeof rawSeed === "number"
  ? rawSeed >>> 0
  : typeof rawSeed === "string" && rawSeed.length > 0
    ? hashStringToSeed(rawSeed)
    : hashStringToSeed(`${proj.id}:${Date.now()}`);  // fallback: project-specific

const mcIterations = typeof body?.monte_carlo_iterations === "number"
  && body.monte_carlo_iterations > 0
  && body.monte_carlo_iterations <= 100000
    ? Math.floor(body.monte_carlo_iterations)
    : 200;
```

5. **Pass to `buildMonteCarloResult`**:
```ts
const monteCarloResult = buildMonteCarloResult(
  objects,
  intransitiveResult,
  runMonteCarlo,
  seed,
  mcIterations
);
```

**Тест-кейсы**:
- Two calls with `seed: 42` → identical `win_rates`, `matchup_matrix`, `balance_verdict` (deterministic).
- Two calls without `seed` → different results (fallback uses `Date.now()`).
- `seed: "my-project"` (string) → hashed to number, same result on every call.
- `winProb` never exceeds `[0.05, 0.95]` even with extreme bias values.
- 4 objects → `iterations >= max(200, 6 × 50) = 300` (adaptive).
- 10 objects → `iterations >= max(200, 45 × 50) = 2250`.
- `ranking_correlation` is now Spearman's rho ∈ `[-1, 1]` (was Kendall tau ∈ `[0, 1]`).
- `totalGames` is now correctly counted (no double-counting).

**Риски**:
- **Performance for large n** — `2250` iterations × `Math.imul` is fast (<10ms). OK.
- **Spearman vs Kendall** — downstream code (verdict thresholds) may need recalibration. Митигация: thresholds 0.5/0.7 work for both (similar interpretation).
- **Deterministic MC may surprise users** — same input → same output. Митигация: default seed is `project_id:timestamp` (varies per call), user can override.

**Dependencies**: TASK-4.5 (real payoff matrix without cyclicalBias — affects winProb computation).

---

### TASK-4.7: Починить Machinations graph — build from object types, not hardcoded HP/damage

**Сложность**: L
**Приоритет**: 🔴 (после TASK-4.6)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts` (`buildMachinationsResult`), `src/types/balance.ts`

**Описание проблемы**:

`route.ts:602-603` (RC-8a): hardcoded HP/damage nodes.
`route.ts:611-624` (RC-8b): hardcoded `damage → obj` and `obj → hp` flows.
`route.ts:632-645` (RC-8c): hardcoded feedback loops with nonexistent "rest" node.
`route.ts:662-663` (RC-8d): `o.attributes.HP` and `o.attributes.damage` hardcoded.
`route.ts:737` (RC-8e): `runs: 10` is a lie.
`route.ts:679-680` (RC-8f): arbitrary 1.8/0.2 thresholds.
`route.ts:697-699` (RC-8g): buildGap formula broken.
`route.ts:683-690` (RC-8h): decorative HP/damage curves.

**Решение**:

1. **Build Machinations graph from object types** — detect type and create appropriate nodes:
```ts
function buildMachinationsResult(
  objects: BalanceObject[],
  runMachinations: boolean,
  monteCarloResult: { balance_verdict: string },
  seed: number
) {
  if (!runMachinations) {
    return { /* same skip result, with feedback_loops at top level for buildStability */ };
  }

  // Detect dominant object type to determine graph structure
  const typeCounts: Record<string, number> = {};
  for (const o of objects) {
    const t = (o.type || "generic").toLowerCase();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "generic";

  // Build nodes: each object becomes a pool/source/drain based on type
  const nodes: MachinationsNode[] = objects.map((o) => {
    const attrs = o.attributes;
    // Detect primary resource value
    const primaryAttr = Object.keys(attrs)[0] || "value";
    const value = attrs[primaryAttr] ?? o.cost ?? 100;
    // Node type heuristic
    let nodeType: "pool" | "source" | "drain" | "converter" = "pool";
    if (dominantType.includes("weapon") || dominantType.includes("damage")) nodeType = "source";
    else if (dominantType.includes("armor") || dominantType.includes("defense")) nodeType = "pool";
    else if (dominantType.includes("consumable") || dominantType.includes("ammo")) nodeType = "drain";
    else if (dominantType.includes("converter") || dominantType.includes("transform")) nodeType = "converter";
    return {
      id: o.id,
      name: o.name,
      type: nodeType,
      value,
      capacity: value * 2,  // Allow 2x of initial value
    };
  });

  // Add anchor resource (fulcrum, Bible 5.5.2) — derived from dominant attribute
  const anchorAttr = Object.keys(objects[0]?.attributes || { power: 1 })[0] || "power";
  nodes.push({
    id: "anchor",
    name: anchorAttr,
    type: "pool",
    value: 100,
    capacity: 200,
  });

  // Build resource flows: each object exchanges with anchor based on its primary attribute
  const resourceFlows: ResourceFlow[] = [];
  for (const o of objects) {
    const attrs = o.attributes;
    const primaryAttr = Object.keys(attrs)[0];
    if (!primaryAttr) continue;
    const rate = attrs[primaryAttr] || 1;
    // Object produces/consumes from anchor
    resourceFlows.push({
      from: "anchor",
      to: o.id,
      rate,
      label: `${primaryAttr}_flow`,
    });
    // Object feeds back to anchor at reduced rate (decay)
    resourceFlows.push({
      from: o.id,
      to: "anchor",
      rate: Number((rate * 0.1).toFixed(2)),
      label: "decay",
    });
  }

  // State connections: each object's state modulates the anchor
  const stateConnections: StateConnection[] = objects.map((o) => ({
    from: o.id,
    to: "anchor",
    modifier: o.tier && o.tier > 1 ? "+" : "-",
  }));

  // Build feedback loops from object relationships (Bible 5.6.1 — 8 characteristics)
  const feedbackLoops: FeedbackLoop[] = [];

  // Loop 1: Object with highest "damage"-like attr → anchor → self (positive reinforcing)
  const sortedByPrimary = [...objects].sort((a, b) => {
    const aVal = Object.values(a.attributes)[0] || 0;
    const bVal = Object.values(b.attributes)[0] || 0;
    return bVal - aVal;
  });
  if (sortedByPrimary.length >= 1) {
    const top = sortedByPrimary[0];
    feedbackLoops.push({
      nodes: [top.id, "anchor", top.id],
      type: "positive",
      strength: 0.7,
      description: `${top.name} → ${anchorAttr} → ${top.name}: reinforcing accumulation (Bible 5.6.1)`,
      // Bible 5.6.1 — 8 characteristics
      characteristics: {
        effect: "constructive",
        investment: "low",
        return: "high",
        speed: "instant",
        duration: "permanent",
        indirectness: "direct",
        determinism: "deterministic",
      },
    });
  }

  // Loop 2: Negative balancing — anchor decay (Bible 5.6.1)
  feedbackLoops.push({
    nodes: ["anchor", "anchor"],
    type: "negative",
    strength: 0.5,
    description: `${anchorAttr} decay: balancing loop preventing runaway`,
    characteristics: {
      effect: "constructive",
      investment: "low",
      return: "low",
      speed: "delayed",
      duration: "permanent",
      indirectness: "direct",
      determinism: "deterministic",
    },
  });

  // Loop 3 (optional): if 3+ objects, create a cycle between them
  if (objects.length >= 3) {
    const [a, b, c] = objects.slice(0, 3);
    feedbackLoops.push({
      nodes: [a.id, b.id, c.id, a.id],
      type: "negative",
      strength: 0.4,
      description: `Cycle ${a.name} → ${b.name} → ${c.name} → ${a.name}: alternating dominance`,
      characteristics: {
        effect: "constructive",
        investment: "medium",
        return: "medium",
        speed: "delayed",
        duration: "permanent",
        indirectness: "mediated",
        determinism: "probabilistic",
      },
    });
  }

  const graph: MachinationsGraph = {
    nodes,
    resource_flows: resourceFlows,
    state_connections: stateConnections,
    feedback_loops: feedbackLoops,
  };

  // Run simulation: 50 ticks × N runs (Bible 5.6)
  const ticks = 50;
  const runs = 10;
  const rand = mulberry32(seed);

  const curves: Record<string, number[]> = {};
  const ranges: Record<string, { min: number; max: number }> = {};
  let runawayCount = 0;
  let stallCount = 0;

  // Aggregate across multiple runs
  for (const o of objects) {
    const attrs = o.attributes;
    const primaryAttr = Object.keys(attrs)[0] || "value";
    const initialValue = attrs[primaryAttr] ?? o.cost ?? 100;
    const damageAttr = attrs.damage ?? attrs.power ?? 0;
    const healAttr = attrs.healing ?? attrs.regen ?? 0;

    const seriesSum: number[] = new Array(ticks).fill(0);
    let runRMax = 0;
    let runRMin = Infinity;

    for (let run = 0; run < runs; run++) {
      let value = initialValue;
      const localSeries: number[] = [initialValue];
      let rMax = initialValue;
      let rMin = initialValue;

      for (let t = 1; t < ticks; t++) {
        // Generic model: value changes by damage (decay) + healing (regen) + noise
        const noise = (rand() - 0.5) * initialValue * 0.1;
        const decay = damageAttr * 0.05;
        const regen = healAttr * 0.05 + initialValue * 0.02;  // baseline 2% regen
        value = value - decay + regen + noise;
        value = Math.max(0, Math.min(initialValue * 2, value));
        localSeries.push(Number(value.toFixed(2)));
        rMax = Math.max(rMax, value);
        rMin = Math.min(rMin, value);
      }

      // Accumulate for averaging
      for (let t = 0; t < ticks; t++) {
        seriesSum[t] += localSeries[t];
      }
      runRMax = Math.max(runRMax, rMax);
      runRMin = Math.min(runRMin, rMin);

      // Bible 5.13.7: 3σ rule for runaway/stall detection
      // Compute mean and stddev across the series
      const mean = localSeries.reduce((s, v) => s + v, 0) / localSeries.length;
      const variance = localSeries.reduce((s, v) => s + (v - mean) ** 2, 0) / localSeries.length;
      const stddev = Math.sqrt(variance);
      // Runaway: max exceeds mean + 3σ
      if (rMax > mean + 3 * stddev + initialValue * 0.5) runawayCount++;
      // Stall: min below mean - 3σ
      if (rMin < mean - 3 * stddev - initialValue * 0.5) stallCount++;
    }

    // Average curve
    curves[o.name] = seriesSum.map((v) => Number((v / runs).toFixed(2)));
    ranges[o.name] = {
      min: Number(runRMin.toFixed(2)),
      max: Number(runRMax.toFixed(2)),
    };
  }

  // Anchor curve (aggregated)
  curves["anchor"] = Array.from({ length: ticks }, (_, t) =>
    Number((100 + Math.sin(t / 5) * 10).toFixed(2))
  );
  ranges["anchor"] = { min: 90, max: 110 };

  const totalRuns = objects.length * runs;
  const runawayFreq = runawayCount / Math.max(1, totalRuns);
  const stallFreq = stallCount / Math.max(1, totalRuns);
  const stability = Number(
    Math.max(0, 1 - (runawayFreq + stallFreq) / 2).toFixed(3)
  );
  // Build gap: difference between runaway and stall frequencies (Bible 5.13.5 inspired)
  // High gap = asymmetric instability (one pathology dominates)
  const buildGap = Number(Math.abs(runawayFreq - stallFreq).toFixed(3));

  // ... rest (pathologies, recommendations, quality) ...

  return {
    graph,
    runs,  // ← now actually 10
    aggregated: {
      avg_resource_curves: curves,
      resource_ranges: ranges,
      runaway_frequency: Number(runawayFreq.toFixed(3)),
      stall_frequency: Number(stallFreq.toFixed(3)),
      stability_index: stability,
      build_gap: buildGap,
    },
    quality,
    detected_pathologies: detectedPathologies,
    recommendations,
    feedback_loops: feedbackLoops,  // ← ALSO expose at top level (fixes RC-9)
  };
}
```

2. **Расширить `FeedbackLoop` type** в `src/types/balance.ts`:
```ts
export interface FeedbackLoopCharacteristics {
  effect?: "constructive" | "destructive";
  investment?: "low" | "medium" | "high";
  return?: "low" | "medium" | "high";
  speed?: "instant" | "delayed";
  duration?: "one-shot" | "permanent";
  indirectness?: "direct" | "mediated";
  determinism?: "deterministic" | "probabilistic";
}

export interface FeedbackLoop {
  nodes: string[];
  type: string;
  strength?: number;
  description?: string;
  characteristics?: FeedbackLoopCharacteristics;  // NEW: Bible 5.6.1 8-dim profile
}
```

3. **Также вернуть `feedback_loops` на верхнем уровне для `buildStability`** — уже добавлено выше.

**Тест-кейсы**:
- 4 weapons (`damage, range, speed`) → nodes: 4 weapon nodes + "anchor" (key="damage"). resource_flows: 8 flows (4 in, 4 out decay). feedback_loops: 3 (reinforcing top weapon, anchor decay, cycle).
- 4 collectibles (`value, rarity, combo_potential`) → anchor = "value". Same structure.
- `runs: 10` в response = actual 10 runs × 50 ticks per object.
- Runaway detection via 3σ rule, not arbitrary 1.8× threshold.
- `feedback_loops` accessible at BOTH `machinationsResult.graph.feedback_loops` AND `machinationsResult.feedback_loops` (top level).
- 2 objects → no cycle loop (need 3+ for cycle).

**Риски**:
- **Type detection heuristic** may misclassify. Митигация: log warnings, allow user override via `machinations_graph_template` param in future.
- **10 runs × 50 ticks × N objects** for N=50: 25000 iterations — fast (<100ms).
- **3σ rule may be too strict** for short series (50 points). Митигация: add `initialValue * 0.5` buffer, document.

**Dependencies**: TASK-4.6 (seeded PRNG `mulberry32`).

---

### TASK-4.8: Починить `buildStability` — убрать `as unknown as`, правильно читать `feedback_loops`

**Сложность**: S
**Приоритет**: 🔴 (после TASK-4.7)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts` (`buildStability`, route handler)

**Описание проблемы**:

`route.ts:897-905` (RC-9a):
```ts
const stability = buildStability(
  machinationsResult as unknown as {
    aggregated: { ... };
    quality: { critical_issues: string[] };
    detected_pathologies: string[];
    feedback_loops: Array<{ type: string }>;  // ← BUG
  },
  transitiveResult
);
```

`feedback_loops` находится в `machinationsResult.graph.feedback_loops`, не на верхнем уровне. Type cast маскирует баг.

`route.ts:763-764` (RC-9b):
```ts
const feedbackLoops = machinationsResult.feedback_loops || [];
```
Всегда `[]` → `positiveLoops = 0, negativeLoops = 0`.

**Решение**:

1. **Обновить сигнатуру `buildStability`**:
```ts
function buildStability(
  machinationsResult: MachinationsResult,  // ← use proper type, no cast
  transitiveResult: { overpowered: string[]; underpowered: string[] }
) {
  // Read feedback_loops from BOTH top-level (TASK-4.7) AND graph (fallback)
  const feedbackLoops = machinationsResult.feedback_loops
    ?? machinationsResult.graph?.feedback_loops
    ?? [];
  const positiveLoops = feedbackLoops.filter((l) => l.type === "positive").length;
  const negativeLoops = feedbackLoops.filter((l) => l.type === "negative").length;

  // ... rest unchanged ...
}
```

2. **В route handler** — убрать type cast:
```ts
const stability = buildStability(
  machinationsResult,  // ← no cast
  transitiveResult
);
```

3. **Импортировать `MachinationsResult` type** (если ещё не импортирован):
```ts
import type { MachinationsResult } from "@/types/balance";
```

4. **Убедиться, что `buildMachinationsResult` возвращает `feedback_loops` на верхнем уровне** (TASK-4.7 уже добавил это):
```ts
return {
  graph,
  runs,
  aggregated: { ... },
  quality,
  detected_pathologies: detectedPathologies,
  recommendations,
  feedback_loops: feedbackLoops,  // ← top-level access for buildStability
};
```

**Тест-кейсы**:
- `runMachinations=true` with 4 objects → `positiveLoops = 1` (reinforcing), `negativeLoops = 2` (decay + cycle). `analysis` строка содержит "1 reinforcing and 2 balancing loops".
- `runMachinations=false` → `feedbackLoops = []`, `positiveLoops = 0`, `negativeLoops = 0`. `analysis` корректно показывает "0 reinforcing and 0 balancing loops".
- Type-check: `tsc --noUnusedLocals` не выдаёт warnings для route.ts.

**Риски**:
- None — straightforward fix after TASK-4.7.

**Dependencies**: TASK-4.7 (который добавляет `feedback_loops` на верхний уровень).

---

### TASK-4.9: Реализовать 8 balance pathologies (Bible 5.13)

**Сложность**: XL
**Приоритет**: 🔴 (после TASK-4.8)
**Файлы**: `src/lib/balance-pathologies.ts` (новый), `src/app/api/v1/balance/analyze/route.ts`

**Описание проблемы**:

Bible 5.13 описывает 8 патологий баланса (RC-17). Реализация детектирует только 2 (Runaway, Stall).

**Решение**:

1. **Создать `src/lib/balance-pathologies.ts`** — каталог патологий:
```ts
import type { BalanceObject, TransitiveResult, IntransitiveResult, MonteCarloResult, MachinationsResult } from "@/types/balance";

export type PathologySeverity = "critical" | "warning" | "info";

export interface BalancePathology {
  id: string;
  name: string;
  bible_ref: string;  // e.g., "5.13.1"
  severity: PathologySeverity;
  detected: boolean;
  description: string;
  treatment: string;
  affected_objects?: string[];
  metric_value?: number | string;
}

export interface PathologyContext {
  objects: BalanceObject[];
  transitive: TransitiveResult;
  intransitive: IntransitiveResult;
  monteCarlo: MonteCarloResult;
  machinations: MachinationsResult;
  balanceType: string;
}

// ============================================================
// 8 pathologies (Bible 5.13)
// ============================================================

/** 5.13.1 Доминантная стратегия */
function detectDominantStrategy(ctx: PathologyContext): BalancePathology {
  const { intransitive, monteCarlo } = ctx;
  const maxShare = intransitive.strategy_balance.max_share;
  const dominatedCount = intransitive.dominated_strategies.length;
  const detected = maxShare > 0.5 || dominatedCount > 0;
  // Bible 5.13.1: "Частота выбора одной стратегии > 50%"
  const topStrategy = intransitive.object_names[
    intransitive.nash_equilibrium.indexOf(Math.max(...intransitive.nash_equilibrium))
  ];
  return {
    id: "dominant_strategy",
    name: "Доминантная стратегия",
    bible_ref: "5.13.1",
    severity: "critical",
    detected,
    description: detected
      ? `Стратегия "${topStrategy}" имеет долю ${(maxShare * 100).toFixed(0)}% в равновесии Нэша. Доминируемых стратегий: ${dominatedCount}.`
      : "Доминантной стратегии не обнаружено.",
    treatment: detected
      ? "Ввести нетранзитивные отношения (КНБ-структуру), повысить стоимость доминанта, добавить контр-стратегии."
      : "—",
    affected_objects: intransitive.dominated_strategies,
    metric_value: `max_share=${maxShare.toFixed(3)}, dominated=${dominatedCount}`,
  };
}

/** 5.13.2 Runaway (саморазгон) */
function detectRunaway(ctx: PathologyContext): BalancePathology {
  const { machinations } = ctx;
  const freq = machinations.aggregated.runaway_frequency;
  const detected = freq > 0.3;
  return {
    id: "runaway",
    name: "Runaway (саморазгон)",
    bible_ref: "5.13.2",
    severity: "critical",
    detected,
    description: detected
      ? `Частота runaway составляет ${(freq * 100).toFixed(0)}% (порог 30%). Усиливающая петля без балансирующей.`
      : `Частота runaway ${(freq * 100).toFixed(0)}% в норме.`,
    treatment: detected
      ? "Добавить Dynamic Friction, Stopping Mechanism, или отрицательную ОС (резиновая лента)."
      : "—",
    metric_value: freq,
  };
}

/** 5.13.3 Мёртвая зона */
function detectDeadZone(ctx: PathologyContext): BalancePathology {
  const { objects, monteCarlo } = ctx;
  // Detect objects with win rate < 10% (Bible 5.13.3: "частота использования ≈ 0%")
  const deadObjects = objects
    .filter((o) => (monteCarlo.win_rates[o.name] ?? 0) < 0.1)
    .map((o) => o.name);
  const detected = deadObjects.length > 0;
  return {
    id: "dead_zone",
    name: "Мёртвая зона",
    bible_ref: "5.13.3",
    severity: "warning",
    detected,
    description: detected
      ? `Объекты с win rate < 10%: ${deadObjects.join(", ")}. Эти опции никогда не выбираются.`
      : "Все объекты имеют win rate ≥ 10%.",
    treatment: detected
      ? "Усилить опцию (повысить сырые значения), снизить стоимость, добавить уникальную ситуационную ценность."
      : "—",
    affected_objects: deadObjects,
  };
}

/** 5.13.4 Обязательный выбор (божественный параметр) */
function detectMandatoryChoice(ctx: PathologyContext): BalancePathology {
  const { objects, monteCarlo } = ctx;
  // Detect attribute present in ALL top-tier objects with win rate > 60%
  // (Bible 5.13.4: "100% оптимальных билдов включают элемент")
  const topObjects = objects.filter((o) => (monteCarlo.win_rates[o.name] ?? 0) > 0.6);
  if (topObjects.length < 2) {
    return {
      id: "mandatory_choice",
      name: "Обязательный выбор (божественный параметр)",
      bible_ref: "5.13.4",
      severity: "warning",
      detected: false,
      description: "Недостаточно топ-объектов для анализа (нужно ≥2 с win rate > 60%).",
      treatment: "—",
    };
  }
  // Find attributes common to all top objects
  const topAttrSets = topObjects.map((o) => new Set(Object.keys(o.attributes)));
  const commonAttrs = [...topAttrSets[0]].filter((attr) =>
    topAttrSets.every((s) => s.has(attr))
  );
  // Check if any common attribute has consistently high values (above 70th percentile)
  const mandatoryAttrs = commonAttrs.filter((attr) => {
    const values = topObjects.map((o) => o.attributes[attr] ?? 0);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const allObjectsAvg = objects
      .map((o) => o.attributes[attr] ?? 0)
      .reduce((s, v) => s + v, 0) / objects.length;
    return avg > allObjectsAvg * 1.5;  // Top objects have 50%+ more of this attr
  });
  const detected = mandatoryAttrs.length > 0;
  return {
    id: "mandatory_choice",
    name: "Обязательный выбор (божественный параметр)",
    bible_ref: "5.13.4",
    severity: "warning",
    detected,
    description: detected
      ? `Атрибуты-кандидаты на "божественный параметр": ${mandatoryAttrs.join(", ")}. Присутствуют во всех топ-объектах с аномально высокими значениями.`
      : "Обязательных атрибутов не обнаружено.",
    treatment: detected
      ? "Усилить альтернативы, добавить затраты на обязательный элемент, ввести нетранзитивность."
      : "—",
    affected_objects: mandatoryAttrs,
  };
}

/** 5.13.5 Разрыв билдов */
function detectBuildGap(ctx: PathologyContext): BalancePathology {
  const { machinations } = ctx;
  const gap = machinations.aggregated.build_gap;
  const detected = gap > 0.25;
  return {
    id: "build_gap",
    name: "Разрыв билдов",
    bible_ref: "5.13.5",
    severity: "warning",
    detected,
    description: detected
      ? `Разрыв между runaway и stall частотами: ${gap.toFixed(3)} (порог 0.25). Дисбаланс растёт с уровнем.`
      : `Разрыв билдов ${gap.toFixed(3)} в норме.`,
    treatment: detected
      ? "Добавить пересечения кривых мощности, ввести затухающие доходы для доминантного пути."
      : "—",
    metric_value: gap,
  };
}

/** 5.13.6 Инфляция / стагнация экономики */
function detectEconomyPathology(ctx: PathologyContext): BalancePathology {
  const { machinations } = ctx;
  const stallFreq = machinations.aggregated.stall_frequency;
  // Heuristic: if stall > 30%, economy is stagnant (currency accumulates without spending)
  // If runaway > 30% AND no stalls, economy may be inflating (currency devalues)
  const runawayFreq = machinations.aggregated.runaway_frequency;
  let pathologyType: "inflation" | "stagnation" | "none" = "none";
  if (stallFreq > 0.3) pathologyType = "stagnation";
  else if (runawayFreq > 0.3 && stallFreq < 0.1) pathologyType = "inflation";
  const detected = pathologyType !== "none";
  return {
    id: "economy_pathology",
    name: `Инфляция / стагнация экономики (${pathologyType})`,
    bible_ref: "5.13.6",
    severity: "warning",
    detected,
    description: detected
      ? pathologyType === "inflation"
        ? "Валюта обесценивается от перепроизводства (runaway без stall)."
        : "Валюта накапливается без возможностей траты (stall без runaway)."
      : "Экономика сбалансирована.",
    treatment: detected
      ? pathologyType === "inflation"
        ? "Добавить стоки (sinks), экономические ресеты (сезонные обнуления)."
        : "Добавить значимые стоки (улучшения, косметика, доступ к контенту)."
      : "—",
    metric_value: `${pathologyType} (runaway=${runawayFreq.toFixed(2)}, stall=${stallFreq.toFixed(2)})`,
  };
}

/** 5.13.7 Хрупкость экологии */
function detectEcologyFragility(ctx: PathologyContext): BalancePathology {
  const { machinations } = ctx;
  // 3σ rule already applied in TASK-4.7 for runaway/stall detection
  // Here: check if stability_index is borderline (close to threshold)
  const stability = machinations.aggregated.stability_index;
  // Fragility: stability in [0.4, 0.6] — looks stable but small perturbation can break it
  const detected = stability > 0.4 && stability < 0.6;
  return {
    id: "ecology_fragility",
    name: "Хрупкость экологии",
    bible_ref: "5.13.7",
    severity: "info",
    detected,
    description: detected
      ? `Stability index ${stability.toFixed(3)} в пограничной зоне [0.4, 0.6]. Система выглядит устойчивой, но малое возмущение может вызвать каскадный коллапс.`
      : `Stability index ${stability.toFixed(3)} — вне пограничной зоны.`,
    treatment: detected
      ? "Добавить резервные механизмы, диверсифицировать источники ресурсов, ввести отрицательные ОС с разными временными масштабами."
      : "—",
    metric_value: stability,
  };
}

/** 5.13.8 Воспринимаемая несправедливость */
function detectPerceivedUnfairness(ctx: PathologyContext): BalancePathology {
  const { monteCarlo, objects } = ctx;
  // Heuristic: if win rate spread is high but no clear dominant strategy,
  // players may perceive unfairness (Bible 5.13.8: "Математика правильна, но игроки жалуются")
  const spread = monteCarlo.win_rate_spread;
  const maxShare = ctx.intransitive.strategy_balance.max_share;
  const detected = spread > 20 && maxShare < 0.5;
  return {
    id: "perceived_unfairness",
    name: "Воспринимаемая несправедливость",
    bible_ref: "5.13.8",
    severity: "info",
    detected,
    description: detected
      ? `Win rate spread ${spread.toFixed(1)}% при max_share ${(maxShare * 100).toFixed(0)}%. Игроки могут воспринимать игру как нечестную из-за когнитивных искажений.`
      : "Признаков воспринимаемой несправедливости не обнаружено.",
    treatment: detected
      ? "Использовать скрытую случайность (резиновая лента), pity timer, прозрачность вероятностей, иллюзия возможной победы."
      : "—",
    metric_value: `spread=${spread.toFixed(1)}%, max_share=${maxShare.toFixed(3)}`,
  };
}

/** Detect all 8 pathologies (Bible 5.13). */
export function detectAllPathologies(ctx: PathologyContext): BalancePathology[] {
  return [
    detectDominantStrategy(ctx),
    detectRunaway(ctx),
    detectDeadZone(ctx),
    detectMandatoryChoice(ctx),
    detectBuildGap(ctx),
    detectEconomyPathology(ctx),
    detectEcologyFragility(ctx),
    detectPerceivedUnfairness(ctx),
  ];
}

/** Get only detected pathologies (filtered). */
export function getDetectedPathologies(ctx: PathologyContext): BalancePathology[] {
  return detectAllPathologies(ctx).filter((p) => p.detected);
}
```

2. **Интегрировать в route handler** (заменить простой `detectedPathologies`):
```ts
import { detectAllPathologies, getDetectedPathologies, type BalancePathology } from "@/lib/balance-pathologies";

// ... after computing transitiveResult, intransitiveResult, monteCarloResult, machinationsResult, stability ...

const pathologyContext: PathologyContext = {
  objects,
  transitive: transitiveResult,
  intransitive: intransitiveResult,
  monteCarlo: monteCarloResult,
  machinations: machinationsResult,
  balanceType,
};
const allPathologies = detectAllPathologies(pathologyContext);
const detectedPathologies = getDetectedPathologies(pathologyContext);
```

3. **Расширить response** — добавить `pathologies_catalog`:
```ts
const result: Record<string, unknown> = {
  // ... existing fields ...
  pathologies_catalog: allPathologies,  // NEW: all 8 with detected flag
  detected_pathologies: detectedPathologies.map((p) => p.name),  // list of names
};
```

4. **Расширить `MachinationsResult` type** в `src/types/balance.ts`:
```ts
export interface MachinationsResult {
  // ... existing ...
  feedback_loops?: FeedbackLoop[];  // top-level access (TASK-4.7)
}

// Add to FullBalanceResponse
export interface FullBalanceResponse {
  // ... existing ...
  pathologies_catalog?: BalancePathology[];  // NEW
}
```

5. **Persist в БД** — расширить `pathologies` JSON column (route.ts:979-984):
```ts
const pathologies = JSON.stringify({
  transitive_overpowered: transitiveResult.overpowered,
  transitive_underpowered: transitiveResult.underpowered,
  machinations_pathologies: machinationsResult.detected_pathologies,
  stability_pathology_risks: stability.pathology_risks,
  // NEW: full catalog
  pathologies_catalog: allPathologies,
  detected_pathologies: detectedPathologies.map((p) => p.id),
});
```

**Тест-кейсы**:
- 4 balanced objects (equal attrs) → `detectedPathologies.length === 0` (no pathologies).
- 1 object with 5× higher `damage` → `dominant_strategy` detected (max_share > 0.5 in Nash).
- Object with win_rate < 10% → `dead_zone` detected.
- `runaway_frequency > 0.3` → `runaway` detected (critical).
- `build_gap > 0.25` → `build_gap` detected (warning).
- `stability_index ∈ [0.4, 0.6]` → `ecology_fragility` detected (info).
- `win_rate_spread > 20 && max_share < 0.5` → `perceived_unfairness` detected (info).
- All 10 test_projects receive different pathology sets based on their balance data.

**Риски**:
- **Heuristics may be inaccurate** — e.g., `mandatory_choice` requires ≥2 top objects with win rate > 60%, which may not exist in balanced sets. Митигация: return `detected: false` with explanatory message.
- **`BalancePathology` type extension** may break existing API consumers (new field `pathologies_catalog`). Митигация: optional field, backward compatible.
- **Performance**: 8 detectors × O(n²) operations — fast for n ≤ 100.

**Dependencies**: TASK-4.5 (real Nash for `max_share`), TASK-4.6 (real Monte Carlo for `win_rates`), TASK-4.7 (real Machinations for `runaway_frequency`, `stall_frequency`), TASK-4.8 (`feedback_loops` accessible).

---

### TASK-4.10: Persist `ai_insights` в БД — вызывать `enrichBalance` ДО persist

**Сложность**: M
**Приоритет**: 🔴 (после TASK-4.9)
**Файлы**: `prisma/schema.prisma` (модель `ProjectBalanceResult`), `src/app/api/v1/balance/analyze/route.ts`, `src/app/api/v1/balance/[projectId]/route.ts`

**Описание проблемы**:

`route.ts:1000-1056` (RC-10): AI enrichment вызывается **после** `db.projectBalanceResult.upsert`. `ai_insights` попадает в HTTP response, но **не в БД**. На перезагрузку теряется.

**Решение**:

1. **Добавить колонку `aiInsights` в schema** (`prisma/schema.prisma`, модель `ProjectBalanceResult`):
```prisma
model ProjectBalanceResult {
  id                 String   @id @default(cuid())
  projectId          String   @unique
  balanceType        String?
  overallBalanceScore Float?
  imbalanceCount     Int?
  elementCount       Int?
  inputData          String?
  elements           String?
  costPowerCurves    String?
  intransitiveMatrix String?
  nashEquilibrium    String?
  monteCarloResults  String?
  machinationsResults String?
  pathologies        String?
  corrections        String?
  situationalValues  String?
  aiInsights         String?   // NEW: AI enrichment text (nullable)
  fullResult         String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([balanceType])
  @@map("project_balance_results")
}
```

2. **Применить миграцию**:
```bash
bunx prisma migrate dev --name add_balance_ai_insights
```

3. **В route handler** — вызывать `enrichBalance` ДО persist:
```ts
// --- Optional AI enrichment (BEFORE persist) ---
let aiInsights: string | null = null;
if (useAi) {
  aiInsights = await enrichBalance({
    projectName: proj.name || "Untitled",
    genre,
    balanceType,
    elementCount: objects.length,
    // NEW: include specific data for better AI recommendations (TASK-4.11)
    objects: objects.map((o) => ({ name: o.name, type: o.type, attributes: o.attributes })),
    overpowered: transitiveResult.overpowered,
    underpowered: transitiveResult.underpowered,
    verdict: monteCarloResult.balance_verdict,
    detected_pathologies: detectedPathologies.map((p) => p.name),
  });
  if (aiInsights) {
    result.ai_insights = aiInsights;
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}

// --- Persist (with aiInsights) ---
const fullResult = JSON.stringify(result);

await db.projectBalanceResult.upsert({
  where: { projectId: proj.id },
  create: {
    projectId: proj.id,
    balanceType: balanceType,
    overallBalanceScore,
    imbalanceCount,
    elementCount: objects.length,
    inputData,
    elements: elementsData,
    costPowerCurves,
    intransitiveMatrix,
    nashEquilibrium,
    monteCarloResults,
    machinationsResults,
    pathologies,
    corrections,
    situationalValues,
    aiInsights,  // NEW: persist AI text
    fullResult,
  },
  update: {
    // ... same fields ...
    aiInsights,  // NEW
    fullResult,
  },
});

await updateProjectStage(proj.id, "balance");

return NextResponse.json(result);
```

4. **Обновить GET endpoint** (`balance/[projectId]/route.ts:26-45`):
```ts
return NextResponse.json({
  // ... existing fields ...
  ai_insights: b.aiInsights || null,  // NEW: expose persisted AI text
  // ... rest ...
});
```

**Тест-кейсы**:
- POST `/balance/analyze` with `use_ai: true` → response contains `ai_insights`. DB row has `aiInsights` column populated.
- GET `/balance/[projectId]` after POST → returns same `ai_insights` value (persisted).
- POST with `use_ai: false` → `ai_insights: null` in response, DB column NULL.
- Reload page → `ai_insights` preserved.

**Риски**:
- **Prisma migration** requires DB write — ensure `bunx prisma migrate dev` runs in dev. In production, `bunx prisma migrate deploy`.
- **`enrichBalance` may fail** (network, AI service down). Митигация: try/catch in `enrichBalance` already returns `null` on error — `aiInsights` column stays NULL, route continues.
- **Latency increase** — AI call adds 2-5 seconds before persist. User sees response only after DB write. Митигация: acceptable for AI-enrichment flows; for fast re-runs, set `use_ai: false`.

**Dependencies**: TASK-4.11 (расширенный prompt для `enrichBalance`).

---

### TASK-4.11: Расширить `enrichBalance` prompt — include specific balance data

**Сложность**: S
**Приоритет**: 🟡 (после TASK-4.10)
**Файлы**: `src/lib/ai-service.ts` (функция `enrichBalance`, интерфейс `BalanceAiInput`)

**Описание проблемы**:

`ai-service.ts:589-627` (RC-15): prompt содержит только generic данные (projectName, genre, balanceType, elementCount). AI даёт общие советы.

**Решение**:

1. **Расширить `BalanceAiInput`**:
```ts
export interface BalanceAiInput {
  projectName: string;
  genre: string;
  balanceType: string;
  elementCount: number;
  // NEW: specific balance data
  objects?: Array<{ name: string; type: string; attributes: Record<string, number> }>;
  overpowered?: string[];
  underpowered?: string[];
  verdict?: string;
  detected_pathologies?: string[];
}
```

2. **Обновить prompt** в `enrichBalance`:
```ts
export async function enrichBalance(ctx: BalanceAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const objectsLine = ctx.objects && ctx.objects.length > 0
      ? ctx.objects.slice(0, 10).map((o) =>
          `- ${o.name} (${o.type}): ${JSON.stringify(o.attributes)}`
        ).join("\n")
      : "—";
    const opLine = ctx.overpowered && ctx.overpowered.length > 0
      ? ctx.overpowered.join(", ")
      : "—";
    const upLine = ctx.underpowered && ctx.underpowered.length > 0
      ? ctx.underpowered.join(", ")
      : "—";
    const pathologiesLine = ctx.detected_pathologies && ctx.detected_pathologies.length > 0
      ? ctx.detected_pathologies.join(", ")
      : "—";

    const prompt = `Ты — эксперт по балансу игр. Дай конкретные рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип баланса: ${ctx.balanceType}
Количество элементов: ${ctx.elementCount}

Объекты:
${objectsLine}

Overpowered: ${opLine}
Underpowered: ${upLine}
Monte Carlo вердикт: ${ctx.verdict || "—"}
Обнаруженные патологии: ${pathologiesLine}

Дай 3-5 конкретных рекомендаций (на русском):
1. Какие конкретно объекты нуждаются в ребалансировке и какие числа изменить
2. Какие патологии приоритетны для лечения и почему
3. Какие Monte-Carlo параметры рекомендуются (итерации, критерии победы) с учётом текущих данных
4. Какие Bible 5.13 патологии могут быть не обнаружены, но вероятны
5. Стратегия патчинга: какие изменения делать первыми (правило Сида Мейера: удвой/раздели пополам)

Ответ — обычный текст с нумерованными пунктами. Будь конкретен: цитируй имена объектов и числовые значения.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по балансу игр. Отвечай конкретно, опираясь на предоставленные данные." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichBalance failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
```

3. **Передавать расширенный контекст из route handler** (TASK-4.10 уже добавил эту сигнатуру):
```ts
aiInsights = await enrichBalance({
  projectName: proj.name || "Untitled",
  genre,
  balanceType,
  elementCount: objects.length,
  objects: objects.map((o) => ({ name: o.name, type: o.type, attributes: o.attributes })),
  overpowered: transitiveResult.overpowered,
  underpowered: transitiveResult.underpowered,
  verdict: monteCarloResult.balance_verdict,
  detected_pathologies: detectedPathologies.map((p) => p.name),
});
```

**Тест-кейсы**:
- AI response содержит конкретные имена объектов (e.g., "Увеличьте стоимость Warrior с 100 до 200").
- AI response ссылается на detected pathologies (e.g., "Для лечения Runaway добавьте sink...").
- AI response рекомендует конкретные Monte Carlo итерации (e.g., "Увеличьте до 1000 для статистической значимости").
- Без `use_ai` → `ai_insights: null`.
- AI service down → `ai_insights: null` (no crash).

**Риски**:
- **Prompt length** — для 50 объектов prompt может превысить token limit. Митигация: `slice(0, 10)` для объектов, summarize остальных.
- **AI hallucination** — модель может предлагать несуществующие объекты. Митигация: prompt явно цитирует предоставленные данные.

**Dependencies**: TASK-4.10 (persist `ai_insights`).

---

### TASK-4.12: Унифицировать DB persistence и GET endpoint — все поля + правильные fallback типы

**Сложность**: M
**Приоритет**: 🟡 (после TASK-4.10)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts` (persist block), `src/app/api/v1/balance/[projectId]/route.ts`

**Описание проблемы**:

`route.ts:967-992` (RC-11): многие поля теряются (только в `fullResult`). GET endpoint возвращает несогласованные fallback типы (`[]` для объектов).

**Решение**:

1. **Расширить persist block** — добавить недостающие колонки или переименовать существующие:
```ts
// Option A: Add new columns (cleaner)
// Option B: Use existing columns more consistently

// Recommended: extend existing columns to include all data
const elementsData = JSON.stringify(objects);
const costPowerCurves = JSON.stringify({
  curve_type: costCurveType,
  curve_model: transitiveResult.cost_curve_model,
  expected_cp: transitiveResult.expected_cp,
  attribute_weights: transitiveResult.attribute_weights,
  objects: transitiveResult.objects,
  overpowered: transitiveResult.overpowered,
  underpowered: transitiveResult.underpowered,
  balanced: transitiveResult.balanced,
  ideal_imbalance: transitiveResult.ideal_imbalance,
  warnings: transitiveResult.warnings,
  suggestions: transitiveResult.suggestions,
});  // was: JSON.stringify(transitiveResult.objects) — incomplete

const intransitiveMatrix = JSON.stringify({
  matrix: intransitiveResult.payoff_matrix,
  names: intransitiveResult.object_names,
  // NEW: include full intransitive result
  nash_equilibrium: intransitiveResult.nash_equilibrium,
  is_intransitive: intransitiveResult.is_intransitive,
  dominated_strategies: intransitiveResult.dominated_strategies,
  strategy_balance: intransitiveResult.strategy_balance,
  rps_cycles: intransitiveResult.rps_cycles,
  has_dominant_strategy: intransitiveResult.has_dominant_strategy,
  warnings: intransitiveResult.warnings,
  suggestions: intransitiveResult.suggestions,
});

// Remove separate nashEquilibrium column (now in intransitiveMatrix)
// OR: keep for backward compat, but make it a subset
const nashEquilibrium = JSON.stringify({
  equilibrium: intransitiveResult.nash_equilibrium,
  strategy_balance: intransitiveResult.strategy_balance,
});

const monteCarloResults = JSON.stringify(monteCarloResult);  // already full
const machinationsResults = JSON.stringify(machinationsResult);  // already full

const pathologies = JSON.stringify({
  transitive_overpowered: transitiveResult.overpowered,
  transitive_underpowered: transitiveResult.underpowered,
  machinations_pathologies: machinationsResult.detected_pathologies,
  stability_pathology_risks: stability.pathology_risks,
  pathologies_catalog: allPathologies,  // NEW: full catalog (TASK-4.9)
  detected_pathologies: detectedPathologies.map((p) => p.id),
});

const corrections = JSON.stringify({
  transitive: transitiveResult.suggestions,
  intransitive: intransitiveResult.suggestions,
  monte_carlo: monteCarloResult.suggestions,
  machinations: machinationsResult.recommendations,
  stability: stability.recommendations,  // NEW
});

const situationalValues = JSON.stringify({
  situational: situationalResult,
  q_factor: qFactorResult,  // NEW: was missing (RC-11)
});

// NEW: dedicated columns for balance_map and stability (optional)
// Or: keep in fullResult only
```

2. **Если добавлять новые колонки** — schema migration:
```prisma
model ProjectBalanceResult {
  // ... existing ...
  balanceMap          String?   // NEW: JSON of balance_map
  stabilityData       String?   // NEW: JSON of stability
  qFactorResult       String?   // NEW: JSON of q_factor_result
  // ...
}
```

3. **Обновить GET endpoint** — correct fallback types:
```ts
// src/app/api/v1/balance/[projectId]/route.ts
return NextResponse.json({
  id: b.id,
  project_id: b.projectId,
  balance_type: b.balanceType,
  overall_balance_score: b.overallBalanceScore,
  imbalance_count: b.imbalanceCount,
  element_count: b.elementCount,
  elements: safeJsonParse(b.elements || "[]", []),
  cost_power_curves: safeJsonParse(b.costPowerCurves || "{}", {}),  // ← FIX: was "[]", now "{}" (object)
  intransitive_matrix: safeJsonParse(b.intransitiveMatrix || "{}", {}),
  nash_equilibrium: safeJsonParse(b.nashEquilibrium || "{}", {}),
  monte_carlo_results: safeJsonParse(b.monteCarloResults || "{}", {}),  // ← FIX: was "[]", now "{}"
  machinations_results: safeJsonParse(b.machinationsResults || "{}", {}),
  pathologies: safeJsonParse(b.pathologies || "{}", {}),  // ← FIX: was "[]", now "{}"
  corrections: safeJsonParse(b.corrections || "{}", {}),  // ← FIX: was "[]", now "{}"
  situational_values: safeJsonParse(b.situationalValues || "{}", {}),  // ← FIX
  input_data: safeJsonParse(b.inputData || "{}", {}),
  ai_insights: b.aiInsights || null,  // NEW (TASK-4.10)
  full_result: safeJsonParse(b.fullResult || "{}", {}),
  // NEW: expose top-level convenience fields (extracted from full_result)
  balance_map: (safeJsonParse(b.fullResult || "{}", {}) as { balance_map?: unknown }).balance_map ?? null,
  stability: (safeJsonParse(b.fullResult || "{}", {}) as { stability?: unknown }).stability ?? null,
  q_factor_result: (safeJsonParse(b.situationalValues || "{}", {}) as { q_factor?: unknown }).q_factor ?? null,
  created_at: b.createdAt.toISOString(),
  updated_at: b.updatedAt.toISOString(),
});
```

4. **Убрать `void safeJsonParse;`** (route.ts:1042) — unused import:
```ts
// Remove this line:
// void safeJsonParse;

// And remove from imports:
import {
  getOwnedProject,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
// (safeJsonParse removed — not used in analyze route, only in GET route)
```

**Тест-кейсы**:
- POST then GET → all fields preserved, no data loss.
- GET on project without balance → 404 (existing behavior).
- `cost_power_curves` is always an object (was array before — TypeError risk for old clients).
- `pathologies` is always an object with `pathologies_catalog` array.
- `ai_insights` is `null` if `use_ai: false`, otherwise a string.
- `q_factor_result` is exposed in GET response (was missing).
- `balance_map` and `stability` are exposed as top-level fields (were buried in `full_result`).
- `tsc --noUnusedLocals` — no warnings.

**Риски**:
- **Breaking change for API consumers** — fallback type changes (`[]` → `{}`). Митигация: frontend `Block4Page` doesn't use GET endpoint (always POST), so no immediate breakage. Document in CHANGELOG.
- **Schema migration** — if adding new columns, requires DB write. Митигация: `bunx prisma migrate dev --name expand_balance_persistence`.

**Dependencies**: TASK-4.10 (для `aiInsights` колонки).

---

### TASK-4.13: Реализовать fulcrum (Bible 5.5.2) — O(n) reference object

**Сложность**: M
**Приоритет**: 🟡 (после TASK-4.3, TASK-4.4)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts` (`buildBalanceMap`, `buildTransitiveResult`), `src/types/balance.ts`

**Описание проблемы**:

`route.ts:60` (RC-2):
```ts
const anchor = Object.keys(firstAttrs)[0] || "power";
```
`anchor` — это просто первый ключ атрибутов первого объекта. Bible 5.5.2:
> «Фулкрум — референтный игровой объект, базовая линия для сравнения всех остальных. Часто не появляется в самой игре — чисто технический инструмент. Каждый объект тестируется только против фулкрума, что снижает сложность с O(n²) до O(n).»

**Решение**:

1. **Расширить `FullBalanceRequest`**:
```ts
export interface FullBalanceRequest {
  // ... existing ...
  fulcrum_object_id?: string;  // ID of object to use as reference (Bible 5.5.2)
  fulcrum_tier?: number;       // If no object ID, use median tier as fulcrum (Bible 5.5.2)
}
```

2. **Реализовать `selectFulcrum`**:
```ts
// src/lib/balance-fulcrum.ts (new file)
import type { BalanceObject } from "@/types/balance";

export interface FulcrumSelection {
  object: BalanceObject;
  reason: string;
  tier: number;
}

/**
 * Select fulcrum object (Bible 5.5.2).
 * Strategy:
 * 1. If user specifies fulcrum_object_id, use that.
 * 2. If user specifies fulcrum_tier, use the lowest-cost object of that tier.
 * 3. Default: use median tier, then median cost within that tier.
 *    Bible 5.5.2: "Безопаснее начинать со среднего уровня (5-й из 9), затем ослабить для минимума и усилить для максимума."
 */
export function selectFulcrum(
  objects: BalanceObject[],
  options: { objectId?: string; tier?: number } = {}
): FulcrumSelection | null {
  if (objects.length === 0) return null;

  // Strategy 1: explicit object ID
  if (options.objectId) {
    const found = objects.find((o) => o.id === options.objectId);
    if (found) {
      return {
        object: found,
        reason: `User-specified fulcrum (id=${options.objectId})`,
        tier: found.tier ?? 1,
      };
    }
  }

  // Group by tier
  const byTier = new Map<number, BalanceObject[]>();
  for (const o of objects) {
    const t = o.tier ?? 1;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(o);
  }
  const sortedTiers = [...byTier.keys()].sort((a, b) => a - b);

  // Strategy 2: explicit tier
  if (options.tier !== undefined) {
    const tierObjects = byTier.get(options.tier);
    if (tierObjects && tierObjects.length > 0) {
      // Use median cost within tier
      const sorted = [...tierObjects].sort((a, b) => (a.cost ?? 100) - (b.cost ?? 100));
      const median = sorted[Math.floor(sorted.length / 2)];
      return {
        object: median,
        reason: `Median cost in user-specified tier ${options.tier}`,
        tier: options.tier,
      };
    }
  }

  // Strategy 3: median tier, median cost
  const medianTierIdx = Math.floor(sortedTiers.length / 2);
  const medianTier = sortedTiers[medianTierIdx];
  const tierObjects = byTier.get(medianTier)!;
  const sorted = [...tierObjects].sort((a, b) => (a.cost ?? 100) - (b.cost ?? 100));
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    object: median,
    reason: `Median cost in median tier (${medianTier}) — Bible 5.5.2 recommendation`,
    tier: medianTier,
  };
}

/**
 * Compute fulcrum-relative metrics for each object (Bible 5.5.2).
 * Instead of comparing all pairs (O(n²)), compare each object to fulcrum (O(n)).
 */
export function computeFulcrumRelativeMetrics(
  objects: BalanceObject[],
  fulcrum: FulcrumSelection,
  weights: Record<string, number>
): Array<{
  name: string;
  fulcrum_ratio: number;  // power / fulcrum_power (1.0 = balanced vs fulcrum)
  cost_ratio: number;     // cost / fulcrum_cost
  cp_relative: number;    // (power/cost) / (fulcrum_power/fulcrum_cost)
}> {
  const fulcrumPower = computePower(fulcrum.object.attributes, weights);
  const fulcrumCost = fulcrum.object.cost ?? 100;
  const fulcrumCpRatio = fulcrumPower / Math.max(1, fulcrumCost);

  return objects.map((o) => {
    const power = computePower(o.attributes, weights);
    const cost = o.cost ?? 100;
    const cpRatio = power / Math.max(1, cost);
    return {
      name: o.name,
      fulcrum_ratio: Number((power / Math.max(0.01, fulcrumPower)).toFixed(3)),
      cost_ratio: Number((cost / Math.max(1, fulcrumCost)).toFixed(3)),
      cp_relative: Number((cpRatio / Math.max(0.01, fulcrumCpRatio)).toFixed(3)),
    };
  });
}

function computePower(attrs: Record<string, number>, weights: Record<string, number>): number {
  let power = 0;
  for (const [key, value] of Object.entries(attrs)) {
    power += value * (weights[key] || 0.25);
  }
  return Number(power.toFixed(2));
}
```

3. **Обновить `buildBalanceMap`** — use fulcrum as anchor:
```ts
import { selectFulcrum, computeFulcrumRelativeMetrics, type FulcrumSelection } from "@/lib/balance-fulcrum";

function buildBalanceMap(
  balanceType: string,
  gameMode: string,
  objects: BalanceObject[],
  fulcrum: FulcrumSelection | null
) {
  // Anchor: fulcrum object name (or fallback to first attr key)
  const anchor = fulcrum?.object.name
    ?? Object.keys(objects[0]?.attributes || { power: 1 })[0]
    ?? "power";

  // ... rest unchanged, but use `anchor` properly ...
}
```

4. **Расширить `TransitiveResult`** — add fulcrum-relative metrics:
```ts
export interface TransitiveResult {
  // ... existing ...
  fulcrum?: {
    object_name: string;
    reason: string;
    tier: number;
    relative_metrics: Array<{
      name: string;
      fulcrum_ratio: number;
      cost_ratio: number;
      cp_relative: number;
    }>;
  };
}
```

5. **Использовать в route handler**:
```ts
const fulcrumSelection = selectFulcrum(objects, {
  objectId: body?.fulcrum_object_id as string | undefined,
  tier: typeof body?.fulcrum_tier === "number" ? body.fulcrum_tier : undefined,
});

const balanceMap = buildBalanceMap(balanceType, gameMode, objects, fulcrumSelection);

// In buildTransitiveResult, add fulcrum-relative metrics
const fulcrumMetrics = fulcrumSelection
  ? computeFulcrumRelativeMetrics(objects, fulcrumSelection, weights)
  : null;

// Add to transitiveResult:
transitiveResult.fulcrum = fulcrumSelection
  ? {
      object_name: fulcrumSelection.object.name,
      reason: fulcrumSelection.reason,
      tier: fulcrumSelection.tier,
      relative_metrics: fulcrumMetrics ?? [],
    }
  : undefined;
```

**Тест-кейсы**:
- 4 objects, no `fulcrum_object_id` → median tier (1), median cost → "Warrior" (or whichever is in the middle).
- `fulcrum_object_id: "obj3"` → "Rogue" is fulcrum, all ratios computed against Rogue.
- `fulcrum_tier: 2` → median cost in tier 2 (e.g., "Tank" if only one tier-2 object).
- 1 object → fulcrum = that object, all ratios = 1.0.
- 50 objects with tiers 1-5 → median tier = 3, median cost in tier 3.

**Риски**:
- **Median computation** for even-length arrays: `sorted[Math.floor(n/2)]` gives the higher of the two middle elements. Acceptable, but document.
- **Fulcrum object may be irrelevant** if user-specified fulcrum is an outlier. Митигация: validate fulcrum selection against distribution (e.g., warn if fulcrum is in top/bottom 10% by cost).

**Dependencies**: TASK-4.4 (weights для power computation).

---

### TASK-4.14: Реализовать Markov chains (Bible 5.8.1) + recursive EV (Bible 5.8.2)

**Сложность**: L
**Приоритет**: 🟡 (после TASK-4.5)
**Файлы**: `src/lib/balance-markov.ts` (новый), `src/app/api/v1/balance/analyze/route.ts`

**Описание проблемы**:

Bible 5.8.1 (Markov chains) и 5.8.2 (recursive EV) — полностью отсутствуют (RC: Bible compliance).

**Решение**:

1. **Создать `src/lib/balance-markov.ts`**:
```ts
import type { MonteCarloResult, MachinationsResult } from "@/types/balance";

/**
 * Bible 5.8.1: Markov chain analysis.
 * M × V = V_next, where M is transition matrix, V is state vector.
 * Stationary state: V* = M × V*.
 *
 * For balance analysis, we model state transitions between
 * "winning", "losing", "tied" states based on Monte Carlo results.
 */
export interface MarkovAnalysis {
  transition_matrix: number[][];
  initial_state: number[];
  stationary_state: number[];
  convergence_iterations: number;
  state_labels: string[];
}

export function analyzeMarkovChain(
  monteCarlo: MonteCarloResult,
  objectNames: string[]
): MarkovAnalysis {
  const n = objectNames.length;
  if (n < 2) {
    return {
      transition_matrix: [],
      initial_state: [],
      stationary_state: [],
      convergence_iterations: 0,
      state_labels: objectNames,
    };
  }

  // Build transition matrix from matchup_matrix
  // M[i][j] = probability of transitioning from state i to state j
  // State = "currently dominant strategy"
  // Transition: if i was dominant last round, probability that j is dominant next round
  // = matchup_matrix[j][i] (j beats i)
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      // Transition prob from i to j = P(j beats i)
      const matchup = monteCarlo.matchup_matrix[objectNames[i]]?.[objectNames[j]] ?? 0;
      row.push(matchup);
      rowSum += matchup;
    }
    // Normalize row to sum to 1 (Markov property)
    if (rowSum > 0) {
      for (let j = 0; j < n; j++) {
        row[j] = Number((row[j] / rowSum).toFixed(4));
      }
    } else {
      // Uniform fallback
      for (let j = 0; j < n; j++) {
        row[j] = Number((1 / n).toFixed(4));
      }
    }
    matrix.push(row);
  }

  // Initial state: uniform
  const initialState = objectNames.map(() => Number((1 / n).toFixed(4)));

  // Iterate to find stationary state: V* = M × V*
  let currentState = [...initialState];
  let iterations = 0;
  const maxIter = 1000;
  const tolerance = 1e-6;

  while (iterations < maxIter) {
    const nextState = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        nextState[j] += currentState[i] * matrix[i][j];
      }
      nextState[j] = Number(nextState[j].toFixed(6));
    }
    // Check convergence
    const diff = nextState.reduce((s, v, i) => s + Math.abs(v - currentState[i]), 0);
    currentState = nextState;
    iterations++;
    if (diff < tolerance) break;
  }

  return {
    transition_matrix: matrix,
    initial_state: initialState,
    stationary_state: currentState.map((v) => Number(v.toFixed(4))),
    convergence_iterations: iterations,
    state_labels: objectNames,
  };
}

/**
 * Bible 5.8.2: Recursive EV for infinite processes.
 * Example: spell that deals 1 damage with P=0.2 of repeating.
 * D = 1 + 0.8 × D → D = 1/0.2 = 5.
 *
 * For balance: model abilities with chance of re-triggering.
 */
export interface RecursiveEVResult {
  ability_name: string;
  base_value: number;
  repeat_probability: number;
  expected_value: number;
  iterations_to_converge: number;
}

export function computeRecursiveEV(
  abilities: Array<{ name: string; base_value: number; repeat_probability: number }>
): RecursiveEVResult[] {
  return abilities.map((a) => {
    const p = Math.max(0, Math.min(0.99, a.repeat_probability));  // clamp [0, 0.99]
    // D = base + (1-p) × D → D = base / p
    // Wait: if P(repeat) = p, then D = base + p × D → D = base / (1 - p)
    // Bible example: P=0.2 repeat → D = 1 / 0.2 = 5? Let's check:
    // If P(repeat) = 0.2, then D = 1 + 0.2 × D → D = 1 / (1 - 0.2) = 1/0.8 = 1.25
    // Bible says D = 5, so Bible's P is "probability of stopping", not "probability of repeating"
    // We use P(repeat), so D = base / (1 - P(repeat))
    const expectedValue = a.base_value / (1 - p);
    return {
      ability_name: a.name,
      base_value: a.base_value,
      repeat_probability: p,
      expected_value: Number(expectedValue.toFixed(3)),
      iterations_to_converge: Math.ceil(Math.log(0.01) / Math.log(p || 0.01)),  // iterations to converge within 1%
    };
  });
}
```

2. **Интегрировать в route handler** (опционально, controlled by `run_markov` flag):
```ts
import { analyzeMarkovChain, computeRecursiveEV } from "@/lib/balance-markov";

// Add to FullBalanceRequest
// run_markov?: boolean

const runMarkov = body?.run_markov === true;

// After monteCarloResult computation
let markovAnalysis: MarkovAnalysis | null = null;
if (runMarkov && runMonteCarlo) {
  markovAnalysis = analyzeMarkovChain(monteCarloResult, objects.map((o) => o.name));
}

// Add to result
if (markovAnalysis) {
  result.markov_analysis = markovAnalysis;
}
```

3. **Расширить `FullBalanceResponse`**:
```ts
export interface FullBalanceResponse {
  // ... existing ...
  markov_analysis?: MarkovAnalysis;
}
```

**Тест-кейсы**:
- RPS-like matchup (A beats B 60%, B beats C 60%, C beats A 60%) → stationary state ≈ `[0.33, 0.33, 0.33]`.
- Dominant strategy (A beats all 90%) → stationary state ≈ `[1.0, 0, 0]`.
- Convergence in ≤100 iterations for n ≤ 10.
- Recursive EV: `base=1, P(repeat)=0.2` → `expected_value = 1.25` (D = 1 / (1 - 0.2) = 1.25).
- Recursive EV: `base=10, P(repeat)=0.5` → `expected_value = 20`.
- Recursive EV: `P(repeat)=0.99` → `expected_value = 100 × base` (high variance).

**Риски**:
- **Markov chain may not converge** for cyclic transitions. Митигация: cap at 1000 iterations, return last state with `convergence_iterations: 1000`.
- **Matchup matrix may not be a valid transition matrix** (rows don't sum to 1). Митигация: normalize each row.

**Dependencies**: TASK-4.6 (Monte Carlo for `matchup_matrix`).

---

### TASK-4.15: Добавить валидацию objects — bound count, numeric attributes, unique IDs

**Сложность**: S
**Приоритет**: 🟡 (после TASK-4.1)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts`

**Описание проблемы**:

`route.ts:847-860` (RC-13):
- Нет валидации значений `attributes` (NaN risk).
- Нет upper bound на `objects.length` (DoS risk).
- Нет проверки duplicate IDs.

**Решение**:

1. **Расширить валидацию** в route handler:
```ts
const MAX_OBJECTS = 100;
const MIN_OBJECTS = 2;
const MAX_ATTRIBUTE_VALUE = 1_000_000;
const MIN_ATTRIBUTE_VALUE = -1_000_000;

if (!Array.isArray(objectsRaw) || objectsRaw.length < MIN_OBJECTS) {
  return VALIDATION_ERROR(
    `Поле 'objects' обязательно и должно содержать минимум ${MIN_OBJECTS} объекта`
  );
}

if (objectsRaw.length > MAX_OBJECTS) {
  return VALIDATION_ERROR(
    `Превышен лимит объектов: ${objectsRaw.length} > ${MAX_OBJECTS}. Разделите анализ на части.`
  );
}

const seenIds = new Set<string>();
const objects: BalanceObject[] = [];
const validationErrors: string[] = [];

objectsRaw.forEach((o: unknown, i: number) => {
  const obj = o as Record<string, unknown>;

  // Validate attributes: must be object with numeric values
  let attributes: Record<string, number> = {};
  if (obj.attributes && typeof obj.attributes === "object" && !Array.isArray(obj.attributes)) {
    for (const [k, v] of Object.entries(obj.attributes as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= MIN_ATTRIBUTE_VALUE && v <= MAX_ATTRIBUTE_VALUE) {
        attributes[k] = v;
      } else {
        validationErrors.push(`objects[${i}].attributes.${k} должно быть числом в [${MIN_ATTRIBUTE_VALUE}, ${MAX_ATTRIBUTE_VALUE}]`);
      }
    }
  }
  // Fallback to default if empty after validation
  if (Object.keys(attributes).length === 0) {
    attributes = { power: 50, hp: 100 };
  }

  // Validate ID uniqueness
  const id = String(obj.id ?? `obj_${i + 1}`);
  if (seenIds.has(id)) {
    validationErrors.push(`Duplicate object ID: "${id}" at index ${i}`);
  }
  seenIds.add(id);

  // Validate name
  const name = String(obj.name ?? `Object ${i + 1}`);
  if (!name.trim()) {
    validationErrors.push(`objects[${i}].name не должно быть пустым`);
  }

  // Validate cost
  const cost = typeof obj.cost === "number" && Number.isFinite(obj.cost) && obj.cost > 0
    ? obj.cost
    : undefined;

  // Validate tier
  const tier = typeof obj.tier === "number" && Number.isInteger(obj.tier) && obj.tier >= 1 && obj.tier <= 10
    ? obj.tier
    : undefined;

  objects.push({
    id,
    name: name.trim(),
    type: String(obj.type ?? "generic"),
    attributes,
    cost,
    tier,
    tags: Array.isArray(obj.tags) ? obj.tags as string[] : undefined,
  });
});

if (validationErrors.length > 0) {
  return VALIDATION_ERROR(
    `Ошибки валидации объектов:\n${validationErrors.slice(0, 10).join("\n")}${validationErrors.length > 10 ? `\n... и ещё ${validationErrors.length - 10} ошибок` : ""}`
  );
}
```

2. **Добавить limits в `FullBalanceRequest`** type doc:
```ts
export interface FullBalanceRequest {
  /**
   * Array of balance objects.
   * - Minimum: 2 objects (else 422 VALIDATION_ERROR).
   * - Maximum: 100 objects (else 422).
   * - Each object must have unique `id`.
   * - `attributes` values must be finite numbers in [-1M, 1M].
   */
  objects: BalanceObject[];
  // ...
}
```

**Тест-кейсы**:
- 0 objects → 422 "минимум 2 объекта".
- 1 object → 422.
- 2 objects, valid → 200 OK.
- 101 objects → 422 "Превышен лимит".
- Object with `attributes: { power: "abc" }` → 422 "должно быть числом".
- Object with `attributes: { power: NaN }` → 422.
- Object with `attributes: { power: 1e10 }` → 422 "в [-1M, 1M]".
- Duplicate IDs → 422.
- Empty name → 422.
- Invalid tier (0, -1, 1.5, 11) → tier set to `undefined` (no error, just fallback).

**Риски**:
- **Strict validation may break existing API consumers** who send loose data. Митигация: gracefully fallback for `tier` (just unset), but strict for `attributes` and `id` (return 422).

**Dependencies**: нет (независимая задача).

---

### TASK-4.16: Реализовать Bible 5.6.2 — 6 combinations sum × OS

**Сложность**: M
**Приоритет**: 🟢 (после TASK-4.7)
**Файлы**: `src/lib/balance-feedback.ts` (новый), `src/app/api/v1/balance/analyze/route.ts`

**Описание проблемы**:

Bible 5.6.2 описывает 6 комбинаций сумма × обратная связь:

| | Положительная ОС | Отрицательная ОС | Обе |
|---|-----------------|-----------------|-----|
| **Положительная сумма** | Экспоненциальный разрыв | «Косичка» | — |
| **Нулевая сумма** | Быстрое завершение | «Качели» | Минус рано, плюс поздно |
| **Отрицательная сумма** | Порочный круг | «Косичка» на нисходящем тренде | — |

Не реализовано.

**Решение**:

1. **Создать `src/lib/balance-feedback.ts`**:
```ts
import type { MachinationsResult, FeedbackLoop } from "@/types/balance";

export type SumType = "positive" | "zero" | "negative";
export type FeedbackType = "positive" | "negative" | "both";

export interface FeedbackCombination {
  sum: SumType;
  feedback: FeedbackType;
  pattern: string;
  description: string;
  example_games: string[];
  recommended: boolean;
  recommendation_reason?: string;
}

export const FEEDBACK_COMBINATIONS: FeedbackCombination[] = [
  {
    sum: "positive",
    feedback: "positive",
    pattern: "exponential_divergence",
    description: "Экспоненциальный разрыв — ранний лидер отрывается всё больше",
    example_games: ["4X-стратегии (Civilization)"],
    recommended: false,
    recommendation_reason: "Уместен в PvE (ощущение роста), разрушителен в PvP",
  },
  {
    sum: "positive",
    feedback: "negative",
    pattern: "braid_alternating",
    description: "«Косичка» — лидерство чередуется между игроками",
    example_games: ["Catan"],
    recommended: true,
    recommendation_reason: "Создаёт напряжение и реиграбельность",
  },
  {
    sum: "zero",
    feedback: "positive",
    pattern: "rapid_completion",
    description: "Быстрое завершение — одна победа исключает другую",
    example_games: ["Армрестлинг"],
    recommended: false,
    recommendation_reason: "Подходит для коротких матчей, фрустрирует в долгих",
  },
  {
    sum: "zero",
    feedback: "negative",
    pattern: "seesaw_eternal",
    description: "«Качели» — бесконечное чередование преимущества",
    example_games: ["Шахматы (эндшпиль)"],
    recommended: true,
    recommendation_reason: "Хорошо для долгих соревновательных игр",
  },
  {
    sum: "zero",
    feedback: "both",
    pattern: "minus_early_plus_late",
    description: "Минус рано, плюс поздно — сначала потери, потом накопление",
    example_games: ["Покер"],
    recommended: true,
    recommendation_reason: "Создаёт драматургию партии",
  },
  {
    sum: "negative",
    feedback: "positive",
    pattern: "vicious_circle",
    description: "Порочный круг — оба игрока теряют, но один быстрее",
    example_games: ["Шахматы (миттельшпиль с обменами)"],
    recommended: false,
    recommendation_reason: "Может быть увлекательным, но рискует фрустрацией",
  },
  {
    sum: "negative",
    feedback: "negative",
    pattern: "braid_declining",
    description: "«Косичка» на нисходящем тренде — чередование с общим спадом",
    example_games: ["Survival-игры с limited resources"],
    recommended: false,
    recommendation_reason: "Подходит для survival, опасен для соревновательных",
  },
];

export interface SumFeedbackAnalysis {
  detected_sum: SumType;
  detected_feedback: FeedbackType;
  matched_pattern: FeedbackCombination | null;
  all_patterns: FeedbackCombination[];
  recommendation: string;
}

export function analyzeSumFeedback(
  machinations: MachinationsResult,
  gameMode: string
): SumFeedbackAnalysis {
  // Detect sum type from resource flows
  // Positive sum: total resources increase over time (faucets > sinks)
  // Zero sum: resources conserved (faucets = sinks)
  // Negative sum: total resources decrease (sinks > faucets)
  const flows = machinations.graph.resource_flows ?? [];
  let totalInflow = 0;
  let totalOutflow = 0;
  for (const flow of flows) {
    const rate = typeof flow.rate === "number" ? flow.rate : 0;
    // Heuristic: flows from "anchor" or "source" type nodes are inflows
    const fromNode = machinations.graph.nodes?.find((n) => n.id === flow.from || n.name === flow.from);
    const toNode = machinations.graph.nodes?.find((n) => n.id === flow.to || n.name === flow.to);
    if (fromNode?.type === "source") totalInflow += rate;
    if (toNode?.type === "drain") totalOutflow += rate;
  }

  let detectedSum: SumType;
  const delta = totalInflow - totalOutflow;
  if (Math.abs(delta) < 0.1 * Math.max(totalInflow, totalOutflow, 1)) {
    detectedSum = "zero";
  } else if (delta > 0) {
    detectedSum = "positive";
  } else {
    detectedSum = "negative";
  }

  // Detect feedback type from feedback loops
  const loops = machinations.feedback_loops ?? machinations.graph?.feedback_loops ?? [];
  const hasPositive = loops.some((l) => l.type === "positive");
  const hasNegative = loops.some((l) => l.type === "negative");

  let detectedFeedback: FeedbackType;
  if (hasPositive && hasNegative) detectedFeedback = "both";
  else if (hasPositive) detectedFeedback = "positive";
  else if (hasNegative) detectedFeedback = "negative";
  else detectedFeedback = "negative";  // default: assume balancing

  // Match pattern
  const matchedPattern = FEEDBACK_COMBINATIONS.find(
    (p) => p.sum === detectedSum && p.feedback === detectedFeedback
  ) ?? null;

  // Recommendation based on game mode
  const isPvP = gameMode === "PvP" || gameMode === "PvPvE";
  let recommendation: string;
  if (matchedPattern) {
    if (matchedPattern.recommended) {
      recommendation = `Паттерн "${matchedPattern.pattern}" подходит для ${gameMode}. ${matchedPattern.recommendation_reason}.`;
    } else if (isPvP && matchedPattern.sum === "positive" && matchedPattern.feedback === "positive") {
      recommendation = `ВНИМАНИЕ: паттерн "${matchedPattern.pattern}" разрушителен в PvP. Рассмотрите добавление отрицательной ОС.`;
    } else {
      recommendation = `Паттерн "${matchedPattern.pattern}" нейтрален. ${matchedPattern.recommendation_reason}.`;
    }
  } else {
    recommendation = "Паттерн не определён — недостаточно данных о feedback loops.";
  }

  return {
    detected_sum: detectedSum,
    detected_feedback: detectedFeedback,
    matched_pattern: matchedPattern,
    all_patterns: FEEDBACK_COMBINATIONS,
    recommendation,
  };
}
```

2. **Интегрировать в route handler**:
```ts
import { analyzeSumFeedback } from "@/lib/balance-feedback";

// After machinationsResult computation
const sumFeedbackAnalysis = analyzeSumFeedback(machinationsResult, gameMode);

// Add to result
result.sum_feedback_analysis = sumFeedbackAnalysis;
```

3. **Расширить `FullBalanceResponse`**:
```ts
export interface FullBalanceResponse {
  // ... existing ...
  sum_feedback_analysis?: SumFeedbackAnalysis;
}
```

**Тест-кейсы**:
- 4 combat objects, positive loops + inflow > outflow → `detected_sum: "positive"`, `detected_feedback: "positive"`, matched = "exponential_divergence", recommendation warns for PvP.
- Economic game with sinks = faucets + 1 negative loop → `detected_sum: "zero"`, `detected_feedback: "negative"`, matched = "seesaw_eternal", recommended.
- Survival game with sinks > faucets + both loop types → `detected_sum: "negative"`, `detected_feedback: "both"`, no match (no "both" + "negative" in catalog) → recommendation "Паттерн не определён".

**Риски**:
- **Heuristic for sum detection** is crude (just counts source/drain rates). Митигация: document as heuristic, allow user override via `sum_type` parameter in future.
- **Catalog may not match all combinations** — `negative × both` is missing (Bible table shows "—" for that cell). Митигация: handle "no match" gracefully.

**Dependencies**: TASK-4.7 (machinations graph с `resource_flows` и `feedback_loops`).

---

### TASK-4.17: Убрать dead code + type bypasses

**Сложность**: S
**Приоритет**: 🟢 (после TASK-4.8, TASK-4.12)
**Файлы**: `src/app/api/v1/balance/analyze/route.ts`

**Описание проблемы**:

- `route.ts:1041-1042`: `void safeJsonParse;` — dead code, satisfies linter.
- `route.ts:898-905`: `as unknown as` type cast (fixed in TASK-4.8).
- `route.ts:854`: `obj.attributes as Record<string, number>` — unsafe cast.
- `route.ts:858`: `obj.tags as string[]` — unsafe cast.

**Решение**:

1. **Убрать `void safeJsonParse;`** и неиспользуемый import (TASK-4.12 уже сделал это).

2. **Заменить unsafe casts** на validated conversions (TASK-4.15 уже делает это):
```ts
// Before:
attributes: (obj.attributes as Record<string, number>) || { power: 50, hp: 100 },
tags: Array.isArray(obj.tags) ? obj.tags as string[] : undefined,

// After (TASK-4.15):
let attributes: Record<string, number> = {};
if (obj.attributes && typeof obj.attributes === "object" && !Array.isArray(obj.attributes)) {
  for (const [k, v] of Object.entries(obj.attributes as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && ...) {
      attributes[k] = v;
    }
  }
}
// ...
tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string") : undefined,
```

3. **Запустить `tsc --noUnusedLocals`** — убедиться, что нет warnings:
```bash
bunx tsc --noUnusedLocals --noEmit
```

4. **Запустить ESLint** — убедиться, что нет errors:
```bash
bunx eslint src/app/api/v1/balance/
```

**Тест-кейсы**:
- `tsc --noUnusedLocals --noEmit` exit code 0.
- `eslint src/app/api/v1/balance/` exit code 0.
- No `as unknown as` in route.ts.
- No `void` statements.

**Риски**:
- None — straightforward cleanup.

**Dependencies**: TASK-4.8 (убрать `as unknown as`), TASK-4.12 (убрать `void safeJsonParse`), TASK-4.15 (validated casts).

---

### TASK-4.18: Unit-тесты для balance модулей

**Сложность**: L
**Приоритет**: 🟢 (после всех остальных задач)
**Файлы**: `src/lib/balance/__tests__/` (новый), `src/app/api/v1/balance/analyze/__tests__/` (новый)

**Описание проблемы**:

Нет unit-тестов для Block 4. Любой regression в `buildTransitiveResult`, `buildIntransitiveResult`, `buildMonteCarloResult`, `buildMachinationsResult`, `buildStability`, `solveNashEquilibrium`, `detectAllPathologies` останется незамеченным.

**Решение**:

1. **Создать тесты для `src/lib/balance-fulcrum.ts`**:
```ts
// src/lib/balance/__tests__/fulcrum.test.ts
import { describe, it, expect } from "bun:test";
import { selectFulcrum, computeFulcrumRelativeMetrics } from "@/lib/balance-fulcrum";
import type { BalanceObject } from "@/types/balance";

const objects: BalanceObject[] = [
  { id: "1", name: "A", type: "x", attributes: { power: 10 }, cost: 100, tier: 1 },
  { id: "2", name: "B", type: "x", attributes: { power: 20 }, cost: 200, tier: 1 },
  { id: "3", name: "C", type: "x", attributes: { power: 30 }, cost: 300, tier: 2 },
  { id: "4", name: "D", type: "x", attributes: { power: 40 }, cost: 400, tier: 2 },
  { id: "5", name: "E", type: "x", attributes: { power: 50 }, cost: 500, tier: 3 },
];

describe("selectFulcrum", () => {
  it("returns user-specified object when ID matches", () => {
    const result = selectFulcrum(objects, { objectId: "3" });
    expect(result?.object.id).toBe("3");
    expect(result?.reason).toContain("User-specified");
  });

  it("returns null for empty array", () => {
    expect(selectFulcrum([], {})).toBeNull();
  });

  it("uses median tier by default", () => {
    const result = selectFulcrum(objects, {});
    expect(result?.tier).toBe(2);  // median of [1, 1, 2, 2, 3] = 2
  });

  it("respects explicit tier", () => {
    const result = selectFulcrum(objects, { tier: 1 });
    expect(result?.tier).toBe(1);
  });

  it("returns median cost within tier", () => {
    const result = selectFulcrum(objects, { tier: 2 });
    // Tier 2: objects 3 (cost 300) and 4 (cost 400). Median = sorted[1] = 400 (odd/even edge).
    expect(["3", "4"]).toContain(result?.object.id);
  });
});

describe("computeFulcrumRelativeMetrics", () => {
  it("returns 1.0 for fulcrum itself", () => {
    const fulcrum = selectFulcrum(objects, { objectId: "3" })!;
    const metrics = computeFulcrumRelativeMetrics(objects, fulcrum, { power: 1 });
    const selfMetric = metrics.find((m) => m.name === "C");
    expect(selfMetric?.fulcrum_ratio).toBe(1.0);
    expect(selfMetric?.cost_ratio).toBe(1.0);
    expect(selfMetric?.cp_relative).toBe(1.0);
  });

  it("returns > 1 for stronger objects", () => {
    const fulcrum = selectFulcrum(objects, { objectId: "1" })!;  // weakest
    const metrics = computeFulcrumRelativeMetrics(objects, fulcrum, { power: 1 });
    const strongMetric = metrics.find((m) => m.name === "E");
    expect(strongMetric?.fulcrum_ratio).toBeGreaterThan(1);
  });
});
```

2. **Тесты для Nash equilibrium solver** (`src/lib/balance/__tests__/nash.test.ts`):
```ts
import { describe, it, expect } from "bun:test";
// Import solveNashEquilibrium from route or extract to lib

describe("solveNashEquilibrium", () => {
  it("returns [1] for single strategy", () => {
    expect(solveNashEquilibrium([[0]], 1)).toEqual([1]);
  });

  it("returns [0.5, 0.5] for symmetric 2x2", () => {
    const matrix = [[0, 1], [-1, 0]];
    const result = solveNashEquilibrium(matrix, 2);
    expect(result[0]).toBeCloseTo(0.5, 1);
    expect(result[1]).toBeCloseTo(0.5, 1);
  });

  it("returns [1, 0] for dominated strategy", () => {
    // Row 0 dominates row 1 (payoffs 5 > 1, 3 > 0)
    const matrix = [[0, 5], [-5, 0], [1, 3], [0, 0]];  // Wait, this is wrong shape
    // Let me redo: 2x2 where row 0 dominates row 1
    const matrix2 = [[0, 5], [-5, 0]];
    // Hmm, for domination, row 0 must have higher payoff than row 1 in every column
    // M[0][0]=0 vs M[1][0]=-5: 0 > -5 ✓
    // M[0][1]=5 vs M[1][1]=0: 5 > 0 ✓
    // So row 0 dominates row 1
    const result = solveNashEquilibrium(matrix2, 2);
    // Row 1 is dominated, so nash = [1, 0]
    expect(result[0]).toBeCloseTo(1, 1);
    expect(result[1]).toBeCloseTo(0, 1);
  });

  it("returns uniform for RPS 3x3", () => {
    const matrix = [
      [0, 1, -1],
      [-1, 0, 1],
      [1, -1, 0],
    ];
    const result = solveNashEquilibrium(matrix, 3);
    expect(result[0]).toBeCloseTo(1/3, 1);
    expect(result[1]).toBeCloseTo(1/3, 1);
    expect(result[2]).toBeCloseTo(1/3, 1);
  });
});
```

3. **Тесты для pathologies** (`src/lib/balance/__tests__/pathologies.test.ts`):
```ts
import { describe, it, expect } from "bun:test";
import { detectAllPathologies, getDetectedPathologies } from "@/lib/balance-pathologies";

describe("detectAllPathologies", () => {
  it("returns 8 pathologies", () => {
    const ctx = makeTestContext();
    const result = detectAllPathologies(ctx);
    expect(result.length).toBe(8);
    expect(result.map((p) => p.bible_ref)).toEqual([
      "5.13.1", "5.13.2", "5.13.3", "5.13.4", "5.13.5", "5.13.6", "5.13.7", "5.13.8",
    ]);
  });

  it("detects dominant strategy when max_share > 0.5", () => {
    const ctx = makeTestContext({ maxShare: 0.7 });
    const dominant = detectAllPathologies(ctx).find((p) => p.id === "dominant_strategy");
    expect(dominant?.detected).toBe(true);
  });

  it("does not detect dominant strategy when max_share < 0.5", () => {
    const ctx = makeTestContext({ maxShare: 0.3 });
    const dominant = detectAllPathologies(ctx).find((p) => p.id === "dominant_strategy");
    expect(dominant?.detected).toBe(false);
  });

  it("detects dead zone when any object has win rate < 10%", () => {
    const ctx = makeTestContext({ winRates: { A: 0.5, B: 0.5, C: 0.05 } });
    const deadZone = detectAllPathologies(ctx).find((p) => p.id === "dead_zone");
    expect(deadZone?.detected).toBe(true);
    expect(deadZone?.affected_objects).toContain("C");
  });
});

function makeTestContext(overrides: Partial<PathologyContext> = {}): PathologyContext {
  // ... factory function
}
```

4. **Тесты для route** (integration):
```ts
// src/app/api/v1/balance/analyze/__tests__/route.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";

describe("POST /api/v1/balance/analyze", () => {
  it("returns 422 for 0 objects", async () => {
    const res = await fetch("/api/v1/balance/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: "test", objects: [] }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 for 1 object", async () => {
    const res = await fetch("/api/v1/balance/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: "test",
        objects: [{ id: "1", name: "A", type: "x", attributes: { power: 10 } }],
      }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 200 for 2 valid objects with deterministic seed", async () => {
    const res = await fetch("/api/v1/balance/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: "test",
        objects: [
          { id: "1", name: "A", type: "x", attributes: { power: 10 }, cost: 100 },
          { id: "2", name: "B", type: "x", attributes: { power: 20 }, cost: 200 },
        ],
        seed: 42,
        use_ai: false,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.balance_map).toBeDefined();
    expect(data.transitive_result).toBeDefined();
    expect(data.monte_carlo_result.config.seed).toContain("mulberry32:42");
  });

  it("returns identical results for same seed", async () => {
    const body = JSON.stringify({
      project_id: "test",
      objects: [
        { id: "1", name: "A", type: "x", attributes: { power: 10 }, cost: 100 },
        { id: "2", name: "B", type: "x", attributes: { power: 20 }, cost: 200 },
      ],
      seed: 42,
      use_ai: false,
    });
    const res1 = await fetch("/api/v1/balance/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const res2 = await fetch("/api/v1/balance/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data1 = await res1.json();
    const data2 = await res2.json();
    expect(data1.monte_carlo_result.win_rates).toEqual(data2.monte_carlo_result.win_rates);
  });
});
```

5. **Запуск тестов**:
```bash
bun test src/lib/balance/ src/app/api/v1/balance/
```

**Тест-кейсы**: см. выше.

**Риски**:
- **Integration tests require running server + DB**. Митигация: использовать `bun:test` с in-memory DB или mock `db` module.
- **Nash solver tests may be flaky** due to floating-point precision. Митигация: `toBeCloseTo(value, 1)` для допуска 0.1.

**Dependencies**: TASK-4.5 (Nash solver), TASK-4.7 (Machinations), TASK-4.9 (pathologies), TASK-4.15 (validation).

---

## Фазы реализации

### Фаза 1: Unblock pipeline test (4-6 часов)
1. **TASK-4.1** — починить `run_pipeline_test.sh` (S, 🔴) — разблокирует end-to-end тестирование.
2. **TASK-4.15** — валидация objects (S, 🟡) — защита от некорректных данных.
3. **TASK-4.17** — убрать dead code + type bypasses (S, 🟢) — cleanup.

### Фаза 2: Pipeline runner (15-20 часов)
4. **TASK-4.2** — derives objects from upstream (L, 🔴) — каждый проект получает свои объекты.

### Фаза 3: Transitive analysis (15-20 часов)
5. **TASK-4.3** — 7 Schreiber curves (M, 🔴) — Bible 5.4.3 compliance.
6. **TASK-4.4** — weighted attribute importance (M, 🔴) — Bible 5.5.3.
7. **TASK-4.13** — fulcrum O(n) reference (M, 🟡) — Bible 5.5.2.

### Фаза 4: Intransitive analysis (20-30 часов)
8. **TASK-4.5** — real Nash + убрать cyclicalBias (L, 🔴) — Bible 5.3.2.

### Фаза 5: Monte Carlo (10-15 часов)
9. **TASK-4.6** — deterministic MC + clamp + Spearman (M, 🔴) — воспроизводимость.

### Фаза 6: Machinations + Stability (20-30 часов)
10. **TASK-4.7** — Machinations graph from object types (L, 🔴) — Bible 5.6.
11. **TASK-4.8** — починить `buildStability` (S, 🔴) — убрать type cast.
12. **TASK-4.16** — 6 combinations sum × OS (M, 🟢) — Bible 5.6.2.

### Фаза 7: Pathologies (15-20 часов)
13. **TASK-4.9** — 8 pathologies (XL, 🔴) — Bible 5.13.

### Фаза 8: AI + persistence (8-12 часов)
14. **TASK-4.10** — persist ai_insights (M, 🔴).
15. **TASK-4.11** — расширенный enrichBalance prompt (S, 🟡).
16. **TASK-4.12** — унифицировать DB persistence + GET (M, 🟡).

### Фаза 9: Advanced analytics (10-15 часов)
17. **TASK-4.14** — Markov chains + recursive EV (L, 🟡) — Bible 5.8.

### Фаза 10: Tests (10-15 часов)
18. **TASK-4.18** — unit-тесты (L, 🟢).

**Итого**: 130-180 часов (без тестов), 140-195 часов (с тестами).

---

## Метрики успеха (definition of done)

После выполнения всех 18 задач:

1. **Pipeline test success**:
   - Все 10 `test_projects/*/04_balance.json` содержат полный `FullBalanceResponse` (не 422-ошибка).
   - 10 test_projects имеют **разные** `transitive_result`, `intransitive_result`, `monte_carlo_result` (зависят от genre и upstream).
   - `ai_insights` сохраняется в БД, доступно через GET endpoint.

2. **Bible compliance**:
   - 7 Schreiber curves реализованы (Bible 5.4.3). Default: `triangular`.
   - Weighted attribute importance (Bible 5.5.3) — `damage` weight > `speed` weight для combat objects.
   - Fulcrum O(n) reference (Bible 5.5.2) — выбирается median tier/median cost.
   - Real Nash equilibrium через Gaussian elimination (Bible 5.3.2).
   - 8 pathologies детектируются (Bible 5.13) — `pathologies_catalog` содержит все 8 с `detected: true/false`.
   - 6 combinations sum × OS анализируются (Bible 5.6.2).
   - Markov chains и recursive EV реализованы (Bible 5.8).
   - 8 feedback loop characteristics (Bible 5.6.1) в `FeedbackLoop.characteristics`.

3. **Determinism**:
   - Monte Carlo с одинаковым `seed` возвращает идентичные результаты.
   - `matchup_matrix`, `win_rates`, `balance_verdict` воспроизводимы.
   - `Math.random()` не используется в route.ts (только `mulberry32`).

4. **Type safety**:
   - `tsc --noUnusedLocals --noEmit` exit code 0.
   - `eslint src/app/api/v1/balance/` exit code 0.
   - Нет `as unknown as` casts в route.ts.
   - Нет `void` statements.

5. **Data integrity**:
   - Все поля `FullBalanceResponse` сохраняются в БД (через отдельные колонки или `fullResult`).
   - GET endpoint возвращает согласованные типы (no `[]` fallback for object fields).
   - `ai_insights` персистится.

6. **Test coverage**:
   - `bun test src/lib/balance/ src/app/api/v1/balance/` проходит без failures.
   - Coverage ≥80% для `src/lib/balance-*.ts`.

7. **Regression test**:
   - После рефакторинга повторно запустить `scripts/run_pipeline_test.sh` и сравнить 10 `04_balance.json` файлов — они должны быть валидными JSON с разными `transitive_result.objects` (раньше все 10 содержали 422-ошибку).

---

## Связанные задачи из других блоков

- **TASK-1.1 (Block 1)** — MechanicsDB `genre_affinity` — не критично для Block 4, но `run-full-pipeline` может использовать для генерации более релевантных balance objects (TASK-4.2).
- **TASK-2.x (Block 2)** — persist `ai_insights` pattern — reference для TASK-4.10.
- **TASK-3.6 (Block 3)** — load `concept.aestheticProfile` — опционально для TASK-4.2 (genre inference from concept).
- **TASK-3.16 (Block 3)** — `machinationsModel` graph — Block 4 может использовать как skeleton для Machinations (TASK-4.7). Coordinate.
- **Block 5 (Economy)** — должен использовать `machinations_result` из Block 4 как input для economy simulation.
- **Block 6b (Checklist)** — `runBalanceCheck` правила могут быть расширены с использованием реальных данных после рефакторинга Block 4.

---

## Приложение A: Сводная таблица задач

| ID | Сложность | Приоритет | Файлы | Краткое описание |
|----|-----------|-----------|-------|------------------|
| TASK-4.1 | S | 🔴 | `run_pipeline_test.sh` | `elements` → `objects`, 2+ объектов, правильный shape |
| TASK-4.2 | L | 🔴 | `run-full-pipeline`, `balance-objects-generator.ts` | Derive objects from upstream (genre, mechanics) |
| TASK-4.3 | M | 🔴 | `constants/balance.ts`, route.ts | 7 Schreiber curves (Bible 5.4.3) |
| TASK-4.4 | M | 🔴 | `constants/balance.ts`, route.ts | Weighted attribute importance (Bible 5.5.3) |
| TASK-4.5 | L | 🔴 | route.ts, `balance-nash.ts` | Real Nash + убрать cyclicalBias (Bible 5.3.2) |
| TASK-4.6 | M | 🔴 | route.ts | Deterministic MC (mulberry32) + clamp + Spearman |
| TASK-4.7 | L | 🔴 | route.ts, types | Machinations graph from object types (Bible 5.6) |
| TASK-4.8 | S | 🔴 | route.ts | Починить `buildStability` — убрать `as unknown as` |
| TASK-4.9 | XL | 🔴 | `balance-pathologies.ts` | 8 pathologies (Bible 5.13) |
| TASK-4.10 | M | 🔴 | schema, route.ts, GET route | Persist `ai_insights` в БД |
| TASK-4.11 | S | 🟡 | `ai-service.ts` | Расширенный `enrichBalance` prompt |
| TASK-4.12 | M | 🟡 | route.ts, GET route | Унифицировать DB persistence + GET fallbacks |
| TASK-4.13 | M | 🟡 | `balance-fulcrum.ts` | Fulcrum O(n) reference (Bible 5.5.2) |
| TASK-4.14 | L | 🟡 | `balance-markov.ts` | Markov chains + recursive EV (Bible 5.8) |
| TASK-4.15 | S | 🟡 | route.ts | Валидация objects (count, numeric, unique IDs) |
| TASK-4.16 | M | 🟢 | `balance-feedback.ts` | 6 combinations sum × OS (Bible 5.6.2) |
| TASK-4.17 | S | 🟢 | route.ts | Убрать dead code + type bypasses |
| TASK-4.18 | L | 🟢 | `__tests__/` | Unit-тесты для balance модулей |

**Итого**: 18 задач (9 🔴 + 5 🟡 + 4 🟢), 130-180 часов (без тестов), 140-195 часов (с тестами).

---

## Приложение B: Подтверждённые находки (цитаты кода)

### B.1: `elements` vs `objects` bug

`scripts/run_pipeline_test.sh:114`:
```bash
-d "{\"project_id\":\"$PID\",\"elements\":[{\"name\":\"sword\",\"cost\":100,\"power\":50}],\"use_ai\":true}" \
```

`src/app/api/v1/balance/analyze/route.ts:822,834`:
```ts
const objectsRaw: unknown = body?.objects;
// ...
if (!Array.isArray(objectsRaw) || objectsRaw.length < 2) {
  return VALIDATION_ERROR(
    "Поле 'objects' обязательно и должно содержать минимум 2 объекта"
  );
}
```

`test_projects/*/04_balance.json` (все 10):
```json
{"detail":"Поле 'objects' обязательно и должно содержать минимум 2 объекта"}
```

### B.2: Hardcoded cost-power curve

`src/app/api/v1/balance/analyze/route.ts:135,139`:
```ts
const costCurveModel = "power = 0.6 * cost^0.8";
// ...
const expectedPower = 0.6 * Math.pow(p.effective_cost, 0.8);
```

### B.3: Artificial cyclicalBias

`src/app/api/v1/balance/analyze/route.ts:242`:
```ts
const cyclicalBias = ((j - i + n) % n === 1 ? 0.4 : (i - j + n) % n === 1 ? -0.4 : 0);
```

### B.4: Fake Nash equilibrium

`src/app/api/v1/balance/analyze/route.ts:272-274`:
```ts
const nash: number[] = hasDominant
  ? names.map((name) => (dominatedStrategies.includes(name) ? 0 : 1 / (n - dominatedStrategies.length)))
  : names.map(() => 1 / n);
```

### B.5: `Math.random()` in Monte Carlo

`src/app/api/v1/balance/analyze/route.ts:442-444,452,465`:
```ts
const i = Math.floor(Math.random() * n);
let j = Math.floor(Math.random() * n);
while (j === i) j = Math.floor(Math.random() * n);
// ...
const iWins = Math.random() < winProb;
const duration = Math.round(60 + (10 / Math.max(1, iSpeed + jSpeed)) * 50 + (Math.random() - 0.5) * 20);
```

### B.6: Hardcoded HP/damage nodes in Machinations

`src/app/api/v1/balance/analyze/route.ts:602-603`:
```ts
nodes.push({ id: "hp", name: "HP", type: "pool", value: 100, capacity: 200 });
nodes.push({ id: "damage", name: "Damage", type: "source", value: 10 });
```

### B.7: Type cast in `buildStability`

`src/app/api/v1/balance/analyze/route.ts:897-905`:
```ts
const stability = buildStability(
  machinationsResult as unknown as {
    aggregated: { ... };
    quality: { critical_issues: string[] };
    detected_pathologies: string[];
    feedback_loops: Array<{ type: string }>;
  },
  transitiveResult
);
```

### B.8: AI enrichment AFTER persist

`src/app/api/v1/balance/analyze/route.ts:1000,1044-1056`:
```ts
// line 1000 — DB persist (no ai_insights)
await db.projectBalanceResult.upsert({ ... });

// line 1044-1056 — AI enrichment AFTER persist
if (useAi) {
  const aiInsights = await enrichBalance({ ... });
  if (aiInsights) {
    result.ai_insights = aiInsights;  // only in HTTP response
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
```

### B.9: Dead code

`src/app/api/v1/balance/analyze/route.ts:1041-1042`:
```ts
// safeJsonParse is imported but unused — satisfy linter
void safeJsonParse;
```

### B.10: `runs: 10` is a lie

`src/app/api/v1/balance/analyze/route.ts:661-681,737`:
```ts
// Only 1 simulation per object (50 ticks each):
for (const o of objects) {
  // ...
  for (let t = 1; t < ticks; t++) {
    // ...
  }
}

// But return claims 10 runs:
return {
  // ...
  runs: 10,  // ← hardcoded, but actual = 1
};
```

---

*Конец плана.*
