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
