import asyncio
import functools

import boto3
from botocore.exceptions import ClientError

from app.config import settings

_s3_client = None


def get_s3_client():
    """MinIO(S3 호환) 클라이언트 싱글톤. 나중에 AWS S3 전환 시 endpoint_url만 제거."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name="us-east-1",
        )
    return _s3_client


async def _run_sync(func, *args, **kwargs):
    """동기 boto3 호출을 이벤트 루프 블로킹 없이 실행"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(func, *args, **kwargs))


async def ensure_bucket_exists():
    """버킷이 없으면 자동 생성"""
    client = get_s3_client()
    try:
        await _run_sync(client.head_bucket, Bucket=settings.MINIO_BUCKET_NAME)
    except ClientError:
        await _run_sync(client.create_bucket, Bucket=settings.MINIO_BUCKET_NAME)


async def upload_file(
    file_key: str, file_data: bytes, content_type: str = "image/jpeg"
) -> str:
    """파일 업로드 후 key 반환"""
    client = get_s3_client()
    await _run_sync(
        client.put_object,
        Bucket=settings.MINIO_BUCKET_NAME,
        Key=file_key,
        Body=file_data,
        ContentType=content_type,
    )
    return file_key


async def get_presigned_url(file_key: str, expires_in: int = 3600) -> str:
    """presigned URL 생성 (기본 1시간)"""
    client = get_s3_client()
    return await _run_sync(
        client.generate_presigned_url,
        "get_object",
        Params={"Bucket": settings.MINIO_BUCKET_NAME, "Key": file_key},
        ExpiresIn=expires_in,
    )


async def delete_file(file_key: str) -> None:
    """파일 삭제"""
    client = get_s3_client()
    await _run_sync(
        client.delete_object,
        Bucket=settings.MINIO_BUCKET_NAME,
        Key=file_key,
    )
