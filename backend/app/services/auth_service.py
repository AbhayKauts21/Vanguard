from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
from uuid import UUID

from loguru import logger
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
    ForgotPasswordRequest,
    LoginRequest,
    LogoutResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequestResponse,
    UserResponse,
)
from app.repositories.auth_repository import auth_repository
from app.repositories.rbac_repository import rbac_repository
from app.repositories.user_repository import user_repository
from app.services.identity_mapper import to_user_response
from app.services.audit_service import audit_service
from app.domain.audit_log import AuditEventCode


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

        await audit_service.logger(user.id).event(AuditEventCode.USER_LOGGED_IN).desc(f"User {user.email} registered and logged in.").commit(session)

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
        await audit_service.logger(user.id).event(AuditEventCode.USER_LOGGED_IN).desc(f"User {user.email} logged in.").commit(session)
        
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
            await audit_service.logger(UUID(token_payload["sub"])).event(AuditEventCode.USER_LOGGED_OUT).desc("User logged out.").commit(session)
            await session.commit()

        return LogoutResponse()

    async def request_password_reset(
        self,
        session: AsyncSession,
        payload: ForgotPasswordRequest,
    ) -> PasswordResetRequestResponse:
        email = payload.email.lower()
        user = await user_repository.get_by_email(session, email)

        if user and user.is_active:
            code = self._generate_reset_code()
            expires_at = datetime.now(timezone.utc) + timedelta(
                minutes=settings.PASSWORD_RESET_CODE_EXPIRE_MINUTES
            )
            await auth_repository.revoke_active_password_reset_codes(session, user_id=user.id)
            await auth_repository.create_password_reset_code(
                session,
                user_id=user.id,
                code_hash=hash_password(code),
                expires_at=expires_at,
            )
            logger.info(
                "Password reset code generated for {}: {} (expires in {} minutes)",
                email,
                code,
                settings.PASSWORD_RESET_CODE_EXPIRE_MINUTES,
            )

        await session.commit()
        return PasswordResetRequestResponse(
            detail=(
                "If an account exists for that email, a reset code has been generated. "
                "Check the backend logs in local development."
            )
        )

    async def reset_password(
        self,
        session: AsyncSession,
        payload: ResetPasswordRequest,
    ) -> PasswordResetConfirmResponse:
        user = await user_repository.get_by_email(session, payload.email.lower())
        if user is None or not user.is_active:
            raise AuthenticationError(detail="Invalid or expired reset code.")

        record = await auth_repository.get_latest_password_reset_code(session, user_id=user.id)
        if record is None:
            raise AuthenticationError(detail="Invalid or expired reset code.")

        now = datetime.now(timezone.utc)
        if record.consumed_at is not None or self._as_utc(record.expires_at) <= now:
            raise AuthenticationError(detail="Invalid or expired reset code.")

        if not verify_password(payload.code, record.code_hash):
            raise AuthenticationError(detail="Invalid or expired reset code.")

        user.password_hash = hash_password(payload.new_password)
        session.add(user)
        await auth_repository.consume_password_reset_code(session, record)
        await auth_repository.revoke_refresh_tokens_for_user(session, user_id=user.id)
        await session.commit()

        logger.info("Password updated via reset flow for {}", user.email)
        return PasswordResetConfirmResponse(
            detail="Your password has been updated. You can sign in now."
        )

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

    @staticmethod
    def _generate_reset_code() -> str:
        return f"{secrets.randbelow(1_000_000):06d}"


auth_service = AuthService()
