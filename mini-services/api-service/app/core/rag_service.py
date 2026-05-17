"""
Gidede — RAG Service (Retrieval-Augmented Generation)
Фаза 4.A.10: pgvector + база знаний

Обеспечивает векторный поиск по «Библии геймдизайна» (12 разделов)
и ключевым фрагментам из 17 книг. Интегрируется в PromptExecutor
для автоматического обогащения промптов релевантным контекстом.

Компоненты:
- TextChunker: разбиение текста на чанки (~500 токенов)
- EmbeddingGenerator: генерация эмбеддингов через OpenAI/z.ai
- RAGService: поиск по базе знаний + интеграция в промпты
"""

import json
import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session, DATABASE_URL
from app.models.db import KnowledgeChunk

logger = logging.getLogger(__name__)


# ============================================================
# Data Classes
# ============================================================

@dataclass
class ChunkResult:
    """Результат поиска — один чанк с метрикой сходства."""
    id: str
    source_type: str
    source_name: str
    chunk_index: int
    title: Optional[str]
    content: str
    similarity: float
    metadata: Optional[dict] = None


@dataclass
class RAGSearchResult:
    """Результат RAG-поиска — коллекция чанков с контекстом."""
    query: str
    chunks: list[ChunkResult] = field(default_factory=list)
    total_found: int = 0

    def to_context_string(self, max_tokens: int = 2000) -> str:
        """
        Сериализовать результаты в строку для добавления в промпт.
        Ограничивает общий размер по приблизительному числу токенов.
        """
        if not self.chunks:
            return ""

        parts = []
        current_tokens = 0

        for chunk in self.chunks:
            source_label = f"[{chunk.source_type}:{chunk.source_name}"
            if chunk.title:
                source_label += f", {chunk.title}"
            source_label += "]"

            chunk_text = f"{source_label}\n{chunk.content}\n"
            # Приблизительная оценка: 1 токен ≈ 4 символа
            chunk_tokens = len(chunk_text) // 4

            if current_tokens + chunk_tokens > max_tokens:
                break

            parts.append(chunk_text)
            current_tokens += chunk_tokens

        if not parts:
            return ""

        return "=== Контекст из базы знаний геймдизайна ===\n\n" + "\n---\n".join(parts)


# ============================================================
# Text Chunker
# ============================================================

class TextChunker:
    """
    Разбиение текста на чанки для RAG.

    Стратегия:
    1. Разбить по заголовкам (## и ###)
    2. Если секция > chunk_size — разбить по абзацам
    3. Если абзац > chunk_size — разбить по предложениям
    4. Добавить overlap между чанками
    """

    def __init__(
        self,
        chunk_size: int = 500,
        overlap: int = 50,
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_text(
        self,
        text: str,
        source_type: str,
        source_name: str,
        title: Optional[str] = None,
    ) -> list[dict]:
        """
        Разбить текст на чанки.

        Returns:
            Список словарей с полями:
            - source_type, source_name, chunk_index, title, content, token_count
        """
        # Шаг 1: Разбить по заголовкам
        sections = self._split_by_headers(text)

        # Шаг 2: Разбить секции на чанки нужного размера
        chunks = []
        chunk_index = 0

        for section_title, section_text in sections:
            if not section_text.strip():
                continue

            section_tokens = self._estimate_tokens(section_text)

            if section_tokens <= self.chunk_size * 1.2:
                # Секция помещается в один чанк
                chunks.append({
                    "source_type": source_type,
                    "source_name": source_name,
                    "chunk_index": chunk_index,
                    "title": section_title or title,
                    "content": section_text.strip(),
                    "token_count": section_tokens,
                })
                chunk_index += 1
            else:
                # Секция слишком большая — разбить по абзацам
                paragraph_chunks = self._split_by_size(
                    section_text,
                    chunk_index,
                    source_type,
                    source_name,
                    section_title or title,
                )
                chunks.extend(paragraph_chunks)
                chunk_index += len(paragraph_chunks)

        return chunks

    def _split_by_headers(self, text: str) -> list[tuple[str, str]]:
        """Разбить текст по Markdown-заголовкам (## и ###)."""
        sections = []
        current_title = ""
        current_text = []

        for line in text.split("\n"):
            if re.match(r"^#{1,4}\s+", line):
                # Сохранить предыдущую секцию
                if current_text:
                    sections.append((current_title, "\n".join(current_text)))
                current_title = line.lstrip("#").strip()
                current_text = []
            else:
                current_text.append(line)

        # Последняя секция
        if current_text:
            sections.append((current_title, "\n".join(current_text)))

        return sections if sections else [("", text)]

    def _split_by_size(
        self,
        text: str,
        start_index: int,
        source_type: str,
        source_name: str,
        title: Optional[str],
    ) -> list[dict]:
        """Разбить длинную секцию на чанки по абзацам с overlap."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        chunks = []
        chunk_index = start_index
        current_content = []

        for para in paragraphs:
            para_tokens = self._estimate_tokens(para)

            # Если один абзац больше chunk_size — разбить по предложениям
            if para_tokens > self.chunk_size:
                if current_content:
                    content = "\n\n".join(current_content)
                    chunks.append({
                        "source_type": source_type,
                        "source_name": source_name,
                        "chunk_index": chunk_index,
                        "title": title,
                        "content": content,
                        "token_count": self._estimate_tokens(content),
                    })
                    chunk_index += 1
                    current_content = []

                # Разбить большой абзац по предложениям
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sentence_chunk = []

                for sentence in sentences:
                    sentence_chunk.append(sentence)
                    combined = " ".join(sentence_chunk)
                    if self._estimate_tokens(combined) >= self.chunk_size:
                        chunks.append({
                            "source_type": source_type,
                            "source_name": source_name,
                            "chunk_index": chunk_index,
                            "title": title,
                            "content": combined,
                            "token_count": self._estimate_tokens(combined),
                        })
                        chunk_index += 1
                        # Overlap: оставить последнее предложение
                        sentence_chunk = sentence_chunk[-1:] if self.overlap > 0 else []

                if sentence_chunk:
                    current_content = [" ".join(sentence_chunk)]
                continue

            # Добавить абзац к текущему чанку
            test_content = "\n\n".join(current_content + [para])
            if self._estimate_tokens(test_content) > self.chunk_size:
                # Текущий чанк заполнен — сохранить
                if current_content:
                    content = "\n\n".join(current_content)
                    chunks.append({
                        "source_type": source_type,
                        "source_name": source_name,
                        "chunk_index": chunk_index,
                        "title": title,
                        "content": content,
                        "token_count": self._estimate_tokens(content),
                    })
                    chunk_index += 1
                current_content = [para]
            else:
                current_content.append(para)

        # Остаток
        if current_content:
            content = "\n\n".join(current_content)
            chunks.append({
                "source_type": source_type,
                "source_name": source_name,
                "chunk_index": chunk_index,
                "title": title,
                "content": content,
                "token_count": self._estimate_tokens(content),
            })

        return chunks

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """Приблизительная оценка токенов (1 токен ≈ 4 символа, CJK ≈ 2 символа)."""
        # Упрощённая оценка — для русского и английского
        return max(1, len(text) // 4)


# ============================================================
# Embedding Generator
# ============================================================

class EmbeddingGenerator:
    """
    Генерация эмбеддингов через OpenAI API / z.ai / локальные модели.

    Поддерживаемые провайдеры:
    - openai: text-embedding-3-small (1536d), text-embedding-3-large (3072d)
    - zai: через z.ai API с OpenAI-совместимым интерфейсом
    - local: заглушка для локальных моделей (Ollama nomic-embed-text)
    """

    def __init__(self):
        self.provider = settings.EMBEDDING_PROVIDER
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self._client = None

    def _get_api_key(self) -> str:
        """Получить API-ключ для эмбеддингов."""
        return settings.EMBEDDING_API_KEY or settings.OPENAI_API_KEY

    def _get_base_url(self) -> Optional[str]:
        """Получить кастомный base URL."""
        return settings.EMBEDDING_BASE_URL or None

    async def generate_embedding(self, text: str) -> list[float]:
        """Сгенерировать эмбеддинг для одного текста."""
        if self.provider == "local":
            return await self._generate_local(text)
        return await self._generate_openai_compatible(text)

    async def generate_embeddings(self, texts: list[str], batch_size: int = 20) -> list[list[float]]:
        """Сгенерировать эмбеддинги для батча текстов."""
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            if self.provider == "local":
                for text in batch:
                    embeddings.append(await self._generate_local(text))
            else:
                batch_embeddings = await self._generate_openai_compatible_batch(batch)
                embeddings.extend(batch_embeddings)
        return embeddings

    async def _generate_openai_compatible(self, text: str) -> list[float]:
        """Генерация эмбеддинга через OpenAI-совместимый API."""
        try:
            import httpx

            api_key = self._get_api_key()
            base_url = self._get_base_url() or "https://api.openai.com/v1"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "input": text,
                        "dimensions": self.dimensions,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data["data"][0]["embedding"]

        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    async def _generate_openai_compatible_batch(self, texts: list[str]) -> list[list[float]]:
        """Генерация эмбеддингов для батча через OpenAI-совместимый API."""
        try:
            import httpx

            api_key = self._get_api_key()
            base_url = self._get_base_url() or "https://api.openai.com/v1"

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "input": texts,
                        "dimensions": self.dimensions,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return [item["embedding"] for item in data["data"]]

        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            raise

    async def _generate_local(self, text: str) -> list[float]:
        """Генерация эмбеддинга через локальный Ollama (nomic-embed-text)."""
        try:
            import httpx

            ollama_url = settings.OLLAMA_BASE_URL
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{ollama_url}/api/embeddings",
                    json={
                        "model": "nomic-embed-text",
                        "prompt": text,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data["embedding"]

        except Exception as e:
            logger.error(f"Local embedding generation failed: {e}")
            # Fallback: нулевой вектор
            logger.warning("Using zero-vector fallback for embeddings")
            return [0.0] * self.dimensions


# ============================================================
# RAG Service
# ============================================================

class RAGService:
    """
    Сервис RAG (Retrieval-Augmented Generation) для Gidede.

    Основные функции:
    - search_knowledge(query, top_k) — векторный поиск по базе знаний
    - enrich_prompt(query, project_context) — обогащение промпта контекстом
    - load_document(content, metadata) — загрузка документа в базу знаний
    - get_stats() — статистика базы знаний
    """

    def __init__(self):
        self.chunker = TextChunker(
            chunk_size=settings.RAG_CHUNK_SIZE_TOKENS,
            overlap=settings.RAG_CHUNK_OVERLAP_TOKENS,
        )
        self.embedding_generator = EmbeddingGenerator()
        self._initialized = False

    async def initialize(self):
        """Инициализация: проверить pgvector, создать колонку embedding если нужно."""
        if self._initialized:
            return

        if DATABASE_URL.startswith("sqlite"):
            logger.warning("RAG: SQLite не поддерживает pgvector, векторный поиск недоступен")
            self._initialized = True
            return

        try:
            async with async_session() as session:
                # Проверить, что pgvector включён
                result = await session.execute(
                    text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
                )
                if not result.scalar():
                    logger.info("RAG: Включаем расширение pgvector...")
                    await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                    await session.commit()

                # Добавить колонку embedding, если её нет
                result = await session.execute(
                    text("""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
                    """)
                )
                if not result.scalar():
                    logger.info("RAG: Добавляем колонку embedding vector(1536)...")
                    await session.execute(text(
                        f"ALTER TABLE knowledge_chunks ADD COLUMN embedding vector({settings.EMBEDDING_DIMENSIONS})"
                    ))
                    await session.commit()

                # Создать индекс для векторного поиска (ivfflat)
                result = await session.execute(
                    text("""
                        SELECT indexname FROM pg_indexes
                        WHERE tablename = 'knowledge_chunks' AND indexname = 'ix_knowledge_embedding'
                    """)
                )
                if not result.scalar():
                    logger.info("RAG: Создаём IVFFlat-индекс для векторного поиска...")
                    await session.execute(text(
                        f"""
                        CREATE INDEX ix_knowledge_embedding ON knowledge_chunks
                        USING ivfflat (embedding vector_cosine_ops)
                        WITH (lists = 100)
                        """
                    ))
                    await session.commit()

            self._initialized = True
            logger.info("RAG: Сервис инициализирован")

        except Exception as e:
            logger.warning(f"RAG: Ошибка инициализации: {e}")
            self._initialized = True  # Не блокировать запуск

    async def search_knowledge(
        self,
        query: str,
        top_k: int = None,
        source_type: Optional[str] = None,
        similarity_threshold: Optional[float] = None,
    ) -> RAGSearchResult:
        """
        Векторный поиск по базе знаний.

        Args:
            query: Поисковый запрос
            top_k: Количество возвращаемых результатов (default: из настроек)
            source_type: Фильтр по типу источника (bible/book/algorithm)
            similarity_threshold: Минимальный порог сходства (default: из настроек)

        Returns:
            RAGSearchResult с найденными чанками
        """
        if not settings.RAG_ENABLED:
            return RAGSearchResult(query=query)

        if DATABASE_URL.startswith("sqlite"):
            logger.debug("RAG: Векторный поиск недоступен в SQLite")
            return RAGSearchResult(query=query)

        top_k = top_k or settings.RAG_TOP_K
        similarity_threshold = similarity_threshold or settings.RAG_SIMILARITY_THRESHOLD

        try:
            # Генерация эмбеддинга запроса
            query_embedding = await self.embedding_generator.generate_embedding(query)

            # Векторный поиск с косинусным сходством
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

            filter_clause = ""
            params: dict[str, Any] = {
                "embedding": embedding_str,
                "top_k": top_k,
                "threshold": similarity_threshold,
            }

            if source_type:
                filter_clause = "AND source_type = :source_type"
                params["source_type"] = source_type

            query_sql = text(f"""
                SELECT
                    id, source_type, source_name, chunk_index, title, content,
                    metadata_json,
                    1 - (embedding <=> :embedding::vector) AS similarity
                FROM knowledge_chunks
                WHERE 1 - (embedding <=> :embedding::vector) > :threshold
                {filter_clause}
                ORDER BY embedding <=> :embedding::vector
                LIMIT :top_k
            """)

            async with async_session() as session:
                result = await session.execute(query_sql, params)
                rows = result.fetchall()

            chunks = []
            for row in rows:
                chunks.append(ChunkResult(
                    id=row[0],
                    source_type=row[1],
                    source_name=row[2],
                    chunk_index=row[3],
                    title=row[4],
                    content=row[5],
                    similarity=round(float(row[7]), 4),
                    metadata=row[6],
                ))

            return RAGSearchResult(
                query=query,
                chunks=chunks,
                total_found=len(chunks),
            )

        except Exception as e:
            logger.error(f"RAG search failed: {e}")
            return RAGSearchResult(query=query)

    async def enrich_prompt(
        self,
        query: str,
        project_context: Optional[dict] = None,
        max_context_tokens: int = 2000,
    ) -> str:
        """
        Обогатить промпт контекстом из базы знаний.

        Используется в PromptExecutor для автоматического добавления
        релевантного контекста из «Библии геймдизайна» и книг.

        Args:
            query: Тема запроса (например, «MDA-анализ», «баланс экономки»)
            project_context: Контекст проекта для уточнения поиска
            max_context_tokens: Максимум токенов контекста

        Returns:
            Строка с релевантным контекстом или пустая строка
        """
        if not settings.RAG_ENABLED:
            return ""

        # Расширенный запрос с контекстом проекта
        search_query = query
        if project_context:
            genre = project_context.get("genre", "")
            if genre:
                search_query = f"{query} {genre}"

        result = await self.search_knowledge(search_query, top_k=settings.RAG_TOP_K)
        return result.to_context_string(max_tokens=max_context_tokens)

    async def load_document(
        self,
        content: str,
        source_type: str,
        source_name: str,
        title: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> int:
        """
        Загрузить документ в базу знаний.

        Разбивает текст на чанки, генерирует эмбеддинги и сохраняет в БД.

        Args:
            content: Текст документа
            source_type: Тип источника (bible/book/algorithm)
            source_name: Имя источника (bible_2_1_fundament, schell, и т.д.)
            title: Заголовок документа
            metadata: Дополнительные метаданные

        Returns:
            Количество созданных чанков
        """
        # Удалить существующие чанки этого источника
        async with async_session() as session:
            await session.execute(
                text("DELETE FROM knowledge_chunks WHERE source_name = :name"),
                {"name": source_name},
            )
            await session.commit()

        # Разбить на чанки
        chunks = self.chunker.chunk_text(content, source_type, source_name, title)

        if not chunks:
            return 0

        # Генерация эмбеддингов батчами
        texts = [chunk["content"] for chunk in chunks]
        embeddings = await self.embedding_generator.generate_embeddings(texts, batch_size=20)

        # Сохранение в БД
        async with async_session() as session:
            for chunk, embedding in zip(chunks, embeddings):
                chunk_id = uuid.uuid4().hex
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

                await session.execute(
                    text("""
                        INSERT INTO knowledge_chunks
                            (id, source_type, source_name, chunk_index, title,
                             content, token_count, metadata_json, embedding, created_at)
                        VALUES
                            (:id, :source_type, :source_name, :chunk_index, :title,
                             :content, :token_count, :metadata_json,
                             :embedding::vector, NOW())
                    """),
                    {
                        "id": chunk_id,
                        "source_type": chunk["source_type"],
                        "source_name": chunk["source_name"],
                        "chunk_index": chunk["chunk_index"],
                        "title": chunk.get("title"),
                        "content": chunk["content"],
                        "token_count": chunk.get("token_count", 0),
                        "metadata_json": json.dumps(metadata or {}, ensure_ascii=False),
                        "embedding": embedding_str,
                    },
                )

            await session.commit()

        logger.info(f"RAG: Загружено {len(chunks)} чанков из {source_name}")
        return len(chunks)

    async def load_file(
        self,
        file_path: str,
        source_type: str,
        source_name: str,
        title: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> int:
        """Загрузить файл (Markdown) в базу знаний."""
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return await self.load_document(content, source_type, source_name, title, metadata)

    async def load_bible(self, bible_dir: str) -> int:
        """
        Загрузить все 12 разделов «Библии геймдизайна» в базу знаний.

        Args:
            bible_dir: Путь к директории с файлами bible_2_*.md

        Returns:
            Общее количество созданных чанков
        """
        total_chunks = 0

        # Маппинг файлов → названия
        bible_files = {
            "bible_2_1_fundament.md": "Фундамент геймдизайна",
            "bible_2_2_elements.md": "Элементы игры",
            "bible_2_3_mda_framework.md": "MDA Framework",
            "bible_2_4_core_loop.md": "Core Loop",
            "bible_2_5_balance.md": "Баланс",
            "bible_2_6_economy_progression.md": "Экономика и прогрессия",
            "bible_2_7_level_design.md": "Левел-дизайн",
            "bible_2_8_narrative_emotional_design.md": "Нарратив и эмоциональный дизайн",
            "bible_2_9_monetization_retention.md": "Монетизация и удержание",
            "bible_2_10_playtesting_iteration.md": "Плейтестинг и итерация",
            "bible_2_11_gdd_templates_checklists.md": "Шаблоны GDD и чек-листы",
            "bible_2_12_compilation.md": "Компиляция",
        }

        import os
        for filename, section_title in bible_files.items():
            file_path = os.path.join(bible_dir, filename)
            if not os.path.exists(file_path):
                logger.warning(f"RAG: Файл не найден: {file_path}")
                continue

            try:
                chunks = await self.load_file(
                    file_path=file_path,
                    source_type="bible",
                    source_name=filename.replace(".md", ""),
                    title=section_title,
                    metadata={"section": filename},
                )
                total_chunks += chunks
            except Exception as e:
                logger.error(f"RAG: Ошибка загрузки {filename}: {e}")

        logger.info(f"RAG: Библия геймдизайна загружена — {total_chunks} чанков")
        return total_chunks

    async def get_stats(self) -> dict:
        """Получить статистику базы знаний."""
        try:
            async with async_session() as session:
                # Общее количество чанков
                result = await session.execute(text("SELECT COUNT(*) FROM knowledge_chunks"))
                total = result.scalar() or 0

                # По типам источников
                result = await session.execute(text(
                    "SELECT source_type, COUNT(*) FROM knowledge_chunks GROUP BY source_type"
                ))
                by_type = dict(result.fetchall())

                # По источникам
                result = await session.execute(text(
                    "SELECT source_name, COUNT(*) FROM knowledge_chunks GROUP BY source_name ORDER BY COUNT(*) DESC"
                ))
                by_source = dict(result.fetchall())

                # Проверить наличие pgvector
                has_pgvector = False
                if not DATABASE_URL.startswith("sqlite"):
                    result = await session.execute(
                        text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
                    )
                    has_pgvector = result.scalar() is not None

            return {
                "total_chunks": total,
                "by_source_type": by_type,
                "by_source_name": by_source,
                "pgvector_enabled": has_pgvector,
                "rag_enabled": settings.RAG_ENABLED,
                "embedding_model": settings.EMBEDDING_MODEL,
                "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
            }

        except Exception as e:
            logger.error(f"RAG stats failed: {e}")
            return {"error": str(e)}


# ============================================================
# Singleton
# ============================================================

_rag_service: Optional[RAGService] = None


async def get_rag_service() -> RAGService:
    """Получить singleton RAG-сервиса."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
        await _rag_service.initialize()
    return _rag_service
