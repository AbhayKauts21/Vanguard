from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    DatabaseConfigurationError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import User
from app.domain.schemas import (
    AuthSessionResponse,
    LoginRequest,
    LogoutResponse,
    RefreshTokenRequest,
    RegisterRequest,
    UserResponse,
)
from app.repositories.auth_repository import auth_repository
from app.repositories.rbac_repository import rbac_repository
from app.repositories.user_repository import user_repository
from app.services.identity_mapper import to_user_response


class AuthService:
    async def register(
        self,
        session: AsyncSession,
        payload: RegisterRequest,
    ) -> AuthSessionResponse:
        email = payload.email.lower()
        existing = await user_repository.get_by_email(session, email)
        if existing:
            raise ConflictError(detail="A user with this email already exists.")

        user_count = await user_repository.count_users(session)
        user = await user_repository.create(
            session,
            email=email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
        )

        default_role_name = "admin" if user_count == 0 else settings.AUTH_DEFAULT_ROLE
        default_role = await rbac_repository.get_role_by_name(session, default_role_name)
        if default_role is None:
            raise DatabaseConfigurationError(
                detail=(
                    f"Default role '{default_role_name}' is missing. "
                    "Run the auth migrations before registering users."
                )
            )

        user.roles = [default_role]
        session.add(user)
        await session.flush()

        response = await self._issue_session(session, user)
        await session.commit()

        persisted = await user_repository.get_by_id(session, user.id)
        return self._build_auth_response(persisted or user, response)

    async def login(
        self,
        session: AsyncSession,
        payload: LoginRequest,
    ) -> AuthSessionResponse:
        user = await user_repository.get_by_email(session, payload.email.lower())
        if user is None or not verify_password(payload.password, user.password_hash):
            raise AuthenticationError(detail="Invalid email or password.")

        if not user.is_active:
            raise AuthenticationError(detail="This user account is inactive.")

        await user_repository.update_last_login(session, user, datetime.now(timezone.utc))
        response = await self._issue_session(session, user)
        await session.commit()

        persisted = await user_repository.get_by_id(session, user.id)
        return self._build_auth_response(persisted or user, response)

    async def refresh(
        self,
        session: AsyncSession,
        payload: RefreshTokenRequest,
    ) -> AuthSessionResponse:
        token_payload = decode_token(payload.refresh_token, expected_type="refresh")
        stored_token = await auth_repository.get_refresh_token_by_jti(session, token_payload["jti"])
        if stored_token is None:
            raise AuthenticationError(detail="Refresh token is not recognized.")

        if stored_token.revoked_at is not None:
            raise AuthenticationError(detail="Refresh token has already been revoked.")

        if self._as_utc(stored_token.expires_at) <= datetime.now(timezone.utc):
            raise AuthenticationError(detail="Refresh token has expired.")

        user = await user_repository.get_by_id(session, UUID(token_payload["sub"]))
        if user is None or not user.is_active:
            raise AuthenticationError(detail="User account is invalid or inactive.")

        await auth_repository.revoke_refresh_token(session, stored_token)
        response = await self._issue_session(session, user)
        await session.commit()

        persisted = await user_repository.get_by_id(session, user.id)
        return self._build_auth_response(persisted or user, response)

    async def logout(
        self,
        session: AsyncSession,
        payload: RefreshTokenRequest,
    ) -> LogoutResponse:
        token_payload = decode_token(payload.refresh_token, expected_type="refresh")
        stored_token = await auth_repository.get_refresh_token_by_jti(session, token_payload["jti"])
        if stored_token is None:
            raise AuthenticationError(detail="Refresh token is not recognized.")

        if stored_token.revoked_at is None:
            await auth_repository.revoke_refresh_token(session, stored_token)
            await session.commit()

        return LogoutResponse()

    async def get_me(self, current_user: User) -> UserResponse:
        return to_user_response(current_user)

    async def _issue_session(self, session: AsyncSession, user: User) -> dict:
        access = create_access_token(str(user.id))
        refresh = create_refresh_token(str(user.id))
        await auth_repository.create_refresh_token(
            session,
            user_id=user.id,
            jti=refresh.jti,
            expires_at=refresh.expires_at,
        )
        return {
            "access_token": access.token,
            "refresh_token": refresh.token,
            "access_expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "refresh_expires_in": settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        }

    def _build_auth_response(self, user: User, token_data: dict) -> AuthSessionResponse:
        return AuthSessionResponse(
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            access_token_expires_in=token_data["access_expires_in"],
            refresh_token_expires_in=token_data["refresh_expires_in"],
            user=to_user_response(user),
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


auth_service = AuthService()
