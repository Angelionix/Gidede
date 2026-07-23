#!/usr/bin/env python3
"""
Gidede — Type Sync Script
Фаза 4.A.12: Синхронизация типов между TypeScript и Python

Проверяет, что TypeScript-интерфейсы и Python Pydantic-модели
остаются синхронизированными. Запускается вручную или через pre-commit.

Использование:
    python shared/types/sync_types.py --check    # Проверить синхронизацию
    python shared/types/sync_types.py --report    # Показать отчёт
"""

import ast
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TS_ENUMS = REPO_ROOT / "shared" / "types" / "typescript" / "enums.ts"
TS_INTERFACES = REPO_ROOT / "shared" / "types" / "typescript" / "interfaces.ts"
PY_ENUMS = REPO_ROOT / "shared" / "types" / "python" / "enums.py"
PY_MODELS = REPO_ROOT / "shared" / "types" / "python" / "models.py"


def extract_ts_types(filepath: Path) -> dict[str, list[str]]:
    """Извлечь типы из TypeScript-файла."""
    content = filepath.read_text(encoding="utf-8")
    types = {}

    # type X = 'a' | 'b' | 'c'
    type_pattern = r"type\s+(\w+)\s*=\s*([^;]+);"
    for match in re.finditer(type_pattern, content):
        name = match.group(1)
        values_str = match.group(2)
        values = [v.strip().strip("'\"") for v in values_str.split("|")]
        types[name] = values

    # interface X { field: Type; ... }
    iface_pattern = r"export\s+interface\s+(\w+)\s*\{([^}]+)\}"
    for match in re.finditer(iface_pattern, content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)
        fields = []
        for line in body.strip().split("\n"):
            line = line.strip()
            if line and ":" in line and not line.startswith("//") and not line.startswith("*"):
                field_match = re.match(r"(\w+)\??\s*:", line)
                if field_match:
                    fields.append(field_match.group(1))
        types[name] = fields

    return types


def extract_py_types(filepath: Path) -> dict[str, list[str]]:
    """Извлечь типы из Python-файла."""
    content = filepath.read_text(encoding="utf-8")
    types = {}

    # Enum class
    enum_pattern = r"class\s+(\w+)\(str,\s*Enum\):\s*\"\"\"[^\"\"\"]*\"\"\"\s*((?:\s+\w+\s*=\s*\"[^\"]+\"\s*)+)"
    for match in re.finditer(enum_pattern, content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)
        values = []
        for member_match in re.finditer(r"(\w+)\s*=\s*\"([^\"]+)\"", body):
            values.append(member_match.group(2))
        types[name] = values

    # Pydantic model
    model_pattern = r"class\s+(\w+)\(BaseModel\):\s*(?:\"\"\"[^\"\"\"]*\"\"\"\s*)?((?:\s+.+\s*)+?)(?=\nclass|\Z)"
    for match in re.finditer(model_pattern, content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)
        fields = []
        for line in body.strip().split("\n"):
            line = line.strip()
            if line and ":" in line and not line.startswith("#") and not line.startswith("class"):
                field_match = re.match(r"(\w+)\s*:", line)
                if field_match:
                    fields.append(field_match.group(1))
        types[name] = fields

    return types


def check_enum_sync(ts_types: dict, py_types: dict) -> list[str]:
    """Проверить синхронизацию enum-ов."""
    issues = []

    # Маппинг TS → PY имён (для случаев, где имена отличаются)
    name_mapping = {
        "BalanceObjectType": "BalanceObjectType",
        "LoopStructuralType": "LoopStructuralType",
    }

    for ts_name, ts_values in ts_types.items():
        # Найти соответствующий Python-тип
        py_name = name_mapping.get(ts_name, ts_name)

        if py_name not in py_types:
            issues.append(f"ENUM MISSING: Python enum '{py_name}' not found (TS: '{ts_name}')")
            continue

        py_values = py_types[py_name]

        # Сравнить значения
        ts_set = set(ts_values)
        py_set = set(py_values)

        missing_in_py = ts_set - py_set
        extra_in_py = py_set - ts_set

        if missing_in_py:
            issues.append(f"ENUM MISMATCH: '{ts_name}' values missing in Python: {missing_in_py}")
        if extra_in_py:
            issues.append(f"ENUM MISMATCH: '{ts_name}' extra values in Python: {extra_in_py}")

    return issues


def check_interface_sync(ts_types: dict, py_types: dict) -> list[str]:
    """Проверить синхронизацию интерфейсов/моделей."""
    issues = []

    for ts_name, ts_fields in ts_types.items():
        if ts_name not in py_types:
            issues.append(f"MODEL MISSING: Python model '{ts_name}' not found")
            continue

        py_fields = py_types[ts_name]

        # Сравнить поля (с учётом snake_case/camelCase конвертации)
        ts_fields_snake = {camel_to_snake(f) for f in ts_fields}
        py_fields_set = set(py_fields)

        missing_in_py = ts_fields_snake - py_fields_set
        extra_in_py = py_fields_set - ts_fields_snake

        if missing_in_py:
            issues.append(f"MODEL MISMATCH: '{ts_name}' fields missing in Python: {missing_in_py}")
        if extra_in_py:
            # Игнорируем дополнительные поля в Python (могут быть alias-ы)
            pass

    return issues


def camel_to_snake(name: str) -> str:
    """Конвертировать camelCase в snake_case."""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def main():
    args = sys.argv[1:]
    if not args:
        args = ["--report"]

    # Извлечь типы
    ts_enums = extract_ts_types(TS_ENUMS)
    ts_interfaces = extract_ts_types(TS_INTERFACES)
    py_enums = extract_py_types(PY_ENUMS)
    py_models = extract_py_types(PY_MODELS)

    all_issues = []

    # Проверить enum-ы
    enum_issues = check_enum_sync(ts_enums, py_enums)
    all_issues.extend(enum_issues)

    # Проверить интерфейсы
    interface_issues = check_interface_sync(ts_interfaces, py_models)
    all_issues.extend(interface_issues)

    if "--report" in args:
        print("=" * 60)
        print("  Gidede Type Sync Report")
        print("=" * 60)
        print(f"\nTypeScript enums:  {len(ts_enums)}")
        print(f"TypeScript interfaces: {len(ts_interfaces)}")
        print(f"Python enums:  {len(py_enums)}")
        print(f"Python models: {len(py_models)}")
        print(f"\nIssues found: {len(all_issues)}")
        for issue in all_issues:
            print(f"  ⚠ {issue}")

        if not all_issues:
            print("\n  ✅ All types are synchronized!")

    if "--check" in args:
        if all_issues:
            print(f"\n❌ Type sync check FAILED: {len(all_issues)} issues found")
            sys.exit(1)
        else:
            print("\n✅ Type sync check PASSED")
            sys.exit(0)


if __name__ == "__main__":
    main()
