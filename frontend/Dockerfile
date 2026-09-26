# syntax=docker/dockerfile:1
# 빌드 컨텍스트는 저장소 루트다 (npm workspaces 라서 루트 package-lock.json 이 필요하다).
#   docker build -f frontend/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# next.config.ts 의 /api/* rewrite 대상은 빌드 시점에 결정되어 이미지에 고정된다.
# (output: 'standalone' 은 rewrite 를 required-server-files.json 에 미리 써 둔다)
# 따라서 런타임 환경변수가 아니라 build arg 로 넘겨야 한다.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app ./
COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# output: 'standalone' 결과물에는 실행에 필요한 node_modules 가 이미 포함되어 있다.
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
