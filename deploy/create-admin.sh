#!/usr/bin/env bash
# İlk super admin hesabını oluşturur. Şifreyi siz yazarsınız; ekranda görünmez, hiçbir yere kaydedilmez.
set -euo pipefail
SB=/opt/lineclass/supabase
KEY=$(grep '^SERVICE_ROLE_KEY=' "$SB/.env" | cut -d= -f2-)

read -rp "Ad Soyad: " NAME
read -rp "E-posta: " EMAIL
read -rsp "Şifre (en az 12 karakter): " PASS; echo
[ ${#PASS} -ge 12 ] || { echo "Şifre en az 12 karakter olmalı."; exit 1; }

BODY=$(NAME="$NAME" EMAIL="$EMAIL" PASS="$PASS" python3 -c 'import json,os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PASS"], "email_confirm": True,
  "app_metadata": {"role": "super_admin"}, "user_metadata": {"full_name": os.environ["NAME"]}}))')

curl -fsS -X POST http://127.0.0.1:8000/auth/v1/admin/users \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  --data "$BODY" >/dev/null && echo "✅ $EMAIL super admin olarak oluşturuldu."
