import Link from "next/link";
import { logout } from "@/app/login/actions";
import { ROLE_LABELS, type Profile } from "@/lib/types";

type Props = {
  profile: Profile;
  title: string;
  backHref?: string;
};

/** Mobilde yapışkan üst bar: geri, başlık, rol bazlı kısayollar ve çıkış. */
export function AppHeader({ profile, title, backHref }: Props) {
  const links =
    profile.role === "super_admin"
      ? [
          { href: "/admin", label: "Notlar" },
          { href: "/admin/manage", label: "Yönetim" },
        ]
      : profile.role === "class_teacher"
        ? [
            { href: "/admin", label: "Sınıfım" },
            { href: "/teacher", label: "Derslerim" },
          ]
        : [];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Geri"
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl text-slate-600 hover:bg-slate-100"
          >
            ←
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          <p className="truncate text-xs text-slate-500">
            {profile.full_name || profile.email} · {ROLE_LABELS[profile.role]}
            {profile.branch ? ` · ${profile.branch}` : ""}
          </p>
        </div>
        <form action={logout}>
          <button className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Çıkış
          </button>
        </form>
      </div>
      {links.length > 0 && (
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
