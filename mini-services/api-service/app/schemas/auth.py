"""
Gidede — Pydantic схемы авторизации
Фаза 4.A.5: JWT авторизация и управление пользователями
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ============================================================
# REQUEST SCHEMES
# ============================================================

class UserRegister(BaseModel):
    """Схема запроса регистрации."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Пароль (8-128 символов)")
    name: Optional[str] = Field(None, max_length=255, description="Имя пользователя")


class UserLogin(BaseModel):
    """Схема запроса логина."""
    email: EmailStr
    password: str = Field(..., description="Пароль")


class TokenRefreshRequest(BaseModel):
    """Схема запроса обновления токена."""
    refresh_token: str = Field(..., description="Refresh token")


class PasswordChange(BaseModel):
    """Схема запроса смены пароля."""
    old_password: str = Field(..., description="Старый пароль")
    new_password: str = Field(..., min_length=8, max_length=128, description="Новый пароль")


# ============================================================
# RESPONSE SCHEMES
# ============================================================

class UserResponse(BaseModel):
    """Схема ответа с данными пользователя."""
    id: str
    email: str
    name: Optional[str] = None
    plan: str = "free"
    ai_calls_count: int = 0
    ai_calls_limit: int = 50
    is_active: bool = True
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Схема ответа с JWT токенами."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # секунды до истечения access token
    user: UserResponse


class MessageResponse(BaseModel):
    """Общая схема ответа с сообщением."""
    message: str
