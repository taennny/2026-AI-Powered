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
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


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
    if not user or not user.password_hash or not verify_password(request.password, user.password_hash):
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
        "token_type": "Bearer"
    }