"""
Gidede — Ollama Provider
Фаза 4.A.7: Поддержка локальных и облачных моделей Ollama

Ollama — провайдер для локальных (localhost) и облачных моделей.
Поддерживает:
- Локальные модели (Ollama Server на localhost:11434)
- Облачные модели (Ollama Cloud / любой Ollama-совместимый API)
- Все модели из библиотеки Ollama (llama3, mistral, codellama, и т.д.)
- JSON-режим (через формат "json")
- Streaming (в будущих версиях)
"""

import os
import time
import json
import logging
from typing import Optional

from app.ai.providers.base import AIProvider, AIResponse, ProviderConfig

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """
    Провайдер Ollama — локальные и облачные модели.

    Конфигурация через переменные окружения:
    - OLLAMA_BASE_URL: URL Ollama сервера (default: http://localhost:11434)
    - OLLAMA_API_KEY: API ключ (для облачных моделей, опционально)
    - OLLAMA_DEFAULT_MODEL: Модель по умолчанию (default: llama3)
    - OLLAMA_TIMEOUT: Таймаут в секундах (default: 120 для локальных)
    """

    def __init__(self):
        self._base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self._api_key = os.getenv("OLLAMA_API_KEY", "")
        self._default_model = os.getenv("OLLAMA_DEFAULT_MODEL", "llama3")
        self._cloud_mode = os.getenv("OLLAMA_CLOUD_MODE", "false").lower() == "true"

        config = ProviderConfig(
            provider_name="ollama",
            is_available=False,  # Проверяется при инициализации
            priority=1,  # Второй приоритет после z.ai
            max_retries=2,
            timeout_seconds=int(os.getenv("OLLAMA_TIMEOUT", "120")),
            default_temperature=0.7,
            default_max_tokens=4096,
            supports_json_mode=True,
            supports_system_prompt=True,
            rate_limit_rpm=100,  # Локальные модели — без жёстких лимитов
        )
        super().__init__(config)
        self._check_local_availability()

    def _check_local_availability(self):
        """Быстрая проверка доступности Ollama при инициализации."""
        try:
            import httpx
            import asyncio

            async def _check():
                async with httpx.AsyncClient(timeout=3) as client:
                    resp = await client.get(f"{self._base_url}/api/tags")
                    return resp.status_code == 200

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # В async-контексте — откладываем проверку
                    self.config.is_available = True  # Оптимистично
                else:
                    self.config.is_available = loop.run_until_complete(_check())
            except RuntimeError:
                self.config.is_available = True  # Оптимистично

            if self._cloud_mode:
                self.config.is_available = True
                self.config.timeout_seconds = 60  # Облачные — быстрее
                logger.info(f"Ollama Provider: облачный режим ({self._base_url})")
            elif self.config.is_available:
                logger.info(f"Ollama Provider: локальный сервер доступен ({self._base_url})")
            else:
                logger.info("Ollama Provider: локальный сервер недоступен")

        except Exception as e:
            logger.warning(f"Ollama Provider: ошибка проверки — {e}")
            self.config.is_available = self._cloud_mode

    async def generate(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        response_format: Optional[str] = None,
    ) -> AIResponse:
        """Генерация ответа через Ollama API."""
        import httpx
        import asyncio

        start_time = time.time()
        model = model or self._default_model

        # Ollama /api/chat endpoint
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        # JSON-режим
        if response_format == "json":
            payload["format"] = "json"

        url = f"{self._base_url}/api/chat"
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        last_error = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()

                    data = resp.json()
                    content = data.get("message", {}).get("content", "")
                    latency = int((time.time() - start_time) * 1000)

                    # Ollama возвращает eval_count и prompt_eval_count
                    tokens_input = data.get("prompt_eval_count", 0) or 0
                    tokens_output = data.get("eval_count", 0) or 0

                    return AIResponse(
                        content=content,
                        model=data.get("model", model),
                        provider="ollama",
                        tokens_input=tokens_input,
                        tokens_output=tokens_output,
                        cost_usd=0.0,  # Локальные модели бесплатны
                        latency_ms=latency,
                        finish_reason="stop" if data.get("done") else None,
                        raw_response=data,
                    )

            except httpx.ConnectError:
                last_error = ConnectionError(f"Ollama недоступен на {self._base_url}")
                logger.warning(f"Ollama: сервер недоступен (попытка {attempt})")
                break  # Нет смысла ретраить если сервер не отвечает

            except Exception as e:
                last_error = e
                logger.warning(f"Ollama: ошибка (попытка {attempt}): {e}")
                if attempt < self.config.max_retries:
                    await asyncio.sleep(2 ** attempt)

        raise RuntimeError(f"Ollama Provider: все попытки исчерпаны — {last_error}")

    async def check_availability(self) -> bool:
        """Проверка доступности Ollama сервера."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                self.config.is_available = resp.status_code == 200
                return self.config.is_available
        except Exception:
            self.config.is_available = False
            return False

    async def list_local_models(self) -> list[dict]:
        """
        Получение списка установленных локальных моделей.
        Возвращает список [{'name': 'llama3:latest', 'size': 4661224676, ...}]
        """
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("models", [])
        except Exception as e:
            logger.warning(f"Ollama: не удалось получить список моделей — {e}")
        return []

    def get_available_models(self) -> list[str]:
        """Список популярных моделей Ollama."""
        if self._cloud_mode:
            return [
                "llama3:70b",
                "mistral:large",
                "codellama:34b",
                "qwen2:72b",
                "deepseek-coder-v2",
                "command-r",
            ]
        return [
            "llama3",
            "llama3:8b",
            "llama3:70b",
            "mistral",
            "mistral:7b",
            "codellama",
            "qwen2",
            "qwen2:7b",
            "deepseek-coder-v2",
            "phi3",
            "gemma2",
            "llava",  # Мультимодальная
        ]

    def get_default_model(self, task_type: str) -> str:
        """Модель по умолчанию для типа задачи."""
        if self._cloud_mode:
            model_map = {
                "classification": "llama3:8b",
                "evaluation": "llama3:8b",
                "recommendation": "mistral:7b",
                "generation": "llama3:70b",
                "analysis": "mistral:large",
            }
        else:
            model_map = {
                "classification": "llama3:8b",
                "evaluation": "llama3:8b",
                "recommendation": "mistral:7b",
                "generation": "llama3",
                "analysis": "llama3",
            }
        return model_map.get(task_type, self._default_model)

    def is_cloud_mode(self) -> bool:
        """Работает ли провайдер в облачном режиме."""
        return self._cloud_mode
