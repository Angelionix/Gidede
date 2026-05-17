"""
Gidede — Базовый класс AI-провайдера
Фаза 4.A.7: Унифицированный интерфейс для всех AI-провайдеров
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class AIResponse:
    """Унифицированный ответ от AI-провайдера."""
    content: str                                  # Текстовый ответ
    model: str                                    # Использованная модель
    provider: str                                 # Имя провайдера (zai/ollama/openai/anthropic)
    tokens_input: int = 0                         # Входные токены
    tokens_output: int = 0                        # Выходные токены
    cost_usd: float = 0.0                         # Стоимость вызова
    latency_ms: int = 0                           # Латентность в мс
    finish_reason: Optional[str] = None           # Причина завершения
    raw_response: Optional[dict] = field(default=None, repr=False)  # Сырой ответ API


@dataclass
class ProviderConfig:
    """Конфигурация провайдера."""
    provider_name: str                            # zai / ollama / openai / anthropic
    is_available: bool = False                    # Доступен ли провайдер
    priority: int = 0                             # Приоритет (0 = высший)
    max_retries: int = 2                          # Максимум повторных попыток
    timeout_seconds: int = 30                     # Таймаут одного вызова
    default_temperature: float = 0.7              # Температура по умолчанию
    default_max_tokens: int = 2048                # Максимум выходных токенов
    supports_json_mode: bool = False              # Поддерживает ли JSON-режим
    supports_system_prompt: bool = True           # Поддерживает ли system prompt
    rate_limit_rpm: int = 60                      # Лимит запросов в минуту


class AIProvider(ABC):
    """
    Абстрактный базовый класс для AI-провайдера.
    Каждый провайдер должен реализовать метод generate().
    """

    def __init__(self, config: ProviderConfig):
        self.config = config

    @property
    def name(self) -> str:
        return self.config.provider_name

    @property
    def is_available(self) -> bool:
        return self.config.is_available

    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: Optional[str] = None,
    ) -> AIResponse:
        """
        Генерация ответа от AI модели.

        Args:
            messages: Список сообщений [{"role": "system"|"user"|"assistant", "content": "..."}]
            model: Имя модели (если None — используется default)
            temperature: Температура генерации
            max_tokens: Максимум выходных токенов
            response_format: "json" для JSON-режима

        Returns:
            AIResponse с текстовым ответом и метаданными
        """
        ...

    @abstractmethod
    async def check_availability(self) -> bool:
        """Проверка доступности провайдера."""
        ...

    @abstractmethod
    def get_available_models(self) -> list[str]:
        """Список доступных моделей."""
        ...

    @abstractmethod
    def get_default_model(self, task_type: str) -> str:
        """Модель по умолчанию для типа задачи."""
        ...

    def build_messages(
        self,
        system_prompt: str,
        context_prompt: str,
        task_prompt: str,
    ) -> list[dict[str, str]]:
        """
        Сборка сообщений из трёхслойной архитектуры промптов.
        Слой 1: System Prompt (статичный)
        Слой 2: Context Prompt (из Project State)
        Слой 3: Task Prompt (специфичный для промпта)
        """
        messages = []

        if self.config.supports_system_prompt:
            messages.append({
                "role": "system",
                "content": f"{system_prompt}\n\n{context_prompt}",
            })
            messages.append({
                "role": "user",
                "content": task_prompt,
            })
        else:
            # Для провайдеров без system prompt — объединяем всё в user
            messages.append({
                "role": "user",
                "content": f"{system_prompt}\n\n{context_prompt}\n\n{task_prompt}",
            })

        return messages
