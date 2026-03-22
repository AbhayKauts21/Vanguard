from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Permission, Role, User


class RBACRepository:
    async def list_roles(self, session: AsyncSession) -> list[Role]:
        stmt = select(Role).options(selectinload(Role.permissions)).order_by(Role.name.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_role_by_name(self, session: AsyncSession, name: str) -> Role | None:
        stmt = select(Role).options(selectinload(Role.permissions)).where(Role.name == name)
        result = await session.execute(stmt)
        return result.scalars().first()

    async def get_role_by_id(self, session: AsyncSession, role_id: UUID) -> Role | None:
        stmt = select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
        result = await session.execute(stmt)
        return result.scalars().first()

    async def list_roles_by_ids(self, session: AsyncSession, role_ids: list[UUID]) -> list[Role]:
        if not role_ids:
            return []
        stmt = select(Role).options(selectinload(Role.permissions)).where(Role.id.in_(role_ids))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create_role(
        self,
        session: AsyncSession,
        *,
        name: str,
        description: str | None,
    ) -> Role:
        role = Role(name=name, description=description)
        session.add(role)
        await session.flush()
        await session.refresh(role)
        return role

    async def list_permissions(self, session: AsyncSession) -> list[Permission]:
        stmt = select(Permission).order_by(Permission.code.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_permission_by_code(self, session: AsyncSession, code: str) -> Permission | None:
        stmt = select(Permission).where(Permission.code == code)
        result = await session.execute(stmt)
        return result.scalars().first()

    async def list_permissions_by_ids(
        self, session: AsyncSession, permission_ids: list[UUID]
    ) -> list[Permission]:
        if not permission_ids:
            return []
        stmt = select(Permission).where(Permission.id.in_(permission_ids))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create_permission(
        self,
        session: AsyncSession,
        *,
        code: str,
        description: str | None,
    ) -> Permission:
        permission = Permission(code=code, description=description)
        session.add(permission)
        await session.flush()
        await session.refresh(permission)
        return permission

    async def assign_roles_to_user(
        self,
        session: AsyncSession,
        *,
        user: User,
        roles: list[Role],
    ) -> User:
        user.roles = roles
        session.add(user)
        await session.flush()
        await session.refresh(user)
        return user

    async def assign_permissions_to_role(
        self,
        session: AsyncSession,
        *,
        role: Role,
        permissions: list[Permission],
    ) -> Role:
        role.permissions = permissions
        session.add(role)
        await session.flush()
        await session.refresh(role)
        return role


rbac_repository = RBACRepository()
