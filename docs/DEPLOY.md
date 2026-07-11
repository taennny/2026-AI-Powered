# 배포 런북 (EC2 + GHCR + GitHub Actions)

develop 브랜치에 `backend/**` 변경이 push되면 자동으로 이미지 빌드 → EC2 배포가 실행된다.

## ① EC2 준비

- 인스턴스: t3.small (2GB), Ubuntu 22.04+
- 보안그룹 인바운드: 22(SSH, 내 IP만), 8000(API)
- 탄력적 IP를 할당해 IP 고정 (재부팅 시 변경 방지)

## ② 서버 초기 세팅

```bash
# Docker + compose plugin 설치
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # 재로그인 필요

# 배포 디렉터리
mkdir -p ~/roame
```

로컬에서 파일 업로드:

```bash
scp backend/docker-compose.prod.yml ubuntu@<EC2_IP>:~/roame/docker-compose.prod.yml
scp backend/.env ubuntu@<EC2_IP>:~/roame/.env   # 프로덕션 값으로 채운 .env
```

GHCR 로그인 (이미지가 private일 때 필요):

```bash
# TOKEN = read:packages 권한이 있는 GitHub PAT
echo <TOKEN> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

## ③ 최초 기동

```bash
cd ~/roame
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
curl http://localhost:8000/health   # {"status":"ok"} 확인
```

## ④ GitHub Secrets 등록

레포 Settings → Secrets and variables → Actions:

| Secret | 값 |
|---|---|
| `EC2_HOST` | EC2 탄력적 IP |
| `EC2_USER` | `ubuntu` (AMI 기본 사용자) |
| `EC2_SSH_KEY` | PEM 개인키 전체 내용 (`-----BEGIN ... END-----` 포함) |

## ⑤ 자동배포 확인

1. develop에 backend 변경 push (또는 PR 머지)
2. GitHub → Actions → CD 워크플로 성공 확인
3. 서버에서 확인:

```bash
docker compose -f ~/roame/docker-compose.prod.yml ps
curl http://<EC2_IP>:8000/health
```

## ⑥ 롤백

이미지는 커밋 SHA 태그로도 푸시되므로 이전 SHA로 되돌린다:

```bash
cd ~/roame
docker pull ghcr.io/taennny/2026-ai-powered-backend:<이전_커밋_SHA>
docker tag ghcr.io/taennny/2026-ai-powered-backend:<이전_커밋_SHA> \
  ghcr.io/taennny/2026-ai-powered-backend:latest
docker compose -f docker-compose.prod.yml up -d backend
```

DB 마이그레이션까지 되돌려야 하면:

```bash
docker compose -f docker-compose.prod.yml exec -T backend alembic downgrade -1
```
