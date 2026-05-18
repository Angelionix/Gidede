# Golden Dataset для AI-промптов Gidede

> **TD-012 / DEFERRED-005** — Формализованный тестовый набор для валидации AI-промптов

## Назначение

Golden dataset — это набор эталонных входов и ожидаемых выходов для ключевых AI-промптов проекта Gidede. Используется для:

1. **Регрессионного тестирования** — при изменении промптов проверяем, что качество ответов не деградирует
2. **A/B тестирования** — сравнение двух версий промпта на одних и тех же входах
3. **CI/CD интеграции** — автоматическая проверка при каждом коммите
4. **Документирования** — описание ожидаемого поведения AI-сервиса

## Формат файлов

### `sample_prompt_inputs.json`

Содержит эталонные данные для 6 ключевых промптов:

| Промпт | Количество примеров | Описание |
|--------|---------------------|----------|
| `CLASSIFY_GENRE` | 3 | Классификация жанра по идее |
| `EXTRACT_AESTHETICS` | 3 | Извлечение эстетик ЛеБланка |
| `SUGGEST_DYNAMICS` | 3 | Генерация динамик |
| `GENERATE_CORE_LOOPS` | 2 | Генерация вариантов Core Loop |
| `VALIDATE_TRIANGLE` | 2 | Валидация через Triangle of Weirdness |
| `ASSEMBLE_ONE_PAGER` | 2 | Сборка One-Pager |

Структура каждого примера:

```json
{
  "id": "уникальный-идентификатор",
  "input": {
    // Параметры, передаваемые в промпт (соответствуют PromptSpec.inputs)
  },
  "expected_output": {
    // Ожидаемые характеристики выхода (не точный ответ, а критерии проверки)
  }
}
```

### `sample_mda_inputs.json`

Содержит эталонные данные для полного MDA-пайплайна (алгоритм 3.3, Этапы 1-6):

| Пример | Жанр | Эстетики | Описание |
|--------|------|----------|----------|
| `mda-001` | RPG/roguelike | Fantasy, Discovery, Expression | Алхимик-крафтер |
| `mda-002` | Action/FPS | Challenge, Sensation, Fellowship | Командный шутер |
| `mda-003` | Simulation/city-builder | Expression, Submission, Discovery | Градостроительный симулятор |

Структура каждого примера:

```json
{
  "id": "mda-XXX",
  "name": "описательное название",
  "input": {
    "genre": "...",
    "subgenre": "...",
    "aesthetics": [...],
    "mechanics": [...],
    "concept_summary": "..."
  },
  "expected_stages": {
    "stage1_extract_dynamics": { ... },
    "stage2_suggest_mechanics": { ... },
    "stage3_build_aesthetic_profile": { ... },
    "stage4_classic_mda_pass": { ... },
    "stage5_validate_lenses": { ... },
    "stage6_validate_bond_matrix": { ... }
  }
}
```

## Правила использования

### Добавление новых примеров

1. Каждый новый пример получает уникальный `id` (префикс + номер: `cg-004`, `mda-004`)
2. `input` должен соответствовать `PromptSpec.inputs` из `app/prompts/registry.py`
3. `expected_output` описывает **критерии проверки**, а не точный ответ (AI ответы вариативны)
4. Используйте `*_range` для числовых значений и `expected_keywords` для текстовых

### Запуск тестов

```bash
# Ручная проверка через pytest (требуется работающий AI-сервис)
pytest tests/test_golden_dataset.py -v

# Проверка формата JSON
python -c "import json; json.load(open('tests/golden_dataset/sample_prompt_inputs.json'))"
python -c "import json; json.load(open('tests/golden_dataset/sample_mda_inputs.json'))"
```

### Критерии валидации

| Поле | Тип проверки |
|------|-------------|
| `confidence_range` | AI-ответ confidence ∈ [min, max] |
| `expected_keywords` | Хотя бы 1 ключевое слово присутствует в ответе |
| `min_*_count` | Количество элементов ≥ min |
| `must_contain` | Все указанные ключи присутствуют в JSON-ответе |
| `score_range` | Значение score ∈ [min, max] |

## Расширение

По мере развития проекта:
- Добавлять примеры для промптов Блоков 4-6 (баланс, экономика, GDD)
- Расширять `expected_output` до более точных критериев
- Создавать отдельные файлы для edge cases и негативных тестов
