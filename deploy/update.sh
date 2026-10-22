#!/usr/bin/env bash
# GitHub'daki son sürümü yayınlar: kod → veritabanı şeması → uygulama yeniden derlenir.
set -euo pipefail
APP=/opt/lineclass/app
git -C "$APP" pull --ff-only
bash "$APP/deploy/migrate.sh"
cd "$APP/deploy" && docker compose up -d --build
docker image prune -f >/dev/null
echo "Güncelleme tamam."
