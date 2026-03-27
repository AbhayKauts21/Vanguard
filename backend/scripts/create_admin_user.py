"""Bootstrap or upgrade a local admin user for RBAC recovery."""

from __future__ import annotations

import argparse
import asyncio

from app.core.security import hash_password
from app.db.session import get_session_factory
from app.repositories.rbac_repository import rbac_repository
from app.repositories.user_repository import user_repository


async def create_or_promote_admin(email: str, password: str, full_name: str | None) -> None:
    session_factory = get_session_factory()
    async with session_factory() as session:
        user = await user_repository.get_by_email(session, email.lower())
        if user is None:
            user = await user_repository.create(
                session,
                email=email.lower(),
                password_hash=hash_password(password),
                full_name=full_name,
            )
        else:
            user.password_hash = hash_password(password)
            if full_name:
                user.full_name = full_name
            session.add(user)

        admin_role = await rbac_repository.get_role_by_name(session, "admin")
        if admin_role is None:
            raise RuntimeError("Admin role is missing. Run migrations before creating an admin user.")

        user.roles = [admin_role]
        user.is_active = True
        session.add(user)
        await session.commit()
        print(f"Admin user ready: {user.email}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or promote a local admin user.")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--full-name", default=None, help="Optional display name")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(create_or_promote_admin(args.email, args.password, args.full_name))
