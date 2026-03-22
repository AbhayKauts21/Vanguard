from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from uuid import uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import settings
from app.core.exceptions import AuthenticationError

password_hasher = PasswordHash.recommended()


@dataclass(frozen=True)
class EncodedToken:
    token: str
    jti: str
    expires_at: datetime


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def _build_token(subject: str, token_type: str, expires_delta: timedelta) -> EncodedToken:
    now = datetime.now(timezone.utc)
    expires_at = now + expires_delta
    jti = str(uuid4())
    payload = {
        "sub": subject,
        "type": token_type,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    encoded = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return EncodedToken(token=encoded, jti=jti, expires_at=expires_at)


def create_access_token(subject: str) -> EncodedToken:
    return _build_token(
        subject=subject,
        token_type="access",
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str) -> EncodedToken:
    return _build_token(
        subject=subject,
        token_type="refresh",
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationError(detail="Invalid or expired token.") from exc

    token_type = payload.get("type")
    if expected_type and token_type != expected_type:
        raise AuthenticationError(detail="Invalid token type.")

    if not payload.get("sub") or not payload.get("jti"):
        raise AuthenticationError(detail="Token payload is incomplete.")

    return payload


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify a BookStack webhook HMAC-SHA256 signature."""
    if not signature or not secret:
        return False

    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
