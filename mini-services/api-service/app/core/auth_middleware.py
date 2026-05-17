"""
Gidede — Middleware для проверки JWT авторизации
Фаза 4.A.5: Защита API-эндпоинтов
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.db import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Зависимость FastAPI для получения текущего пользователя из JWT токена.
    Используется для защиты эндпоинтов.
    """
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен: отсутствует идентификатор пользователя",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Получаем пользователя из БД
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Зависимость для получения активного пользователя."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )
    return current_user


def require_plan(required_plan: str):
    """
    Фабрика зависимостей для проверки уровня доступа.
    Использование: Depends(require_plan("pro"))
    """
    async def check_plan(current_user: User = Depends(get_current_active_user)) -> User:
        if required_plan == "pro" and current_user.plan != "pro":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Требуется Pro-подписка для данного действия",
            )
        return current_user
    return check_plan
