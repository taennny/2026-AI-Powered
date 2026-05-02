from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gps_log import GpsLog
from app.schemas.gps import GPSLogBatchRequest


async def save_gps_logs(
    db: AsyncSession,
    user_id: str,
    request: GPSLogBatchRequest,
) -> int:
    logs = []
    for item in request.logs:
        log = GpsLog(
            user_id=user_id,
            location=WKTElement(f"POINT({item.lng} {item.lat})", srid=4326),
            accuracy=item.accuracy,
            speed=item.speed,
            recorded_at=item.timestamp,
        )
        logs.append(log)

    db.add_all(logs)
    await db.commit()
    return len(logs)
