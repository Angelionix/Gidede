"""
Gidede — Сервис авторизации (JWT + хеширование паролей)
Фаза 4.A.5: JWT авторизация, хеширование паролей
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Хеширование пароля с использованием bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля против хеша."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def _create_token(
    user_id: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: Optional[dict] = None,
) -> tuple[str, datetime]:
    """
    Внутренняя функция создания JWT токена.
    Возвращает (token, expires_at).
    """
    expires_at = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": user_id,
        "type": token_type,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "jti": uuid.uuid4().hex,
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expires_at


def create_access_token(user_id: str, plan: str = "free") -> tuple[str, datetime]:
    """
    Создание JWT access token.
    Возвращает (token, expires_at).
    """
    return _create_token(
        user_id=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims={"plan": plan},
    )


def create_refresh_token(user_id: str) -> tuple[str, datetime]:
    """
    Создание refresh token.
    Возвращает (token, expires_at).
    """
    return _create_token(
        user_id=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> Optional[dict]:
    """Декодирование и валидация JWT токена. Возвращает None при ошибке."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
