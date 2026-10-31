# 🐳 Docker 로컬 개발 환경 가이드

팀원 모두가 **같은 환경(Node 22, 같은 Postgres 버전, 같은 실행 명령)** 에서 앱을 띄우기 위한 구성입니다.
현재 구성은 서버 배포용이 아니라 **로컬 개발용**입니다.

## 언제 쓰나요?

| 상황 | 추천 |
|---|---|
| 전체 앱을 한 번에 띄워서 확인 / 다른 사람 브랜치 확인 / 처음 세팅 | 🐳 Docker |
| 코드를 고치면서 바로바로 확인 | `npm run dev` |

Docker 구성은 **빌드된 결과물을 실행**하기 때문에 코드를 고쳐도 자동 반영되지 않습니다. 고친 뒤에는 `--build` 를 붙여 다시 띄워야 합니다.

---

## 1. 준비

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 후 실행 (메뉴바 고래 아이콘이 떠 있어야 함)
2. `backend/.env` 만들기 — `npm run dev` 와 **같은 파일**을 씁니다.

   ```bash
   cp backend/.env.example backend/.env
   ```

   | 항목 | 채우는 법 | 필수 |
   |---|---|---|
   | `DATABASE_URL` | `[YOUR-PASSWORD]` 를 Supabase DB 비밀번호로 교체 (대괄호까지 삭제). `!` → `%21`, `@` → `%40`. 포트는 **6543** (Transaction Pooler) | ✅ |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` 결과 붙여넣기 | ✅ (로그인) |
   | `DEV_LOGIN` | `true` 면 Google 설정 없이 "테스트 계정으로 로그인" 사용 가능 | 선택 |
   | `GOOGLE_*` | Google 로그인 쓸 때만 | 선택 |

   > `backend/.env` 는 비밀번호가 들어 있어서 **절대 커밋하지 않습니다** (`.gitignore` 처리됨).

---

## 2. 실행

### A. 기본 — 팀 공용 Supabase DB 사용

```bash
docker compose up --build
```

- http://localhost:3000 접속
- 종료: 터미널에서 `Ctrl + C` 후 `docker compose down`

### B. 로컬 DB — 내 컴퓨터에 Postgres 를 띄워서 사용

Supabase 데이터를 건드리지 않고 실험하고 싶을 때 씁니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up --build
```

처음 한 번은 다른 터미널에서 상품 데이터를 넣어 줍니다 (테이블·브랜드·마이그레이션은 자동으로 들어갑니다).

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hamburger?sslmode=disable" npm run db:init
```

종료:

```bash
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down      # 데이터 유지
docker compose -f docker-compose.yml -f docker-compose.local-db.yml down -v   # 데이터까지 삭제
```

---

## 3. 자주 쓰는 명령어

```bash
docker compose ps                  # 떠 있는 컨테이너 목록과 상태
docker compose logs -f backend     # backend 로그 실시간 보기 (Ctrl + C 로 빠져나옴)
docker compose up -d --build       # 백그라운드로 띄우기 (터미널을 계속 쓸 수 있음)
docker compose restart backend     # backend/.env 를 고친 뒤 재시작
docker compose down                # 전부 종료
```

> 로컬 DB 구성(B)을 띄웠다면 위 명령에도 `-f docker-compose.yml -f docker-compose.local-db.yml` 을 똑같이 붙입니다.

---

## 4. 구성 파일 설명

```text
hamburger/
├── docker-compose.yml           # 기본: backend(4000) + frontend(3000)
├── docker-compose.local-db.yml  # 겹쳐 쓰는 파일: 로컬 Postgres(5432) 추가 + backend DB 주소 교체
├── docker/local-db/init-db.sh   # 로컬 DB 최초 기동 시 schema → indexes → 브랜드 시드 → migrations 실행
├── backend/Dockerfile           # backend 이미지 만드는 법
├── frontend/Dockerfile          # frontend 이미지 만드는 법
└── .dockerignore                # 이미지에 넣지 않을 파일 (node_modules, .env 등)
```

---

## 5. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop 이 꺼져 있음 → 실행 후 고래 아이콘이 뜰 때까지 대기 |
| `env file .../backend/.env not found` | `backend/.env` 가 없음 → 1번 준비 단계 진행 |
| `port is already allocated` (3000/4000/5432) | `npm run dev` 나 다른 Postgres 가 같은 포트를 쓰는 중 → 그쪽을 끄고 다시 실행 |
| backend 로그에 `PostgreSQL not configured` | `DATABASE_URL` 에 `[YOUR-PASSWORD]` 가 남아 있음 → 비밀번호 입력 후 `docker compose restart backend` |
| DB 접속 시 `ENOTFOUND` | 직접 접속 주소(`db.xxx.supabase.co`)를 쓰는 중. IPv6 전용 주소라 IPv4 환경에서 접속 불가 → `.env.example` 의 Session Pooler 주소(`...pooler.supabase.com`) 사용 |
| 로그인 시 `SESSION_SECRET` 오류 | `SESSION_SECRET` 이 비었거나 32자 미만 → 1번 표의 명령으로 생성 |
| 로컬 DB에서 "테이블이 없다" 오류 | 자동 초기화는 **볼륨(로컬 DB 데이터가 저장된 공간)이 비어 있을 때 한 번만** 실행됨. 예전 볼륨이 남아 있거나 새 마이그레이션이 추가된 경우 → `down -v` 로 볼륨을 지우고 다시 띄우거나, `DATABASE_URL="...localhost:5432/hamburger?sslmode=disable" npm run db:migrate` |
| 코드를 고쳤는데 화면이 그대로 | 이미지를 다시 안 만듦 → `docker compose up --build` |

## QA 서버 (Render)

로컬이 아니라 주소로 같이 확인하는 QA 서버는 저장소 루트의 `render.yaml` 로 만든다.

1. [Render](https://render.com) 로그인 → **New → Blueprint** → `team-aend/hamburger` 선택
2. 처음 한 번 `DATABASE_URL` 입력 (backend/.env 와 같은 값, **포트 6543**)
3. 배포가 끝나면 프론트 주소 `https://hamburger-qa-web.onrender.com` 으로 접속

- 이후엔 `main` 에 push 하면 자동으로 다시 배포된다.
- 무료 플랜이라 15분 동안 접속이 없으면 잠들고, 다음 첫 접속은 1분 정도 걸린다.
- 서비스 이름이 이미 쓰이고 있어서 주소 뒤에 글자가 붙으면 `render.yaml` 의 `*.onrender.com` 값들을 실제 주소로 고친다.
- Google 로그인을 쓰려면 백엔드 서비스에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 을 추가하고, Google Cloud Console 의 리디렉션 URI 에 `https://hamburger-qa-web.onrender.com/api/auth/google/callback` 을 등록한다. (QA 는 production 모드라 개발용 로그인은 꺼져 있다)

