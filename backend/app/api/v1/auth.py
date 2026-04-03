from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import (
    RegisterRequest, RegisterResponse,
    LoginRequest, LoginResponse,
    RefreshRequest, RefreshResponse,
    PasswordResetRequest, PasswordResetConfirm
)
from app.services.auth import register_user, login_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """회원가입"""
    try:
        user = await register_user(db, request)
        return RegisterResponse(
            user_id=user.id,
            email=user.email,
            nickname=user.nickname
        )
    except ValueError as e:
        if "이메일" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """로그인"""
    try:
        result = await login_user(db, request)
        return LoginResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """액세스 토큰 갱신"""
    from app.utils.jwt import decode_token
    from sqlalchemy import select
    from app.models.user import User
    from datetime import datetime, timezone

    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user or user.refresh_token != request.refresh_token:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")

        from app.utils.jwt import create_access_token
        access_token = create_access_token(str(user.id))
        return RefreshResponse(access_token=access_token)

    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/password-reset/request")
async def password_reset_request(request: PasswordResetRequest):
    """비밀번호 재설정 이메일 발송"""
    # Sprint 1에서는 이메일 발송 없이 성공 응답만 반환
    return {"message": "비밀번호 재설정 링크를 이메일로 발송했습니다"}


@router.post("/password-reset/confirm")
async def password_reset_confirm(request: PasswordResetConfirm):
    """새 비밀번호 설정"""
    # Sprint 1에서는 토큰 검증 없이 성공 응답만 반환
    return {"message": "비밀번호가 성공적으로 변경되었습니다"}