#!/bin/sh
# 로컬 Postgres 컨테이너 최초 기동 시 1회 실행된다 (볼륨이 비어 있을 때만).
# backend/src/db 가 /sql 로 마운트되어 있다. migrations 는 새 파일이 추가돼도 자동으로 포함된다.
set -eu

run() {
  echo "init-db: $1"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -q -f "$1"
}

run /sql/schema.sql
run /sql/indexes.sql
run /sql/seed_brands.sql
for file in /sql/migrations/*.sql; do
  run "$file"
done
