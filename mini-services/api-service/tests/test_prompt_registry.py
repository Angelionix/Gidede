"""
Gidede — Тесты реестра промптов
Фаза 4.A.11: Локальная тестовая инфраструктура

Тестирует:
- PROMPT_REGISTRY: все 31 промпт зарегистрированы
- get_prompt_spec(): получение спецификации по ID
- PromptSpec: валидация структуры
"""

import pytest
from app.prompts.registry import PROMPT_REGISTRY, get_prompt_spec, get_prompts_by_module, get_registry_stats


class TestPromptRegistry:
    """Тесты реестра промптов."""

    def test_registry_not_empty(self):
        """Реестр не должен быть пустым."""
        assert len(PROMPT_REGISTRY) > 0

    def test_all_31_prompts_registered(self):
        """Должно быть зарегистрировано 31 промптов."""
        assert len(PROMPT_REGISTRY) == 31

    def test_get_prompt_spec_existing(self):
        """Получение существующей спецификации."""
        spec = get_prompt_spec("CLASSIFY_GENRE")
        assert spec is not None
        assert spec.id == "CLASSIFY_GENRE"

    def test_get_prompt_spec_nonexistent(self):
        """Получение несуществующей спецификации."""
        spec = get_prompt_spec("NONEXISTENT_PROMPT")
        assert spec is None

    def test_prompt_spec_has_required_fields(self):
        """Каждая спецификация должна иметь обязательные поля."""
        required_fields = ["id", "module", "task_type", "output_format",
                          "system_prompt", "user_prompt_template",
                          "model_requirements", "guarantees"]

        for prompt_id, spec in PROMPT_REGISTRY.items():
            for field in required_fields:
                assert hasattr(spec, field), f"Промпт {prompt_id} не имеет поля {field}"

    def test_get_prompts_by_module(self):
        """Фильтрация промптов по модулю."""
        concept_prompts = get_prompts_by_module("concept")
        assert len(concept_prompts) > 0

    def test_registry_stats(self):
        """Статистика реестра."""
        stats = get_registry_stats()
        assert "total_prompts" in stats
        assert stats["total_prompts"] == 31

    def test_known_prompt_ids(self):
        """Проверка ключевых промптов."""
        expected_ids = [
            "CLASSIFY_GENRE",
            "EXTRACT_AESTHETICS",
            "SUGGEST_DYNAMICS",
            "SELECT_MECHANICS",
            "GENERATE_CORE_LOOPS",
            "GENERATE_USP",
            "CLASSIFY_CORE_LOOP",
            "BUILD_LOOP_HIERARCHY",
            "DIAGNOSE_PATHOLOGIES",
            "GENERATE_RECOMMENDATIONS",
            "CHAT_ASSISTANT",
        ]
        for prompt_id in expected_ids:
            assert prompt_id in PROMPT_REGISTRY, f"Промпт {prompt_id} не найден в реестре"
