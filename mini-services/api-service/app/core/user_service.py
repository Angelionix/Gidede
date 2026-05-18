"""
Gidede — Сервис управления пользователями
Фаза 4.A.5: Управление refresh-токенами, пользователи

Отвечает за:
1. Хранение и валидация refresh-токенов
2. Получение и создание пользователей
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token, hash_password
from app.models.db import User, RefreshToken


async def store_refresh_token(
    db: AsyncSession,
    user_id: str,
    token: str,
    expires_at: datetime,
) -> RefreshToken:
    """Сохранение refresh token в БД."""
    db_token = RefreshToken(
        id=uuid.uuid4().hex,
        user_id=user_id,
        token=token,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(db_token)
    await db.flush()
    return db_token


async def revoke_refresh_token(db: AsyncSession, token: str) -> bool:
    """Отзыв refresh token."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == token)
    )
    db_token = result.scalar_one_or_none()
    if db_token and not db_token.is_revoked:
        db_token.is_revoked = True
        await db.flush()
        return True
    return False


async def validate_refresh_token(db: AsyncSession, token: str) -> Optional[User]:
    """Валидация refresh token и возврат пользователя."""
    # Проверяем JWT-формат
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        return None

    # Проверяем в БД
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == token,
            RefreshToken.is_revoked == False,  # noqa: E712
        )
    )
    db_token = result.scalar_one_or_none()
    if not db_token:
        return None

    # Проверяем срок действия
    if db_token.expires_at < datetime.now(timezone.utc):
        return None

    # Получаем пользователя
    result = await db.execute(
        select(User).where(User.id == db_token.user_id)
    )
    user = result.scalar_one_or_none()
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Получение пользователя по email."""
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    name: Optional[str] = None,
) -> User:
    """Создание нового пользователя."""
    hashed_pw = hash_password(password)
    user = User(
        id=uuid.uuid4().hex,
        email=email,
        name=name,
        hashed_password=hashed_pw,
        plan="free",
        ai_calls_count=0,
        ai_calls_limit=settings.FREE_AI_CALLS_LIMIT,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user
