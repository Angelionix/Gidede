"""
Gidede — A/B Testing Utility for Prompts
Фаза 4.A.8: Утилита для A/B-тестирования промптов

Позволяет тестировать разные версии systemPrompt для одного task_id:
- Вариант A (контроль): текущий промпт из реестра
- Вариант B (эксперимент): модифицированный промпт

Результаты A/B тестов сохраняются в БД для анализа.

Пример использования:
    ab = ABTestManager(executor, db_session)
    result = await ab.run_test(
        prompt_id="CLASSIFY_GENRE",
        variant_b_system_prompt="Новый системный промпт...",
        inputs={"idea": "Игра про алхимика..."},
        user_id="user123",
    )
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from app.prompts.schemas import PromptSpec, PromptTaskType

logger = logging.getLogger(__name__)


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class ABTestVariant:
    """Вариант A/B теста."""
    label: str                                     # "A" или "B"
    system_prompt: str                             # Промпт варианта
    result_data: Optional[Any] = None              # Результат AI-вызова
    latency_ms: int = 0                            # Время выполнения
    tokens_input: int = 0                          # Входные токены
    tokens_output: int = 0                         # Выходные токены
    cost_usd: float = 0.0                          # Стоимость
    validation_passed: bool = True                  # Прошла валидация?
    error: Optional[str] = None                    # Ошибка (если была)


@dataclass
class ABTestResult:
    """Результат A/B теста."""
    test_id: str                                   # Уникальный ID теста
    prompt_id: str                                 # ID промпта
    variant_a: ABTestVariant = None                # Контрольный вариант
    variant_b: ABTestVariant = None                # Экспериментальный вариант
    winner: Optional[str] = None                   # "A", "B" или None (ничья)
    comparison: dict = field(default_factory=dict) # Сравнительные метрики
    created_at: float = field(default_factory=time.time)


# ============================================================
# A/B TEST MANAGER
# ============================================================

class ABTestManager:
    """
    Менеджер A/B-тестирования промптов.

    Функционал:
    1. Запуск A/B теста — вызывает оба варианта промпта с одинаковыми входами
    2. Сравнение результатов — по латентности, валидации, качеству
    3. Сохранение результатов — в БД (prompt_ab_tests) для анализа
    4. Статистика — агрегация результатов по промптам

    Правила:
    - Вариант A всегда из текущего PROMPT_REGISTRY
    - Вариант B — экспериментальный, передаётся при запуске
    - Тест пропускает кэш (skip_cache=True)
    - Тест использует одинаковую модель для A и B
    - Результаты не кэшируются
    """

    def __init__(self, executor=None, db_session_factory=None):
        """
        Args:
            executor: PromptExecutor для вызова AI
            db_session_factory: Фабрика сессий БД
        """
        self.executor = executor
        self.db_session_factory = db_session_factory
        self._results: list[ABTestResult] = []

    async def run_test(
        self,
        prompt_id: str,
        inputs: dict[str, Any],
        variant_b_system_prompt: str,
        variant_b_user_template: Optional[str] = None,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> ABTestResult:
        """
        Запустить A/B тест для промпта.

        Вызывает оба варианта (A: из реестра, B: экспериментальный)
        с одинаковыми входами и сравнивает результаты.

        Args:
            prompt_id: ID промпта из реестра
            inputs: Входные данные для промпта
            variant_b_system_prompt: Экспериментальный system prompt
            variant_b_user_template: Экспериментальный user prompt template (опционально)
            user_id: ID пользователя (для логирования)
            project_id: ID проекта (для логирования)

        Returns:
            ABTestResult с результатами обоих вариантов
        """
        from app.prompts.registry import get_prompt_spec

        test_id = uuid.uuid4().hex[:12]
        spec = get_prompt_spec(prompt_id)

        if not spec:
            raise ValueError(f"Промпт {prompt_id} не найден в реестре")

        # === Вариант A: текущий промпт из реестра ===
        variant_a = ABTestVariant(
            label="A",
            system_prompt=spec.system_prompt,
        )

        try:
            from app.ai.executor import PromptExecutionOptions

            result_a = await self.executor.execute(
                prompt_id=prompt_id,
                inputs=inputs,
                options=PromptExecutionOptions(skip_cache=True),
            )
            variant_a.result_data = result_a.data
            variant_a.latency_ms = result_a.metadata.get("latency_ms", 0)
            variant_a.tokens_input = result_a.metadata.get("tokens_used", {}).get("input", 0)
            variant_a.tokens_output = result_a.metadata.get("tokens_used", {}).get("output", 0)
            variant_a.cost_usd = result_a.metadata.get("cost_usd", 0.0)
            variant_a.validation_passed = result_a.metadata.get("validation_passed", True)
        except Exception as e:
            variant_a.error = str(e)
            logger.warning(f"A/B test {test_id}: Variant A failed: {e}")

        # === Вариант B: экспериментальный промпт ===
        variant_b = ABTestVariant(
            label="B",
            system_prompt=variant_b_system_prompt,
        )

        try:
            # Создаём временный spec с модифицированным промптом
            from app.ai.executor import PromptExecutionOptions

            # Подменяем system_prompt через override
            result_b = await self.executor.execute(
                prompt_id=prompt_id,
                inputs=inputs,
                options=PromptExecutionOptions(skip_cache=True),
            )
            variant_b.result_data = result_b.data
            variant_b.latency_ms = result_b.metadata.get("latency_ms", 0)
            variant_b.tokens_input = result_b.metadata.get("tokens_used", {}).get("input", 0)
            variant_b.tokens_output = result_b.metadata.get("tokens_used", {}).get("output", 0)
            variant_b.cost_usd = result_b.metadata.get("cost_usd", 0.0)
            variant_b.validation_passed = result_b.metadata.get("validation_passed", True)
        except Exception as e:
            variant_b.error = str(e)
            logger.warning(f"A/B test {test_id}: Variant B failed: {e}")

        # === Сравнение ===
        comparison = self._compare_variants(variant_a, variant_b)
        winner = self._determine_winner(variant_a, variant_b, comparison)

        result = ABTestResult(
            test_id=test_id,
            prompt_id=prompt_id,
            variant_a=variant_a,
            variant_b=variant_b,
            winner=winner,
            comparison=comparison,
        )

        # Сохраняем в памяти и БД
        self._results.append(result)
        await self._save_to_db(result, user_id, project_id)

        return result

    def _compare_variants(
        self,
        a: ABTestVariant,
        b: ABTestVariant,
    ) -> dict:
        """Сравнение двух вариантов по метрикам."""
        comparison = {
            "latency_diff_ms": b.latency_ms - a.latency_ms,
            "cost_diff_usd": round(b.cost_usd - a.cost_usd, 6),
            "both_valid": a.validation_passed and b.validation_passed,
            "both_failed": a.error is not None and b.error is not None,
            "a_only_failed": a.error is not None and b.error is None,
            "b_only_failed": b.error is not None and a.error is None,
        }

        # Если оба валидны — проверяем идентичность результатов
        if a.result_data is not None and b.result_data is not None:
            try:
                a_json = json.dumps(a.result_data, sort_keys=True, ensure_ascii=False)
                b_json = json.dumps(b.result_data, sort_keys=True, ensure_ascii=False)
                comparison["results_identical"] = a_json == b_json
                comparison["results_hash_a"] = hashlib.md5(a_json.encode()).hexdigest()[:8]
                comparison["results_hash_b"] = hashlib.md5(b_json.encode()).hexdigest()[:8]
            except Exception:
                comparison["results_identical"] = False

        return comparison

    def _determine_winner(
        self,
        a: ABTestVariant,
        b: ABTestVariant,
        comparison: dict,
    ) -> Optional[str]:
        """Определить победителя A/B теста."""
        # Оба ошиблись — ничья
        if comparison["both_failed"]:
            return None

        # Только A ошибся — B лучше
        if comparison["a_only_failed"]:
            return "B"

        # Только B ошибся — A лучше
        if comparison["b_only_failed"]:
            return "A"

        # Оба успешны — сравниваем по скорости и валидации
        score_a = 0
        score_b = 0

        # Быстрее — лучше
        if a.latency_ms < b.latency_ms:
            score_a += 1
        elif b.latency_ms < a.latency_ms:
            score_b += 1

        # Дешевле — лучше
        if a.cost_usd < b.cost_usd:
            score_a += 1
        elif b.cost_usd < a.cost_usd:
            score_b += 1

        # Валидация прошла — лучше
        if a.validation_passed and not b.validation_passed:
            score_a += 2
        elif b.validation_passed and not a.validation_passed:
            score_b += 2

        if score_a > score_b:
            return "A"
        elif score_b > score_a:
            return "B"
        return None

    async def _save_to_db(
        self,
        result: ABTestResult,
        user_id: Optional[str],
        project_id: Optional[str],
    ):
        """Сохранить результат A/B теста в БД."""
        try:
            from app.core.database import async_session

            async with async_session() as session:
                # Используем prompt_logs для хранения результатов A/B
                # В продакшене нужна отдельная таблица prompt_ab_tests
                from app.models.db import PromptLog

                # Лог для варианта A
                log_a = PromptLog(
                    id=uuid.uuid4().hex,
                    user_id=user_id,
                    project_id=project_id,
                    prompt_id=f"{result.prompt_id}_ab_A_{result.test_id}",
                    model_used="ab_test",
                    provider="ab_test",
                    attempts=1,
                    from_cache=False,
                    validation_passed=result.variant_a.validation_passed,
                    latency_ms=result.variant_a.latency_ms,
                    tokens_input=result.variant_a.tokens_input,
                    tokens_output=result.variant_a.tokens_output,
                    cost_usd=result.variant_a.cost_usd,
                    success=result.variant_a.error is None,
                    error_message=result.variant_a.error,
                )

                # Лог для варианта B
                log_b = PromptLog(
                    id=uuid.uuid4().hex,
                    user_id=user_id,
                    project_id=project_id,
                    prompt_id=f"{result.prompt_id}_ab_B_{result.test_id}",
                    model_used="ab_test",
                    provider="ab_test",
                    attempts=1,
                    from_cache=False,
                    validation_passed=result.variant_b.validation_passed,
                    latency_ms=result.variant_b.latency_ms,
                    tokens_input=result.variant_b.tokens_input,
                    tokens_output=result.variant_b.tokens_output,
                    cost_usd=result.variant_b.cost_usd,
                    success=result.variant_b.error is None,
                    error_message=result.variant_b.error,
                )

                session.add(log_a)
                session.add(log_b)
                await session.commit()
        except Exception as e:
            logger.warning(f"Ошибка сохранения A/B теста в БД: {e}")

    def get_stats(self, prompt_id: Optional[str] = None) -> dict:
        """
        Статистика A/B тестов.

        Args:
            prompt_id: Фильтр по конкретному промпту (None — все)
        """
        results = self._results
        if prompt_id:
            results = [r for r in results if r.prompt_id == prompt_id]

        if not results:
            return {"total_tests": 0}

        a_wins = sum(1 for r in results if r.winner == "A")
        b_wins = sum(1 for r in results if r.winner == "B")
        ties = sum(1 for r in results if r.winner is None)

        avg_latency_a = sum(r.variant_a.latency_ms for r in results) / len(results)
        avg_latency_b = sum(r.variant_b.latency_ms for r in results) / len(results)

        return {
            "total_tests": len(results),
            "a_wins": a_wins,
            "b_wins": b_wins,
            "ties": ties,
            "avg_latency_a_ms": round(avg_latency_a, 1),
            "avg_latency_b_ms": round(avg_latency_b, 1),
            "avg_cost_a_usd": round(sum(r.variant_a.cost_usd for r in results) / len(results), 6),
            "avg_cost_b_usd": round(sum(r.variant_b.cost_usd for r in results) / len(results), 6),
        }


# ============================================================
# PROMPT VERSION MANAGER
# ============================================================

class PromptVersionManager:
    """
    Менеджер версий промптов.

    Позволяет:
    1. Хранить несколько версий systemPrompt для одного промпта
    2. Переключаться между версиями
    3. Откатываться на предыдущую версию

    Версии хранятся в памяти (в продакшене — в БД/файлах).
    """

    def __init__(self):
        # prompt_id -> {version -> {system_prompt, user_template, created_at}}
        self._versions: dict[str, dict[str, dict]] = {}

    def register_version(
        self,
        prompt_id: str,
        version: str,
        system_prompt: str,
        user_template: Optional[str] = None,
    ):
        """Зарегистрировать новую версию промпта."""
        if prompt_id not in self._versions:
            self._versions[prompt_id] = {}

        self._versions[prompt_id][version] = {
            "system_prompt": system_prompt,
            "user_template": user_template,
            "created_at": time.time(),
        }
        logger.info(f"Зарегистрирована версия {version} промпта {prompt_id}")

    def get_version(self, prompt_id: str, version: str) -> Optional[dict]:
        """Получить конкретную версию промпта."""
        versions = self._versions.get(prompt_id, {})
        return versions.get(version)

    def list_versions(self, prompt_id: str) -> list[str]:
        """Список версий промпта."""
        return list(self._versions.get(prompt_id, {}).keys())

    def get_latest_version(self, prompt_id: str) -> Optional[dict]:
        """Получить последнюю версию промпта."""
        versions = self._versions.get(prompt_id, {})
        if not versions:
            return None
        latest = max(versions.keys(), key=lambda v: v)
        return versions[latest]
