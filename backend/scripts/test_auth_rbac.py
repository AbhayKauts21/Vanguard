from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router_admin import router as admin_router
from app.api.router_auth import router as auth_router
from app.api.router_rbac import router as rbac_router
from app.core.exceptions import CleoError, cleo_exception_handler, http_exception_handler


def build_app() -> FastAPI:
    app = FastAPI(title="CLEO Auth/RBAC Smoke Test")
    app.add_exception_handler(CleoError, cleo_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(rbac_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    return app


async def main() -> None:
    app = build_app()
    transport = httpx.ASGITransport(app=app)
    unique_email = (
        f"auth-smoke-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}@example.com"
    )

    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        register = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "StrongPass123",
                "full_name": "Auth Smoke",
            },
        )
        register.raise_for_status()
        register_payload = register.json()
        access_token = register_payload["access_token"]

        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        me.raise_for_status()

        roles = await client.get(
            "/api/v1/rbac/roles",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        roles.raise_for_status()

        print("=== Auth/RBAC Smoke Test ===")
        print(f"registered_email: {register_payload['user']['email']}")
        print(f"user_id: {register_payload['user']['id']}")
        print(f"roles_count: {len(roles.json()['items'])}")
        print(f"me_permissions: {[item['code'] for item in me.json()['permissions']]}")


if __name__ == "__main__":
    asyncio.run(main())
