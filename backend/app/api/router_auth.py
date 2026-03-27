from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db_session
from app.domain.schemas import (
    AuthSessionResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutResponse,
    LogoutRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequestResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthSessionResponse, status_code=201)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await auth_service.register(session, body)


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await auth_service.login(session, body)


@router.post("/refresh", response_model=AuthSessionResponse)
async def refresh(
    body: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await auth_service.refresh(session, body)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    body: LogoutRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await auth_service.logout(session, body)


@router.post("/forgot-password", response_model=PasswordResetRequestResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await auth_service.request_password_reset(session, body)


@router.post("/reset-password", response_model=PasswordResetConfirmResponse)
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_db_session),
):
    return await auth_service.reset_password(session, body)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return await auth_service.get_me(current_user)
