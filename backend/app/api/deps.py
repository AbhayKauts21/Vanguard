from __future__ import annotations

from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import decode_token
from app.db.models import User
from app.db.session import get_db_session
from app.repositories.user_repository import user_repository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if credentials is None:
        raise AuthenticationError(detail="Missing bearer token.")

    payload = decode_token(credentials.credentials, expected_type="access")
    user = await user_repository.get_by_id(session, UUID(payload["sub"]))
    if user is None:
        raise AuthenticationError(detail="User no longer exists.")
    if not user.is_active:
        raise AuthenticationError(detail="User account is inactive.")
    return user


def require_permissions(*required_permissions: str):
    async def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        granted = {permission.code for permission in user_repository.collect_permissions(current_user)}
        missing = [permission for permission in required_permissions if permission not in granted]
        if missing:
            raise AuthorizationError(
                detail="Missing required permissions: " + ", ".join(sorted(missing))
            )
        return current_user

    return dependency
