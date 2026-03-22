from __future__ import annotations

from app.db.models import Permission, Role, User
from app.domain.schemas import PermissionResponse, RoleResponse, UserResponse
from app.repositories.user_repository import user_repository


def to_permission_response(permission: Permission) -> PermissionResponse:
    return PermissionResponse(
        id=permission.id,
        code=permission.code,
        description=permission.description,
    )


def to_role_response(role: Role) -> RoleResponse:
    permissions = sorted(role.permissions, key=lambda item: item.code)
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=[to_permission_response(permission) for permission in permissions],
    )


def to_user_response(user: User) -> UserResponse:
    permissions = user_repository.collect_permissions(user)
    roles = sorted(user.roles, key=lambda item: item.name)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        roles=[to_role_response(role) for role in roles],
        permissions=[to_permission_response(permission) for permission in permissions],
    )
