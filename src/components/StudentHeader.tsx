import { Avatar } from "@/components/Avatar";
import type { Student } from "@/lib/types";

/** Öğrenci detay üst kartı: fotoğraf, isim, sınıf ve kısa bilgi. */
export function StudentHeader({ student, className }: { student: Student; className?: string }) {
  return (
    <section className="card flex items-center gap-4 p-5">
      <Avatar firstName={student.first_name} lastName={student.last_name} photoUrl={student.photo_url} size="xl" />
      <div className="min-w-0">
        <h2 className="text-xl font-bold leading-tight">
          {student.first_name} {student.last_name}
        </h2>
        {className && <p className="text-sm font-medium text-brand-700">{className}</p>}
        {student.short_info ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{student.short_info}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Kısa bilgi eklenmemiş.</p>
        )}
      </div>
    </section>
  );
}
