"""
Gidede — Компиляция Библии геймдизайна в PDF

Скрипт объединяет 12 markdown-файлов Библии геймдизайна
в единый PDF-документ с оглавлением.

Зависимости: markdown, weasyprint (или markdown-pdf)

Использование:
    python scripts/compile_bible_pdf.py
    python scripts/compile_bible_pdf.py --output docs/bible/Gidede_Game_Design_Bible.pdf
    python scripts/compile_bible_pdf.py --format html  # HTML вместо PDF
"""

import argparse
import os
import re
import sys
from pathlib import Path


# ============================================================
# Конфигурация
# ============================================================

BIBLE_DIR = Path(__file__).parent.parent / "docs" / "bible"
OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "bible"

BIBLE_FILES = {
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


def read_markdown_file(filepath: Path) -> str:
    """Прочитать markdown-файл с обработкой ошибок."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"  [WARN] Файл не найден: {filepath}")
        return f"\n\n## {filepath.stem}\n\n*Файл не найден*\n\n"
    except Exception as e:
        print(f"  [ERROR] Ошибка чтения {filepath}: {e}")
        return f"\n\n## {filepath.stem}\n\n*Ошибка чтения файла: {e}*\n\n"


def combine_bible_markdowns() -> str:
    """Объединить все 12 разделов Библии в один Markdown."""
    print("[1/3] Чтение markdown-файлов...")

    combined_parts = []

    # Титульная страница
    combined_parts.append("""# Библия геймдизайна Gidede

> **Проект**: Gidede — Game Design AI System
> **Версия**: Компиляция 12 разделов
> **Описание**: Систематизированный свод знаний по геймдизайну, основанный на анализе 17 книг и практическом опыте

---

""")

    # Оглавление
    combined_parts.append("## Оглавление\n\n")
    for i, (filename, title) in enumerate(BIBLE_FILES.items(), 1):
        combined_parts.append(f"{i}. [{title}](#{filename.replace('.md', '')})\n")
    combined_parts.append("\n---\n\n")

    # Содержание каждого раздела
    for filename, title in BIBLE_FILES.items():
        filepath = BIBLE_DIR / filename
        print(f"  [{len(combined_parts):3d}] {title} ← {filename}")
        content = read_markdown_file(filepath)
        if content:
            combined_parts.append(content)
            combined_parts.append("\n\n---\n\n")

    return "".join(combined_parts)


def markdown_to_html(md_text: str) -> str:
    """Конвертировать Markdown в HTML с базовым CSS."""
    try:
        import markdown
        html_body = markdown.markdown(
            md_text,
            extensions=["extra", "toc", "tables", "fenced_code"],
        )
    except ImportError:
        # Fallback: простая конвертация заголовков и абзацев
        html_body = simple_md_to_html(md_text)

    css = """
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: 'Noto Sans SC', 'DejaVu Sans', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a1a1a;
        }
        h1 { font-size: 22pt; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
        h2 { font-size: 16pt; color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 4px; margin-top: 24px; }
        h3 { font-size: 13pt; color: #34495e; margin-top: 16px; }
        h4 { font-size: 11pt; color: #7f8c8d; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        code { background-color: #f8f8f8; padding: 2px 4px; border-radius: 3px; font-size: 10pt; }
        blockquote { border-left: 4px solid #3498db; margin: 12px 0; padding: 8px 16px; background: #f0f7ff; }
        hr { border: none; border-top: 1px solid #ccc; margin: 24px 0; }
    </style>
    """

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Библия геймдизайна Gidede</title>
    {css}
</head>
<body>
{html_body}
</body>
</html>"""
    return html


def simple_md_to_html(md_text: str) -> str:
    """Простая конвертация Markdown → HTML (fallback без библиотеки markdown)."""
    html = md_text
    # Заголовки
    html = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    # Жирный и курсив
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
    # Горизонтальная линия
    html = re.sub(r'^---$', r'<hr>', html, flags=re.MULTILINE)
    # Абзацы
    paragraphs = html.split('\n\n')
    processed = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if p.startswith('<h') or p.startswith('<hr'):
            processed.append(p)
        else:
            processed.append(f'<p>{p}</p>')
    return '\n'.join(processed)


def html_to_pdf(html: str, output_path: Path) -> bool:
    """Конвертировать HTML в PDF через WeasyPrint."""
    try:
        from weasyprint import HTML
        print(f"[3/3] Генерация PDF: {output_path}")
        HTML(string=html).write_pdf(str(output_path))
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"  PDF создан: {output_path} ({size_mb:.1f} МБ)")
        return True
    except ImportError:
        print("[3/3] WeasyPrint не установлен. Сохраняю HTML.")
        print("  Для PDF: pip install weasyprint && python scripts/compile_bible_pdf.py")
        html_path = output_path.with_suffix('.html')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  HTML сохранён: {html_path}")
        return False
    except Exception as e:
        print(f"[3/3] Ошибка генерации PDF: {e}")
        html_path = output_path.with_suffix('.html')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"  HTML сохранён: {html_path}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Компиляция Библии геймдизайна в PDF/HTML")
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Путь к выходному файлу (по умолчанию: docs/bible/Gidede_Game_Design_Bible.pdf)"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["pdf", "html", "markdown"],
        default="pdf",
        help="Формат вывода (по умолчанию: pdf)"
    )
    args = parser.parse_args()

    # Определяем путь вывода
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = OUTPUT_DIR / "Gidede_Game_Design_Bible.pdf"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Шаг 1: Объединить markdown
    combined_md = combine_bible_markdowns()

    if args.format == "markdown":
        md_path = output_path.with_suffix('.md')
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(combined_md)
        print(f"\n[OK] Markdown сохранён: {md_path}")
        return

    # Шаг 2: Конвертировать в HTML
    print("[2/3] Конвертация Markdown → HTML...")
    html = markdown_to_html(combined_md)

    if args.format == "html":
        html_path = output_path.with_suffix('.html')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        size_kb = html_path.stat().st_size / 1024
        print(f"\n[OK] HTML сохранён: {html_path} ({size_kb:.0f} КБ)")
        return

    # Шаг 3: Конвертировать в PDF
    success = html_to_pdf(html, output_path)

    if success:
        print(f"\n[OK] Библия геймдизайна скомпилирована в PDF!")
    else:
        # Сохраняем HTML как fallback
        html_path = output_path.with_suffix('.html')
        print(f"\n[PARTIAL] Библия геймдизайна скомпилирована в HTML.")
        print(f"  Для генерации PDF установите weasyprint: pip install weasyprint")


if __name__ == "__main__":
    main()
