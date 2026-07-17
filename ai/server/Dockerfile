FROM python:3.13-slim

WORKDIR /code

# 배포용 슬림 의존성 (CLIP 제외)
COPY requirements-deploy.txt .
RUN pip install --no-cache-dir -r requirements-deploy.txt

# 앱 소스 (app.py, config.py, modules/)
COPY app.py config.py ./
COPY modules ./modules

# 백엔드 AI_SERVER_URL 과 맞출 단일 진입점 포트
ENV PORT=5000
EXPOSE 5000

# 프로덕션 WSGI (openai 블로그 생성 대비 timeout 여유)
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 app:app"]
