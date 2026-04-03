import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_register_success():
    """회원가입 성공 테스트"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/auth/register", json={
            "email": "testuser@example.com",
            "password": "pass1234",
            "nickname": "tester"
        })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "testuser@example.com"
    assert data["nickname"] == "tester"
    assert "user_id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email():
    """이메일 중복 회원가입 테스트"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 첫 번째 가입
        await client.post("/api/v1/auth/register", json={
            "email": "duplicate@example.com",
            "password": "pass1234",
            "nickname": "tester"
        })
        # 같은 이메일로 두 번째 가입
        response = await client.post("/api/v1/auth/register", json={
            "email": "duplicate@example.com",
            "password": "pass1234",
            "nickname": "tester2"
        })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_success():
    """로그인 성공 테스트"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 먼저 회원가입
        await client.post("/api/v1/auth/register", json={
            "email": "logintest@example.com",
            "password": "pass1234",
            "nickname": "tester"
        })
        # 로그인
        response = await client.post("/api/v1/auth/login", json={
            "email": "logintest@example.com",
            "password": "pass1234"
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"


@pytest.mark.asyncio
async def test_login_wrong_password():
    """비밀번호 틀린 로그인 테스트"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/v1/auth/register", json={
            "email": "wrongpw@example.com",
            "password": "pass1234",
            "nickname": "tester"
        })
        response = await client.post("/api/v1/auth/login", json={
            "email": "wrongpw@example.com",
            "password": "wrongpassword"
        })
    assert response.status_code == 401