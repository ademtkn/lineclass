import { redirect } from "next/navigation";

/** Eski yönetim ekranı: yönetici artık yalnızca kullanıcıları yönetir. */
export default function OldManagePage() {
  redirect("/admin/users");
}
