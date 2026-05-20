"""
Gidede — Tests for app.core.security module

Covers:
- hash_password: string output, unique salts, empty input
- verify_password: correct/wrong password, invalid hash, empty inputs
- create_access_token: return type, payload fields (sub, type, plan, exp, iat, jti)
- create_refresh_token: return type, payload fields (type=refresh, no plan)
- decode_token: valid access/refresh, expired, invalid, tampered
- Roundtrip: create + decode preserves data
- Edge cases: long passwords, special characters in user_id
"""

import time  # noqa: F401 — reserved for future time-sensitive tests
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from freezegun import freeze_time

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


# ============================================================
# hash_password
# ============================================================


class TestHashPassword:
    """Tests for hash_password function."""

    def test_returns_string(self):
        """hash_password should return a string."""
        result = hash_password("mypassword")
        assert isinstance(result, str)

    def test_returns_bcrypt_hash_format(self):
        """Result should be a valid bcrypt hash string starting with $2b$."""
        result = hash_password("mypassword")
        assert result.startswith("$2b$")
        # bcrypt hashes are 60 characters
        assert len(result) == 60

    def test_different_hashes_for_same_password(self):
        """Same password should produce different hashes due to random salt."""
        hash1 = hash_password("samepassword")
        hash2 = hash_password("samepassword")
        assert hash1 != hash2

    def test_handles_empty_string(self):
        """hash_password should handle an empty string without error."""
        result = hash_password("")
        assert isinstance(result, str)
        assert result.startswith("$2b$")

    def test_long_password_raises_valueerror(self):
        """bcrypt raises ValueError for passwords longer than 72 bytes.
        The security module does not truncate, so this is the expected behavior."""
        long_pw = "a" * 200  # 200 bytes > 72 byte bcrypt limit
        with pytest.raises(ValueError):
            hash_password(long_pw)

    def test_password_exactly_72_bytes(self):
        """A password exactly 72 bytes (bcrypt max) should work fine."""
        boundary_pw = "a" * 72
        result = hash_password(boundary_pw)
        assert isinstance(result, str)
        assert result.startswith("$2b$")
        assert verify_password(boundary_pw, result) is True

    def test_handles_unicode_password(self):
        """Should correctly hash passwords with Unicode characters."""
        result = hash_password("пароль密码🔐")
        assert isinstance(result, str)
        assert result.startswith("$2b$")


# ============================================================
# verify_password
# ============================================================


class TestVerifyPassword:
    """Tests for verify_password function."""

    def test_correct_password(self):
        """verify_password returns True for matching password and hash."""
        password = "correcthorsebatterystaple"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_wrong_password(self):
        """verify_password returns False for non-matching password."""
        hashed = hash_password("rightpassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_invalid_hash_format(self):
        """verify_password returns False when hashed_password is not a valid bcrypt hash."""
        assert verify_password("anypassword", "not-a-valid-hash") is False

    def test_empty_hash(self):
        """verify_password returns False for an empty hash string."""
        assert verify_password("anypassword", "") is False

    def test_empty_password_against_real_hash(self):
        """verify_password returns False for empty plain_password against a non-empty hash."""
        hashed = hash_password("nonemptypassword")
        assert verify_password("", hashed) is False

    def test_empty_password_against_empty_hash(self):
        """verify_password returns False for both empty password and empty hash."""
        assert verify_password("", "") is False

    def test_none_like_hash(self):
        """verify_password returns False for non-string-like hash inputs."""
        assert verify_password("password", "   ") is False

    def test_special_characters_password(self):
        """Passwords with special characters should verify correctly."""
        password = "P@$$w0rd!#%^&*()"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


# ============================================================
# create_access_token
# ============================================================


class TestCreateAccessToken:
    """Tests for create_access_token function."""

    def test_returns_tuple_str_datetime(self):
        """Should return a (token_string, expires_at_datetime) tuple."""
        result = create_access_token(user_id="user123")
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)
        assert isinstance(result[1], datetime)

    def test_payload_has_sub(self):
        """Decoded payload should contain 'sub' matching the user_id."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"

    def test_payload_has_type_access(self):
        """Decoded payload should contain type='access'."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "access"

    def test_payload_has_plan_default_free(self):
        """Default plan claim should be 'free'."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["plan"] == "free"

    def test_payload_has_custom_plan(self):
        """Custom plan should be stored in the token."""
        token, _ = create_access_token(user_id="user123", plan="pro")
        payload = decode_token(token)
        assert payload is not None
        assert payload["plan"] == "pro"

    def test_payload_has_exp(self):
        """Decoded payload should contain 'exp' (expiration)."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert "exp" in payload

    def test_payload_has_iat(self):
        """Decoded payload should contain 'iat' (issued-at)."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert "iat" in payload

    def test_payload_has_jti(self):
        """Decoded payload should contain 'jti' (unique token identifier)."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert "jti" in payload
        # jti should be a hex string (uuid4.hex)
        assert len(payload["jti"]) == 32

    def test_expires_at_is_future(self):
        """Returned expires_at should be in the future relative to now."""
        _, expires_at = create_access_token(user_id="user123")
        assert expires_at > datetime.now(timezone.utc) - timedelta(seconds=1)

    def test_expires_at_matches_settings(self):
        """expires_at should be approximately ACCESS_TOKEN_EXPIRE_MINUTES from now."""
        before = datetime.now(timezone.utc)
        _, expires_at = create_access_token(user_id="user123")
        after = datetime.now(timezone.utc)
        expected_min = before + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        expected_max = after + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        assert expected_min <= expires_at <= expected_max

    def test_different_user_ids_produce_different_tokens(self):
        """Different user_ids should produce different tokens."""
        token1, _ = create_access_token(user_id="user1")
        token2, _ = create_access_token(user_id="user2")
        assert token1 != token2


# ============================================================
# create_refresh_token
# ============================================================


class TestCreateRefreshToken:
    """Tests for create_refresh_token function."""

    def test_returns_tuple_str_datetime(self):
        """Should return a (token_string, expires_at_datetime) tuple."""
        result = create_refresh_token(user_id="user123")
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)
        assert isinstance(result[1], datetime)

    def test_payload_has_type_refresh(self):
        """Decoded payload should contain type='refresh'."""
        token, _ = create_refresh_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_payload_has_no_plan(self):
        """Refresh token should NOT contain a 'plan' field."""
        token, _ = create_refresh_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert "plan" not in payload

    def test_payload_has_sub(self):
        """Decoded payload should contain 'sub' matching the user_id."""
        token, _ = create_refresh_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"

    def test_expires_at_matches_settings(self):
        """expires_at should be approximately REFRESH_TOKEN_EXPIRE_DAYS from now."""
        before = datetime.now(timezone.utc)
        _, expires_at = create_refresh_token(user_id="user123")
        after = datetime.now(timezone.utc)
        expected_min = before + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        expected_max = after + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        assert expected_min <= expires_at <= expected_max

    def test_payload_has_jti(self):
        """Refresh token should also have a unique jti."""
        token, _ = create_refresh_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert "jti" in payload


# ============================================================
# decode_token
# ============================================================


class TestDecodeToken:
    """Tests for decode_token function."""

    def test_valid_access_token(self):
        """Decoding a valid access token should return the payload dict."""
        token, _ = create_access_token(user_id="user123", plan="pro")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"
        assert payload["type"] == "access"
        assert payload["plan"] == "pro"

    def test_valid_refresh_token(self):
        """Decoding a valid refresh token should return the payload dict."""
        token, _ = create_refresh_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"
        assert payload["type"] == "refresh"

    def test_expired_token_returns_none(self):
        """An expired token should decode to None."""
        # Create a token that expired 1 hour ago using freezegun
        past_time = datetime.now(timezone.utc) - timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES + 60
        )
        with freeze_time(past_time):
            token, _ = create_access_token(user_id="user123")
        # Now we're back in the present — token is expired
        result = decode_token(token)
        assert result is None

    def test_invalid_token_returns_none(self):
        """A completely invalid string should return None."""
        result = decode_token("this.is.not.a.jwt")
        assert result is None

    def test_tampered_token_returns_none(self):
        """A token with modified payload should return None."""
        token, _ = create_access_token(user_id="user123")
        # Tamper: change one character in the middle of the token
        tampered = token[:-5] + chr(ord(token[-5]) + 1) + token[-4:]
        result = decode_token(tampered)
        assert result is None

    def test_token_with_wrong_secret_returns_none(self):
        """Token signed with a different secret should fail to decode."""
        # Manually create a token with a different secret
        payload = {
            "sub": "user123",
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        fake_token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")
        result = decode_token(fake_token)
        assert result is None

    def test_empty_string_returns_none(self):
        """An empty string should return None."""
        assert decode_token("") is None


# ============================================================
# Token Roundtrip
# ============================================================


class TestTokenRoundtrip:
    """Tests verifying create + decode roundtrip preserves data."""

    def test_access_token_roundtrip(self):
        """Create then decode an access token: all fields preserved."""
        user_id = "roundtrip_user"
        plan = "enterprise"
        token, _ = create_access_token(user_id=user_id, plan=plan)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert payload["plan"] == plan
        assert "exp" in payload
        assert "iat" in payload
        assert "jti" in payload

    def test_refresh_token_roundtrip(self):
        """Create then decode a refresh token: all fields preserved."""
        user_id = "roundtrip_refresh_user"
        token, _ = create_refresh_token(user_id=user_id)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"
        assert "plan" not in payload
        assert "exp" in payload
        assert "iat" in payload
        assert "jti" in payload

    def test_exp_is_consistent_with_returned_expires_at(self):
        """The 'exp' in the decoded payload should match the returned expires_at."""
        token, expires_at = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        # JWT exp is a Unix timestamp integer
        payload_exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        # They should be equal (same second)
        assert abs((payload_exp - expires_at).total_seconds()) < 1

    def test_iat_is_before_exp(self):
        """iat (issued-at) should always be before exp (expiration)."""
        token, _ = create_access_token(user_id="user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["iat"] < payload["exp"]


# ============================================================
# Edge Cases
# ============================================================


class TestEdgeCases:
    """Edge-case tests for the security module."""

    def test_password_at_72_byte_boundary(self):
        """Passwords at the 72-byte bcrypt boundary should hash and verify correctly."""
        pw_72 = "a" * 72
        hashed = hash_password(pw_72)
        assert verify_password(pw_72, hashed) is True
        assert verify_password("b" * 72, hashed) is False

    def test_long_password_raises_valueerror(self):
        """Passwords exceeding 72 bytes should raise ValueError."""
        with pytest.raises(ValueError):
            hash_password("x" * 200)

    def test_special_characters_in_user_id(self):
        """User IDs with special characters should survive roundtrip."""
        special_id = "user-123_abc@example.com"
        token, _ = create_access_token(user_id=special_id)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == special_id

    def test_unicode_in_user_id(self):
        """Unicode user IDs should survive roundtrip."""
        unicode_id = "пользователь_用户_🔑"
        token, _ = create_access_token(user_id=unicode_id)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == unicode_id

    def test_jwt_unique_per_creation(self):
        """Two tokens created for the same user at the same time differ due to jti."""
        frozen = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        with freeze_time(frozen):
            token1, _ = create_access_token(user_id="user1", plan="free")
            token2, _ = create_access_token(user_id="user1", plan="free")
        # Even with identical timestamps, jti makes them unique
        assert token1 != token2

    def test_hash_verify_full_workflow(self):
        """End-to-end: hash a password, create token, decode, verify password."""
        password = "SecureP@ss123"
        user_id = "workflow_user"
        plan = "pro"

        hashed = hash_password(password)
        token, expires_at = create_access_token(user_id=user_id, plan=plan)
        payload = decode_token(token)

        # Verify password
        assert verify_password(password, hashed) is True
        assert verify_password("wrong", hashed) is False

        # Verify token
        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["plan"] == plan

    def test_two_access_tokens_same_user_have_different_jti(self):
        """Two access tokens for the same user should have different jtis."""
        token1, _ = create_access_token(user_id="sameuser")
        token2, _ = create_access_token(user_id="sameuser")
        payload1 = decode_token(token1)
        payload2 = decode_token(token2)
        assert payload1["jti"] != payload2["jti"]

    def test_refresh_token_expires_later_than_access_token(self):
        """Refresh token's expires_at should be later than access token's."""
        _, access_exp = create_access_token(user_id="user123")
        _, refresh_exp = create_refresh_token(user_id="user123")
        assert refresh_exp > access_exp
