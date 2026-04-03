from pydantic import BaseModel, EmailStr
import uuid


# 회원가입 요청
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str


# 회원가입 응답
class RegisterResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    nickname: str


# 로그인 요청
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# 로그인 응답
class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"


# 토큰 갱신 요청
class RefreshRequest(BaseModel):
    refresh_token: str


# 토큰 갱신 응답
class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"


# 비밀번호 재설정 이메일 요청
class PasswordResetRequest(BaseModel):
    email: EmailStr


# 새 비밀번호 설정 요청
class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str