// Demo verisi: node --env-file=.env.local scripts/seed.mjs
// Service-role anahtarı ile kullanıcı, sınıf, öğrenci, atama ve örnek notlar oluşturur.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local).");
  process.exit(1);
}
// Demo şifresi bu depoda herkese açık: canlı veritabanında asla demo hesapları oluşturma
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(`Seed yalnızca yerel Supabase için çalışır (hedef: ${host}). İptal edildi.`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const PASSWORD = "LineClass123!";
const USERS = [
  { email: "admin@lineclass.test", full_name: "Ana Yönetici", role: "super_admin", branch: null },
  { email: "aisel@lineclass.test", full_name: "Aisel Tokonova", role: "class_teacher", branch: "Kırgızca" },
  { email: "mehmet@lineclass.test", full_name: "Mehmet Yılmaz", role: "branch_teacher", branch: "Matematik" },
  { email: "irina@lineclass.test", full_name: "Irina Petrova", role: "branch_teacher", branch: "Rusça" },
];

async function ensureUser(u) {
  const { data, error } = await db.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: u.role },
    user_metadata: { full_name: u.full_name, branch: u.branch },
  });
  if (!error) return data.user.id;
  // Zaten varsa id'sini profilden bul
  const { data: p } = await db.from("profiles").select("id").eq("email", u.email).single();
  if (!p) throw error;
  return p.id;
}

const ids = {};
for (const u of USERS) ids[u.email] = await ensureUser(u);

const { data: classes, error: cErr } = await db
  .from("classes")
  .upsert(
    [
      { name: "5-A", class_teacher_id: ids["aisel@lineclass.test"] },
      { name: "6-B", class_teacher_id: null },
    ],
    { onConflict: "class_teacher_id,name" },
  )
  .select();
if (cErr) throw cErr;
const c5a = classes.find((c) => c.name === "5-A");
const c6b = classes.find((c) => c.name === "6-B");

await db.from("teacher_class_access").upsert([
  { teacher_id: ids["mehmet@lineclass.test"], class_id: c5a.id },
  { teacher_id: ids["mehmet@lineclass.test"], class_id: c6b.id },
  { teacher_id: ids["irina@lineclass.test"], class_id: c5a.id },
]);

// Sınıf dersleri ve öğretmenleri (tetikleyici sınıf erişimini de verir)
await db.from("class_subjects").upsert(
  [
    { class_id: c5a.id, subject: "Matematik", teacher_id: ids["mehmet@lineclass.test"] },
    { class_id: c5a.id, subject: "Rusça", teacher_id: ids["irina@lineclass.test"] },
    { class_id: c5a.id, subject: "Kırgızca", teacher_id: ids["aisel@lineclass.test"] },
    { class_id: c5a.id, subject: "Türkçe", teacher_id: null },
    { class_id: c6b.id, subject: "Matematik", teacher_id: ids["mehmet@lineclass.test"] },
  ],
  { onConflict: "class_id,subject", ignoreDuplicates: true },
);

const { count } = await db.from("students").select("*", { count: "exact", head: true });
if (!count) {
  const names = [
    ["Aibek", "Asanov", c5a], ["Nurai", "Bekova", c5a], ["Emir", "Kaya", c5a],
    ["Aruuke", "Saparova", c5a], ["Daniyar", "Usenov", c5a], ["Elif", "Demir", c5a],
    ["Bakyt", "Moldoev", c6b], ["Aigerim", "Toktobaeva", c6b], ["Can", "Öztürk", c6b],
  ];
  const { data: students, error } = await db
    .from("students")
    .insert(
      names.map(([first_name, last_name, c], i) => ({
        first_name,
        last_name,
        class_id: c.id,
        // Demo fotoğraflar; gerçek kullanımda Storage'a yüklenir
        photo_url: `https://i.pravatar.cc/240?img=${i + 10}`,
        short_info: i % 3 === 0 ? "Ön sırada oturuyor; gözlük kullanıyor." : null,
      })),
    )
    .select();
  if (error) throw error;

  await db.from("notes").insert([
    {
      student_id: students[0].id,
      teacher_id: ids["mehmet@lineclass.test"],
      note_text: "Bugün kesirler konusunda tahtaya kalktı ve çok iyi açıkladı.",
      status: "positive",
    },
    {
      student_id: students[0].id,
      teacher_id: ids["irina@lineclass.test"],
      note_text: "Домашнее задание не сделано второй раз подряд.",
      status: "concern",
    },
    {
      student_id: students[1].id,
      teacher_id: ids["mehmet@lineclass.test"],
      note_text: "Derste biraz dalgındı, yorgun görünüyordu.",
      status: "neutral",
    },
  ]);
}

console.log("✓ Seed tamam. Giriş bilgileri (şifre hepsi için: %s):", PASSWORD);
USERS.forEach((u) => console.log(`  ${u.role.padEnd(15)} ${u.email}`));
