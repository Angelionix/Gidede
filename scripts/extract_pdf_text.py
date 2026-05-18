#!/usr/bin/env python3
"""
Gidede — Скрипт для извлечения текста из PDF с разбиением на главы

Решает TD-001: Создать автоматизированный пайплайн извлечения текста
из исходных книг (200+ МБ каждый) для анализа и загрузки в RAG.

Функционал:
1. Извлечение текста из PDF (PyMuPDF)
2. Автоматическое разбиение на главы по заголовкам
3. Разбиение на чанки (~500 токенов) для RAG
4. Поддержка нескольких языков (русский, английский)
5. Метаданные: источник, страница, глава

Использование:
  python scripts/extract_pdf_text.py <pdf_path> [--output-dir DIR] [--chunk-size 500]
  python scripts/extract_pdf_text.py ./books/  # обработать все PDF в папке

Пример:
  python scripts/extract_pdf_text.py ./docs/gdd_examples/doom_gdd.pdf --output-dir ./extracted/
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


# ============================================================
# МОДЕЛИ ДАННЫХ
# ============================================================

@dataclass
class Chapter:
    """Глава документа."""
    title: str
    start_page: int
    end_page: int
    text: str
    char_count: int = 0
    token_estimate: int = 0


@dataclass
class Chunk:
    """Чанк текста для RAG (~500 токенов)."""
    chunk_index: int
    source_file: str
    chapter: str
    page_start: int
    page_end: int
    content: str
    token_estimate: int
    char_count: int = 0


@dataclass
class ExtractionResult:
    """Результат извлечения текста из PDF."""
    source_file: str
    total_pages: int
    total_chapters: int
    total_chunks: int
    total_chars: int
    total_token_estimate: int
    chapters: list[Chapter] = field(default_factory=list)
    chunks: list[Chunk] = field(default_factory=list)


# ============================================================
# КОНСТАНТЫ
# ============================================================

# Паттерны заголовков глав
HEADING_PATTERNS = [
    # Нумерованные: "Глава 1", "Chapter 1", "1.", "1.1"
    re.compile(r'^(?:Глава|Chapter|CHAPTER)\s+\d+', re.IGNORECASE),
    re.compile(r'^(\d+\.)+\s+\S'),  # 1.1 Title, 1. Title
    # Заглавные заголовки (3+ слова CAPS)
    re.compile(r'^[A-ZА-ЯЁ\s]{10,}$'),
    # Markdown-стиль заголовков
    re.compile(r'^#{1,4}\s+\S'),
]

# Минимальный размер текста для заголовка (символы)
MIN_HEADING_LEN = 3
MAX_HEADING_LEN = 120

# Примерное соотношение токенов к символам (для английского + русского)
CHARS_PER_TOKEN = 4.0


# ============================================================
# ИЗВЛЕЧЕНИЕ ТЕКСТА
# ============================================================

def extract_text_from_pdf(pdf_path: str) -> list[dict]:
    """
    Извлечь текст из PDF по страницам.

    Returns:
        [{"page": int, "text": str, "char_count": int}]
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("Ошибка: PyMuPDF не установлен. Установите: pip install pymupdf")
        sys.exit(1)

    pages = []
    doc = fitz.open(pdf_path)

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        # Очистка: удаление лишних пробелов и пустых строк
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()

        pages.append({
            "page": page_num + 1,
            "text": text,
            "char_count": len(text),
        })

    doc.close()
    return pages


def detect_chapters(pages: list[dict]) -> list[Chapter]:
    """
    Разбить текст на главы по заголовкам.

    Использует эвристики:
    1. Паттерны номеров глав (Глава 1, Chapter 1, 1.1)
    2. Короткие строки крупным шрифтом
    3. Сильно отформатированные строки
    4. Fallback: если глав не найдено — весь текст = одна глава
    """
    # Сначала проверяем, есть ли вообще текст
    all_text = "\n".join(p["text"] for p in pages if p["text"].strip())
    if not all_text.strip():
        # PDF без текста (сканы) — создаём главу-заглушку
        return [Chapter(
            title="[Нет текста — возможно, сканированный PDF]",
            start_page=1,
            end_page=len(pages) if pages else 1,
            text="",
            char_count=0,
            token_estimate=0,
        )]

    chapters: list[Chapter] = []
    current_title = "Введение / Вводная часть"
    current_start = 1
    current_text_parts: list[str] = []

    for page_data in pages:
        page_num = page_data["page"]
        text = page_data["text"]

        # Ищем заголовки в тексте страницы
        lines = text.split('\n')
        heading_found = False
        text_before_heading = []
        heading_line = None

        for line in lines:
            stripped = line.strip()

            # Пропускаем пустые и очень короткие строки
            if len(stripped) < MIN_HEADING_LEN:
                text_before_heading.append(line)
                continue

            # Проверяем паттерны заголовков
            is_heading = False
            for pattern in HEADING_PATTERNS:
                if pattern.match(stripped):
                    is_heading = True
                    break

            # Эвристика: строка в 2+ раза короче средней строки — возможный заголовок
            if not is_heading and len(stripped) < MAX_HEADING_LEN:
                avg_len = sum(len(l.strip()) for l in lines if l.strip()) / max(len([l for l in lines if l.strip()]), 1)
                if avg_len > 0 and len(stripped) < avg_len * 0.5 and not stripped.endswith(('.', ',', ';', ':')):
                    # Короткая строка без знаков препинания — возможный заголовок
                    if len(stripped.split()) <= 8:
                        is_heading = True

            if is_heading and not heading_found:
                heading_found = True
                heading_line = stripped
                # Текст до заголовка — в текущую главу
                if text_before_heading:
                    current_text_parts.append('\n'.join(text_before_heading))
            else:
                text_before_heading.append(line)

        if heading_found and current_text_parts:
            # Сохраняем текущую главу
            chapter_text = '\n'.join(current_text_parts).strip()
            if chapter_text:
                chapters.append(Chapter(
                    title=current_title,
                    start_page=current_start,
                    end_page=page_num - 1 if heading_found else page_num,
                    text=chapter_text,
                    char_count=len(chapter_text),
                    token_estimate=int(len(chapter_text) / CHARS_PER_TOKEN),
                ))

            current_title = heading_line
            current_start = page_num
            current_text_parts = []

            # Добавляем текст после заголовка на этой же странице
            remaining = '\n'.join(text_before_heading).strip()
            if remaining:
                current_text_parts.append(remaining)
        else:
            current_text_parts.append(text)

    # Последняя глава
    if current_text_parts:
        chapter_text = '\n'.join(current_text_parts).strip()
        if chapter_text:
            chapters.append(Chapter(
                title=current_title,
                start_page=current_start,
                end_page=pages[-1]["page"] if pages else current_start,
                text=chapter_text,
                char_count=len(chapter_text),
                token_estimate=int(len(chapter_text) / CHARS_PER_TOKEN),
            ))

    # Fallback: если глав не найдено — весь текст = одна глава
    if not chapters and all_text.strip():
        chapters.append(Chapter(
            title="Полный документ",
            start_page=1,
            end_page=len(pages) if pages else 1,
            text=all_text.strip(),
            char_count=len(all_text.strip()),
            token_estimate=int(len(all_text.strip()) / CHARS_PER_TOKEN),
        ))

    return chapters


def split_into_chunks(
    chapters: list[Chapter],
    source_file: str,
    target_tokens: int = 500,
    overlap_tokens: int = 50,
) -> list[Chunk]:
    """
    Разбить главы на чанки для RAG.

    Args:
        chapters: Список глав
        source_file: Имя исходного файла
        target_tokens: Целевой размер чанка в токенах
        overlap_tokens: Перекрытие между чанками

    Returns:
        Список чанков
    """
    chunks: list[Chunk] = []
    chunk_index = 0
    target_chars = int(target_tokens * CHARS_PER_TOKEN)
    overlap_chars = int(overlap_tokens * CHARS_PER_TOKEN)

    for chapter in chapters:
        text = chapter.text
        if not text:
            continue

        # Если глава помещается в один чанк
        if len(text) <= target_chars:
            chunks.append(Chunk(
                chunk_index=chunk_index,
                source_file=source_file,
                chapter=chapter.title,
                page_start=chapter.start_page,
                page_end=chapter.end_page,
                content=text,
                token_estimate=chapter.token_estimate,
                char_count=chapter.char_count,
            ))
            chunk_index += 1
            continue

        # Разбиваем на чанки по абзацам
        paragraphs = re.split(r'\n\n+', text)
        current_chunk = ""
        chunk_start_page = chapter.start_page

        for para in paragraphs:
            # Если добавление параграфа не превышает лимит
            if len(current_chunk) + len(para) + 2 <= target_chars:
                current_chunk += ("\n\n" if current_chunk else "") + para
            else:
                # Сохраняем текущий чанк
                if current_chunk:
                    chunks.append(Chunk(
                        chunk_index=chunk_index,
                        source_file=source_file,
                        chapter=chapter.title,
                        page_start=chunk_start_page,
                        page_end=chapter.end_page,
                        content=current_chunk,
                        token_estimate=int(len(current_chunk) / CHARS_PER_TOKEN),
                        char_count=len(current_chunk),
                    ))
                    chunk_index += 1

                # Начинаем новый чанк с overlap
                if overlap_chars > 0 and len(current_chunk) > overlap_chars:
                    overlap_text = current_chunk[-overlap_chars:]
                    current_chunk = overlap_text + "\n\n" + para
                else:
                    current_chunk = para

        # Последний чанк из главы
        if current_chunk:
            chunks.append(Chunk(
                chunk_index=chunk_index,
                source_file=source_file,
                chapter=chapter.title,
                page_start=chunk_start_page,
                page_end=chapter.end_page,
                content=current_chunk,
                token_estimate=int(len(current_chunk) / CHARS_PER_TOKEN),
                char_count=len(current_chunk),
            ))
            chunk_index += 1

    return chunks


# ============================================================
# СБОРКА РЕЗУЛЬТАТА
# ============================================================

def process_pdf(pdf_path: str, chunk_size: int = 500) -> ExtractionResult:
    """Полный пайплайн обработки PDF."""
    filename = os.path.basename(pdf_path)

    print(f"  📄 Извлечение текста: {filename}")
    pages = extract_text_from_pdf(pdf_path)
    print(f"     Страниц: {len(pages)}")

    print(f"  📑 Определение глав...")
    chapters = detect_chapters(pages)
    print(f"     Глав: {len(chapters)}")

    print(f"  ✂️  Разбиение на чанки ({chunk_size} токенов)...")
    chunks = split_into_chunks(chapters, filename, target_tokens=chunk_size)
    print(f"     Чанков: {len(chunks)}")

    total_chars = sum(c.char_count for c in chapters)
    total_tokens = sum(c.token_estimate for c in chapters)

    return ExtractionResult(
        source_file=filename,
        total_pages=len(pages),
        total_chapters=len(chapters),
        total_chunks=len(chunks),
        total_chars=total_chars,
        total_token_estimate=total_tokens,
        chapters=chapters,
        chunks=chunks,
    )


# ============================================================
# СЕРИАЛИЗАЦИЯ
# ============================================================

def result_to_dict(result: ExtractionResult) -> dict:
    """Сериализовать результат в JSON-совместимый словарь."""
    return {
        "source_file": result.source_file,
        "total_pages": result.total_pages,
        "total_chapters": result.total_chapters,
        "total_chunks": result.total_chunks,
        "total_chars": result.total_chars,
        "total_token_estimate": result.total_token_estimate,
        "chapters": [
            {
                "title": ch.title,
                "start_page": ch.start_page,
                "end_page": ch.end_page,
                "char_count": ch.char_count,
                "token_estimate": ch.token_estimate,
                "text_preview": ch.text[:500] + "..." if len(ch.text) > 500 else ch.text,
            }
            for ch in result.chapters
        ],
        "chunks": [
            {
                "chunk_index": c.chunk_index,
                "source_file": c.source_file,
                "chapter": c.chapter,
                "page_start": c.page_start,
                "page_end": c.page_end,
                "token_estimate": c.token_estimate,
                "char_count": c.char_count,
                "content": c.content,
            }
            for c in result.chunks
        ],
    }


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Извлечение текста из PDF с разбиением на главы и чанки для RAG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python scripts/extract_pdf_text.py book.pdf
  python scripts/extract_pdf_text.py ./books/ --output-dir ./extracted/
  python scripts/extract_pdf_text.py doc.pdf --chunk-size 300
        """,
    )
    parser.add_argument("input", help="Путь к PDF-файлу или папке с PDF")
    parser.add_argument("--output-dir", default="./extracted", help="Папка для результатов (по умолчанию: ./extracted)")
    parser.add_argument("--chunk-size", type=int, default=500, help="Размер чанка в токенах (по умолчанию: 500)")
    parser.add_argument("--save-full-text", action="store_true", help="Сохранить полный текст в .txt")
    parser.add_argument("--json-only", action="store_true", help="Вывести только JSON (для пайплайнов)")

    args = parser.parse_args()

    # Определяем список PDF-файлов
    input_path = Path(args.input)
    if input_path.is_file() and input_path.suffix.lower() == ".pdf":
        pdf_files = [str(input_path)]
    elif input_path.is_dir():
        pdf_files = sorted(str(f) for f in input_path.glob("*.pdf"))
        if not pdf_files:
            print(f"В папке {input_path} нет PDF-файлов")
            sys.exit(1)
    else:
        print(f"Файл не найден: {input_path}")
        sys.exit(1)

    # Создаём выходную папку
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Обрабатываем каждый PDF
    all_results = []
    for pdf_path in pdf_files:
        print(f"\n🔍 Обработка: {pdf_path}")
        result = process_pdf(pdf_path, chunk_size=args.chunk_size)
        all_results.append(result)

        # Сохраняем JSON
        base_name = Path(pdf_path).stem
        json_path = output_dir / f"{base_name}_extracted.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(result_to_dict(result), f, ensure_ascii=False, indent=2)
        print(f"  💾 JSON: {json_path}")

        # Сохраняем полный текст
        if args.save_full_text:
            txt_path = output_dir / f"{base_name}_full.txt"
            with open(txt_path, "w", encoding="utf-8") as f:
                for ch in result.chapters:
                    f.write(f"\n{'='*60}\n")
                    f.write(f"ГЛАВА: {ch.title} (стр. {ch.start_page}–{ch.end_page})\n")
                    f.write(f"{'='*60}\n\n")
                    f.write(ch.text)
                    f.write("\n")
            print(f"  📝 Текст: {txt_path}")

        print(f"  ✅ Готово: {result.total_pages} стр, {result.total_chapters} глав, {result.total_chunks} чанков, ~{result.total_token_estimate} токенов")

    # Итоговый отчёт
    total_pages = sum(r.total_pages for r in all_results)
    total_chapters = sum(r.total_chapters for r in all_results)
    total_chunks = sum(r.total_chunks for r in all_results)
    total_tokens = sum(r.total_token_estimate for r in all_results)

    print(f"\n{'='*60}")
    print(f"📊 ИТОГ: {len(all_results)} PDF обработано")
    print(f"   Страниц: {total_pages}")
    print(f"   Глав: {total_chapters}")
    print(f"   Чанков: {total_chunks}")
    print(f"   Токенов (оценка): ~{total_tokens:,}")
    print(f"   Результаты: {output_dir}/")

    # JSON-only режим
    if args.json_only:
        summary = {
            "files_processed": len(all_results),
            "total_pages": total_pages,
            "total_chapters": total_chapters,
            "total_chunks": total_chunks,
            "total_token_estimate": total_tokens,
            "results": [result_to_dict(r) for r in all_results],
        }
        print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
