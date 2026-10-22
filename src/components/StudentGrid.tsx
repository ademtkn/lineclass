import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { Student } from "@/lib/types";

type Props = {
  students: Student[];
  hrefFor: (s: Student) => string;
  /** Kart altında gösterilecek küçük rozet (ör. not sayısı) */
  badgeFor?: (s: Student) => string | null;
};

/** Fotoğraflı öğrenci kartları: telefonda 2, tablette 3-4, masaüstünde 5 sütun. */
export function StudentGrid({ students, hrefFor, badgeFor }: Props) {
  if (students.length === 0) {
    return <p className="card text-center text-slate-500">Bu sınıfta henüz öğrenci yok.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {students.map((s) => {
        const badge = badgeFor?.(s);
        return (
          <li key={s.id}>
            <Link
              href={hrefFor(s)}
              className="card flex h-full flex-col items-center gap-2 py-5 text-center transition hover:ring-brand-200 active:scale-[0.98]"
            >
              <Avatar firstName={s.first_name} lastName={s.last_name} photoUrl={s.photo_url} />
              <span className="font-semibold leading-tight">
                {s.first_name}
                <br />
                {s.last_name}
              </span>
              {badge && (
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  {badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
