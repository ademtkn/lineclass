import { BRANCHES, branchLabel } from "@/lib/i18n/branches";
import { getT } from "@/lib/i18n/server";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["class_teacher", "branch_teacher", "super_admin"];

type Props = {
  user?: { full_name: string; email: string; role: Role; branch: string | null };
  /** Kendi hesabını düzenleyen yönetici görevini değiştiremez */
  lockRole?: boolean;
};

/** Kullanıcı oluşturma/düzenleme formunun ortak alanları. */
export async function UserFields({ user, lockRole }: Props) {
  const { t, locale } = await getT();
  return (
    <>
      <div>
        <label className="label" htmlFor="full_name">{t("users.fullName")}</label>
        <input id="full_name" name="full_name" defaultValue={user?.full_name} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">{t("users.email")}</label>
        <input id="email" name="email" type="email" defaultValue={user?.email} required autoComplete="off" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{user ? t("users.newPassword") : t("users.password")}</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required={!user}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="role">{t("users.role")}</label>
          <select id="role" name="role" defaultValue={user?.role ?? "class_teacher"} disabled={lockRole} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>{t(`role.${r}`)}</option>
            ))}
          </select>
          {lockRole && <input type="hidden" name="role" value={user?.role} />}
        </div>
        <div>
          <label className="label" htmlFor="branch">{t("users.branch")}</label>
          <select id="branch" name="branch" defaultValue={user?.branch ?? ""} className="input">
            <option value="">—</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>{branchLabel(b, locale)}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
