from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permissions
from app.db.session import get_db_session
from app.domain.schemas import (
    PermissionCreateRequest,
    PermissionListResponse,
    PermissionResponse,
    RoleCreateRequest,
    RoleListResponse,
    RolePermissionAssignmentRequest,
    RoleResponse,
    UserListResponse,
    UserResponse,
    UserRoleAssignmentRequest,
)
from app.services.rbac_service import rbac_service

router = APIRouter(prefix="/rbac", tags=["rbac"])


@router.get(
    "/roles",
    response_model=RoleListResponse,
    dependencies=[Depends(require_permissions("rbac:manage"))],
)
async def list_roles(session: AsyncSession = Depends(get_db_session)):
    return await rbac_service.list_roles(session)


@router.post(
    "/roles",
    response_model=RoleResponse,
    status_code=201,
    dependencies=[Depends(require_permissions("rbac:manage"))],
)
async def create_role(
    body: RoleCreateRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await rbac_service.create_role(session, body)


@router.get(
    "/permissions",
    response_model=PermissionListResponse,
    dependencies=[Depends(require_permissions("rbac:manage"))],
)
async def list_permissions(session: AsyncSession = Depends(get_db_session)):
    return await rbac_service.list_permissions(session)


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=201,
    dependencies=[Depends(require_permissions("rbac:manage"))],
)
async def create_permission(
    body: PermissionCreateRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await rbac_service.create_permission(session, body)


@router.post(
    "/roles/{role_id}/permissions",
    response_model=RoleResponse,
    dependencies=[Depends(require_permissions("rbac:manage"))],
)
async def assign_role_permissions(
    role_id: UUID,
    body: RolePermissionAssignmentRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await rbac_service.assign_permissions_to_role(session, role_id, body)


@router.get(
    "/users",
    response_model=UserListResponse,
    dependencies=[Depends(require_permissions("users:read"))],
)
async def list_users(session: AsyncSession = Depends(get_db_session)):
    return await rbac_service.list_users(session)


@router.post(
    "/users/{user_id}/roles",
    response_model=UserResponse,
    dependencies=[Depends(require_permissions("users:manage"))],
)
async def assign_user_roles(
    user_id: UUID,
    body: UserRoleAssignmentRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await rbac_service.assign_roles_to_user(session, user_id, body)
