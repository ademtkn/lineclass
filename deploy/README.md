# LineClass — sunucu kurulumu

İki kurulum seçeneği vardır:

| | **A) Sadece uygulama** (şu an kullanılan) | **B) Her şey kendi sunucumuzda** |
|---|---|---|
| Sunucu | 512 MB ($4/ay) | ≥ 4 GB ($24/ay) |
| Veritabanı | supabase.com (ücretsiz plan) | Self-hosted Supabase |
| Dosyalar | `deploy/app-only/`, `scripts/deploy-app.sh` | `deploy/bootstrap.sh` ve aşağısı |

## A) Sadece uygulama (512 MB sunucu + supabase.com)

1. supabase.com'da proje (Frankfurt) → SQL Editor'de `supabase/migrations/0001…0007` sırayla → Authentication → Sign In / Providers: **"Allow new users to sign up" kapalı**; URL Configuration → Site URL `https://lineclass.com.kg`.
2. `deploy/app-only/.env.production.example` → `deploy/app-only/.env.production` (Supabase anahtarları).
3. Sunucuyu bir kez hazırla: `ssh -i ~/.ssh/lineclass_do root@IP 'bash -s' < deploy/app-only/setup-server.sh`
4. Yayınla / güncelle (bu bilgisayardan): `bash scripts/deploy-app.sh root@IP`
5. DNS: `lineclass.com.kg` ve `www.lineclass.com.kg` için A kaydı → sunucu IP. HTTPS sertifikası otomatik gelir.

Yedekler: supabase.com ücretsiz planda otomatik yedek yoktur; Dashboard → Database → Backups bölümünden veya `pg_dump` ile ara sıra alın. Ücretsiz proje 7 gün hiç kullanılmazsa duraklatılır; panelden "Restore" ile açılır.

---

## B) Her şey kendi sunucumuzda (self-hosted Supabase)

Tek sunucu (DigitalOcean droplet, Ubuntu 24.04) üzerinde:

```
İnternet ──443──▶ Caddy (otomatik HTTPS)
                   ├─ lineclass.com.kg      → LineClass (Next.js)
                   └─ api.lineclass.com.kg  → Supabase API (yalnızca /auth /rest /storage /realtime)
Supabase (self-hosted, sabit sürüm self-hosted/v0.8.3): Postgres, Auth, Storage, Studio …
```

Dışarıya yalnızca 22 (SSH), 80 ve 443 açıktır. Postgres, Studio ve Supabase API geçidi dışarıya kapalıdır.

## İlk kurulum

1. Droplet: Ubuntu 24.04, **en az 4 GB RAM**, Frankfurt (fra1), SSH anahtarıyla.
2. Alan adı panelinde (cctld.kg) A kayıtları → droplet IP'si:
   `lineclass.com.kg`, `www.lineclass.com.kg`, `api.lineclass.com.kg`
3. Sunucuda root olarak:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/ademtkn/lineclass/main/deploy/bootstrap.sh | APP_DOMAIN=lineclass.com.kg bash
   ```
4. İlk admin (şifreyi siz yazarsınız, ekranda görünmez):
   ```bash
   bash /opt/lineclass/app/deploy/create-admin.sh
   ```

## Güncelleme (GitHub'daki son sürümü yayınla)

```bash
bash /opt/lineclass/app/deploy/update.sh
```
Yeni `supabase/migrations/*.sql` dosyaları otomatik ve bir kez uygulanır.

## Yedekler

Her gece 02:30'da `/opt/lineclass/backups` altına veritabanı (`db-*.dump`) ve öğrenci fotoğrafları (`storage-*.tar.gz`) alınır, 14 gün saklanır. Elle almak için: `bash /opt/lineclass/app/deploy/backup.sh`

Sunucu çökmesine karşı DigitalOcean'ın haftalık droplet yedeklerini de açmanız önerilir. Yedekleri ara sıra bilgisayarınıza indirin:
```bash
scp -r root@SUNUCU_IP:/opt/lineclass/backups ./lineclass-yedek
```

Veritabanını geri yükleme (dikkat: mevcut verinin üzerine yazar):
```bash
PGPASSWORD=$(grep ^POSTGRES_PASSWORD= /opt/lineclass/supabase/.env | cut -d= -f2-)
docker exec -i -e PGPASSWORD="$PGPASSWORD" supabase-db pg_restore -h 127.0.0.1 -U supabase_admin -d postgres --clean --if-exists < /opt/lineclass/backups/db-TARIH.dump
```

## Supabase Studio (yönetim paneli)

İnternete açık değildir. Kendi bilgisayarınızdan SSH tüneliyle:
```bash
ssh -L 8000:127.0.0.1:8000 root@SUNUCU_IP
```
Sonra tarayıcıda http://localhost:8000 — kullanıcı adı/şifre: sunucudaki `/opt/lineclass/supabase/.env` içindeki `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`.

## Gizli bilgiler

- `/opt/lineclass/supabase/.env` — veritabanı şifresi, JWT anahtarları (yalnızca root okuyabilir). **Kaybetmeyin; yedekleyin.**
- `/opt/lineclass/app/deploy/.env` — uygulama anahtarları; gerçek çeviri için `OPENAI_API_KEY` buraya, sonra `update.sh`.

## Sorun giderme

```bash
cd /opt/lineclass/app/deploy && docker compose logs -f --tail=100     # uygulama + Caddy
cd /opt/lineclass/supabase && docker compose ps                       # Supabase servisleri
```
HTTPS sertifikası alınamıyorsa: DNS kayıtlarının sunucu IP'sini gösterdiğini kontrol edin (`dig +short lineclass.com.kg`).
