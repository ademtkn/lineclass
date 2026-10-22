#!/usr/bin/env bash
# Supabase service_role anahtarını ekrana yazdırmadan deploy/app-only/.env.production'a kaydeder.
set -euo pipefail
cd "$(dirname "$0")/.."
# Terminal yapıştırırken metnin başına/sonuna "bracketed paste" kodları (ESC[200~ / ESC[201~)
# ekleyebiliyor; bu kodlar anahtarı/şifreyi bozar. Yapıştırma modunu kapat, çıkışta geri aç.
printf '\e[?2004l'; trap 'printf "\e[?2004h"' EXIT
strip_paste() { printf '%s' "$1" | LC_ALL=C sed -e 's/\x1b\[20[01]~//g' -e 's/\x1b\[[0-9;]*[~A-Za-z]//g'; }
ENV_FILE=deploy/app-only/.env.production
REF=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | sed -E 's|.*https://([a-z0-9]+)\.supabase\.co.*|\1|')

echo "Supabase → Project Settings → API Keys → Legacy → service_role → Reveal → Copy"
read -rsp "service_role anahtarını buraya yapıştırıp Enter'a basın (ekranda görünmez): " KEY; echo
KEY=$(strip_paste "$KEY" | tr -d '[:space:]')

CHECK=$(python3 -c 'import sys,base64,json
t=sys.argv[1]
try:
    p=t.split(".")[1]; p+="="*(-len(p)%4); d=json.loads(base64.urlsafe_b64decode(p)); print(d.get("role"), d.get("ref"))
except Exception: print("- -")' "$KEY")

if [ "$CHECK" != "service_role $REF" ]; then
  echo "❌ Bu bir '$REF' projesinin service_role anahtarı değil (algılanan: $CHECK). Tekrar deneyin."
  exit 1
fi

umask 077
python3 - "$KEY" "$ENV_FILE" <<'EOF'
import re, sys
key, path = sys.argv[1], sys.argv[2]
s = open(path).read()
s = re.sub(r"^SUPABASE_SERVICE_ROLE_KEY=.*$", "SUPABASE_SERVICE_ROLE_KEY=" + key, s, flags=re.M)
open(path, "w").write(s)
EOF
echo "✅ service_role anahtarı kaydedildi ($ENV_FILE). Claude'a 'tamam' diyebilirsiniz."
