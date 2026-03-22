from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ResourceNotFoundError
from app.db.models import User
from app.domain.schemas import (
    PermissionCreateRequest,
    PermissionListResponse,
    RoleCreateRequest,
    RoleListResponse,
    RolePermissionAssignmentRequest,
    RoleResponse,
    UserListResponse,
    UserResponse,
    UserRoleAssignmentRequest,
)
from app.repositories.rbac_repository import rbac_repository
from app.repositories.user_repository import user_repository
from app.services.identity_mapper import (
    to_permission_response,
    to_role_response,
    to_user_response,
)


class RBACService:
    async def list_roles(self, session: AsyncSession) -> RoleListResponse:
        roles = await rbac_repository.list_roles(session)
        return RoleListResponse(items=[to_role_response(role) for role in roles])

    async def create_role(
        self,
        session: AsyncSession,
        payload: RoleCreateRequest,
    ) -> RoleResponse:
        existing = await rbac_repository.get_role_by_name(session, payload.name)
        if existing is not None:
            raise ConflictError(detail=f"Role '{payload.name}' already exists.")

        role = await rbac_repository.create_role(
            session,
            name=payload.name,
            description=payload.description,
        )
        await session.commit()
        persisted = await rbac_repository.get_role_by_id(session, role.id)
        return to_role_response(persisted or role)

    async def list_permissions(self, session: AsyncSession) -> PermissionListResponse:
        permissions = await rbac_repository.list_permissions(session)
        return PermissionListResponse(
            items=[to_permission_response(permission) for permission in permissions]
        )

    async def create_permission(
        self,
        session: AsyncSession,
        payload: PermissionCreateRequest,
    ):
        existing = await rbac_repository.get_permission_by_code(session, payload.code)
        if existing is not None:
            raise ConflictError(detail=f"Permission '{payload.code}' already exists.")

        permission = await rbac_repository.create_permission(
            session,
            code=payload.code,
            description=payload.description,
        )
        await session.commit()
        return to_permission_response(permission)

    async def assign_permissions_to_role(
        self,
        session: AsyncSession,
        role_id: UUID,
        payload: RolePermissionAssignmentRequest,
    ) -> RoleResponse:
        role = await rbac_repository.get_role_by_id(session, role_id)
        if role is None:
            raise ResourceNotFoundError(detail="Role not found.")

        permissions = await rbac_repository.list_permissions_by_ids(session, payload.permission_ids)
        if len(permissions) != len(set(payload.permission_ids)):
            raise ResourceNotFoundError(detail="One or more permissions were not found.")

        role = await rbac_repository.assign_permissions_to_role(
            session,
            role=role,
            permissions=permissions,
        )
        await session.commit()
        persisted = await rbac_repository.get_role_by_id(session, role.id)
        return to_role_response(persisted or role)

    async def list_users(self, session: AsyncSession) -> UserListResponse:
        users = await user_repository.list_users(session)
        return UserListResponse(items=[to_user_response(user) for user in users])

    async def assign_roles_to_user(
        self,
        session: AsyncSession,
        user_id: UUID,
        payload: UserRoleAssignmentRequest,
    ) -> UserResponse:
        user = await user_repository.get_by_id(session, user_id)
        if user is None:
            raise ResourceNotFoundError(detail="User not found.")

        roles = await rbac_repository.list_roles_by_ids(session, payload.role_ids)
        if len(roles) != len(set(payload.role_ids)):
            raise ResourceNotFoundError(detail="One or more roles were not found.")

        updated = await rbac_repository.assign_roles_to_user(
            session,
            user=user,
            roles=roles,
        )
        await session.commit()
        persisted = await user_repository.get_by_id(session, updated.id)
        return to_user_response(persisted or updated)


rbac_service = RBACService()
