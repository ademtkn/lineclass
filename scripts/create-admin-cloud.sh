#!/usr/bin/env bash
# supabase.com projesinde ilk super admin hesabını açar. Şifreyi siz yazarsınız; ekranda görünmez, hiçbir yere kaydedilmez.
set -euo pipefail
cd "$(dirname "$0")/.."
# Terminal yapıştırırken metnin başına/sonuna "bracketed paste" kodları (ESC[200~ / ESC[201~)
# ekleyebiliyor; bu kodlar anahtarı/şifreyi bozar. Yapıştırma modunu kapat, çıkışta geri aç.
printf '\e[?2004l'; trap 'printf "\e[?2004h"' EXIT
strip_paste() { printf '%s' "$1" | LC_ALL=C sed -e 's/\x1b\[20[01]~//g' -e 's/\x1b\[[0-9;]*[~A-Za-z]//g'; }
ENV_FILE=deploy/app-only/.env.production
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)

read -rp "Ad Soyad: " NAME
read -rp "E-posta: " EMAIL
read -rsp "Şifre (en az 12 karakter, ekranda görünmez): " PASS; echo
read -rsp "Şifre (tekrar): " PASS2; echo
NAME=$(strip_paste "$NAME"); EMAIL=$(strip_paste "$EMAIL" | tr -d '[:space:]')
PASS=$(strip_paste "$PASS"); PASS2=$(strip_paste "$PASS2")
[ "$PASS" = "$PASS2" ] || { echo "❌ Şifreler aynı değil."; exit 1; }
[ ${#PASS} -ge 12 ] || { echo "❌ Şifre en az 12 karakter olmalı."; exit 1; }

BODY=$(NAME="$NAME" EMAIL="$EMAIL" PASS="$PASS" python3 -c 'import json,os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PASS"], "email_confirm": True,
  "app_metadata": {"role": "super_admin"}, "user_metadata": {"full_name": os.environ["NAME"]}}))')

CODE=$(curl -s -o /tmp/lc-admin-resp.json -w "%{http_code}" -X POST "$URL/auth/v1/admin/users" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" --data "$BODY")
if [ "$CODE" = 200 ]; then
  echo "✅ $EMAIL super admin olarak oluşturuldu. https://lineclass.com.kg/login adresinden girebilirsiniz."
else
  echo "❌ Oluşturulamadı (HTTP $CODE): $(python3 -c 'import json;d=json.load(open("/tmp/lc-admin-resp.json"));print(d.get("msg") or d.get("message") or d.get("error_description") or d)' 2>/dev/null || echo "yanıt yok — anahtar geçersiz olabilir: bash scripts/set-service-key.sh")"
fi
rm -f /tmp/lc-admin-resp.json
