"""
Gidede — OpenAI Provider
Фаза 4.A.7: Поддержка OpenAI API (fallback провайдер)

Используется как fallback когда z.ai и Ollama недоступны.
Поддерживает GPT-4, GPT-4o, GPT-3.5-turbo и другие модели.
"""

import os
import time
import logging
from typing import Optional

from app.ai.providers.base import AIProvider, AIResponse, ProviderConfig

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    """
    Провайдер OpenAI — fallback для продакшена.
    Использует httpx для прямых HTTP-вызовов к OpenAI API.
    """

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY", "")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        config = ProviderConfig(
            provider_name="openai",
            is_available=bool(api_key),
            priority=2,  # Третий приоритет
            max_retries=2,
            timeout_seconds=30,
            default_temperature=0.7,
            default_max_tokens=2048,
            supports_json_mode=True,
            supports_system_prompt=True,
            rate_limit_rpm=60,
        )
        super().__init__(config)
        self._api_key = api_key
        self._base_url = base_url

        if api_key:
            logger.info("OpenAI Provider: инициализирован (API key найден)")
        else:
            logger.info("OpenAI Provider: не инициализирован (нет API key)")

    async def generate(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: Optional[str] = None,
    ) -> AIResponse:
        """Генерация ответа через OpenAI API."""
        import httpx
        import asyncio

        start_time = time.time()
        model = model or "gpt-4o-mini"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # JSON-режим
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        url = f"{self._base_url}/chat/completions"

        last_error = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                    resp = await client.post(url, json=payload, headers=headers)

                    if resp.status_code == 429:
                        logger.warning(f"OpenAI: rate limit, попытка {attempt}")
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
                        provider="openai",
                        tokens_input=usage.get("prompt_tokens", 0),
                        tokens_output=usage.get("completion_tokens", 0),
                        cost_usd=self._estimate_cost(model, usage),
                        latency_ms=latency,
                        finish_reason=data["choices"][0].get("finish_reason"),
                        raw_response=data,
                    )

            except Exception as e:
                last_error = e
                logger.warning(f"OpenAI: ошибка (попытка {attempt}): {e}")

        raise RuntimeError(f"OpenAI Provider: все попытки исчерпаны — {last_error}")

    async def check_availability(self) -> bool:
        """Проверка доступности OpenAI API."""
        if not self._api_key:
            self.config.is_available = False
            return False
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{self._base_url}/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                self.config.is_available = resp.status_code == 200
                return self.config.is_available
        except Exception:
            self.config.is_available = False
            return False

    def get_available_models(self) -> list[str]:
        """Список моделей OpenAI."""
        return [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
        ]

    def get_default_model(self, task_type: str) -> str:
        """Модель по умолчанию."""
        model_map = {
            "classification": "gpt-3.5-turbo",
            "evaluation": "gpt-3.5-turbo",
            "recommendation": "gpt-3.5-turbo",
            "generation": "gpt-4o",
            "analysis": "gpt-4o",
        }
        return model_map.get(task_type, "gpt-4o-mini")

    def _estimate_cost(self, model: str, usage: dict) -> float:
        """Оценка стоимости вызова OpenAI."""
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        # Цены за 1K токенов (USD, примерные на 2026)
        prices = {
            "gpt-4o": (0.0025, 0.01),
            "gpt-4o-mini": (0.00015, 0.0006),
            "gpt-4-turbo": (0.01, 0.03),
            "gpt-4": (0.03, 0.06),
            "gpt-3.5-turbo": (0.0005, 0.0015),
        }
        input_price, output_price = prices.get(model, (0.001, 0.002))
        cost = (input_tokens / 1000 * input_price) + (output_tokens / 1000 * output_price)
        return round(cost, 6)
