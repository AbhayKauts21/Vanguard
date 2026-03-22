import pytest

from app.core.exceptions import AuthenticationError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hashing_round_trip():
    password = "StrongPass123"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_decode_token_rejects_wrong_token_type():
    access = create_access_token("user-123")
    refresh = create_refresh_token("user-123")

    access_payload = decode_token(access.token, expected_type="access")
    assert access_payload["sub"] == "user-123"

    with pytest.raises(AuthenticationError):
        decode_token(refresh.token, expected_type="access")
