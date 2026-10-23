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
2. **SQL Editor** → `supabase/migrations/` altındaki dosyaları sırayla (`0001` … `0009`) yapıştırıp çalıştırın.
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

## Yayın (lineclass.com.kg)

Uygulama ve veritabanı (self-hosted Supabase) tek bir DigitalOcean sunucusunda Docker ile çalışır; Caddy otomatik HTTPS sağlar. Kurulum tek komut, güncelleme tek komut, gece yedekleri otomatik: **[deploy/README.md](deploy/README.md)**.

## Roller

| Rol | Ana ekran | Yapabildikleri |
|---|---|---|
| **Super Admin** | `/admin`, `/admin/manage` | Kullanıcı oluşturma + rol, sınıf oluşturma + sınıf öğretmeni atama, tüm öğrenci/not/atama yönetimi, tüm notları görme ve silme |
| **Sınıf Öğretmeni** | `/admin` (Sınıfım), `/teacher` (Derslerim) | Kendi sınıfının öğrencilerini ve derse giren öğretmen atamalarını yönetir; sınıfındaki öğrencilere yazılan **tüm** notları görür; derse girdiği sınıflara not yazar |
| **Branş Öğretmeni** | `/join/<link>` → `/teacher` | **Şifre yok:** sınıf öğretmeninin gönderdiği sınıf linkini açar, adına dokunur ya da ad + branş seçer; atandığı sınıfları → fotoğraflı öğrenci kartlarını görür; not ekler (yazılı veya 🎤 sesle), yalnızca **kendi** notlarını görür |

### Başvuru, öğrenci listesi ve fotoğraflar

- **Sınıf öğretmeni başvurusu:** `/apply` (girişsiz) → okul, sınıf, adres, iletişim. Yönetici `/admin/applications`'da inceler; **Onayla** hesabı açar, başvurudaki sınıfı oluşturur ve tek seferlik geçici şifreyi gösterir (telefon/WhatsApp ile iletilir).
- **Öğrenciler:** liste numaralıdır (1., 2., …), sınıf mevcudu gösterilir. **Pasif** öğrenci listelerden ve mevcuttan çıkar ama silinmez (Yönetim → Pasif öğrenciler → Aktif yap). **Sil** kaydı, notları ve sunucudaki fotoğraf dosyasını kalıcı siler.
- **Fotoğraflar** tarayıcıda, sonra sunucuda küçültülür (480 px WebP, ~40 KB).
- Sınıf öğretmeni, yalnızca kendi sınıflarındaki branş öğretmenlerinin adını/branşını düzeltebilir ve hesabını silebilir; dersleri düzeltir/siler.

### Derslere öğretmen atama

Sınıf öğretmeni **Öğretmen davet et → Dersler ve öğretmenleri** bölümünde sınıfın derslerini çiplerle ekler (veya özel ders adı yazar) ve her dersin yanındaki listeden öğretmen seçer; seçim anında kaydedilir. O branştaki öğretmenler listede önce önerilir.

- Derse atanan öğretmen sınıfa otomatik erişim kazanır; son dersinden çıkarılan öğretmenin erişimi kalkar (DB tetikleyicisi).
- Davet linkiyle gelen öğretmenin branşı, sınıfın **öğretmensiz** bir dersiyle eşleşiyorsa o derse otomatik atanır.
- Öğretmenin panelindeki sınıf kartında verdiği ders(ler) görünür.

### Sınıf davet linki (şifresiz branş öğretmeni)

Link biçimi kısa ve okunabilir: `<site>/<sınıf>-<7 karakter>`, örn. `class.line.kg/5a-k7m2qxp`. Karıştırılabilen karakterler (0/o, 1/l/i) kullanılmaz. Alan adı `NEXT_PUBLIC_SITE_URL` ile belirlenir.

Sınıf öğretmeni **Öğretmen davet et** ekranından sınıfa özel linki kopyalar / WhatsApp ile paylaşır. Linki açan öğretmen:
- daha önce katıldıysa listeden adına dokunur,
- ilk kez geliyorsa adını ve branşını seçer (aynı ad + branş başka bir sınıftan geldiyse aynı hesap kullanılır).

Oturum o telefonda açık kalır; bir daha link açmasına gerek yoktur. Link yanlış kişiye giderse **yeni link oluştur** ile eski link anında geçersiz olur. Admin ve sınıf öğretmenleri her zaman şifreyle girer; link onların hesaplarını açamaz.

> Not: Linke sahip olan herkes o sınıfın branş öğretmenlerinden biri olarak not yazabilir — kolaylık için bilinçli bir takas. Linki yalnızca öğretmen grubuyla paylaşın.

Yetkiler arayüzde değil **veritabanında (RLS)** uygulanır; bkz. `0001_init.sql` içindeki `can_access_class`, `is_class_teacher_of` fonksiyonları ve politikalar.

## Klasör yapısı

```
supabase/migrations/0001_init.sql   Şema, trigger, RLS, storage bucket
supabase/migrations/0002_class_join_links.sql  Sınıf davet linki (join_token, link yenileme)
supabase/migrations/0003_class_subjects.sql     Sınıf dersleri + derse öğretmen atama (erişim tetikleyicisi)
supabase/migrations/0004_short_join_codes.sql   Kısa davet kodu (5a-k7m2qxp)
supabase/migrations/0005_security_hardening.sql Güvenlik sağlamlaştırma (sütun yetkileri, storage, fonksiyonlar)
supabase/migrations/0006…0007                Rol yalnızca sunucunun yazabildiği app_metadata'dan okunur
Dockerfile, deploy/                 Sunucu kurulumu: Supabase + uygulama + Caddy + yedekler
scripts/security-test.mjs           Otomatik güvenlik testleri (npm run test:security)
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
    [token]/                        Sınıf davet sayfası (kök adreste kısa kod: /5a-k7m2qxp)
    api/translate/route.ts          POST { noteId, lang } → çeviri (note_translations'ta önbellek)
```

## Çeviri

Anahtarı tanımlı sağlayıcılar sırayla denenir: **Gemini** (ücretsiz katman, [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) → **DeepSeek** → **OpenAI**; biri hata verirse (ör. kota) sıradakine geçilir. Hiçbiri yoksa **mock** (`[EN · demo çeviri] …`). `TRANSLATE_PROVIDER` ile biri zorlanabilir. Gerçek çeviriler `note_translations` tablosunda saklanır; aynı not aynı dile ikinci kez çevrilmez.

## Güvenlik

```bash
npm run test:security   # uygulama + yerel Supabase çalışırken; 38 test
```

Testler her rol için yapılmaması gerekenleri dener: başka sınıfı/notu görme, başkası adına not yazma, rol yükseltme, e-posta değiştirme/okuma, sahte çeviri enjekte etme, başka sınıfın klasörüne veya SVG dosya yükleme, girişsiz API/DB fonksiyonu çağırma ve güvenlik başlıkları.

- Yetkiler veritabanında (RLS + sütun yetkileri) uygulanır; service role yalnızca sunucuda, yetki kontrolünden sonra kullanılır.
- Davet linki yalnızca **linkle oluşturulmuş** branş öğretmeni hesaplarını şifresiz açar. Şifreli hesaplar (admin, sınıf öğretmeni, admin'in açtığı öğretmenler) linkle açılamaz; isimleri yazılarak da ele geçirilemez.
- Bilinçli takas: linke sahip biri, o sınıfa linkle katılmış öğretmenlerden biri adına not yazabilir. Link sızarsa **yeni link oluştur** ile kapatın.
- Supabase'e geçici olarak ulaşılamazsa kullanıcı çıkışa atılmaz, "Bağlantı sorunu / Tekrar dene" ekranı görür.
- Çeviri API'sinde kullanıcı başına dakikada 20 istek sınırı vardır (tek sunucu için bellek içi; çok sunuculu kurulumda Redis gibi paylaşılan bir depo kullanın).
- Yayında HTTPS kullanın; `Strict-Transport-Security` başlığı yalnızca HTTPS üzerinde etkilidir.

## Sonraki adımlar (öneri)

- Not düzenleme, tarih/öğretmen filtresi, haftalık özet
- Supabase Realtime ile sınıf öğretmeni ekranında canlı not akışı
- Toplu öğrenci içe aktarma (CSV) ve fotoğraf kırpma
- `supabase gen types typescript` ile tip güvenli sorgular
