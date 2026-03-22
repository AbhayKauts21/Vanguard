from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import RefreshToken


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


auth_repository = AuthRepository()
