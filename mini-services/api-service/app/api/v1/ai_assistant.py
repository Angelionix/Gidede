"""Блок 7: AI-ассистент — API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class ChatMessage(BaseModel):
    """Сообщение чата с AI-ассистентом."""
    concept_id: Optional[str] = None
    message: str
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    """Ответ AI-ассистента."""
    reply: str
    sources: List[dict] = []
    suggestions: List[str] = []


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(message: ChatMessage):
    """
    Чат с AI-ассистентом Gidede.
    
    Ассистент знает:
    - Текущее состояние проекта (Project State)
    - 17 книг по геймдизайну (через RAG)
    - Фреймворки: MDA, MechanicsDB, линзы Шелла
    - Рекомендации по текущему модулю
    """
    # TODO: Реализация в Фазе 4.D
    return ChatResponse(
        reply="AI-ассистент будет доступен после реализации в Фазе 4.D.",
        sources=[],
        suggestions=[],
    )
