import boto3
from botocore.exceptions import ClientError

from app.config import settings


def get_s3_client():
    """MinIO(S3 호환) 클라이언트 생성. 나중에 AWS S3 전환 시 endpoint_url만 제거."""
    return boto3.client(
        "s3",
        endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",
    )


def ensure_bucket_exists():
    """버킷이 없으면 자동 생성"""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.MINIO_BUCKET_NAME)
    except ClientError:
        client.create_bucket(Bucket=settings.MINIO_BUCKET_NAME)


async def upload_file(
    file_key: str, file_data: bytes, content_type: str = "image/jpeg"
) -> str:
    """파일 업로드 후 key 반환"""
    client = get_s3_client()
    client.put_object(
        Bucket=settings.MINIO_BUCKET_NAME,
        Key=file_key,
        Body=file_data,
        ContentType=content_type,
    )
    return file_key


async def get_presigned_url(file_key: str, expires_in: int = 3600) -> str:
    """presigned URL 생성 (기본 1시간)"""
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.MINIO_BUCKET_NAME, "Key": file_key},
        ExpiresIn=expires_in,
    )


async def delete_file(file_key: str) -> None:
    """파일 삭제"""
    client = get_s3_client()
    client.delete_object(Bucket=settings.MINIO_BUCKET_NAME, Key=file_key)
