import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest
from app.utils.jwt import create_access_token, create_refresh_token
import bcrypt


def hash_password(password: str) -> str:
    """비밀번호 해시화"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


async def register_user(db: AsyncSession, request: RegisterRequest) -> User:
    """회원가입"""
    # 이메일 중복 확인
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise ValueError("이미 사용 중인 이메일입니다")

    # 유저 생성
    user = User(
        id=uuid.uuid4(),
        email=request.email,
        password_hash=hash_password(request.password),
        nickname=request.nickname,
        auth_provider="local",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login_user(db: AsyncSession, request: LoginRequest) -> dict:
    """로그인"""
    # 유저 조회
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # 이메일 없거나 비밀번호 틀리면 오류
    if (
        not user
        or not user.password_hash
        or not verify_password(request.password, user.password_hash)
    ):
        raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다")

    # 토큰 생성
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # refresh_token DB에 저장
    user.refresh_token = refresh_token
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
    }


async def kakao_login(db: AsyncSession, code: str) -> dict:
    from app.services.kakao import get_kakao_token, get_kakao_user_info

    # 1. 인가 코드로 카카오 액세스 토큰 받기
    kakao_token_data = await get_kakao_token(code)
    kakao_access_token = kakao_token_data.get("access_token")

    # 2. 카카오 액세스 토큰으로 유저 정보 받기
    kakao_user_info = await get_kakao_user_info(kakao_access_token)
    kakao_id = str(kakao_user_info.get("id"))
    kakao_account = kakao_user_info.get("kakao_account", {})
    email = kakao_account.get("email", f"{kakao_id}@kakao.com")
    nickname = kakao_user_info.get("properties", {}).get(
        "nickname", f"카카오유저{kakao_id[:4]}"
    )

    # 3. 기존 유저인지 확인 (social_id 우선)
    result = await db.execute(select(User).where(User.social_id == kakao_id))
    user = result.scalar_one_or_none()
    is_new_user = False

    if not user:
        # 4. social_id로 못 찾았으면 email로 한 번 더 확인 — 이미 이메일로
        # 가입한 유저면 새 계정을 만들지 않고 그 계정에 카카오 연동만 해준다.
        # (이메일 미동의 유저는 f"{kakao_id}@kakao.com" 가짜 이메일이라 겹칠 일 없음)
        email_result = await db.execute(select(User).where(User.email == email))
        existing_user = email_result.scalar_one_or_none()

        if existing_user:
            existing_user.social_id = kakao_id
            existing_user.updated_at = datetime.now(timezone.utc)
            user = existing_user
            await db.commit()
            await db.refresh(user)
        else:
            # 5. 이메일로도 없으면 진짜 신규 유저
            is_new_user = True
            user = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=None,
                nickname=nickname,
                auth_provider="kakao",
                social_id=kakao_id,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    # 6. JWT 발급
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # 7. refresh_token DB에 저장
    user.refresh_token = refresh_token
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "is_new_user": is_new_user,
    }
