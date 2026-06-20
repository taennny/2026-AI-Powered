import uuid
from datetime import date
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.models.daily_record import DailyRecord
from app.models.user import User
from app.utils.dependencies import get_current_user

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(DATABASE_URL)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

TEST_USER_ID = uuid.uuid4()


def _register_spatialite_stubs(dbapi_conn, connection_record):
    """SQLite에서 GeoAlchemy2가 호출하는 SpatiaLite 함수들의 dummy 등록."""
    dbapi_conn.create_function("RecoverGeometryColumn", -1, lambda *args: 1)
    dbapi_conn.create_function("DiscardGeometryColumn", -1, lambda *args: 1)
    dbapi_conn.create_function("CreateSpatialIndex", -1, lambda *args: 1)
    dbapi_conn.create_function("DisableSpatialIndex", -1, lambda *args: 1)
    dbapi_conn.create_function("CheckSpatialIndex", -1, lambda *args: 1)


event.listen(engine.sync_engine, "connect", _register_spatialite_stubs)


# --- Dependency Overrides ---


async def override_get_db():
    async with TestingSessionLocal() as db:
        yield db


async def override_get_current_user():
    """인증 우회 - 테스트 유저 반환"""
    return User(
        id=TEST_USER_ID,
        email="test@test.com",
        nickname="테스트유저",
        auth_provider="local",
    )


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user


# --- Fixtures ---


@pytest.fixture(autouse=True)
async def setup_db():
    """매 테스트마다 테이블 생성 → 테스트 유저 + 하루기록 삽입 → 정리"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as db:
        user = User(
            id=TEST_USER_ID,
            email="test@test.com",
            nickname="테스트유저",
            auth_provider="local",
        )
        db.add(user)
        await db.flush()

        daily_record = DailyRecord(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, "test-daily-record"),
            user_id=TEST_USER_ID,
            target_date=date(2026, 5, 1),
            place_count=3,
            photo_count=5,
        )
        db.add(daily_record)
        await db.commit()

    # BackgroundTask에서 사용하는 async_session을 테스트 DB로 교체
    with patch("app.services.blog.async_session", TestingSessionLocal):
        yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def daily_record_id():
    """테스트용 하루기록 ID"""
    return uuid.uuid5(uuid.NAMESPACE_DNS, "test-daily-record")


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
