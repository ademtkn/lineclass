export type Role = "super_admin" | "class_teacher" | "branch_teacher";
export type NoteStatus = "positive" | "neutral" | "concern";
export type Lang = "en" | "ky" | "ru" | "tr";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  branch: string | null;
};

export type ClassRow = {
  id: string;
  name: string;
  class_teacher_id: string | null;
};

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string;
  photo_url: string | null;
  short_info: string | null;
};

export type Note = {
  id: string;
  student_id: string;
  teacher_id: string;
  note_text: string;
  status: NoteStatus;
  created_at: string;
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  class_teacher: "Sınıf Öğretmeni",
  branch_teacher: "Branş Öğretmeni",
};

export const STATUS_META: Record<NoteStatus, { label: string; emoji: string; className: string }> = {
  positive: { label: "Olumlu", emoji: "👍", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  neutral: { label: "Gözlem", emoji: "📝", className: "bg-slate-50 text-slate-700 ring-slate-200" },
  concern: { label: "Dikkat", emoji: "⚠️", className: "bg-amber-50 text-amber-800 ring-amber-200" },
};

export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "ky", label: "KG", name: "Kyrgyz" },
  { code: "ru", label: "RU", name: "Russian" },
  { code: "tr", label: "TR", name: "Turkish" },
];

export const BRANCHES = [
  "Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Türkçe",
  "İngilizce",
  "Rusça",
  "Kırgızca",
  "Tarih",
  "Coğrafya",
  "Bilişim",
  "Beden Eğitimi",
  "Müzik",
  "Görsel Sanatlar",
];
