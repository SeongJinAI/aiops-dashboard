# Nova 운영 배포 가이드

## 구성

```
nginx (80/443)  ─┬─►  /api    → backend:8000   (FastAPI)
                 ├─►  /ws     → backend:8000   (WebSocket)
                 └─►  /       → frontend:80    (SPA)

backend  ───►  postgres:5432  (영구 데이터)
```

모든 서비스는 `docker-compose.cloud.yml`로 관리한다.

## 첫 배포

1. `.env` 작성 (`.env.example` 참고):
   ```env
   POSTGRES_USER=nova
   POSTGRES_PASSWORD=<랜덤_16자+>
   POSTGRES_DB=nova
   JWT_SECRET=<랜덤_32자+>
   HERMES_MASTER_KEY=<랜덤_32자+>
   AIOPS_PUBLIC_URL=https://your-domain.com
   AIOPS_CORS_ORIGINS=https://your-domain.com
   ```

2. 빌드 + 기동:
   ```bash
   docker compose -f docker-compose.cloud.yml up -d --build
   ```
   backend 컨테이너가 시작될 때 `alembic upgrade head`로 마이그레이션이 자동 적용된다.

3. (도메인 보유 시) SSL 발급:
   ```bash
   # DNS의 A 레코드가 이 서버를 가리키는지 먼저 확인
   docker compose -f docker-compose.cloud.yml run --rm certbot \
     certonly --webroot -w /var/www/certbot \
     -d your-domain.com \
     --email you@example.com --agree-tos --no-eff-email
   ```
   발급 후 `deploy/nginx/nova.conf` 하단의 `# HTTPS` 블록 주석을 해제하고
   80 → 443 redirect를 활성화한 뒤 nginx 재시작:
   ```bash
   docker compose -f docker-compose.cloud.yml restart nginx
   ```

4. SSL 자동 갱신은 `certbot` 컨테이너를 SSL 프로파일로 띄움:
   ```bash
   docker compose -f docker-compose.cloud.yml --profile ssl up -d certbot
   ```

## DB 마이그레이션

스키마 변경 시:
```bash
# 1. 모델 수정 (server/models/db_models.py)
# 2. revision 자동 생성 (로컬 또는 DB 연결된 환경에서)
cd server
alembic revision --autogenerate -m "add new column"
# 3. 생성된 파일 검토 + commit
# 4. 배포하면 backend 시작 시 자동 적용
```

## 첫 마이그레이션 생성 (한 번만)

처음 배포 전 로컬에서 실행:
```bash
# 로컬 PostgreSQL 띄우기
docker compose up -d postgres
# 첫 revision 생성
cd server
DATABASE_URL=postgresql+asyncpg://nova:nova@localhost:5432/nova \
  alembic revision --autogenerate -m "initial schema"
# alembic/versions/*.py 생성됨 → git commit
```

이후 운영 backend 컨테이너가 시작될 때 `alembic upgrade head`로 자동 적용.

## 백업

PostgreSQL 데이터는 `postgres-data` Docker 볼륨에 있다:
```bash
docker compose -f docker-compose.cloud.yml exec postgres \
  pg_dump -U nova nova > backup-$(date +%F).sql
```

복구:
```bash
docker compose -f docker-compose.cloud.yml exec -T postgres \
  psql -U nova nova < backup-2026-05-28.sql
```

## 로컬 dev 환경

```bash
# PostgreSQL만 docker로
docker compose up -d postgres

# backend는 system uvicorn (편의)
cd server
DATABASE_URL=postgresql+asyncpg://nova:nova@localhost:5432/nova \
  alembic upgrade head
DATABASE_URL=postgresql+asyncpg://nova:nova@localhost:5432/nova \
  uvicorn main:app --reload --port 8000

# 또는 전체 docker로
docker compose up -d --build
```

SQLite 폴백도 지원한다(env에 `DATABASE_URL` 없고 `DB_PATH`만 있을 때) — 단일 인스턴스
dev 전용. 운영에선 반드시 PostgreSQL.
