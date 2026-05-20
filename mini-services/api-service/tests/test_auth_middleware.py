"""
Gidede — Auth Middleware Tests
Фаза 4.A.5: Тесты для middleware проверки JWT авторизации

Тестирует:
- get_current_user: valid token, invalid/expired token, refresh token, missing sub,
                    non-existent user, inactive user
- get_current_active_user: active user, inactive user
- require_plan: pro user, free user
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth_middleware import get_current_user, get_current_active_user, require_plan


# ============================================================
# Helpers
# ============================================================

def _make_credentials(token: str = "test-token") -> HTTPAuthorizationCredentials:
    """Создать мок HTTPAuthorizationCredentials."""
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _make_user(
    user_id: str = "user123",
    email: str = "test@gidede.com",
    name: str = "Test User",
    plan: str = "free",
    is_active: bool = True,
) -> MagicMock:
    """Создать мок User с нужными атрибутами."""
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.name = name
    user.plan = plan
    user.is_active = is_active
    user.hashed_password = "hashed"
    user.ai_calls_count = 0
    user.ai_calls_limit = 50
    return user


def _make_db_session(user: MagicMock = None) -> AsyncMock:
    """Создать мок AsyncSession, возвращающий заданного пользователя при запросе."""
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = user
    db.execute.return_value = result_mock
    return db


# ============================================================
# Tests: get_current_user
# ============================================================

@pytest.mark.asyncio
async def test_get_current_user_valid_token():
    """Валидный access token → возвращает пользователя."""
    user = _make_user(user_id="user123", is_active=True)
    db = _make_db_session(user=user)
    credentials = _make_credentials("valid-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "user123", "type": "access"}
        result = await get_current_user(credentials, db)

    assert result == user
    assert result.id == "user123"
    assert result.is_active is True
    mock_decode.assert_called_once_with("valid-token")


@pytest.mark.asyncio
async def test_get_current_user_invalid_token():
    """Невалидный/истёкший токен → 401."""
    db = _make_db_session()
    credentials = _make_credentials("bad-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Недействительный или истёкший токен" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_refresh_token_instead_of_access():
    """Refresh token вместо access → 401 с сообщением «Требуется access token»."""
    db = _make_db_session()
    credentials = _make_credentials("refresh-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "user123", "type": "refresh"}
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Требуется access token" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_missing_sub():
    """Токен без поля sub → 401."""
    db = _make_db_session()
    credentials = _make_credentials("no-sub-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"type": "access"}  # нет "sub"
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "отсутствует идентификатор пользователя" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_sub_is_empty_string():
    """Токен с пустым sub → 401."""
    db = _make_db_session()
    credentials = _make_credentials("empty-sub-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "", "type": "access"}
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "отсутствует идентификатор пользователя" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_nonexistent_user():
    """Токен валидный, но пользователь не найден в БД → 401."""
    db = _make_db_session(user=None)
    credentials = _make_credentials("valid-but-no-user")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "nonexistent_id", "type": "access"}
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Пользователь не найден" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_inactive_user():
    """Пользователь найден, но is_active=False → 403."""
    user = _make_user(user_id="inactive_user", is_active=False)
    db = _make_db_session(user=user)
    credentials = _make_credentials("inactive-user-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "inactive_user", "type": "access"}
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "деактивирован" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_401_has_www_authenticate_header():
    """Все 401 ошибки должны содержать WWW-Authenticate заголовок."""
    db = _make_db_session()
    credentials = _make_credentials("bad-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(credentials, db)

    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert exc_info.value.headers is not None
    assert exc_info.value.headers.get("WWW-Authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_get_current_user_pro_user_passes():
    """Pro-пользователь с валидным токеном проходит проверку."""
    user = _make_user(user_id="pro_user", plan="pro", is_active=True)
    db = _make_db_session(user=user)
    credentials = _make_credentials("pro-token")

    with patch("app.core.auth_middleware.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "pro_user", "type": "access", "plan": "pro"}
        result = await get_current_user(credentials, db)

    assert result == user
    assert result.plan == "pro"


# ============================================================
# Tests: get_current_active_user
# ============================================================

@pytest.mark.asyncio
async def test_get_current_active_user_active():
    """Активный пользователь → возвращает пользователя."""
    user = _make_user(is_active=True)
    result = await get_current_active_user(user)
    assert result == user


@pytest.mark.asyncio
async def test_get_current_active_user_inactive():
    """Неактивный пользователь → 403 (двойная проверка)."""
    user = _make_user(is_active=False)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_active_user(user)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "деактивирован" in exc_info.value.detail


# ============================================================
# Tests: require_plan
# ============================================================

@pytest.mark.asyncio
async def test_require_plan_pro_with_pro_user():
    """require_plan("pro") с pro-пользователем → возвращает пользователя."""
    check_plan = require_plan("pro")
    user = _make_user(plan="pro", is_active=True)

    result = await check_plan(user)
    assert result == user
    assert result.plan == "pro"


@pytest.mark.asyncio
async def test_require_plan_pro_with_free_user():
    """require_plan("pro") с free-пользователем → 403."""
    check_plan = require_plan("pro")
    user = _make_user(plan="free", is_active=True)

    with pytest.raises(HTTPException) as exc_info:
        await check_plan(user)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Pro-подписка" in exc_info.value.detail


@pytest.mark.asyncio
async def test_require_plan_non_pro_plan_passes():
    """require_plan("free") — любой активный пользователь проходит (только "pro" проверяется)."""
    check_plan = require_plan("free")
    user = _make_user(plan="free", is_active=True)

    result = await check_plan(user)
    assert result == user


@pytest.mark.asyncio
async def test_require_plan_returns_callable():
    """require_plan возвращает асинхронную функцию-зависимость."""
    check_plan = require_plan("pro")
    assert callable(check_plan)
