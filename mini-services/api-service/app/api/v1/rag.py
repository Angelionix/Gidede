"""
Gidede — API роутер для RAG-сервиса
Фаза 4.A.10: pgvector + база знаний

Эндпоинты:
- GET  /api/v1/rag/stats     — статистика базы знаний
- POST /api/v1/rag/search    — векторный поиск
- POST /api/v1/rag/load      — загрузка документа
- POST /api/v1/rag/load-bible — загрузка Библии геймдизайна
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.core.rag_service import get_rag_service

router = APIRouter()


class SearchRequest(BaseModel):
    """Запрос на векторный поиск."""
    query: str = Field(..., min_length=1, max_length=1000, description="Поисковый запрос")
    top_k: int = Field(default=5, ge=1, le=20, description="Количество результатов")
    source_type: Optional[str] = Field(default=None, description="Фильтр по типу (bible/book/algorithm)")
    similarity_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class LoadDocumentRequest(BaseModel):
    """Запрос на загрузку документа в базу знаний."""
    content: str = Field(..., min_length=1, description="Текст документа")
    source_type: str = Field(default="bible", description="Тип источника")
    source_name: str = Field(..., min_length=1, description="Имя источника")
    title: Optional[str] = Field(default=None, description="Заголовок")


class LoadBibleRequest(BaseModel):
    """Запрос на загрузку Библии геймдизайна."""
    bible_dir: Optional[str] = Field(default=None, description="Путь к директории с файлами")


@router.get("/stats")
async def rag_stats():
    """Получить статистику базы знаний RAG."""
    rag = await get_rag_service()
    return await rag.get_stats()


@router.post("/search")
async def rag_search(request: SearchRequest):
    """Векторный поиск по базе знаний геймдизайна."""
    rag = await get_rag_service()
    result = await rag.search_knowledge(
        query=request.query,
        top_k=request.top_k,
        source_type=request.source_type,
        similarity_threshold=request.similarity_threshold,
    )

    return {
        "query": result.query,
        "total_found": result.total_found,
        "chunks": [
            {
                "id": chunk.id,
                "source_type": chunk.source_type,
                "source_name": chunk.source_name,
                "chunk_index": chunk.chunk_index,
                "title": chunk.title,
                "content": chunk.content[:500],  # Ограничиваем для API
                "similarity": chunk.similarity,
            }
            for chunk in result.chunks
        ],
    }


@router.post("/load")
async def rag_load_document(request: LoadDocumentRequest):
    """Загрузить документ в базу знаний."""
    rag = await get_rag_service()
    try:
        chunks_count = await rag.load_document(
            content=request.content,
            source_type=request.source_type,
            source_name=request.source_name,
            title=request.title,
        )
        return {"status": "ok", "chunks_created": chunks_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/load-bible")
async def rag_load_bible(request: LoadBibleRequest):
    """Загрузить все 12 разделов Библии геймдизайна."""
    import os

    rag = await get_rag_service()

    # Определяем путь к bible директории
    bible_dir = request.bible_dir
    if not bible_dir:
        # По умолчанию — docs/bible в корне репозитория
        api_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        repo_root = os.path.dirname(api_dir)
        bible_dir = os.path.join(repo_root, "docs", "bible")

    if not os.path.exists(bible_dir):
        raise HTTPException(status_code=404, detail=f"Директория не найдена: {bible_dir}")

    try:
        total_chunks = await rag.load_bible(bible_dir)
        return {"status": "ok", "chunks_created": total_chunks, "bible_dir": bible_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
