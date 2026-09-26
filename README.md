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

## 화면 및 기능

- `/`: 햄버거 월드컵 (8강/16강 선택, 우승 결과)
- `/ranking`: 샘플 랭킹. 월드컵 시작·완료 화면의 **랭킹 확인하기** 버튼으로 이동합니다.
- `/recommend`: 브랜드·포함/제외 재료·가격·칼로리로 버거 검색 및 조건 내 랜덤 추천. 공통 메뉴의 **버거 검색 · 추천**으로 이동합니다.

검색·추천은 백엔드의 `/api/recommend`, `/api/recommend/filters`, `/api/recommend/random`을 사용하므로 프론트와 백엔드를 함께 실행해야 합니다. 현재 검색 데이터는 `backend/src/data/database.ts`에 정의된 데이터이며, 랭킹은 별도의 화면용 샘플 데이터입니다.

## 월드컵 참가 옵션 API

`GET /api/worldcup/options`는 DB에서 활성 브랜드의 ACTIVE 햄버거 상품 수를 조회합니다. 8개 이상이면 8강, 16개 이상이면 16강이 가능합니다. 참가 수가 0이면 정상 응답으로 두 강수가 모두 비활성화됩니다.

```json
{"eligibleProductCount":18,"roundOptions":[{"roundSize":8,"available":true},{"roundSize":16,"available":true}]}
```

`DATABASE_URL`은 서버 환경변수 → `backend/.env` → `backend/.env.example` 순서로 우선 적용합니다. `.env`가 없어도 `.env.example`의 설정으로 연결합니다. 파일 경로는 실행 디렉터리와 무관하게 backend 폴더를 기준으로 찾습니다. 연결은 인증서를 검증하는 TLS를 사용하며, 별도 CA가 필요하면 `DATABASE_SSL_CA`에 PEM 인증서를 설정합니다. URL의 SSL 옵션으로 인증서 검증을 비활성화하지 마세요. 설정이 없으면 HTTP 503 `DATABASE_NOT_CONFIGURED`, 조회 실패 시 HTTP 503 `DATABASE_UNAVAILABLE`을 반환합니다. DB 오류를 목업 데이터로 대체하지 않습니다.

테스트: `npm run test --workspace=backend`. SQL 통합 테스트는 격리된 테스트 PostgreSQL의 `TEST_DATABASE_URL`을 설정하면 실행되며, 미설정 시 해당 테스트만 건너뜁니다. 테스트는 연결별 임시 테이블만 생성합니다.

기존에 저장소에 포함됐던 DB 접속 비밀번호는 DB 관리자 측에서 교체해야 합니다. 코드에서 제거해도 과거 커밋에 남은 비밀번호는 무효화되지 않습니다.
