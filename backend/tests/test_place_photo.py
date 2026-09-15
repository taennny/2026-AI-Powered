"""카드 사진 교체·삭제.

두 갈래를 구분해서 본다.
  - 자동 첨부: EXIF 촬영시각이 체류 시간대에 들어와서 붙은 사진 (place_id 없음)
  - 직접 지정: 사용자가 갤러리에서 고른 사진 (place_id 있음)

지운 사진이 재설치 후 다시 올라와도 되살아나지 않아야 하고, 그 억제가
사용자가 직접 고른 사진까지 막으면 안 된다.
"""

import io
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import piexif
import pytest
from PIL import Image

from app.models.daily_record import DailyRecord
from app.models.photos import Photo
from app.models.place import Place
from app.services.calendar import select_place_photos
from app.services.place import delete_place
from app.services.place_photo import delete_place_photo, replace_place_photo
from tests.conftest import TEST_USER_ID, TestingSessionLocal

ARRIVED = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
LEFT = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
DURING = datetime(2026, 5, 1, 11, 0, tzinfo=timezone.utc)

DAILY_RECORD_ID = uuid.uuid5(uuid.NAMESPACE_DNS, "test-daily-record")


def _jpeg() -> bytes:
    """EXIF 촬영시각이 든 최소 JPEG — 업로드 경로가 EXIF를 읽는다"""
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="white").save(buf, format="jpeg")

    exif = piexif.dump(
        {"Exif": {piexif.ExifIFD.DateTimeOriginal: b"2026:05:01 20:00:00"}}
    )
    out = io.BytesIO()
    piexif.insert(exif, buf.getvalue(), out)
    return out.getvalue()


def _place(**kwargs) -> Place:
    """좌표는 SQLite 스텁이 문자열로 받는다 — 이 테스트는 좌표를 읽지 않는다"""
    return Place(
        id=kwargs.pop("id", uuid.uuid4()),
        user_id=TEST_USER_ID,
        daily_record_id=DAILY_RECORD_ID,
        name="매드피자 성남점",
        category="음식점",
        location="POINT(127.1 37.4)",
        arrived_at=ARRIVED,
        left_at=LEFT,
        **kwargs,
    )


def _photo(**kwargs) -> Photo:
    return Photo(
        id=kwargs.pop("id", uuid.uuid4()),
        user_id=TEST_USER_ID,
        daily_record_id=DAILY_RECORD_ID,
        storage_key=kwargs.pop("storage_key", f"photos/{uuid.uuid4()}.jpg"),
        taken_at=kwargs.pop("taken_at", DURING),
        **kwargs,
    )


# ──────────────────────────────────────────
# 사진 고르는 규칙 (순수 함수)
# ──────────────────────────────────────────


def test_auto_attaches_photo_taken_during_stay():
    """기존 동작 — 체류 시간대에 찍힌 사진은 그대로 붙는다"""
    place = _place()
    photo = _photo()

    assert select_place_photos(place, [photo], set()) == [photo]


def test_photo_outside_stay_is_not_attached():
    outside = _photo(taken_at=datetime(2026, 5, 1, 18, 0, tzinfo=timezone.utc))

    assert select_place_photos(_place(), [outside], set()) == []


def test_user_picked_photo_wins_over_auto_match():
    """직접 고른 사진이 있으면 시간대로 걸리는 사진은 밀려난다 — 카드는 한 장만 쓴다"""
    place = _place()
    picked = _photo(place_id=place.id)
    auto = _photo()

    assert select_place_photos(place, [auto, picked], set()) == [picked]


def test_deleted_photo_does_not_come_back_when_reuploaded():
    """재설치 후 photoSync가 같은 사진을 다시 올려도 붙지 않는다"""
    reuploaded = _photo()

    assert select_place_photos(_place(), [reuploaded], {DURING}) == []


def test_user_can_pick_a_photo_they_previously_deleted():
    """억제는 자동 첨부에만 건다 — 직접 고른 것까지 막으면 되돌릴 방법이 없다"""
    place = _place()
    picked = _photo(place_id=place.id)

    assert select_place_photos(place, [picked], {DURING}) == [picked]


def test_blocked_place_gets_no_auto_photo():
    """'앞으로 사진 안 붙이기' — 지운 그 사진이 아니라 어떤 사진도 안 붙는다"""
    blocked = _place(photo_blocked=True)
    other = _photo(taken_at=datetime(2026, 5, 1, 11, 30, tzinfo=timezone.utc))

    assert select_place_photos(blocked, [other], set()) == []


def test_blocked_place_still_shows_a_photo_the_user_picked():
    """차단해 둔 카드라도 직접 고르면 보여야 한다"""
    blocked = _place(photo_blocked=True)
    picked = _photo(place_id=blocked.id)

    assert select_place_photos(blocked, [picked], set()) == [picked]


def test_bound_photo_does_not_leak_into_another_place():
    """A에 붙인 사진이 시간대가 겹치는 B에도 뜨면 같은 사진이 두 번 나온다"""
    a, b = _place(), _place()
    bound_to_a = _photo(place_id=a.id)

    assert select_place_photos(b, [bound_to_a], set()) == []


# ──────────────────────────────────────────
# 교체·삭제 (DB + S3)
# ──────────────────────────────────────────


@pytest.fixture
def storage():
    """S3는 테스트에서 안 띄운다 — 호출됐는지만 본다"""
    with (
        patch("app.services.place_photo.upload_file", new=AsyncMock()) as upload,
        patch("app.services.place_photo.delete_file", new=AsyncMock()) as delete,
        patch(
            "app.services.place_photo.get_presigned_url",
            new=AsyncMock(return_value="https://example.test/photo.jpg"),
        ),
    ):
        yield {"upload": upload, "delete": delete}


async def _seed(*objects):
    async with TestingSessionLocal() as db:
        for obj in objects:
            db.add(obj)
        await db.commit()


async def test_replace_binds_photo_to_place(storage):
    place = _place()
    await _seed(place)

    async with TestingSessionLocal() as db:
        photo, _, _ = await replace_place_photo(
            db, place.id, TEST_USER_ID, _jpeg(), "image/jpeg"
        )

    assert photo.place_id == place.id
    assert photo.daily_record_id == DAILY_RECORD_ID
    assert storage["upload"].await_count >= 1


async def test_replace_removes_the_previous_photo(storage):
    place = _place()
    old = _photo()
    await _seed(place, old)

    async with TestingSessionLocal() as db:
        await replace_place_photo(db, place.id, TEST_USER_ID, _jpeg(), "image/jpeg")

    async with TestingSessionLocal() as db:
        stored = await db.get(Photo, old.id)
        assert stored.is_deleted is True

    # 묘비만 남기고 파일은 실제로 지운다 (원본 + 썸네일이면 2회)
    assert storage["delete"].await_count >= 1


async def test_replace_marks_place_as_corrected(storage):
    """재분석이 Place를 지우고 다시 만들면 FK가 깨지고 사진 연결도 풀린다.

    ai.py는 is_corrected=False인 Place만 지우므로, 이 플래그가 보존 장치다.
    """
    place = _place()
    await _seed(place)

    async with TestingSessionLocal() as db:
        await replace_place_photo(db, place.id, TEST_USER_ID, _jpeg(), "image/jpeg")

    async with TestingSessionLocal() as db:
        stored = await db.get(Place, place.id)
        assert stored.is_corrected is True


async def test_replace_clears_the_block(storage):
    """차단해 둔 카드에 직접 골라 넣었으면 차단은 풀려야 한다"""
    place = _place(photo_blocked=True)
    await _seed(place)

    async with TestingSessionLocal() as db:
        await replace_place_photo(db, place.id, TEST_USER_ID, _jpeg(), "image/jpeg")

    async with TestingSessionLocal() as db:
        stored = await db.get(Place, place.id)
        assert stored.photo_blocked is False


async def test_replace_accepts_a_photo_without_exif(storage):
    """장소는 place_id로 정해지므로 촬영시각이 없어도 받는다 (업로드 API와 다른 점)"""
    place = _place()
    await _seed(place)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="white").save(buf, format="jpeg")

    async with TestingSessionLocal() as db:
        photo, _, _ = await replace_place_photo(
            db, place.id, TEST_USER_ID, buf.getvalue(), "image/jpeg"
        )

    assert photo.place_id == place.id
    assert photo.taken_at is None


async def test_delete_tombstones_without_blocking(storage):
    place = _place()
    photo = _photo()
    await _seed(place, photo)

    async with TestingSessionLocal() as db:
        await delete_place_photo(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        assert (await db.get(Photo, photo.id)).is_deleted is True
        assert (await db.get(Place, place.id)).photo_blocked is False


async def test_delete_with_block_sets_the_flag(storage):
    place = _place()
    await _seed(place, _photo())

    async with TestingSessionLocal() as db:
        await delete_place_photo(db, place.id, TEST_USER_ID, block=True)

    async with TestingSessionLocal() as db:
        stored = await db.get(Place, place.id)
        assert stored.photo_blocked is True
        # 플래그가 살아남으려면 Place 자체가 보존돼야 한다
        assert stored.is_corrected is True


async def test_delete_survives_storage_failure(storage):
    """S3가 죽었다고 롤백하면 묘비가 안 남아 사진이 되살아난다"""
    storage["delete"].side_effect = RuntimeError("S3 down")
    place = _place()
    photo = _photo()
    await _seed(place, photo)

    async with TestingSessionLocal() as db:
        await delete_place_photo(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        assert (await db.get(Photo, photo.id)).is_deleted is True


async def test_deleting_a_place_cleans_up_its_own_photo(storage):
    """그 카드에만 있던 사진은 어디에도 안 보이면서 S3에만 남는다"""
    place = _place()
    bound = _photo(place_id=place.id)
    await _seed(place, bound)

    async with TestingSessionLocal() as db:
        await delete_place(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        assert (await db.get(Photo, bound.id)).is_deleted is True


async def test_deleting_a_place_keeps_auto_matched_photos(storage):
    """시간대로 걸린 사진은 그날의 일반 사진이라 장소와 함께 지우면 안 된다"""
    place = _place()
    auto = _photo()
    await _seed(place, auto)

    async with TestingSessionLocal() as db:
        await delete_place(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        assert (await db.get(Photo, auto.id)).is_deleted is False


async def test_replace_rejects_another_users_place(storage):
    place = Place(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="남의 장소",
        location="POINT(127.1 37.4)",
        arrived_at=ARRIVED,
        left_at=LEFT,
    )
    await _seed(place)

    async with TestingSessionLocal() as db:
        with pytest.raises(ValueError):
            await replace_place_photo(db, place.id, TEST_USER_ID, _jpeg(), "image/jpeg")


async def test_place_count_drops_when_place_deleted(storage):
    """사진 정리를 끼워 넣어도 기존 카운트 감소가 그대로여야 한다"""
    place = _place()
    await _seed(place)

    async with TestingSessionLocal() as db:
        before = (await db.get(DailyRecord, DAILY_RECORD_ID)).place_count
        await delete_place(db, place.id, TEST_USER_ID)

    async with TestingSessionLocal() as db:
        after = (await db.get(DailyRecord, DAILY_RECORD_ID)).place_count

    assert after == before - 1


async def test_unknown_place_raises():
    async with TestingSessionLocal() as db:
        with pytest.raises(ValueError):
            await delete_place_photo(db, uuid.uuid4(), TEST_USER_ID)


def test_seed_date_matches_fixture():
    """픽스처의 하루기록과 같은 날짜를 쓰는지 — 어긋나면 조용히 빈 결과가 된다"""
    assert ARRIVED.date() == date(2026, 5, 1)
