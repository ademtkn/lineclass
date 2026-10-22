import type { Locale } from "./locales";

/**
 * Branş / ders anahtarları veritabanında Türkçe adıyla saklanır (geriye uyumluluk);
 * ekranda seçili dile çevrilir. Sınıfa özel derslerin adları class_subjects.names'te durur.
 */
export const BRANCH_NAMES: Record<string, Record<Locale, string>> = {
  Matematik: { tr: "Matematik", en: "Mathematics", ky: "Математика", ru: "Математика" },
  Fizik: { tr: "Fizik", en: "Physics", ky: "Физика", ru: "Физика" },
  Kimya: { tr: "Kimya", en: "Chemistry", ky: "Химия", ru: "Химия" },
  Biyoloji: { tr: "Biyoloji", en: "Biology", ky: "Биология", ru: "Биология" },
  Türkçe: { tr: "Türkçe", en: "Turkish", ky: "Түрк тили", ru: "Турецкий язык" },
  İngilizce: { tr: "İngilizce", en: "English", ky: "Англис тили", ru: "Английский язык" },
  Rusça: { tr: "Rusça", en: "Russian", ky: "Орус тили", ru: "Русский язык" },
  Kırgızca: { tr: "Kırgızca", en: "Kyrgyz", ky: "Кыргыз тили", ru: "Кыргызский язык" },
  Tarih: { tr: "Tarih", en: "History", ky: "Тарых", ru: "История" },
  Coğrafya: { tr: "Coğrafya", en: "Geography", ky: "География", ru: "География" },
  Bilişim: { tr: "Bilişim", en: "Computer Science", ky: "Информатика", ru: "Информатика" },
  "Beden Eğitimi": { tr: "Beden Eğitimi", en: "Physical Education", ky: "Дене тарбия", ru: "Физкультура" },
  Müzik: { tr: "Müzik", en: "Music", ky: "Музыка", ru: "Музыка" },
  "Görsel Sanatlar": { tr: "Görsel Sanatlar", en: "Visual Arts", ky: "Сүрөт искусствосу", ru: "Изобразительное искусство" },
};

export const BRANCHES = Object.keys(BRANCH_NAMES);

export type SubjectNames = Partial<Record<Locale, string>>;

/** Branş anahtarını seçili dilde gösterir; bilinmeyen (özel) adları olduğu gibi döner. */
export function branchLabel(key: string | null | undefined, locale: Locale): string {
  if (!key) return "";
  return BRANCH_NAMES[key]?.[locale] ?? key;
}

/** Ders adı: önce sınıf öğretmeninin girdiği çeviri, sonra hazır branş çevirisi, sonra anahtar. */
export function subjectLabel(subject: string, names: SubjectNames | null | undefined, locale: Locale): string {
  return names?.[locale]?.trim() || BRANCH_NAMES[subject]?.[locale] || names?.tr?.trim() || subject;
}
