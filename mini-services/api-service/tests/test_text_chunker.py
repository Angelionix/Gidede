"""
Gidede — Тесты TextChunker (детальные)
Фаза 4.A.11: Локальная тестовая инфраструктура

Подробные тесты разбиения текста на чанки для RAG.
"""

import pytest
from app.core.rag_service import TextChunker


class TestTextChunkerEdgeCases:
    """Граничные случаи TextChunker."""

    def setup_method(self):
        self.chunker = TextChunker(chunk_size=200, overlap=20)

    def test_very_long_paragraph(self):
        """Очень длинный абзац должен разбиваться по предложениям."""
        text = "Первое предложение достаточно длинное для тестирования. " * 30
        chunks = self.chunker.chunk_text(text, "bible", "test")
        assert len(chunks) >= 2

    def test_russian_text(self):
        """Русский текст должен корректно разбиваться."""
        text = "## Основные принципы геймдизайна\n\nГеймдизайн — это искусство создания игровых переживаний. Основой геймдизайна является понимание того, что делает игру увлекательной. Каждый элемент игры должен служить общей цели — создавать значимый опыт для игрока."
        chunks = self.chunker.chunk_text(text, "bible", "test")
        assert len(chunks) >= 1
        assert "геймдизайн" in chunks[0]["content"].lower()

    def test_mixed_headers(self):
        """Разные уровни заголовков."""
        text = "# Уровень 1\nТекст1\n## Уровень 2\nТекст2\n### Уровень 3\nТекст3"
        chunks = self.chunker.chunk_text(text, "bible", "test")
        assert len(chunks) >= 2

    def test_code_blocks(self):
        """Текст с блоками кода."""
        text = "## Пример\n\n```python\ndef hello():\n    print('hello')\n```\n\nОбъяснение кода."
        chunks = self.chunker.chunk_text(text, "bible", "test")
        assert len(chunks) >= 1

    def test_token_estimation(self):
        """Оценка токенов должна быть приблизительно корректной."""
        text = "This is a test sentence."
        tokens = TextChunker._estimate_tokens(text)
        assert tokens > 0
        assert tokens <= len(text)  # Не больше символов

    def test_source_type_preserved(self):
        """Тип источника должен сохраняться в чанках."""
        for source_type in ["bible", "book", "algorithm"]:
            chunks = self.chunker.chunk_text("Текст", source_type, "test")
            if chunks:
                assert chunks[0]["source_type"] == source_type
