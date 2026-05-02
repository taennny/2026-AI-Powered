import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.database import Base, get_db
from app.main import app

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(DATABASE_URL)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def _register_spatialite_stubs(dbapi_conn, connection_record):
    """SQLite에서 GeoAlchemy2가 호출하는 SpatiaLite 함수들의 dummy 등록.
    실제 공간 연산은 하지 않지만 테이블 생성/삭제 시 오류를 방지한다."""
    dbapi_conn.create_function("RecoverGeometryColumn", -1, lambda *args: 1)
    dbapi_conn.create_function("DiscardGeometryColumn", -1, lambda *args: 1)
    dbapi_conn.create_function("CreateSpatialIndex", -1, lambda *args: 1)
    dbapi_conn.create_function("DisableSpatialIndex", -1, lambda *args: 1)
    dbapi_conn.create_function("CheckSpatialIndex", -1, lambda *args: 1)


event.listen(engine.sync_engine, "connect", _register_spatialite_stubs)


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db():
    async with TestingSessionLocal() as db:
        yield db


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
