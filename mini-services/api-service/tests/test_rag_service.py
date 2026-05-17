"""
Gidede — Тесты RAG-сервиса
Фаза 4.A.11: Локальная тестовая инфраструктура

Тестирует:
- TextChunker: разбиение текста на чанки
- RAGService: поиск (с моками)
- Интеграция RAG в PromptExecutor (с моками)
"""

import pytest
from app.core.rag_service import TextChunker, RAGSearchResult, ChunkResult


class TestTextChunker:
    """Тесты TextChunker — разбиение текста на чанки."""

    def setup_method(self):
        self.chunker = TextChunker(chunk_size=100, overlap=10)

    def test_short_text_single_chunk(self):
        """Короткий текст должен создавать один чанк."""
        text = "Короткий текст для тестирования."
        chunks = self.chunker.chunk_text(text, "bible", "test_source", "Test")
        assert len(chunks) == 1
        assert chunks[0]["content"] == text

    def test_long_text_multiple_chunks(self):
        """Длинный текст должен разбиваться на несколько чанков."""
        text = "Первый абзац текста. " * 50 + "\n\n" + "Второй абзац текста. " * 50
        chunks = self.chunker.chunk_text(text, "bible", "test_source", "Test")
        assert len(chunks) >= 2

    def test_header_splitting(self):
        """Текст с заголовками должен разбиваться по заголовкам."""
        text = "# Введение\nТекст введения\n\n## Основная часть\nТекст основной части\n\n### Заключение\nТекст заключения"
        chunks = self.chunker.chunk_text(text, "bible", "test_source")
        assert len(chunks) >= 2

    def test_chunk_metadata(self):
        """Каждый чанк должен содержать метаданные."""
        text = "Тестовый текст."
        chunks = self.chunker.chunk_text(text, "bible", "bible_2_1", "Фундамент")
        assert chunks[0]["source_type"] == "bible"
        assert chunks[0]["source_name"] == "bible_2_1"
        assert chunks[0]["title"] == "Фундамент"
        assert chunks[0]["chunk_index"] == 0

    def test_empty_text(self):
        """Пустой текст не должен создавать чанки."""
        chunks = self.chunker.chunk_text("", "bible", "test")
        assert len(chunks) == 0

    def test_whitespace_only_text(self):
        """Текст из пробелов не должен создавать чанки."""
        chunks = self.chunker.chunk_text("   \n\n  \t  ", "bible", "test")
        assert len(chunks) == 0

    def test_chunk_indices_sequential(self):
        """Индексы чанков должны быть последовательными."""
        text = "Абзац 1.\n\nАбзац 2.\n\nАбзац 3."
        chunks = self.chunker.chunk_text(text, "bible", "test")
        for i, chunk in enumerate(chunks):
            assert chunk["chunk_index"] == i


class TestRAGSearchResult:
    """Тесты RAGSearchResult — сериализация результатов."""

    def test_empty_result(self):
        """Пустой результат должен возвращать пустую строку."""
        result = RAGSearchResult(query="test")
        assert result.to_context_string() == ""

    def test_result_with_chunks(self):
        """Результат с чанками должен генерировать контекстную строку."""
        chunks = [
            ChunkResult(
                id="1",
                source_type="bible",
                source_name="bible_2_3",
                chunk_index=0,
                title="MDA",
                content="MDA Framework — формальный подход",
                similarity=0.95,
            ),
        ]
        result = RAGSearchResult(query="MDA", chunks=chunks, total_found=1)
        context = result.to_context_string()
        assert "MDA Framework" in context
        assert "[bible:bible_2_3, MDA]" in context

    def test_max_tokens_limit(self):
        """Контекст должен ограничиваться по max_tokens."""
        long_content = "Длинный текст. " * 500
        chunks = [
            ChunkResult(
                id=str(i),
                source_type="bible",
                source_name="test",
                chunk_index=i,
                title=None,
                content=long_content,
                similarity=0.9,
            )
            for i in range(5)
        ]
        result = RAGSearchResult(query="test", chunks=chunks, total_found=5)
        context = result.to_context_string(max_tokens=100)
        # Контекст должен быть ограничен
        assert len(context) < len(long_content) * 5


class TestRAGServiceIntegration:
    """Интеграционные тесты RAG-сервиса (с моками)."""

    @pytest.mark.asyncio
    async def test_search_with_rag_disabled(self):
        """Поиск с отключённым RAG должен возвращать пустой результат."""
        import os
        os.environ["RAG_ENABLED"] = "false"

        from app.core.rag_service import RAGService
        rag = RAGService()
        result = await rag.search_knowledge("test query")
        assert result.total_found == 0
        assert len(result.chunks) == 0

        # Восстановить
        os.environ["RAG_ENABLED"] = "true"

    @pytest.mark.asyncio
    async def test_rag_stats(self):
        """Статистика RAG должна возвращать корректную структуру."""
        import os
        os.environ["RAG_ENABLED"] = "false"

        from app.core.rag_service import RAGService
        rag = RAGService()
        stats = await rag.get_stats()

        assert "total_chunks" in stats or "error" in stats
