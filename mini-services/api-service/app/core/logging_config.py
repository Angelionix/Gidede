"""
Настройка структурированного логирования Gidede API.
Фаза 4.E.7: Нагрузочное тестирование и мониторинг

Поддерживает text и json форматы через LOG_FORMAT env-var.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
import uuid
from datetime import datetime, timezone


logger = logging.getLogger("gidede")


# ---------------------------------------------------------------------------
# StructuredFormatter
# ---------------------------------------------------------------------------

class StructuredFormatter(logging.Formatter):
    """
    Форматтер логов с поддержкой text и json форматов.

    Text:  стандартный человекочитаемый формат
    JSON:  структурированный JSON для машинного парсинга
    """

    def __init__(self, fmt: str = "text", datefmt: str | None = None):
        super().__init__(datefmt=datefmt)
        self.fmt = fmt

    def format(self, record: logging.LogRecord) -> str:
        if self.fmt == "json":
            return self._format_json(record)
        return self._format_text(record)

    def _format_text(self, record: logging.LogRecord) -> str:
        """Человекочитаемый формат."""
        request_id = getattr(record, "request_id", "-")
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()
        message = f"{timestamp} | {record.levelname:<8s} | {record.name} | [{request_id}] {record.getMessage()}"

        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            message += "\n" + record.exc_text

        return message

    def _format_json(self, record: logging.LogRecord) -> str:
        """JSON-формат для машинного парсинга."""
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Добавить request_id если есть
        request_id = getattr(record, "request_id", None)
        if request_id and request_id != "-":
            log_entry["request_id"] = request_id

        # Добавить exception если есть
        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            log_entry["exception"] = record.exc_text

        return json.dumps(log_entry, ensure_ascii=False, default=str)


# ---------------------------------------------------------------------------
# RequestIdFilter
# ---------------------------------------------------------------------------

_thread_local = threading.local()


class RequestIdFilter(logging.Filter):
    """
    Фильтр, добавляющий request_id к каждой записи лога.

    Использование:
        filter.set_request_id("abc-123")
        # ... логирование в контексте запроса ...
        filter.clear_request_id()
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = getattr(_thread_local, "request_id", "-")
        return True

    @staticmethod
    def set_request_id(request_id: str) -> None:
        _thread_local.request_id = request_id

    @staticmethod
    def clear_request_id() -> None:
        _thread_local.request_id = "-"

    @staticmethod
    def generate_request_id() -> str:
        return str(uuid.uuid4())


# Глобальный экземпляр фильтра
_request_id_filter = RequestIdFilter()


# ---------------------------------------------------------------------------
# setup_logging
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    """
    Настроить логирование для всего приложения.

    Переменные окружения:
        LOG_FORMAT:  "text" (default) или "json"
        LOG_LEVEL:   "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL" (default: "INFO")
    """
    log_format = os.environ.get("LOG_FORMAT", "text").lower()
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()

    # Маппинг строковых уровней
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "WARN": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    numeric_level = level_map.get(log_level, logging.INFO)

    # Создать форматтер
    formatter = StructuredFormatter(fmt=log_format)

    # Настроить root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Удалить существующие handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Создать stdout handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)
    handler.setFormatter(formatter)
    handler.addFilter(_request_id_filter)

    root_logger.addHandler(handler)

    # Уменьшить шум от uvicorn
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    logger.info(
        "Логирование настроено: format=%s, level=%s",
        log_format,
        log_level,
    )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def log_request(method: str, path: str, status_code: int, duration: float) -> None:
    """Логировать HTTP-запрос."""
    logger.info(
        "HTTP %s %s → %d (%.3fs)",
        method,
        path,
        status_code,
        duration,
    )


def log_ai_call(provider: str, model: str, status: str, duration: float) -> None:
    """Логировать AI-вызов."""
    logger.info(
        "AI call: provider=%s model=%s status=%s duration=%.3fs",
        provider,
        model,
        status,
        duration,
    )


def log_db_query(query: str, duration: float) -> None:
    """Логировать DB-запрос."""
    logger.debug(
        "DB query: %s (%.3fs)",
        query,
        duration,
    )
