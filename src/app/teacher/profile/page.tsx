import { redirect } from "next/navigation";

/** Eski adres: profil ayarları artık /profile altında. */
export default function OldProfilePage() {
  redirect("/profile");
}
