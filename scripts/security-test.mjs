// Güvenlik testleri: npm run test:security
// Yerel Supabase + seed verisi + çalışan uygulama (APP_URL, varsayılan http://localhost:3123) gerekir.
// Her test "saldırganın yapamaması gereken" bir işlemi dener; başarısızlık = güvenlik açığı.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APP = process.env.APP_URL ?? "http://localhost:3123";
const PASSWORD = "LineClass123!"; // scripts/seed.mjs ile aynı demo şifre

const results = [];
async function test(name, fn) {
  try {
    const ok = await fn();
    results.push({ name, ok: !!ok });
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
  }
}
const anon = () => createClient(url, anonKey, { auth: { persistSession: false } });
async function login(email) {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email} giriş yapamadı: ${error.message}`);
  const { data } = await c.auth.getSession();
  return Object.assign(c, { uid: data.session.user.id, jwt: data.session.access_token });
}
const denied = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null;
const id = async (table, col, val) => (await svc.from(table).select("id").eq(col, val).single()).data.id;

// ---------------------------------------------------------------- hazırlık
const c5a = await id("classes", "name", "5-A");
const c6b = await id("classes", "name", "6-B");
const s5a = (await svc.from("students").select("id").eq("class_id", c5a).limit(1).single()).data.id;
const s6b = (await svc.from("students").select("id").eq("class_id", c6b).limit(1).single()).data.id;
const mehmetId = await id("profiles", "email", "mehmet@lineclass.test");
const mehmetNote = (await svc.from("notes").insert({ student_id: s5a, teacher_id: mehmetId, note_text: "güvenlik testi notu" }).select("id").single()).data.id;

const irina = await login("irina@lineclass.test"); // branş öğretmeni, sadece 5-A
const aisel = await login("aisel@lineclass.test"); // sınıf öğretmeni, 5-A
const guest = anon();

// ---------------------------------------------------------------- girişsiz kullanıcı
for (const t of ["profiles", "classes", "students", "notes", "teacher_class_access", "class_subjects", "note_translations"]) {
  await test(`Girişsiz: ${t} tablosu okunamaz`, async () => denied(await guest.from(t).select("*").limit(1)));
}
await test("Girişsiz: yardımcı DB fonksiyonları çağrılamaz (class_of_student)", async () =>
  !!(await guest.rpc("class_of_student", { p_student_id: s5a })).error);
await test("Girişsiz: link kodu üretici çağrılamaz", async () => !!(await guest.rpc("gen_join_code", { p_name: "x" })).error);
await test("Girişsiz: /api/translate → 401", async () =>
  (await fetch(`${APP}/api/translate`, { method: "POST", body: JSON.stringify({ noteId: mehmetNote, lang: "en" }) })).status === 401);
await test("Girişsiz: /teacher ve /admin girişe yönlenir", async () => {
  const a = await fetch(`${APP}/teacher`, { redirect: "manual" });
  const b = await fetch(`${APP}/admin/manage`, { redirect: "manual" });
  return [a, b].every((r) => r.status === 307 && r.headers.get("location")?.endsWith("/login"));
});
await test("Girişsiz: geçersiz davet kodu sınıf bilgisi sızdırmaz", async () =>
  (await (await fetch(`${APP}/5a-zzzzzzz`)).text()).includes("Link geçersiz"));

await test("Girişsiz: herkese açık kayıt ile admin olunamaz (signup + rol enjeksiyonu)", async () => {
  const email = `saldirgan-${Date.now()}@example.com`;
  const { data, error } = await guest.auth.signUp({
    email,
    password: "Saldirgan-12345",
    options: { data: { role: "super_admin", via_link: true } },
  });
  if (error || !data.user) return true; // kayıt kapalı: en iyi durum
  const { data: p } = await svc.from("profiles").select("role, via_link").eq("id", data.user.id).single();
  await svc.auth.admin.deleteUser(data.user.id);
  return p?.role === "branch_teacher" && p?.via_link === false;
});

await test("Hesap açma: admin'in verdiği rol (app_metadata) profile doğru yansır", async () => {
  const { data, error } = await svc.auth.admin.createUser({
    email: `rol-testi-${Date.now()}@example.com`,
    password: "Rol-Testi-12345",
    email_confirm: true,
    app_metadata: { role: "class_teacher" },
  });
  if (error) throw error;
  const { data: p } = await svc.from("profiles").select("role").eq("id", data.user.id).single();
  await svc.auth.admin.deleteUser(data.user.id);
  return p?.role === "class_teacher";
});

// ---------------------------------------------------------------- branş öğretmeni (Irina)
await test("Branş: başka sınıfın (6-B) öğrencilerini göremez", async () => denied(await irina.from("students").select("id").eq("class_id", c6b)));
await test("Branş: başka öğretmenin notunu göremez", async () => denied(await irina.from("notes").select("id").eq("id", mehmetNote)));
await test("Branş: erişimi olmayan sınıfa not yazamaz", async () =>
  !!(await irina.from("notes").insert({ student_id: s6b, teacher_id: irina.uid, note_text: "x" })).error);
await test("Branş: başkası adına not yazamaz", async () =>
  !!(await irina.from("notes").insert({ student_id: s5a, teacher_id: mehmetId, note_text: "x" })).error);
await test("Branş: başkasının notunu değiştiremez", async () =>
  denied(await irina.from("notes").update({ note_text: "hack" }).eq("id", mehmetNote).select()));
await test("Branş: başkasının notunu silemez", async () =>
  denied(await irina.from("notes").delete().eq("id", mehmetNote).select()));
await test("Branş: kendi rolünü yükseltemez", async () =>
  denied(await irina.from("profiles").update({ role: "super_admin" }).eq("id", irina.uid).select()));
await test("Branş: kendi e-postasını değiştiremez (hesap ele geçirme)", async () =>
  denied(await irina.from("profiles").update({ email: "x@lineclass.test" }).eq("id", irina.uid).select()));
await test("Branş: diğer kullanıcıların e-postalarını göremez", async () =>
  !!(await irina.from("profiles").select("email").neq("id", irina.uid).limit(1)).error);
await test("Branş: sahte çeviri yazamaz (önbellek zehirleme)", async () => {
  const own = (await irina.from("notes").insert({ student_id: s5a, teacher_id: irina.uid, note_text: "test" }).select("id").single()).data.id;
  const r = await irina.from("note_translations").insert({ note_id: own, lang: "en", text: "fake" });
  await svc.from("notes").delete().eq("id", own);
  return !!r.error;
});
await test("Branş: erişemediği notu çeviri API'siyle okuyamaz", async () =>
  (await fetch(`${APP}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: await authCookie(irina) },
    body: JSON.stringify({ noteId: mehmetNote, lang: "en" }),
  })).status === 404);
await test("Branş: fotoğraf yükleyemez", async () =>
  !!(await irina.storage.from("student-photos").upload(`${c5a}/x.png`, new Blob(["x"], { type: "image/png" }))).error);
await test("Branş: ders ekleyemez / atama yapamaz", async () =>
  !!(await irina.from("class_subjects").insert({ class_id: c5a, subject: "Hack" })).error &&
  !!(await irina.from("teacher_class_access").insert({ class_id: c6b, teacher_id: irina.uid })).error);
await test("Branş: davet linkini yenileyemez", async () => !!(await irina.rpc("regenerate_join_token", { p_class_id: c5a })).error);

// ---------------------------------------------------------------- sınıf öğretmeni (Aisel)
await test("Sınıf öğr.: başka sınıfın öğrencilerini/notlarını göremez", async () =>
  denied(await aisel.from("students").select("id").eq("class_id", c6b)));
await test("Sınıf öğr.: öğrenciyi başka sınıfa taşıyamaz", async () =>
  !!(await aisel.from("students").update({ class_id: c6b }).eq("id", s5a)).error);
await test("Sınıf öğr.: başka sınıfa öğretmen atayamaz", async () =>
  !!(await aisel.from("teacher_class_access").insert({ class_id: c6b, teacher_id: aisel.uid })).error);
await test("Sınıf öğr.: sınıf bilgilerini/sınıf öğretmenini değiştiremez", async () =>
  denied(await aisel.from("classes").update({ class_teacher_id: aisel.uid }).eq("id", c6b).select()));
await test("Sınıf öğr.: kendi sınıfını açabilir, adını değiştirip silebilir", async () => {
  const name = `T-${Date.now() % 100000}`;
  const ins = await aisel.from("classes").insert({ name, class_teacher_id: aisel.uid }).select("id, join_token").single();
  if (ins.error || !ins.data.join_token) return false;
  const upd = await aisel.from("classes").update({ name: name + "X" }).eq("id", ins.data.id).select();
  const del = await aisel.from("classes").delete().eq("id", ins.data.id).select();
  return !upd.error && upd.data.length === 1 && !del.error && del.data.length === 1;
});
await test("Sınıf öğr.: başkası adına sınıf açamaz", async () =>
  denied(await aisel.from("classes").insert({ name: `X-${Date.now() % 100000}`, class_teacher_id: mehmetId }).select()));
await test("Sınıf öğr.: davet kodunu kendisi belirleyemez", async () =>
  !!(await aisel.from("classes").insert({ name: `J-${Date.now() % 100000}`, class_teacher_id: aisel.uid, join_token: "5a-hack" }).select()).error);
await test("Sınıf öğr.: başka sınıfı silemez", async () => {
  await aisel.from("classes").delete().eq("id", c6b);
  return !!(await svc.from("classes").select("id").eq("id", c6b).maybeSingle()).data;
});
await test("Branş: sınıf açamaz", async () =>
  denied(await irina.from("classes").insert({ name: `B-${Date.now() % 100000}`, class_teacher_id: irina.uid }).select()));
await test("Sınıf öğr.: başkasının rolünü değiştiremez", async () =>
  denied(await aisel.from("profiles").update({ role: "super_admin" }).eq("id", irina.uid).select()));
await test("Sınıf öğr.: başka sınıfın klasörüne fotoğraf yükleyemez", async () =>
  !!(await aisel.storage.from("student-photos").upload(`${c6b}/x.png`, new Blob(["x"], { type: "image/png" }))).error);
await test("Sınıf öğr.: SVG/HTML dosyası yükleyemez (XSS)", async () =>
  !!(await aisel.storage.from("student-photos").upload(`${c5a}/x.svg`, new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" }))).error);

// ---------------------------------------------------------------- HTTP güvenlik başlıkları
await test("Başlıklar: clickjacking koruması (X-Frame-Options / frame-ancestors)", async () => {
  const h = (await fetch(`${APP}/login`)).headers;
  return h.get("x-frame-options") === "DENY" || /frame-ancestors 'none'/.test(h.get("content-security-policy") ?? "");
});
await test("Başlıklar: nosniff + referrer-policy", async () => {
  const h = (await fetch(`${APP}/login`)).headers;
  return h.get("x-content-type-options") === "nosniff" && !!h.get("referrer-policy");
});
await test("Başlıklar: X-Powered-By gizli", async () => !(await fetch(`${APP}/login`)).headers.get("x-powered-by"));

// ---------------------------------------------------------------- temizlik + rapor
await svc.from("notes").delete().eq("id", mehmetNote);
await svc.storage.from("student-photos").remove([`${c5a}/x.png`, `${c6b}/x.png`, `${c5a}/x.svg`]);

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.err ? `  (${r.err})` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} test geçti`);
process.exit(failed.length ? 1 : 0);

/** @supabase/ssr çerez biçimi: Next.js route'larına kullanıcı olarak istek atmak için */
async function authCookie(client) {
  const { data } = await client.auth.getSession();
  const ref = new URL(url).hostname.split(".")[0];
  const value = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  return `sb-${ref}-auth-token=${value}`;
}
