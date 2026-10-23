#!/usr/bin/env bash
# LineClass — yeni bir Ubuntu 24.04 sunucusuna (DigitalOcean droplet) tek komutla kurulum.
# root olarak:
#   curl -fsSL https://raw.githubusercontent.com/ademtkn/lineclass/main/deploy/bootstrap.sh | APP_DOMAIN=lineclass.com.kg bash
#
# Kurar: Docker, güvenlik duvarı, self-hosted Supabase (sabit sürüm), veritabanı şeması,
#        LineClass uygulaması, Caddy (otomatik HTTPS), gece yedekleri.
# Tekrar çalıştırmak güvenlidir: var olan kurulum ve anahtarlar korunur.
set -euo pipefail

APP_DOMAIN=${APP_DOMAIN:?APP_DOMAIN gerekli, örn. APP_DOMAIN=lineclass.com.kg}
API_DOMAIN=${API_DOMAIN:-api.$APP_DOMAIN}
SUPABASE_REF=${SUPABASE_REF:-self-hosted/v0.8.3}
REPO=${REPO:-https://github.com/ademtkn/lineclass.git}
BASE=/opt/lineclass
SB=$BASE/supabase
APP=$BASE/app

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
set_env() { # set_env DOSYA ANAHTAR DEĞER
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else echo "$2=$3" >> "$1"; fi
}
read_env() { grep "^$2=" "$1" | head -n1 | cut -d= -f2-; }

[ "$(id -u)" = 0 ] || { echo "root olarak çalıştırın"; exit 1; }

log "Sistem paketleri ve 2 GB swap"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ufw python3 >/dev/null
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Güvenlik duvarı: yalnızca SSH, HTTP, HTTPS"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

mkdir -p "$BASE"
if [ ! -d "$APP/.git" ]; then
  log "LineClass kaynak kodu indiriliyor"
  git clone -q "$REPO" "$APP"
else
  git -C "$APP" pull -q --ff-only
fi

if [ ! -f "$SB/.env" ]; then
  log "Supabase kuruluyor ($SUPABASE_REF) — Docker ve anahtarlar dahil"
  cd "$BASE"
  curl -fsSL "https://raw.githubusercontent.com/supabase/supabase/refs/tags/$SUPABASE_REF/docker/setup.sh" -o /tmp/supabase-setup.sh
  sh /tmp/supabase-setup.sh --ref "$SUPABASE_REF" --project-dir supabase -y
fi

log "Supabase ayarları"
set_env "$SB/.env" SUPABASE_PUBLIC_URL "https://$API_DOMAIN"
set_env "$SB/.env" API_EXTERNAL_URL "https://$API_DOMAIN/auth/v1"
set_env "$SB/.env" SITE_URL "https://$APP_DOMAIN"
set_env "$SB/.env" DISABLE_SIGNUP true            # hesapları yalnızca admin / davet linki açar
set_env "$SB/.env" ENABLE_ANONYMOUS_USERS false
set_env "$SB/.env" ENABLE_PHONE_SIGNUP false
cp "$APP/deploy/supabase-override.yml" "$SB/docker-compose.lineclass.yml"
set_env "$SB/.env" COMPOSE_FILE "docker-compose.yml:docker-compose.lineclass.yml"
chmod 600 "$SB/.env"

log "Supabase başlatılıyor"
cd "$SB" && docker compose up -d --quiet-pull
for i in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' supabase-storage 2>/dev/null)" = healthy ] && break
  sleep 5
done
[ "$(docker inspect -f '{{.State.Health.Status}}' supabase-storage)" = healthy ] || { echo "Supabase sağlıklı başlamadı: cd $SB && docker compose ps"; exit 1; }

log "Veritabanı şeması (migration'lar)"
bash "$APP/deploy/migrate.sh"

if [ ! -f "$APP/deploy/.env" ]; then
  log "Uygulama ortam değişkenleri"
  umask 077
  cat > "$APP/deploy/.env" <<EOF
APP_DOMAIN=$APP_DOMAIN
API_DOMAIN=$API_DOMAIN
NEXT_PUBLIC_SITE_URL=https://$APP_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://$API_DOMAIN
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(read_env "$SB/.env" ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=$(read_env "$SB/.env" SERVICE_ROLE_KEY)
NEXT_PUBLIC_TIME_ZONE=Asia/Bishkek
# Gerçek çeviri için birini doldurup: bash /opt/lineclass/app/deploy/update.sh
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
EOF
fi

log "LineClass derleniyor ve başlatılıyor (birkaç dakika sürebilir)"
cd "$APP/deploy" && docker compose up -d --build --quiet-pull

log "Gece yedekleri (02:30, 14 gün saklanır)"
echo "30 2 * * * root bash $APP/deploy/backup.sh >> /var/log/lineclass-backup.log 2>&1" > /etc/cron.d/lineclass-backup

IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
cat <<EOF

✅ Kurulum tamam.

DNS kayıtları (alan adı panelinde) bu sunucuyu göstermeli:
   A   $APP_DOMAIN        → $IP
   A   www.$APP_DOMAIN    → $IP
   A   $API_DOMAIN        → $IP
DNS yayılınca HTTPS sertifikaları otomatik alınır: https://$APP_DOMAIN

İlk admin hesabı (şifreyi siz yazarsınız):
   bash $APP/deploy/create-admin.sh
EOF
