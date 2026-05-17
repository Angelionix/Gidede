"""Core module — общий функционал Gidede API."""

from .config import settings
from .logging_config import setup_logging

__all__ = ["settings", "setup_logging"]
