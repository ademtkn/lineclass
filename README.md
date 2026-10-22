# LineClass

Öğretmenlerin öğrencileri fotoğraflı listelerde görüp ders içi not/gözlem girdiği, sınıf öğretmenleri ve yöneticilerin bu notları takip edip yapay zekâ ile **EN / KG / RU / TR** dillerine çevirebildiği mobil öncelikli web uygulaması.

**Stack:** Next.js 16 (App Router, Server Actions) · Tailwind CSS v4 · Supabase (Auth, Postgres + RLS, Storage) · OpenAI / Gemini (çeviri, anahtar yoksa mock)

## Hızlı başlangıç (yerel Supabase — hesap gerekmez)

Docker Desktop açıkken:

```bash
npm install
npm run db:start      # Supabase'i Docker'da başlatır, şemayı otomatik uygular (portlar 553xx)
npx supabase status   # API URL + anon / service_role anahtarlarını gösterir → .env.local'e yazın
npm run seed          # demo verisi
npm run dev
```

Yerel Supabase Studio (veritabanını tablo olarak görmek için): http://127.0.0.1:55323
Veritabanını sıfırlayıp seed'i tekrar yüklemek: `npm run db:reset`

## Kurulum (supabase.com bulut projesi)

1. [supabase.com](https://supabase.com)'da bir proje açın.
2. **SQL Editor** → `supabase/migrations/0001_init.sql` içeriğini yapıştırıp çalıştırın.
3. Ortam değişkenleri:
   ```bash
   cp .env.example .env.local   # değerleri Supabase → Project Settings → API'den doldurun
   ```
4. Demo verisi (isteğe bağlı):
   ```bash
   node --env-file=.env.local scripts/seed.mjs
   ```
5. Çalıştırın:
   ```bash
   npm run dev
   ```
   → http://localhost:3000 (telefondan denemek için aynı ağdaki bilgisayarın IP'si)

Seed sonrası giriş: `admin@lineclass.test`, `aisel@lineclass.test` (sınıf öğretmeni), `mehmet@lineclass.test` (branş), şifre `LineClass123!`.

## Roller

| Rol | Ana ekran | Yapabildikleri |
|---|---|---|
| **Super Admin** | `/admin`, `/admin/manage` | Kullanıcı oluşturma + rol, sınıf oluşturma + sınıf öğretmeni atama, tüm öğrenci/not/atama yönetimi, tüm notları görme ve silme |
| **Sınıf Öğretmeni** | `/admin` (Sınıfım), `/teacher` (Derslerim) | Kendi sınıfının öğrencilerini ve derse giren öğretmen atamalarını yönetir; sınıfındaki öğrencilere yazılan **tüm** notları görür; derse girdiği sınıflara not yazar |
| **Branş Öğretmeni** | `/teacher` | İlk girişte ad + branş seçer; atandığı sınıfları → fotoğraflı öğrenci kartlarını görür; not ekler (yazılı veya 🎤 sesle), yalnızca **kendi** notlarını görür |

Yetkiler arayüzde değil **veritabanında (RLS)** uygulanır; bkz. `0001_init.sql` içindeki `can_access_class`, `is_class_teacher_of` fonksiyonları ve politikalar.

## Klasör yapısı

```
supabase/migrations/0001_init.sql   Şema, trigger, RLS, storage bucket
scripts/seed.mjs                    Demo kullanıcı / sınıf / öğrenci / not
src/
  proxy.ts                          (Next 16'da middleware → proxy) oturum yenileme + /login yönlendirmesi
  lib/
    supabase/{server,client,proxy}.ts
    auth.ts                         getProfile(), requireRole(...)
    queries.ts                      Ortak sorgular (öğrenci + notlar)
    translate.ts                    OpenAI / Gemini / mock çeviri sağlayıcısı
    types.ts                        Tipler, rol/durum/dil etiketleri, branş listesi
  components/
    AppHeader, Avatar, StudentGrid, StudentHeader,
    NoteForm (durum + sesle yazma), NoteList, TranslateBox, ProfileForm, ActionForm
  app/
    login/                          Giriş + server actions (login/logout)
    teacher/                        Sınıflarım → classes/[classId] → students/[studentId] (+ not ekleme)
    admin/                          Sınıf filtresi + öğrenci kartları → students/[studentId] (tüm notlar + çeviri)
      classes/[classId]/            Öğrenci ekle (fotoğraflı) / öğretmen ata
      manage/                       Super admin: kullanıcılar & sınıflar
    api/translate/route.ts          POST { noteId, lang } → çeviri (note_translations'ta önbellek)
```

## Çeviri

`TRANSLATE_PROVIDER` boşsa: `OPENAI_API_KEY` varsa OpenAI (`gpt-4o-mini`), yoksa `GEMINI_API_KEY` varsa Gemini, ikisi de yoksa **mock** (`[EN · demo çeviri] …`). Gerçek çeviriler `note_translations` tablosunda saklanır; aynı not aynı dile ikinci kez ücretlendirilmez.

## Sonraki adımlar (öneri)

- Not düzenleme, tarih/öğretmen filtresi, haftalık özet
- Supabase Realtime ile sınıf öğretmeni ekranında canlı not akışı
- Toplu öğrenci içe aktarma (CSV) ve fotoğraf kırpma
- `supabase gen types typescript` ile tip güvenli sorgular
