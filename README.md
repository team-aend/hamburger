# 🍔 Hamburger

**Next.js (Frontend)** + **Node.js / Express (Backend)** 기반의 TypeScript 모노레포 프로젝트입니다.

## 📁 프로젝트 구조

```text
hamburger/
├── package.json          # 루트 워크스페이스 설정 및 통합 실행 스크립트
├── backend/              # Node.js + Express + TypeScript (Port: 4000)
│   ├── src/
│   │   ├── index.ts      # 서버 엔트리 포인트
│   │   └── routes/       # API 라우터 (/api/health, /api/hello)
│   └── tsconfig.json
└── frontend/             # Next.js App Router + TypeScript (Port: 3000)
    ├── src/app/          # 페이지 및 레이아웃
    ├── next.config.ts    # /api/* -> 백엔드(4000) 프록시 설정 포함
    └── tsconfig.json
```

## 🚀 시작하기

### 1. 패키지 설치

루트 디렉토리에서 한 번에 프론트엔드와 백엔드 의존성을 모두 설치합니다.

```bash
npm install
```

### 2. 개발 서버 실행

프론트엔드(`http://localhost:3000`)와 백엔드(`http://localhost:4000`)를 동시에 실행합니다.

```bash
npm run dev
```

개별 실행이 필요한 경우:

```bash
# 백엔드만 실행 (Port 4000)
npm run dev:backend

# 프론트엔드만 실행 (Port 3000)
npm run dev:frontend
```

### 3. 빌드

```bash
npm run build
```
## 🐳 Docker로 실행하기 (로컬 개발용)

Node 버전 등 실행 환경을 팀원 모두 똑같이 맞추기 위한 구성입니다. Docker Desktop만 있으면 됩니다.
빌드된 결과물을 실행하므로 코드 수정이 바로 반영되지 않습니다 (수정 후 `--build` 로 재빌드). 코드를 고치며 개발할 때는 `npm run dev` 를 쓰세요.

환경변수는 `npm run dev` 와 같은 `backend/.env` 를 사용합니다 (`backend/.env.example` 참고).

```bash
# backend + frontend (팀 공용 Supabase 사용) → http://localhost:3000
docker compose up --build

# 위 + 로컬 Postgres (Supabase 대신 내 컴퓨터의 DB 사용)
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up --build
# 최초 1회 상품 시드 (스키마·브랜드·마이그레이션은 DB 컨테이너가 자동 적용)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hamburger?sslmode=disable" npm run db:init

# 종료 (로컬 DB 데이터까지 지우려면 -v 추가)
docker compose down
```

로컬 DB의 자동 초기화는 **DB 볼륨이 비어 있을 때 한 번만** 실행됩니다. 새 마이그레이션이 추가되었거나 테이블이 없다는 오류가 나면 `-v` 로 볼륨을 지우고 다시 띄우거나, `npm run db:migrate` 를 위와 같은 `DATABASE_URL` 로 실행하세요.
