"""
Gidede — API эндпоинты авторизации
Фаза 4.A.5: JWT авторизация и управление пользователями

Эндпоинты:
- POST /register — регистрация нового пользователя
- POST /login — авторизация (получение JWT токенов)
- POST /refresh — обновление access token через refresh token
- GET /me — получение данных текущего пользователя
- PUT /me — обновление данных текущего пользователя
- POST /logout — отзыв refresh token
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token,
)
from app.core.user_service import (
    store_refresh_token, validate_refresh_token, revoke_refresh_token,
    get_user_by_email, create_user,
)
from app.core.auth_middleware import get_current_active_user
from app.core.config import settings
from app.models.db import User
from app.schemas.auth import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    TokenRefreshRequest, PasswordChange, MessageResponse,
)

router = APIRouter()


def _build_token_response(user: User, access_token: str, refresh_token: str) -> TokenResponse:
    """Сборка ответа с токенами."""
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegister,
    db: AsyncSession = Depends(get_db),
):
    """Регистрация нового пользователя. Автоматический логин после регистрации."""
    # Проверяем, что email не занят
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    # Создаём пользователя
    user = await create_user(db, data.email, data.password, data.name)
    await db.flush()

    # Генерируем токены
    access_token, _ = create_access_token(user.id, user.plan)
    refresh_token, refresh_expires = create_refresh_token(user.id)

    # Сохраняем refresh token
    await store_refresh_token(db, user.id, refresh_token, refresh_expires)
    await db.flush()

    return _build_token_response(user, access_token, refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Авторизация пользователя. Возвращает access и refresh токены."""
    # Ищем пользователя
    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    # Проверяем пароль
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    # Проверяем, что аккаунт активен
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    # Обновляем дату последнего входа
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    # Генерируем токены
    access_token, _ = create_access_token(user.id, user.plan)
    refresh_token, refresh_expires = create_refresh_token(user.id)

    # Сохраняем refresh token
    await store_refresh_token(db, user.id, refresh_token, refresh_expires)
    await db.flush()

    return _build_token_response(user, access_token, refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Обновление access token с помощью refresh token."""
    # Валидируем refresh token
    user = await validate_refresh_token(db, data.refresh_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истёкший refresh token",
        )

    # Отзываем старый refresh token (ротация)
    await revoke_refresh_token(db, data.refresh_token)

    # Генерируем новые токены
    access_token, _ = create_access_token(user.id, user.plan)
    new_refresh_token, refresh_expires = create_refresh_token(user.id)

    # Сохраняем новый refresh token
    await store_refresh_token(db, user.id, new_refresh_token, refresh_expires)
    await db.flush()

    return _build_token_response(user, access_token, new_refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
):
    """Получение данных текущего пользователя."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    name: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновление имени текущего пользователя."""
    if name is not None:
        current_user.name = name
    await db.flush()
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    data: TokenRefreshRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Выход из системы — отзыв refresh token."""
    revoked = await revoke_refresh_token(db, data.refresh_token)
    if revoked:
        return MessageResponse(message="Успешный выход из системы")
    return MessageResponse(message="Токен уже отозван или не найден")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Смена пароля текущего пользователя."""
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль",
        )

    from app.core.security import hash_password
    current_user.hashed_password = hash_password(data.new_password)
    await db.flush()

    return MessageResponse(message="Пароль успешно изменён")
