# 개발 규칙

## 브랜치 전략
```
main ─────────────────────────── 배포용 (항상 안정적)
 └── develop ─────────────────── 개발 통합 (여기서 테스트)
      ├── feature/auth ────────── 기능 개발 (A: 인증)
      ├── feature/gps ─────────── 기능 개발 (A: GPS)
      ├── feature/blog ────────── 기능 개발 (B: 블로그)
      └── feature/infra ───────── 기능 개발 (B: 인프라)
```

### 규칙

1. **main에 직접 푸시 금지.** 항상 develop을 거쳐서 합친다.
2. 새 기능 시작할 때 develop에서 브랜치를 딴다.
```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/기능이름
```
3. 기능 완성하면 develop으로 PR(Pull Request) 올린다.
4. PR은 상대방이 코드 리뷰 후 머지한다. (B가 만든 건 A가 리뷰, A가 만든 건 B가 리뷰)
5. develop에서 충분히 테스트되면 main에 머지한다.

### 브랜치 이름 규칙

- `feature/기능명` — 새 기능 (예: feature/blog-generate)
- `fix/버그명` — 버그 수정 (예: fix/photo-upload-error)
- `hotfix/긴급수정` — main에서 긴급 수정

### 커밋 메시지 규칙
```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
refactor: 코드 리팩토링
test: 테스트 추가
chore: 설정, 빌드 등 기타
```

예시: `feat: 블로그 생성 API 추가`, `fix: GPS 로그 저장 오류 수정`