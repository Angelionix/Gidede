"""
Gidede — Prompt Router
Фаза 4.A.7: Маршрутизация промптов по провайдерам и моделям

Правила маршрутизации (из спецификации 3.9.4.2):
- classification / evaluation / recommendation → быстрая модель (Haiku/Flash/GPT-3.5)
- generation / analysis → мощная модель (Sonnet/GPT-4/GLM-4)
- input.length > 4000 tokens → мощная модель
- user premium → мощная модель всегда

Порядок провайдеров:
1. z.ai (приоритет 0) — основной для продакшена
2. Ollama (приоритет 1) — локальные/облачные модели
3. OpenAI (приоритет 2) — fallback
4. Anthropic (приоритет 3) — fallback
"""

import logging
from dataclasses import dataclass
from typing import Optional

from app.ai.providers.base import AIProvider

logger = logging.getLogger(__name__)


@dataclass
class RouteResult:
    """Результат маршрутизации — выбранный провайдер и модель."""
    provider: AIProvider
    model: str
    temperature: float
    max_tokens: int
    response_format: Optional[str] = None
    fallback_chain: list[tuple[AIProvider, str]] = None  # [(provider, model), ...]


# Маппинг типов задач на требования к модели
TASK_MODEL_REQUIREMENTS = {
    "classification": {
        "min_tier": "fast",       # Быстрая модель
        "temperature": 0.3,       # Низкая температура для детерминизма
        "max_tokens": 500,        # Короткий ответ
        "response_format": "json",
    },
    "evaluation": {
        "min_tier": "fast",
        "temperature": 0.3,
        "max_tokens": 800,
        "response_format": "json",
    },
    "recommendation": {
        "min_tier": "fast",
        "temperature": 0.5,
        "max_tokens": 1000,
        "response_format": "json",
    },
    "generation": {
        "min_tier": "powerful",   # Мощная модель
        "temperature": 0.7,       # Выше для креативности
        "max_tokens": 2048,
        "response_format": "json",
    },
    "analysis": {
        "min_tier": "powerful",
        "temperature": 0.5,
        "max_tokens": 2048,
        "response_format": "json",
    },
}


class PromptRouter:
    """
    Маршрутизатор промптов — выбирает провайдер и модель
    на основе типа задачи, доступности провайдеров и приоритетов.
    """

    def __init__(self, providers: list[AIProvider]):
        """
        Args:
            providers: Список провайдеров, отсортированных по приоритету
        """
        self.providers = sorted(providers, key=lambda p: p.config.priority)

    def route(
        self,
        task_type: str,
        user_plan: str = "free",
        override_model: Optional[str] = None,
        override_provider: Optional[str] = None,
        estimated_input_tokens: int = 0,
    ) -> RouteResult:
        """
        Маршрутизация промпта — выбор провайдера и модели.

        Args:
            task_type: Тип задачи (classification/generation/analysis/evaluation/recommendation)
            user_plan: План пользователя (free/pro)
            override_model: Переопределение модели
            override_provider: Переопределение провайдера
            estimated_input_tokens: Оценка длины входа

        Returns:
            RouteResult с выбранным провайдером, моделью и fallback-цепочкой
        """
        # Получаем требования к модели для типа задачи
        requirements = TASK_MODEL_REQUIREMENTS.get(task_type, {
            "min_tier": "powerful",
            "temperature": 0.7,
            "max_tokens": 2048,
            "response_format": None,
        })

        # Pro-пользователи всегда получают мощную модель
        if user_plan == "pro":
            requirements["min_tier"] = "powerful"

        # Длинный вход → мощная модель
        if estimated_input_tokens > 4000:
            requirements["min_tier"] = "powerful"

        # Явное переопределение провайдера
        if override_provider:
            provider = self._find_provider(override_provider)
            if provider and provider.is_available:
                model = override_model or provider.get_default_model(task_type)
                return RouteResult(
                    provider=provider,
                    model=model,
                    temperature=requirements["temperature"],
                    max_tokens=requirements["max_tokens"],
                    response_format=requirements.get("response_format"),
                    fallback_chain=self._build_fallback_chain(provider, task_type),
                )

        # Выбор основного провайдера (первый доступный)
        primary_provider = None
        primary_model = None

        for provider in self.providers:
            if not provider.is_available:
                continue
            primary_provider = provider
            primary_model = override_model or provider.get_default_model(task_type)
            break

        if not primary_provider:
            # Все провайдеры недоступны — используем первый с optimistic retry
            logger.warning("PromptRouter: все провайдеры недоступны, используем первый")
            primary_provider = self.providers[0]
            primary_model = override_model or primary_provider.get_default_model(task_type)

        return RouteResult(
            provider=primary_provider,
            model=primary_model,
            temperature=requirements["temperature"],
            max_tokens=requirements["max_tokens"],
            response_format=requirements.get("response_format"),
            fallback_chain=self._build_fallback_chain(primary_provider, task_type),
        )

    def _find_provider(self, name: str) -> Optional[AIProvider]:
        """Найти провайдер по имени."""
        for p in self.providers:
            if p.name == name:
                return p
        return None

    def _build_fallback_chain(
        self,
        primary: AIProvider,
        task_type: str,
    ) -> list[tuple[AIProvider, str]]:
        """
        Построение fallback-цепочки.
        Порядок: primary → другие провайдеры по приоритету
        """
        chain = []
        for provider in self.providers:
            if provider.name == primary.name:
                continue
            if provider.is_available:
                model = provider.get_default_model(task_type)
                chain.append((provider, model))
        return chain

    def get_routing_info(self) -> dict:
        """Информация о текущей маршрутизации (для API /health/detailed)."""
        return {
            "providers": [
                {
                    "name": p.name,
                    "available": p.is_available,
                    "priority": p.config.priority,
                    "models": p.get_available_models(),
                }
                for p in self.providers
            ],
            "task_routing": {
                task: req["min_tier"]
                for task, req in TASK_MODEL_REQUIREMENTS.items()
            },
        }
