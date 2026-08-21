from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config import settings

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)


async def send_password_reset_email(to_email: str, reset_link: str) -> None:
    message = MessageSchema(
        subject="[Roame] 비밀번호 재설정 안내",
        recipients=[to_email],
        body=f"""
        <p>아래 링크를 눌러 비밀번호를 재설정해주세요.</p>
        <p><a href="{reset_link}">{reset_link}</a></p>
        <p>이 링크는 30분 동안만 유효합니다.</p>
        """,
        subtype=MessageType.html,
    )
    fm = FastMail(conf)
    await fm.send_message(message)
