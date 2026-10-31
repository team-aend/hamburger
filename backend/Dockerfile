# syntax=docker/dockerfile:1
# 빌드 컨텍스트는 저장소 루트다 (npm workspaces 라서 루트 package-lock.json 이 필요하다).
#   docker build -f backend/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY backend ./backend
RUN npm run build --workspace=backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# 실행에 필요한 의존성만 설치 (devDependencies 및 frontend 의존성 제외)
RUN npm ci --omit=dev --workspace=backend --include-workspace-root && npm cache clean --force
COPY --from=builder /app/backend/dist ./backend/dist
USER node
EXPOSE 4000
CMD ["node", "backend/dist/index.js"]
