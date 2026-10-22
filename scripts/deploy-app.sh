#!/usr/bin/env bash
# LineClass'ı 512 MB'lık sunucuya yayınlar: imaj bu bilgisayarda derlenir, sunucuya gönderilir.
#   bash scripts/deploy-app.sh root@SUNUCU_IP
# Gerekli: deploy/app-only/.env.production (git'e girmez; örnek: deploy/app-only/.env.production.example)
set -euo pipefail
HOST=${1:?Kullanım: bash scripts/deploy-app.sh root@SUNUCU_IP}
cd "$(dirname "$0")/.."
ENV_FILE=deploy/app-only/.env.production
SSH="ssh -i $HOME/.ssh/lineclass_do -o StrictHostKeyChecking=accept-new"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE yok"; exit 1; }

get() { grep "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }

echo "==> İmaj derleniyor (linux/amd64)"
docker build -q --platform linux/amd64 -t lineclass-app:latest \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$(get NEXT_PUBLIC_SUPABASE_URL)" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$(get NEXT_PUBLIC_SUPABASE_ANON_KEY)" \
  --build-arg NEXT_PUBLIC_SITE_URL="$(get NEXT_PUBLIC_SITE_URL)" .

echo "==> İmaj sunucuya gönderiliyor"
docker save lineclass-app:latest | gzip | $SSH "$HOST" 'gunzip | docker load -q'

echo "==> Yapılandırma ve başlatma"
scp -q -i "$HOME/.ssh/lineclass_do" deploy/app-only/docker-compose.yml deploy/app-only/Caddyfile "$HOST":/opt/lineclass/
scp -q -i "$HOME/.ssh/lineclass_do" "$ENV_FILE" "$HOST":/opt/lineclass/.env
$SSH "$HOST" 'chmod 600 /opt/lineclass/.env && cd /opt/lineclass && docker compose up -d --remove-orphans && docker image prune -f >/dev/null && docker compose ps --format "{{.Name}}: {{.Status}}"'
echo "==> Tamam"
