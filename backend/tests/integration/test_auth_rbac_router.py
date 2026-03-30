from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.router_admin import router as admin_router
from app.api.router_auth import router as auth_router
from app.api.router_rbac import router as rbac_router
from app.core.config import settings
from app.core.exceptions import CleoError, cleo_exception_handler, http_exception_handler
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import PasswordResetCode, Permission, Role, User
from app.db.session import get_db_session


async def seed_defaults(session: AsyncSession) -> None:
    sync_manage = Permission(code="sync:manage", description="Trigger sync jobs.")
    rbac_manage = Permission(code="rbac:manage", description="Manage RBAC.")
    users_read = Permission(code="users:read", description="Read users.")
    users_manage = Permission(code="users:manage", description="Manage users.")
    chat_use = Permission(code="chat:use", description="Use chat.")

    admin = Role(
        name="admin",
        description="Full platform administration.",
        permissions=[sync_manage, rbac_manage, users_read, users_manage, chat_use],
    )
    operator = Role(
        name="operator",
        description="Operational sync management.",
        permissions=[sync_manage, users_read, chat_use],
    )
    developer = Role(
        name="developer",
        description="Authenticated developer access.",
        permissions=[chat_use],
    )
    viewer = Role(
        name="viewer",
        description="Read-only authenticated access.",
        permissions=[chat_use],
    )

    session.add_all([admin, operator, developer, viewer])
    await session.commit()


@pytest_asyncio.fixture
async def auth_test_context() -> AsyncIterator[dict]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        await seed_defaults(session)

    async def override_get_db_session():
        async with session_factory() as session:
            yield session

    app = FastAPI()
    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(rbac_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.dependency_overrides[get_db_session] = override_get_db_session

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield {"client": client, "session_factory": session_factory}

    await engine.dispose()


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


@pytest.mark.asyncio
async def test_register_first_user_creates_admin_and_hashes_password(auth_test_context):
    client: httpx.AsyncClient = auth_test_context["client"]
    session_factory = auth_test_context["session_factory"]

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@example.com",
            "password": "StrongPass123",
            "full_name": "Platform Admin",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["email"] == "admin@example.com"
    assert {role["name"] for role in payload["user"]["roles"]} == {"admin"}

    async with session_factory() as session:
        user = await session.get(User, UUID(payload["user"]["id"]))
        assert user is not None
        assert user.password_hash != "StrongPass123"
        assert user.password_hash


@pytest.mark.asyncio
async def test_duplicate_registration_is_rejected(auth_test_context):
    client: httpx.AsyncClient = auth_test_context["client"]

    body = {
        "email": "duplicate@example.com",
        "password": "StrongPass123",
        "full_name": "First User",
    }
    first = await client.post("/api/v1/auth/register", json=body)
    second = await client.post("/api/v1/auth/register", json=body)

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "A user with this email already exists."


@pytest.mark.asyncio
async def test_login_me_refresh_and_logout_flow(auth_test_context):
    client: httpx.AsyncClient = auth_test_context["client"]

    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "StrongPass123",
            "full_name": "Owner",
        },
    )
    assert register_response.status_code == 201

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123"},
    )
    assert login_response.status_code == 200
    login_payload = login_response.json()

    me_response = await client.get(
        "/api/v1/auth/me",
        headers=auth_headers(login_payload["access_token"]),
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "owner@example.com"

    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_payload["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refresh_payload = refresh_response.json()
    assert refresh_payload["refresh_token"] != login_payload["refresh_token"]

    old_refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_payload["refresh_token"]},
    )
    assert old_refresh_response.status_code == 401

    logout_response = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_payload["refresh_token"]},
    )
    assert logout_response.status_code == 200

    revoked_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_payload["refresh_token"]},
    )
    assert revoked_refresh.status_code == 401


@pytest.mark.asyncio
async def test_forgot_password_resets_password_and_revokes_refresh_tokens(auth_test_context):
    client: httpx.AsyncClient = auth_test_context["client"]
    session_factory = auth_test_context["session_factory"]

    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "recover@example.com",
            "password": "StrongPass123",
            "full_name": "Recover User",
        },
    )
    assert register_response.status_code == 201

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "recover@example.com", "password": "StrongPass123"},
    )
    assert login_response.status_code == 200
    refresh_token = login_response.json()["refresh_token"]

    forgot_response = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "recover@example.com"},
    )
    assert forgot_response.status_code == 200
    assert forgot_response.json()["status"] == "ok"

    async with session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.email == "recover@example.com")
        )
        user = user_result.scalars().first()
        assert user is not None

        code_result = await session.execute(
            select(PasswordResetCode)
            .where(PasswordResetCode.user_id == user.id)
            .order_by(PasswordResetCode.created_at.desc())
        )
        reset_code = code_result.scalars().first()
        assert reset_code is not None

    invalid_reset = await client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "recover@example.com",
            "code": "000000",
            "new_password": "NewStrongPass123",
        },
    )
    assert invalid_reset.status_code == 401

    async with session_factory() as session:
        code_result = await session.execute(
            select(PasswordResetCode).order_by(PasswordResetCode.created_at.desc())
        )
        latest_code = code_result.scalars().first()
        assert latest_code is not None
        latest_code.code_hash = hash_password("654321")
        session.add(latest_code)
        await session.commit()

    reset_response = await client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "recover@example.com",
            "code": "654321",
            "new_password": "NewStrongPass123",
        },
    )
    assert reset_response.status_code == 200
    assert reset_response.json()["status"] == "ok"

    old_login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "recover@example.com", "password": "StrongPass123"},
    )
    assert old_login_response.status_code == 401

    new_login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "recover@example.com", "password": "NewStrongPass123"},
    )
    assert new_login_response.status_code == 200

    revoked_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert revoked_refresh.status_code == 401


@pytest.mark.asyncio
async def test_viewer_cannot_access_rbac_or_admin_routes(auth_test_context):
    client: httpx.AsyncClient = auth_test_context["client"]

    first = await client.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "StrongPass123", "full_name": "Admin"},
    )
    second = await client.post(
        "/api/v1/auth/register",
        json={"email": "viewer@example.com", "password": "StrongPass123", "full_name": "Viewer"},
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert {role["name"] for role in first.json()["user"]["roles"]} == {"admin"}
    assert {role["name"] for role in second.json()["user"]["roles"]} == {
        settings.AUTH_DEFAULT_ROLE
    }

    # Manually downgrade 'second' to viewer to verify 403 logic still works
    session_factory = auth_test_context["session_factory"]
    async with session_factory() as session:
        user_result = await session.execute(
            select(User).where(User.email == "viewer@example.com")
        )
        user = user_result.scalars().first()
        viewer_role_result = await session.execute(
            select(Role).where(Role.name == "viewer")
        )
        viewer_role = viewer_role_result.scalars().first()
        user.roles = [viewer_role]
        session.add(user)
        await session.commit()

    viewer_token = second.json()["access_token"]

    roles_response = await client.get(
        "/api/v1/rbac/roles",
        headers=auth_headers(viewer_token),
    )
    sync_response = await client.get(
        "/api/v1/admin/sync/status",
        headers=auth_headers(viewer_token),
    )

    assert roles_response.status_code == 403
    assert sync_response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_manage_rbac_and_assign_roles(auth_test_context):
    client: httpx.AsyncClient = auth_test_context["client"]

    admin_response = await client.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "StrongPass123", "full_name": "Admin"},
    )
    member_response = await client.post(
        "/api/v1/auth/register",
        json={"email": "member@example.com", "password": "StrongPass123", "full_name": "Member"},
    )
    admin_token = admin_response.json()["access_token"]
    member_id = member_response.json()["user"]["id"]

    create_permission = await client.post(
        "/api/v1/rbac/permissions",
        json={"code": "reports:view", "description": "View reports."},
        headers=auth_headers(admin_token),
    )
    assert create_permission.status_code == 201
    permission_id = create_permission.json()["id"]

    create_role = await client.post(
        "/api/v1/rbac/roles",
        json={"name": "auditor", "description": "Audit access."},
        headers=auth_headers(admin_token),
    )
    assert create_role.status_code == 201
    role_id = create_role.json()["id"]

    assign_permissions = await client.post(
        f"/api/v1/rbac/roles/{role_id}/permissions",
        json={"permission_ids": [permission_id]},
        headers=auth_headers(admin_token),
    )
    assert assign_permissions.status_code == 200
    assert {item["code"] for item in assign_permissions.json()["permissions"]} == {"reports:view"}

    assign_role = await client.post(
        f"/api/v1/rbac/users/{member_id}/roles",
        json={"role_ids": [role_id]},
        headers=auth_headers(admin_token),
    )
    assert assign_role.status_code == 200
    assert {role["name"] for role in assign_role.json()["roles"]} == {"auditor"}

    list_users = await client.get(
        "/api/v1/rbac/users",
        headers=auth_headers(admin_token),
    )
    assert list_users.status_code == 200
    assert len(list_users.json()["items"]) == 2
