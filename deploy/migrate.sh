#!/usr/bin/env bash
# supabase/migrations/*.sql dosyalarından henüz uygulanmamış olanları sırayla, her biri
# tek bir işlem (transaction) içinde uygular ve kaydını tutar.
set -euo pipefail
APP=$(cd "$(dirname "$0")/.." && pwd)
SB_ENV=${SB_ENV:-/opt/lineclass/supabase/.env}
PGPASSWORD=$(grep '^POSTGRES_PASSWORD=' "$SB_ENV" | cut -d= -f2-)

psql_db() {
  docker exec -i -e PGPASSWORD="$PGPASSWORD" -e PGOPTIONS="-c client_min_messages=warning" "${DB_CONTAINER:-supabase-db}" \
    psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

psql_db -c "create schema if not exists lineclass_meta;
            create table if not exists lineclass_meta.migrations (
              name text primary key, applied_at timestamptz not null default now());
            revoke all on schema lineclass_meta from public, anon, authenticated;"

for f in "$APP"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  applied=$(psql_db -tA -c "select 1 from lineclass_meta.migrations where name = '$name'")
  [ "$applied" = 1 ] && continue
  echo "→ $name"
  { echo "begin;"; cat "$f"; echo; echo "insert into lineclass_meta.migrations (name) values ('$name');"; echo "commit;"; } | psql_db
done
echo "Veritabanı güncel."
