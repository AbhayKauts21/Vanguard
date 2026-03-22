from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Permission, Role, User


class UserRepository:
    async def count_users(self, session: AsyncSession) -> int:
        result = await session.execute(select(func.count()).select_from(User))
        return int(result.scalar_one())

    async def get_by_email(self, session: AsyncSession, email: str) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.email == email.lower())
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def get_by_id(self, session: AsyncSession, user_id: UUID) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.id == user_id)
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    async def list_users(self, session: AsyncSession) -> list[User]:
        stmt = select(User).options(selectinload(User.roles).selectinload(Role.permissions))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        session: AsyncSession,
        *,
        email: str,
        password_hash: str,
        full_name: str | None,
    ) -> User:
        user = User(
            email=email.lower(),
            password_hash=password_hash,
            full_name=full_name,
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)
        return user

    async def update_last_login(
        self,
        session: AsyncSession,
        user: User,
        when: datetime,
    ) -> User:
        user.last_login_at = when
        session.add(user)
        await session.flush()
        return user

    @staticmethod
    def collect_permissions(user: User) -> list[Permission]:
        seen: dict[str, Permission] = {}
        for role in user.roles:
            for permission in role.permissions:
                seen[permission.code] = permission
        return sorted(seen.values(), key=lambda item: item.code)


user_repository = UserRepository()
