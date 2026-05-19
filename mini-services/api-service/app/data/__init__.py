"""
Gidede — Data module
Фаза 4.E.3: Кэширование часто используемых справочных данных
"""

from app.data.mechanics_db import (
    get_mechanics_by_group,
    get_mechanics_by_genre,
    get_mechanic_by_name,
    MECHANICS_DB_DATA,
)

__all__ = [
    "get_mechanics_by_group",
    "get_mechanics_by_genre",
    "get_mechanic_by_name",
    "MECHANICS_DB_DATA",
]
