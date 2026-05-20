"""
Gidede — User Service Tests
Фаза 4.A.5: Тесты для сервиса управления пользователями

Тестирует:
- create_user: без name, с name, хеширование пароля, план free, is_active
- get_user_by_email: найден, не найден
- store_refresh_token: хранение и возврат RefreshToken
- revoke_refresh_token: успех, уже отозван / не найден
- validate_refresh_token: валидный токен, неверный тип (access),
                          отозванный токен, истёкший токен, невалидный JWT
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, call

from app.core.user_service import (
    store_refresh_token,
    revoke_refresh_token,
    validate_refresh_token,
    get_user_by_email,
    create_user,
)


# ============================================================
# Helpers
# ============================================================

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
    user.hashed_password = "hashed_pw"
    user.ai_calls_count = 0
    user.ai_calls_limit = 50
    return user


def _make_refresh_token(
    token: str = "refresh-jwt-token",
    user_id: str = "user123",
    is_revoked: bool = False,
    expires_at: datetime = None,
) -> MagicMock:
    """Создать мок RefreshToken."""
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    rt = MagicMock()
    rt.id = "rt123"
    rt.token = token
    rt.user_id = user_id
    rt.is_revoked = is_revoked
    rt.expires_at = expires_at
    return rt


def _make_db_session() -> AsyncMock:
    """Создать базовый мок AsyncSession."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.execute = AsyncMock()
    return db


# ============================================================
# Tests: create_user
# ============================================================

@pytest.mark.asyncio
async def test_create_user_basic():
    """Создание пользователя без name: plan=free, is_active=True, хешированный пароль."""
    db = _make_db_session()

    with patch("app.core.user_service.hash_password") as mock_hash:
        mock_hash.return_value = "hashed_password_123"
        user = await create_user(db, email="new@gidede.com", password="SecretPass123!")

    # Проверяем, что hash_password вызван с паролем
    mock_hash.assert_called_once_with("SecretPass123!")

    # Проверяем, что db.add вызван (передан User объект)
    db.add.assert_called_once()
    db.flush.assert_awaited_once()

    # Проверяем атрибуты созданного пользователя
    added_user = db.add.call_args[0][0]
    assert added_user.email == "new@gidede.com"
    assert added_user.hashed_password == "hashed_password_123"
    assert added_user.plan == "free"
    assert added_user.is_active is True
    assert added_user.ai_calls_count == 0
    assert added_user.name is None


@pytest.mark.asyncio
async def test_create_user_with_name():
    """Создание пользователя с параметром name."""
    db = _make_db_session()

    with patch("app.core.user_service.hash_password") as mock_hash:
        mock_hash.return_value = "hashed_pw"
        user = await create_user(
            db, email="named@gidede.com", password="Pass123!", name="Alice"
        )

    added_user = db.add.call_args[0][0]
    assert added_user.name == "Alice"
    assert added_user.email == "named@gidede.com"


@pytest.mark.asyncio
async def test_create_user_has_uuid_id():
    """Созданный пользователь получает сгенерированный id (uuid hex)."""
    db = _make_db_session()

    with patch("app.core.user_service.hash_password") as mock_hash:
        mock_hash.return_value = "hashed"
        user = await create_user(db, email="id@gidede.com", password="Pass123!")

    added_user = db.add.call_args[0][0]
    assert added_user.id is not None
    assert len(added_user.id) == 32  # uuid4().hex is 32 chars


@pytest.mark.asyncio
async def test_create_user_ai_calls_limit_from_settings():
    """ai_calls_limit берётся из settings.FREE_AI_CALLS_LIMIT."""
    db = _make_db_session()

    with patch("app.core.user_service.hash_password") as mock_hash, \
         patch("app.core.user_service.settings") as mock_settings:
        mock_hash.return_value = "hashed"
        mock_settings.FREE_AI_CALLS_LIMIT = 42
        user = await create_user(db, email="limit@gidede.com", password="Pass123!")

    added_user = db.add.call_args[0][0]
    assert added_user.ai_calls_limit == 42


# ============================================================
# Tests: get_user_by_email
# ============================================================

@pytest.mark.asyncio
async def test_get_user_by_email_found():
    """Пользователь найден по email → возвращает User."""
    user = _make_user(email="found@gidede.com")
    db = _make_db_session()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = user
    db.execute.return_value = result_mock

    result = await get_user_by_email(db, "found@gidede.com")

    assert result == user
    assert result.email == "found@gidede.com"


@pytest.mark.asyncio
async def test_get_user_by_email_not_found():
    """Пользователь не найден по email → возвращает None."""
    db = _make_db_session()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    db.execute.return_value = result_mock

    result = await get_user_by_email(db, "nobody@gidede.com")

    assert result is None


# ============================================================
# Tests: store_refresh_token
# ============================================================

@pytest.mark.asyncio
async def test_store_refresh_token():
    """Хранение refresh token в БД → возвращает RefreshToken объект."""
    db = _make_db_session()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    token = await store_refresh_token(
        db, user_id="user123", token="jwt-refresh-token", expires_at=expires_at
    )

    # db.add вызван с RefreshToken
    db.add.assert_called_once()
    db.flush.assert_awaited_once()

    added_token = db.add.call_args[0][0]
    assert added_token.token == "jwt-refresh-token"
    assert added_token.user_id == "user123"
    assert added_token.expires_at == expires_at
    assert added_token.is_revoked is False
    assert added_token.id is not None


@pytest.mark.asyncio
async def test_store_refresh_token_returns_added_object():
    """store_refresh_token возвращает тот же объект, что был добавлен в db.add."""
    db = _make_db_session()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    token = await store_refresh_token(
        db, user_id="u1", token="rt1", expires_at=expires_at
    )

    added_token = db.add.call_args[0][0]
    assert token is added_token


# ============================================================
# Tests: revoke_refresh_token
# ============================================================

@pytest.mark.asyncio
async def test_revoke_refresh_token_success():
    """Успешный отзыв refresh token → возвращает True."""
    rt = _make_refresh_token(token="rt1", is_revoked=False)
    db = _make_db_session()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = rt
    db.execute.return_value = result_mock

    result = await revoke_refresh_token(db, "rt1")

    assert result is True
    assert rt.is_revoked is True
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_revoke_refresh_token_already_revoked():
    """Попытка отзыва уже отозванного токена → возвращает False."""
    rt = _make_refresh_token(token="rt1", is_revoked=True)
    db = _make_db_session()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = rt
    db.execute.return_value = result_mock

    result = await revoke_refresh_token(db, "rt1")

    assert result is False
    # flush НЕ должен вызываться, т.к. ничего не изменилось
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_revoke_refresh_token_not_found():
    """Попытка отзыва несуществующего токена → возвращает False."""
    db = _make_db_session()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    db.execute.return_value = result_mock

    result = await revoke_refresh_token(db, "nonexistent-token")

    assert result is False
    db.flush.assert_not_awaited()


# ============================================================
# Tests: validate_refresh_token
# ============================================================

@pytest.mark.asyncio
async def test_validate_refresh_token_valid():
    """Валидный refresh token → возвращает пользователя."""
    user = _make_user(user_id="user123")
    rt = _make_refresh_token(
        token="valid-rt",
        user_id="user123",
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db = _make_db_session()

    # Первая query — RefreshToken, вторая — User
    rt_result = MagicMock()
    rt_result.scalar_one_or_none.return_value = rt

    user_result = MagicMock()
    user_result.scalar_one_or_none.return_value = user

    db.execute.side_effect = [rt_result, user_result]

    with patch("app.core.user_service.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "user123", "type": "refresh"}
        result = await validate_refresh_token(db, "valid-rt")

    assert result == user
    assert result.id == "user123"


@pytest.mark.asyncio
async def test_validate_refresh_token_wrong_type_access():
    """Токен с type=access вместо refresh → возвращает None."""
    db = _make_db_session()

    with patch("app.core.user_service.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "user123", "type": "access"}
        result = await validate_refresh_token(db, "access-token")

    assert result is None
    # DB не должен вызываться, т.к. проверка типа происходит до запроса
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_validate_refresh_token_revoked():
    """Отозванный refresh token → возвращает None."""
    db = _make_db_session()

    # DB запрос вернёт None (is_revoked=True не пройдёт фильтр)
    rt_result = MagicMock()
    rt_result.scalar_one_or_none.return_value = None
    db.execute.return_value = rt_result

    with patch("app.core.user_service.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "user123", "type": "refresh"}
        result = await validate_refresh_token(db, "revoked-rt")

    assert result is None


@pytest.mark.asyncio
async def test_validate_refresh_token_expired():
    """Истёкший refresh token → возвращает None."""
    rt = _make_refresh_token(
        token="expired-rt",
        user_id="user123",
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),  # истёк
    )
    db = _make_db_session()

    rt_result = MagicMock()
    rt_result.scalar_one_or_none.return_value = rt
    db.execute.return_value = rt_result

    with patch("app.core.user_service.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "user123", "type": "refresh"}
        result = await validate_refresh_token(db, "expired-rt")

    assert result is None


@pytest.mark.asyncio
async def test_validate_refresh_token_invalid_jwt():
    """Невалидный JWT → decode_token возвращает None → возвращает None."""
    db = _make_db_session()

    with patch("app.core.user_service.decode_token") as mock_decode:
        mock_decode.return_value = None
        result = await validate_refresh_token(db, "garbage-token")

    assert result is None
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_validate_refresh_token_user_not_found():
    """Токен валидный, но пользователь не найден в БД → возвращает None."""
    rt = _make_refresh_token(
        token="orphan-rt",
        user_id="deleted_user",
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db = _make_db_session()

    # Первая query — RefreshToken найден, вторая — User не найден
    rt_result = MagicMock()
    rt_result.scalar_one_or_none.return_value = rt

    user_result = MagicMock()
    user_result.scalar_one_or_none.return_value = None

    db.execute.side_effect = [rt_result, user_result]

    with patch("app.core.user_service.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "deleted_user", "type": "refresh"}
        result = await validate_refresh_token(db, "orphan-rt")

    assert result is None
