"""
Gidede — AI Service Module
Фаза 4.A.7: Ядро AI-интеграции

Провайдеры:
1. ZAIProvider — z.ai (z-ai-web-dev-sdk), основной для продакшена
2. OllamaProvider — локальные/облачные модели Ollama
3. OpenAIProvider — OpenAI API (fallback)
4. AnthropicProvider — Anthropic API (fallback)

Архитектура:
- PromptExecutor — точка входа (execute, маршрутизация, кэширование, fallback)
- PromptRouter — выбор модели по задаче
- PromptCache — Redis-кэш (fallback на in-memory)
- PromptValidator — валидация выхода AI
"""

from app.ai.executor import PromptExecutor
from app.ai.router import PromptRouter
from app.ai.cache import PromptCache
from app.ai.validator import PromptValidator
from app.ai.providers.zai_provider import ZAIProvider
from app.ai.providers.ollama_provider import OllamaProvider
from app.ai.providers.openai_provider import OpenAIProvider
from app.ai.providers.anthropic_provider import AnthropicProvider

__all__ = [
    "PromptExecutor",
    "PromptRouter",
    "PromptCache",
    "PromptValidator",
    "ZAIProvider",
    "OllamaProvider",
    "OpenAIProvider",
    "AnthropicProvider",
]
