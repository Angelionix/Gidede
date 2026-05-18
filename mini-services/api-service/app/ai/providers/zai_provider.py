"""
Gidede — ZAI Provider (z-ai-web-dev-sdk)
Фаза 4.A.7: Поддержка z.ai сервиса

z.ai — основной AI-провайдер для продакшена.
Использует z-ai-web-dev-sdk для вызовов chat completions.
Поддерживает:
- Chat completions (основной режим)
- Модели: GLM-4 и другие
- JSON-режим через инструкцию в промпте
"""

import os
import time
import json
import logging
from typing import Optional

from app.ai.providers.base import AIProvider, AIResponse, ProviderConfig

logger = logging.getLogger(__name__)


class ZAIProvider(AIProvider):
    """
    Провайдер z.ai — использует z-ai-web-dev-sdk.
    Основной провайдер для продакшена Gidede.
    """

    def __init__(self):
        config = ProviderConfig(
            provider_name="zai",
            is_available=False,  # Проверяется при инициализации
            priority=0,  # Высший приоритет
            max_retries=2,
            timeout_seconds=30,
            default_temperature=0.7,
            default_max_tokens=4096,
            supports_json_mode=True,
            supports_system_prompt=True,
            rate_limit_rpm=60,
        )
        super().__init__(config)
        self._zai = None
        self._init_sdk()

    def _init_sdk(self):
        """Инициализация z-ai-web-dev-sdk."""
        try:
            import asyncio

            # SDK — JS-пакет (z-ai-web-dev-sdk), для Python используем HTTP API
            # Проверяем наличие ключа
            api_key = os.getenv("ZAI_API_KEY", "")
            base_url = os.getenv("ZAI_BASE_URL", "https://api.z.ai/v1")

            if api_key:
                self.config.is_available = True
                self._api_key = api_key
                self._base_url = base_url
                logger.info("ZAI Provider: инициализирован (API key найден)")
            else:
                # Пробуем без ключа — z.ai может быть доступен в среде
                self._api_key = ""
                self._base_url = base_url
                self.config.is_available = True
                logger.info("ZAI Provider: инициализирован (без API key)")

        except Exception as e:
            logger.warning(f"ZAI Provider: ошибка инициализации — {e}")
            self.config.is_available = False

    async def generate(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: Optional[str] = None,
    ) -> AIResponse:
        """Генерация ответа через z.ai HTTP API."""
        import httpx

        start_time = time.time()
        model = model or "glm-4"

        # Если нужен JSON-режим, добавляем инструкцию
        if response_format == "json":
            messages = self._inject_json_instruction(messages)

        headers = {
            "Content-Type": "application/json",
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        url = f"{self._base_url}/chat/completions"

        last_error = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                    resp = await client.post(url, json=payload, headers=headers)

                    if resp.status_code == 429:
                        logger.warning(f"ZAI: rate limit, попытка {attempt}")
                        await asyncio.sleep(2 ** attempt)
                        continue

                    resp.raise_for_status()
                    data = resp.json()

                    content = data["choices"][0]["message"]["content"]
                    latency = int((time.time() - start_time) * 1000)

                    usage = data.get("usage", {})

                    return AIResponse(
                        content=content,
                        model=data.get("model", model),
                        provider="zai",
                        tokens_input=usage.get("prompt_tokens", 0),
                        tokens_output=usage.get("completion_tokens", 0),
                        cost_usd=self._estimate_cost(usage),
                        latency_ms=latency,
                        finish_reason=data["choices"][0].get("finish_reason"),
                        raw_response=data,
                    )

            except Exception as e:
                last_error = e
                logger.warning(f"ZAI: ошибка (попытка {attempt}): {e}")

        raise RuntimeError(f"ZAI Provider: все попытки исчерпаны — {last_error}")

    async def check_availability(self) -> bool:
        """Проверка доступности z.ai."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self._base_url}/models", headers={
                    "Authorization": f"Bearer {self._api_key}",
                } if self._api_key else {})
                self.config.is_available = resp.status_code == 200
                return self.config.is_available
        except Exception:
            self.config.is_available = False
            return False

    def get_available_models(self) -> list[str]:
        """Список моделей z.ai."""
        return [
            "glm-4",
            "glm-4-plus",
            "glm-4-flash",
            "glm-4-long",
            "glm-4v",
        ]

    def get_default_model(self, task_type: str) -> str:
        """Модель по умолчанию в зависимости от типа задачи."""
        model_map = {
            "classification": "glm-4-flash",    # Быстрая классификация
            "evaluation": "glm-4-flash",        # Оценка
            "recommendation": "glm-4-flash",    # Рекомендации
            "generation": "glm-4",              # Креативная генерация
            "analysis": "glm-4-plus",           # Глубокий анализ
        }
        return model_map.get(task_type, "glm-4")

    def _inject_json_instruction(self, messages: list[dict]) -> list[dict]:
        """Добавляет инструкцию для JSON-формата в последнее сообщение."""
        messages = [m.copy() for m in messages]
        if messages:
            last = messages[-1]
            last["content"] += (
                "\n\nВАЖНО: Верни ответ строго в формате JSON без markdown-обёрток, "
                "без пояснений и комментариев. Только валидный JSON."
            )
        return messages

    def _estimate_cost(self, usage: dict) -> float:
        """Оценка стоимости вызова z.ai."""
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        # Примерные расценки z.ai (USD за 1K токенов)
        cost = (input_tokens * 0.00001) + (output_tokens * 0.00003)
        return round(cost, 6)


# Импорт asyncio для sleep в retry
import asyncio
