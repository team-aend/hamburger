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

## 월드컵 데이터

월드컵 참가 상품은 DB에서 조회하며, 랭킹은 완료된 실제 상품 세션만 집계합니다. 정적 샘플 버거 목록과 기존 클라이언트 결과 제출 API는 제거했습니다. 데이터 조회 실패 시 샘플 결과로 대체하지 않습니다.

회원 기록은 로그인 상태에서 시작한 세션에 연결됩니다. 익명 세션과 기존 샘플 기록은 로그인 후 자동으로 회원 기록에 편입하지 않습니다. 과거 샘플 기록 테이블은 조회·저장 경로에서 제외하며 기존 DB 데이터를 삭제하는 마이그레이션은 실행하지 않습니다.

업데이트 후 서버를 실행하기 전에 `005_worldcup_session_users.sql`을 포함한 마이그레이션을 적용하세요.

```bash
npm run db:migrate
```
