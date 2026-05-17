"""
Gidede — Prompt Validator
Фаза 4.A.7: Валидация выхода AI (из спецификации 3.9.5)

Три уровня валидации:
1. Синтаксическая — парсинг JSON
2. Схемная — проверка по JSON-Schema
3. Семантическая — проверка значений

Также включает детерминированные заглушки для критичных промптов.
"""

import json
import re
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ValidationResult:
    """Результат валидации."""

    def __init__(
        self,
        is_valid: bool,
        data: Any = None,
        errors: list[str] = None,
        was_repaired: bool = False,
    ):
        self.is_valid = is_valid
        self.data = data
        self.errors = errors or []
        self.was_repaired = was_repaired


class PromptValidator:
    """
    Валидатор выхода AI.

    Алгоритм (из спецификации 3.9.5):
    1. Синтаксическая валидация — JSON-парсинг
    2. Схемная валидация — проверка по схеме
    3. Семантическая валидация — проверка значений
    """

    # Детерминированные заглушки (из спецификации 3.9.5)
    DETERMINISTIC_FALLBACKS = {
        "CLASSIFY_GENRE": "keyword_match_genre",
        "EXTRACT_AESTHETICS": "genre_aesthetic_map",
        "ESTIMATE_WEIGHTS": "uniform_weights",
        "APPLY_LENS_MDA": "rule_based_scoring",
        "CHECK_PROGRESSION_AESTHETICS": "aesthetic_rule_table",
        "EVALUATE_SITUATIONAL_VALUE": "power_cost_ratio",
    }

    def validate_syntax(self, content: str, expected_format: str = "json") -> ValidationResult:
        """
        Шаг 1: Синтаксическая валидация.
        Попытка парсинга JSON из ответа AI.
        """
        if expected_format != "json":
            return ValidationResult(is_valid=True, data=content)

        # Прямой парсинг
        try:
            parsed = json.loads(content)
            return ValidationResult(is_valid=True, data=parsed)
        except json.JSONDecodeError:
            pass

        # Попытка извлечь JSON из markdown-обёртки
        patterns = [
            r"```json\s*\n(.*?)\n```",
            r"```\s*\n(.*?)\n```",
            r"(\{.*\})",  # Один JSON-объект
            r"(\[.*\])",  # Один JSON-массив
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group(1))
                    return ValidationResult(
                        is_valid=True,
                        data=parsed,
                        was_repaired=True,
                    )
                except json.JSONDecodeError:
                    continue

        return ValidationResult(
            is_valid=False,
            errors=["AI вернул невалидный JSON, не удалось извлечь данные"],
        )

    def validate_schema(
        self,
        data: Any,
        output_schema: Optional[dict] = None,
    ) -> ValidationResult:
        """
        Шаг 2: Схемная валидация.
        Проверка структуры данных по JSON-Schema (упрощённая).
        """
        if not output_schema:
            return ValidationResult(is_valid=True, data=data)

        errors = []

        # Проверка типа верхнего уровня
        expected_type = output_schema.get("type")
        if expected_type == "array" and not isinstance(data, list):
            errors.append(f"Ожидался array, получен {type(data).__name__}")
        elif expected_type == "object" and not isinstance(data, dict):
            errors.append(f"Ожидался object, получен {type(data).__name__}")

        # Проверка required полей (для object)
        if isinstance(data, dict) and "required" in output_schema:
            for field_name in output_schema["required"]:
                if field_name not in data:
                    errors.append(f"Отсутствует обязательное поле: {field_name}")

        # Проверка maxItems (для array)
        if isinstance(data, list) and "maxItems" in output_schema:
            if len(data) > output_schema["maxItems"]:
                errors.append(f"Превышен maxItems: {len(data)} > {output_schema['maxItems']}")

        if errors:
            return ValidationResult(is_valid=False, data=data, errors=errors)

        return ValidationResult(is_valid=True, data=data)

    def validate_semantics(
        self,
        data: Any,
        task_type: str,
        prompt_id: str,
    ) -> ValidationResult:
        """
        Шаг 3: Семантическая валидация.
        Проверка на галлюцинации и нереалистичные значения.
        """
        errors = []
        was_repaired = False

        if task_type == "classification" and isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    # Confidence должен быть 0-1
                    if "confidence" in item:
                        val = item["confidence"]
                        if not isinstance(val, (int, float)):
                            item["confidence"] = 0.5
                            was_repaired = True
                        elif val < 0 or val > 1:
                            item["confidence"] = max(0.0, min(1.0, float(val)))

        elif task_type == "evaluation" and isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "score" in item:
                    val = item["score"]
                    if not isinstance(val, (int, float)):
                        item["score"] = 0.5
                        was_repaired = True
                    elif val < 0 or val > 1:
                        item["score"] = max(0.0, min(1.0, float(val)))

        return ValidationResult(
            is_valid=len(errors) == 0,
            data=data,
            errors=errors,
            was_repaired=was_repaired,
        )

    def validate_full(
        self,
        content: str,
        expected_format: str = "json",
        output_schema: Optional[dict] = None,
        task_type: str = "",
        prompt_id: str = "",
    ) -> ValidationResult:
        """Полная валидация — синтаксическая + схемная + семантическая."""
        # Шаг 1: Синтаксическая
        syntax_result = self.validate_syntax(content, expected_format)
        if not syntax_result.is_valid:
            return syntax_result

        data = syntax_result.data
        was_repaired = syntax_result.was_repaired

        # Шаг 2: Схемная (только для JSON)
        if expected_format == "json" and output_schema:
            schema_result = self.validate_schema(data, output_schema)
            if not schema_result.is_valid:
                # Пытаемся использовать частичный результат
                logger.warning(f"Схемная валидация неуспешна: {schema_result.errors}")
                return schema_result

        # Шаг 3: Семантическая
        if expected_format == "json" and task_type:
            semantic_result = self.validate_semantics(data, task_type, prompt_id)
            data = semantic_result.data
            was_repaired = was_repaired or semantic_result.was_repaired

        return ValidationResult(
            is_valid=True,
            data=data,
            was_repaired=was_repaired,
        )

    def has_deterministic_fallback(self, prompt_id: str) -> bool:
        """Есть ли детерминированная заглушка для данного промпта."""
        return prompt_id in self.DETERMINISTIC_FALLBACKS

    def get_degraded_response(self, prompt_id: str, inputs: dict) -> Optional[Any]:
        """
        Получение детерминированной заглушки (degraded response).
        Используется когда AI полностью недоступен.
        """
        fallback_type = self.DETERMINISTIC_FALLBACKS.get(prompt_id)

        if fallback_type == "keyword_match_genre":
            return self._keyword_match_genre(inputs.get("idea", ""))

        if fallback_type == "genre_aesthetic_map":
            return self._genre_aesthetic_map(inputs.get("genre", "action"))

        if fallback_type == "uniform_weights":
            return self._uniform_weights(inputs.get("attributes", []))

        return None

    # ===== Детерминированные заглушки =====

    def _keyword_match_genre(self, idea: str) -> list[dict]:
        """Заглушка: классификация жанра по ключевым словам (~60% точность)."""
        keywords = {
            "RPG": ["ролев", "rpg", "уровн", "класс", "персонаж", "навык", "квест"],
            "Shooter": ["стреля", "shooter", "оружие", "бой", "битва", "пушка"],
            "Strategy": ["стратег", "strategy", "баз", "армия", "ресурс", "тактик"],
            "Puzzle": ["головолом", "puzzle", "загадк", "логик", "ребус"],
            "Platformer": ["платформ", "прыжок", "platformer", "уровень"],
            "Simulation": ["симулят", "simulat", "управлен", "менеджмент"],
            "Horror": ["ужас", "horror", "страх", "мрак", "зомби"],
            "Racing": ["гонк", "racing", "скорость", "авто", "машина"],
        }

        idea_lower = idea.lower()
        results = []

        for genre, words in keywords.items():
            confidence = sum(1 for w in words if w in idea_lower) / max(len(words), 1)
            if confidence > 0:
                results.append({
                    "genre": genre,
                    "subgenre": genre.lower(),
                    "confidence": min(confidence * 3, 0.85),
                    "reasoning": f"Ключевое слово совпадение для жанра {genre}",
                })

        if not results:
            results.append({
                "genre": "Action",
                "subgenre": "general",
                "confidence": 0.3,
                "reasoning": "Не удалось определить жанр по ключевым словам",
            })

        return sorted(results, key=lambda x: x["confidence"], reverse=True)[:3]

    def _genre_aesthetic_map(self, genre: str) -> list[dict]:
        """Заглушка: маппинг жанр → эстетика (~70% точность)."""
        genre_map = {
            "RPG": [
                {"aesthetic": "Fantasy", "confidence": 0.9, "reasoning": "RPG → Фантазия"},
                {"aesthetic": "Narrative", "confidence": 0.7, "reasoning": "RPG → Нарратив"},
                {"aesthetic": "Challenge", "confidence": 0.6, "reasoning": "RPG → Вызов"},
            ],
            "Shooter": [
                {"aesthetic": "Challenge", "confidence": 0.9, "reasoning": "Shooter → Вызов"},
                {"aesthetic": "Sensation", "confidence": 0.7, "reasoning": "Shooter → Чувственное"},
                {"aesthetic": "Competition", "confidence": 0.6, "reasoning": "Shooter → Товарищество"},
            ],
            "Strategy": [
                {"aesthetic": "Challenge", "confidence": 0.9, "reasoning": "Strategy → Вызов"},
                {"aesthetic": "Submission", "confidence": 0.7, "reasoning": "Strategy → Подчинение"},
                {"aesthetic": "Discovery", "confidence": 0.5, "reasoning": "Strategy → Открытие"},
            ],
        }
        return genre_map.get(genre, genre_map.get("RPG"))

    def _uniform_weights(self, attributes: list) -> dict:
        """Заглушка: равные веса атрибутов (~50% точность)."""
        if not attributes:
            return {}
        weight = 1.0 / len(attributes)
        return {attr: round(weight, 4) for attr in attributes}
