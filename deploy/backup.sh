#!/usr/bin/env bash
# Veritabanı + öğrenci fotoğrafları yedeği. Cron her gece çalıştırır; 14 günden eskiler silinir.
# Geri yükleme: deploy/README.md
set -euo pipefail
DIR=/opt/lineclass/backups
SB=/opt/lineclass/supabase
TS=$(date +%F-%H%M)
mkdir -p "$DIR" && chmod 700 "$DIR"
PGPASSWORD=$(grep '^POSTGRES_PASSWORD=' "$SB/.env" | cut -d= -f2-)

docker exec -e PGPASSWORD="$PGPASSWORD" supabase-db \
  pg_dump -h 127.0.0.1 -U supabase_admin -d postgres -Fc > "$DIR/db-$TS.dump"
tar -czf "$DIR/storage-$TS.tar.gz" -C "$SB/volumes" storage

find "$DIR" -type f -mtime +14 -delete
echo "$(date -Is) yedek tamam: $(du -sh "$DIR" | cut -f1)"
