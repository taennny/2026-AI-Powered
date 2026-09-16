import uuid

import pytest
from geoalchemy2 import WKTElement
from sqlalchemy import select

from app.models.frequent_place import FrequentPlace
from app.services.frequent_place import delete_frequent_place
from tests.conftest import TEST_USER_ID, TestingSessionLocal


def _place(user_id=None, name="우리집") -> FrequentPlace:
    return FrequentPlace(
        id=uuid.uuid4(),
        user_id=user_id or TEST_USER_ID,
        name=name,
        place_type="home",
        address="서울 강남구",
        location=WKTElement("POINT(127.1 37.4)", srid=4326),
    )


async def _seed(*objects):
    async with TestingSessionLocal() as db:
        for obj in objects:
            db.add(obj)
        await db.commit()


async def test_delete_removes_the_row():
    place = _place()
    await _seed(place)

    async with TestingSessionLocal() as db:
        await delete_frequent_place(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        assert await db.get(FrequentPlace, place.id) is None


async def test_delete_keeps_other_places():
    kept, removed = _place(name="회사"), _place(name="우리집")
    await _seed(kept, removed)

    async with TestingSessionLocal() as db:
        await delete_frequent_place(db, removed.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        rows = (await db.execute(select(FrequentPlace))).scalars().all()
        assert [p.id for p in rows] == [kept.id]


async def test_delete_rejects_another_users_place():
    place = _place(user_id=uuid.uuid4())
    await _seed(place)

    async with TestingSessionLocal() as db:
        with pytest.raises(ValueError):
            await delete_frequent_place(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        assert await db.get(FrequentPlace, place.id) is not None


async def test_delete_unknown_place_raises():
    async with TestingSessionLocal() as db:
        with pytest.raises(ValueError):
            await delete_frequent_place(db, uuid.uuid4(), TEST_USER_ID)


async def test_delete_endpoint_returns_204(client):
    place = _place()
    await _seed(place)

    response = await client.delete(f"/api/v1/places/frequent/{place.id}")

    assert response.status_code == 204


async def test_delete_endpoint_returns_404_for_unknown(client):
    response = await client.delete(f"/api/v1/places/frequent/{uuid.uuid4()}")

    assert response.status_code == 404


async def test_delete_endpoint_does_not_hit_timeline_place_route(client):
    """경로가 /places/{id}로 흘러가면 타임라인 장소를 지운다"""
    place = _place()
    await _seed(place)

    await client.delete(f"/api/v1/places/frequent/{place.id}")

    async with TestingSessionLocal() as db:
        assert await db.get(FrequentPlace, place.id) is None
