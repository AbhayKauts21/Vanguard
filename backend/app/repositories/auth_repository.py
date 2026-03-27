from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PasswordResetCode, RefreshToken


class AuthRepository:
    async def create_refresh_token(
        self,
        session: AsyncSession,
        *,
        user_id,
        jti: str,
        expires_at: datetime,
    ) -> RefreshToken:
        token = RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at)
        session.add(token)
        await session.flush()
        await session.refresh(token)
        return token

    async def get_refresh_token_by_jti(
        self,
        session: AsyncSession,
        jti: str,
    ) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.jti == jti)
        result = await session.execute(stmt)
        return result.scalars().first()

    async def revoke_refresh_token(
        self,
        session: AsyncSession,
        refresh_token: RefreshToken,
    ) -> RefreshToken:
        refresh_token.revoked_at = datetime.now(timezone.utc)
        session.add(refresh_token)
        await session.flush()
        return refresh_token

    async def revoke_refresh_tokens_for_user(
        self,
        session: AsyncSession,
        *,
        user_id,
    ) -> None:
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await session.execute(stmt)

    async def revoke_active_password_reset_codes(
        self,
        session: AsyncSession,
        *,
        user_id,
    ) -> None:
        stmt = (
            update(PasswordResetCode)
            .where(
                PasswordResetCode.user_id == user_id,
                PasswordResetCode.consumed_at.is_(None),
                PasswordResetCode.expires_at > datetime.now(timezone.utc),
            )
            .values(consumed_at=datetime.now(timezone.utc))
        )
        await session.execute(stmt)

    async def create_password_reset_code(
        self,
        session: AsyncSession,
        *,
        user_id,
        code_hash: str,
        expires_at: datetime,
    ) -> PasswordResetCode:
        record = PasswordResetCode(
            user_id=user_id,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        session.add(record)
        await session.flush()
        await session.refresh(record)
        return record

    async def get_latest_password_reset_code(
        self,
        session: AsyncSession,
        *,
        user_id,
    ) -> PasswordResetCode | None:
        stmt = (
            select(PasswordResetCode)
            .where(PasswordResetCode.user_id == user_id)
            .order_by(PasswordResetCode.created_at.desc())
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def consume_password_reset_code(
        self,
        session: AsyncSession,
        record: PasswordResetCode,
    ) -> PasswordResetCode:
        record.consumed_at = datetime.now(timezone.utc)
        session.add(record)
        await session.flush()
        return record


auth_repository = AuthRepository()
