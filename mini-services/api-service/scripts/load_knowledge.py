#!/usr/bin/env python3
"""
Gidede — Загрузка базы знаний для RAG
Фаза 4.A.10: pgvector + база знаний

Загружает «Библию геймдизайна» (12 разделов) и ключевые фрагменты
из книг в таблицу knowledge_chunks с векторными эмбеддингами.

Использование:
    # Загрузить всё (библия + книги)
    python scripts/load_knowledge.py --all

    # Только библию геймдизайна
    python scripts/load_knowledge.py --bible

    # Только книги
    python scripts/load_knowledge.py --books

    # Конкретный файл
    python scripts/load_knowledge.py --file docs/bible/bible_2_1_fundament.md --type bible --name bible_2_1_fundament

    # Проверить статистику
    python scripts/load_knowledge.py --stats
"""

import asyncio
import argparse
import os
import sys

# Добавить путь к приложению
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def load_bible(bible_dir: str):
    """Загрузить все 12 разделов Библии геймдизайна."""
    from app.core.rag_service import get_rag_service

    rag = await get_rag_service()
    total = await rag.load_bible(bible_dir)
    print(f"[OK] Библия геймдизайна: {total} чанков загружено")
    return total


async def load_books(books_dir: str):
    """Загрузить ключевые фрагменты из 17 книг (PDF)."""
    from app.core.rag_service import get_rag_service

    rag = await get_rag_service()
    total_chunks = 0

    # Для PDF-книг нужна библиотека для извлечения текста
    # Пока что создаём метаданные-заглушки, текст будет добавлен позже
    # при установке PyPDF2/pdfplumber

    book_registry = {
        "Schell_Geymdizayn.pdf": {"name": "schell", "title": "Джесси Шелл — Искусство геймдизайна"},
        "Iskusstvo_Geymdizayna.pdf": {"name": "iskusstvo_geymdizayna", "title": "Искусство геймдизайна"},
        "Game_Mechanics_Advanced_Game_Design.pdf": {"name": "adams_dormans", "title": "Adams & Dormans — Game Mechanics"},
        "Igrovoy_balans_nauka.pdf": {"name": "igrovoy_balans", "title": "Игровой баланс — наука"},
        "Scott_Rogers_Level_Up.pdf": {"name": "rogers_level_up", "title": "Скотт Роджерс — Level Up"},
        "Zubek_Elementy_geymdizayna_2022.pdf": {"name": "zubek", "title": "Зубек — Элементы геймдизайна"},
        "Tracy_Fullerton_Game_Design_Workshop_2024.pdf": {"name": "fullerton", "title": "Tracy Fullerton — Game Design Workshop"},
        "Michael_Sellers_Advanced_Game_Design.pdf": {"name": "sellers", "title": "Michael Sellers — Advanced Game Design"},
        "Gazendasek_Vseadnye_dizainery_igr_2023.pdf": {"name": "gazendasek", "title": "Газендасек — Вседневные дизайнеры игр"},
        "Bri_Destins_Dumai_kak_geym_dizainer_2024.pdf": {"name": "destins", "title": "Бри Дестинс — Думай как гейм-дизайнер"},
        "Kadikov_Proektirovanie_virtualnyh_mirov_2019.pdf": {"name": "kadikov", "title": "Кадиков — Проектирование виртуальных миров"},
        "Rollingz_Morris_Proektirovanie_i_arkhitektura_igr.pdf": {
            "name": "rollingz_morris", "title": "Роллингз и Моррис — Проектирование и архитектура игр"
        },
        "LD_In_pursuit_of_better_levels.pdf": {"name": "ld_better_levels", "title": "Level Design — In Pursuit of Better Levels"},
        "SW_BAND.pdf": {"name": "sw_band", "title": "SW.BAND — Карты геймдизайнера"},
        "Kniga_Igroka_2024.pdf": {"name": "kniga_igroka", "title": "Книга Игрока 2024"},
        "Bond_Unity_i_Cs_2019.pdf": {"name": "bond_unity", "title": "Бонд — Unity и C#"},
    }

    print(f"[INFO] Найдено {len(book_registry)} книг в реестре")
    print("[INFO] Загрузка PDF-книг будет доступна после установки pdfplumber/PyPDF2")
    print("[INFO] Для загрузки книг выполните: pip install pdfplumber")

    # Проверяем, установлен ли pdfplumber
    try:
        import pdfplumber  # noqa: F401

        for pdf_file, info in book_registry.items():
            pdf_path = os.path.join(books_dir, pdf_file)
            if not os.path.exists(pdf_path):
                print(f"[SKIP] Файл не найден: {pdf_file}")
                continue

            try:
                text = _extract_pdf_text(pdf_path)
                if text.strip():
                    chunks = await rag.load_document(
                        content=text,
                        source_type="book",
                        source_name=info["name"],
                        title=info["title"],
                        metadata={"filename": pdf_file},
                    )
                    total_chunks += chunks
                    print(f"[OK] {info['title']}: {chunks} чанков")
                else:
                    print(f"[SKIP] {pdf_file}: пустой текст")
            except Exception as e:
                print(f"[ERROR] {pdf_file}: {e}")

    except ImportError:
        print("[WARN] pdfplumber не установлен. Установите: pip install pdfplumber")
        print("[INFO] Книги будут загружены при следующем запуске с pdfplumber")

    return total_chunks


def _extract_pdf_text(pdf_path: str) -> str:
    """Извлечь текст из PDF-файла."""
    import pdfplumber

    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    return "\n\n".join(text_parts)


async def load_single_file(file_path: str, source_type: str, source_name: str, title: str = None):
    """Загрузить один файл в базу знаний."""
    from app.core.rag_service import get_rag_service

    rag = await get_rag_service()
    chunks = await rag.load_file(
        file_path=file_path,
        source_type=source_type,
        source_name=source_name,
        title=title,
    )
    print(f"[OK] {file_path}: {chunks} чанков загружено")
    return chunks


async def show_stats():
    """Показать статистику базы знаний."""
    from app.core.rag_service import get_rag_service

    rag = await get_rag_service()
    stats = await rag.get_stats()

    print("\n=== Статистика базы знаний RAG ===")
    print(f"Всего чанков: {stats.get('total_chunks', 0)}")
    print(f"pgvector: {'Включён' if stats.get('pgvector_enabled') else 'Недоступен'}")
    print(f"RAG: {'Активен' if stats.get('rag_enabled') else 'Отключён'}")
    print(f"Модель эмбеддингов: {stats.get('embedding_model', 'N/A')}")
    print(f"Размерность: {stats.get('embedding_dimensions', 'N/A')}")

    by_type = stats.get("by_source_type", {})
    if by_type:
        print("\nПо типам источников:")
        for src_type, count in by_type.items():
            print(f"  {src_type}: {count} чанков")

    by_source = stats.get("by_source_name", {})
    if by_source:
        print("\nПо источникам:")
        for source, count in by_source.items():
            print(f"  {source}: {count} чанков")


async def main():
    parser = argparse.ArgumentParser(description="Загрузка базы знаний для RAG")
    parser.add_argument("--all", action="store_true", help="Загрузить всё (библия + книги)")
    parser.add_argument("--bible", action="store_true", help="Загрузить Библию геймдизайна")
    parser.add_argument("--books", action="store_true", help="Загрузить книги")
    parser.add_argument("--file", type=str, help="Загрузить конкретный файл")
    parser.add_argument("--type", type=str, default="bible", help="Тип источника (bible/book/algorithm)")
    parser.add_argument("--name", type=str, help="Имя источника")
    parser.add_argument("--title", type=str, help="Заголовок")
    parser.add_argument("--stats", action="store_true", help="Показать статистику")
    args = parser.parse_args()

    # Определяем пути к директориям с документами
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    bible_dir = os.path.join(repo_root, "docs", "bible")
    books_dir = os.path.join(repo_root, "docs", "books")

    if args.stats:
        await show_stats()
        return

    if args.file:
        if not args.name:
            args.name = os.path.splitext(os.path.basename(args.file))[0]
        await load_single_file(args.file, args.type, args.name, args.title)
        return

    if args.bible or args.all:
        await load_bible(bible_dir)

    if args.books or args.all:
        await load_books(books_dir)

    if not args.bible and not args.books and not args.all:
        parser.print_help()

    # Показать итоговую статистику
    await show_stats()


if __name__ == "__main__":
    asyncio.run(main())
