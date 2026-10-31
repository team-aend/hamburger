# 🍔 Burger Pick

여러 브랜드의 햄버거를 **검색·비교·추천**하고, **햄버거 월드컵**으로 내 최애 버거를 찾는 서비스입니다.

**Next.js (Frontend)** + **Node.js / Express (Backend)** + **PostgreSQL (Supabase)** 기반의 TypeScript 모노레포 프로젝트입니다.

## ✨ 주요 기능

### 🏆 햄버거 월드컵 (`/`)
- 8강 / 16강 중 하나를 골라 두 버거 중 더 끌리는 쪽을 선택하는 토너먼트
- 진행 상황이 저장되어 중간에 나가도 **이어하기** 가능
- 우승 결과를 **공유 링크**로 보내기 (`/share/worldcup/:sessionId`, 로그인 없이 열람, 미리보기 이미지 자동 생성)

### 📊 월드컵 랭킹 (`/ranking`)
- 완료된 월드컵 결과를 집계한 실시간 랭킹 (TOP 3 + 전체 순위)
- 우승 횟수순 / 대결 승률순 정렬, 8강·16강 범위 필터, 버거 이름 검색

### 🔍 버거 검색 · 추천 (`/recommend`)
- 브랜드, 패티·토핑·치즈/소스 재료, 가격 범위, 칼로리 등 조건 필터
- 칼로리 / 금액 / 단백질 기준 정렬
- 조건에 맞는 버거 **랜덤 1개 추천**
- 자주 쓰는 **검색 조건 저장** (로그인 사용자)

### 💰 햄버거 비교 (`/compare`)
- 여러 브랜드 메뉴를 한 화면에서 가격·영양정보로 비교
- **단백질 가성비(단성비)** 지표와 정렬

### 🍔 상품 상세 (`/products/:id`)
- 가격, 가격 추이, 영양 정보
- 좋아요(♥)와 **한 줄 평** (리뷰 작성은 로그인 사용자 전용)

### 🎮 햄버거 쌓기 게임 (`/game`)
- 주문서를 보고 재료를 순서대로 쌓아 60초 동안 최대한 많은 햄버거 완성하기
- 별도 DB 없이 프론트엔드에서만 동작

### 👤 로그인 · 마이페이지 (`/login`, `/mypage`)
- Google OAuth 로그인 (개발용 테스트 로그인 지원)
- **좋아요한 버거** 목록과 **가격 변동 알림**
- **월드컵 기록**, 내가 고른 버거로 분석한 **취향 리포트**(자주 고르는 가격대, 평균 열량 등)
- 회원 정보·닉네임 관리

## 📁 프로젝트 구조

```text
hamburger/
├── package.json              # 루트 워크스페이스 설정 및 통합 실행 스크립트
├── backend/                  # Node.js + Express + TypeScript (Port: 4000)
│   ├── AGENTS.md             # 백엔드 계층 구조·개발 규칙
│   ├── src/
│   │   ├── index.ts          # 서버 엔트리 포인트
│   │   ├── routes/           # 기존 API 라우터 (auth, brands, likes, me, reviews, recommend 등)
│   │   ├── worldcup/         # 월드컵 (참가 옵션·세션·경기 선택·랭킹·공유)
│   │   ├── products/         # 상품 목록·상세
│   │   ├── priceAlerts/      # 좋아요한 버거 가격 변동 알림
│   │   ├── savedSearches/    # 검색 조건 저장
│   │   ├── taste/            # 취향 리포트
│   │   ├── auth/             # Google OAuth·세션
│   │   └── db/               # 스키마, 마이그레이션, 시드 데이터
│   └── tests/
└── frontend/                 # Next.js App Router + TypeScript (Port: 3000)
    ├── src/
    │   ├── app/              # 페이지 (/, ranking, recommend, compare, products, game, mypage, login, share)
    │   ├── components/       # 공통 헤더, 비교 테이블, 필터 등 UI 컴포넌트
    │   ├── hooks/            # 좋아요·리뷰·필터·게임 상태 훅
    │   └── lib/, data/, types/
    ├── next.config.ts        # /api/* -> 백엔드(4000) 프록시 설정 포함
    └── tests/
```

새 백엔드 기능은 `src/<도메인>/` 아래 `presentation / application / domain / infrastructure` 계층 구조를 따릅니다. 자세한 규칙은 [`backend/AGENTS.md`](backend/AGENTS.md)를 참고하세요.

## 🚀 시작하기

### 1. 패키지 설치

루트 디렉토리에서 한 번에 프론트엔드와 백엔드 의존성을 모두 설치합니다.

```bash
npm install
```

### 2. 환경 변수 설정

각 폴더의 `.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| 변수 | 위치 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | backend | Supabase PostgreSQL 접속 주소 (**Transaction Pooler, 포트 6543** 사용 — 5432는 동시 연결 15개 제한으로 여러 서버가 켜지면 막힘) |
| `SESSION_SECRET` | backend | 세션 쿠키 서명용 비밀값 (32자 이상) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | backend | Google OAuth 설정 |
| `DEV_LOGIN` | backend | `true`면 Google 설정 없이 테스트 계정 로그인 가능 (운영 환경에서는 항상 꺼짐) |
| `NEXT_PUBLIC_API_URL` | frontend | 백엔드 주소 (기본 `http://localhost:4000`) |
| `NEXT_PUBLIC_SITE_URL` | frontend | 공유 링크 미리보기 이미지의 기준 주소 |

자세한 설명은 각 `.env.example` 파일의 주석을 참고하세요.

### 3. 데이터베이스 준비

```bash
npm run db:init      # 스키마 생성 및 시드 데이터 입력
npm run db:migrate   # 마이그레이션 적용
```

### 4. 개발 서버 실행

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

### 5. 빌드

```bash
npm run build
```

### 6. 테스트

```bash
npm test --workspace=backend
```

## 🔌 API 개요

모든 API는 `/api` 아래에 있습니다.

| 경로 | 설명 |
| --- | --- |
| `/api/health` | 서버 상태 확인 |
| `/api/auth` | Google 로그인, 로그아웃, 개발용 로그인 |
| `/api/me` | 내 정보, 좋아요, 월드컵 기록, 취향 리포트 |
| `/api/brands` | 브랜드 목록 |
| `/api/products` | 상품 목록·상세 |
| `/api/recommend` | 조건 검색·랜덤 추천 |
| `/api/likes` | 좋아요 추가·삭제 |
| `/api/reviews` | 한 줄 평 작성·삭제 |
| `/api/saved-searches` | 검색 조건 저장·삭제 |
| `/api/worldcup` | 참가 옵션, 세션 시작·진행, 경기 선택, 랭킹, 결과 공유 |

## 🐳 Docker로 실행하기 (로컬 개발용)

Docker Desktop 만 있으면 팀원 모두 같은 환경에서 앱을 띄울 수 있습니다. `backend/.env` 를 준비한 뒤:

```bash
docker compose up --build   # → http://localhost:3000
```

로컬 DB 사용법, 명령어, 문제 해결은 **[docker/README.md](docker/README.md)** 를 참고하세요.
