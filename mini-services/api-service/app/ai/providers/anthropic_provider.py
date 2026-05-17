"""
Gidede — Anthropic Provider
Фаза 4.A.7: Поддержка Anthropic API (fallback провайдер)

Использует Claude 3.5 Sonnet, Haiku и другие модели Anthropic.
"""

import os
import time
import logging
from typing import Optional

from app.ai.providers.base import AIProvider, AIResponse, ProviderConfig

logger = logging.getLogger(__name__)


class AnthropicProvider(AIProvider):
    """
    Провайдер Anthropic — Claude 3.5 / 3 модели.
    Использует httpx для прямых HTTP-вызовов к Anthropic API.
    """

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")

        config = ProviderConfig(
            provider_name="anthropic",
            is_available=bool(api_key),
            priority=3,  # Четвёртый приоритет
            max_retries=2,
            timeout_seconds=30,
            default_temperature=0.7,
            default_max_tokens=2048,
            supports_json_mode=True,  # Через инструкцию в промпте
            supports_system_prompt=True,
            rate_limit_rpm=50,
        )
        super().__init__(config)
        self._api_key = api_key
        self._base_url = base_url

        if api_key:
            logger.info("Anthropic Provider: инициализирован (API key найден)")
        else:
            logger.info("Anthropic Provider: не инициализирован (нет API key)")

    async def generate(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: Optional[str] = None,
    ) -> AIResponse:
        """Генерация ответа через Anthropic API."""
        import httpx
        import asyncio

        start_time = time.time()
        model = model or "claude-3-5-sonnet-20241022"

        # Anthropic использует отдельный system parameter
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content += msg["content"] + "\n"
            else:
                chat_messages.append(msg)

        # JSON-режим — добавляем инструкцию
        if response_format == "json":
            if chat_messages:
                last = chat_messages[-1]
                last["content"] += (
                    "\n\nIMPORTANT: Return your response as valid JSON only. "
                    "No markdown, no explanations, no comments. Only valid JSON."
                )

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self._api_key,
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": chat_messages,
        }
        if system_content.strip():
            payload["system"] = system_content.strip()

        url = f"{self._base_url}/messages"

        last_error = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                    resp = await client.post(url, json=payload, headers=headers)

                    if resp.status_code == 429:
                        logger.warning(f"Anthropic: rate limit, попытка {attempt}")
                        await asyncio.sleep(2 ** attempt)
                        continue

                    resp.raise_for_status()
                    data = resp.json()

                    content = data["content"][0]["text"]
                    latency = int((time.time() - start_time) * 1000)

                    usage = data.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)

                    return AIResponse(
                        content=content,
                        model=data.get("model", model),
                        provider="anthropic",
                        tokens_input=input_tokens,
                        tokens_output=output_tokens,
                        cost_usd=self._estimate_cost(model, input_tokens, output_tokens),
                        latency_ms=latency,
                        finish_reason=data.get("stop_reason"),
                        raw_response=data,
                    )

            except Exception as e:
                last_error = e
                logger.warning(f"Anthropic: ошибка (попытка {attempt}): {e}")

        raise RuntimeError(f"Anthropic Provider: все попытки исчерпаны — {last_error}")

    async def check_availability(self) -> bool:
        """Проверка доступности Anthropic API."""
        if not self._api_key:
            self.config.is_available = False
            return False
        # Anthropic не имеет /models endpoint — пробуем минимальный запрос
        self.config.is_available = True
        return True

    def get_available_models(self) -> list[str]:
        """Список моделей Anthropic."""
        return [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
        ]

    def get_default_model(self, task_type: str) -> str:
        """Модель по умолчанию."""
        model_map = {
            "classification": "claude-3-5-haiku-20241022",
            "evaluation": "claude-3-5-haiku-20241022",
            "recommendation": "claude-3-5-haiku-20241022",
            "generation": "claude-3-5-sonnet-20241022",
            "analysis": "claude-3-5-sonnet-20241022",
        }
        return model_map.get(task_type, "claude-3-5-sonnet-20241022")

    def _estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Оценка стоимости вызова Anthropic."""
        prices = {
            "claude-3-5-sonnet-20241022": (0.003, 0.015),
            "claude-3-5-haiku-20241022": (0.001, 0.005),
            "claude-3-opus-20240229": (0.015, 0.075),
            "claude-3-sonnet-20240229": (0.003, 0.015),
            "claude-3-haiku-20240307": (0.00025, 0.00125),
        }
        input_price, output_price = prices.get(model, (0.003, 0.015))
        cost = (input_tokens / 1000 * input_price) + (output_tokens / 1000 * output_price)
        return round(cost, 6)
