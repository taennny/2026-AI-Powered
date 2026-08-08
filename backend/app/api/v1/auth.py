import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.utils.dependencies import get_current_user


from app.database import get_db
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    PasswordResetRequest,
    PasswordResetConfirm,
    KakaoLoginRequest,
    KakaoLoginResponse,
)
from app.services.auth import (
    register_user,
    login_user,
    kakao_login,
    withdraw_user,
    link_kakao_account,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """회원가입"""
    try:
        user = await register_user(db, request)
        return RegisterResponse(
            user_id=user.id, email=user.email, nickname=user.nickname
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


@router.post("/kakao", response_model=KakaoLoginResponse)
async def kakao_auth(request: KakaoLoginRequest, db: AsyncSession = Depends(get_db)):
    """카카오 로그인"""
    try:
        result = await kakao_login(db, request.code)
        return KakaoLoginResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/kakao/callback")
async def kakao_callback(
    code: str, state: str | None = None, db: AsyncSession = Depends(get_db)
):
    """카카오 로그인/연동 콜백"""
    from app.utils.jwt import decode_token

    if state:
        # 연동 모드 — state 토큰에서 user_id 추출
        try:
            payload = decode_token(state)
            if payload.get("type") != "kakao_link":
                raise ValueError("유효하지 않은 연동 요청입니다")
            user_id = uuid.UUID(payload["sub"])
        except ValueError:
            return RedirectResponse(
                url="roameapp://kakao-link?success=false&reason=invalid_state"
            )

        try:
            await link_kakao_account(db, user_id, code)
            return RedirectResponse(url="roameapp://kakao-link?success=true")
        except ValueError as e:
            return RedirectResponse(
                url=f"roameapp://kakao-link?success=false&reason={str(e)}"
            )

    # 기존 로그인/가입 모드
    try:
        result = await kakao_login(db, code)
        access_token = result["access_token"]
        refresh_token = result["refresh_token"]
        is_new_user = result["is_new_user"]

        redirect_url = f"roameapp://kakao-login?accessToken={access_token}&refreshToken={refresh_token}&isNewUser={is_new_user}"
        return RedirectResponse(url=redirect_url)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 유저 정보 조회"""
    # user_id: RevenueCat Purchases.logIn()에 넘길 우리 서비스 식별자
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "is_kakao_linked": current_user.social_id is not None,
    }


@router.delete("/me", status_code=204)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """회원 탈퇴 — 유저 + 연관 데이터 완전 삭제"""
    await withdraw_user(db, current_user.id)


@router.get("/kakao/link")
async def kakao_link_start(current_user: User = Depends(get_current_user)):
    """카카오 계정 연동 시작 — 카카오 인가 URL 반환"""
    from app.services.kakao import get_kakao_authorize_url
    from app.utils.jwt import create_link_state_token

    state = create_link_state_token(str(current_user.id))
    authorize_url = get_kakao_authorize_url(state)
    return {"authorize_url": authorize_url}
