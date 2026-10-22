type Props = {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  size?: "md" | "lg" | "xl";
};

const SIZES = {
  md: "size-12 text-base",
  lg: "size-20 text-2xl",
  xl: "size-28 text-4xl",
};

/** Öğrenci fotoğrafı; yoksa baş harfli renkli yer tutucu. */
export function Avatar({ firstName, lastName, photoUrl, size = "lg" }: Props) {
  const cls = `${SIZES[size]} shrink-0 rounded-full object-cover`;
  if (photoUrl) {
    // Supabase Storage URL'leri dinamik olduğu için düz <img> kullanılıyor.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={`${firstName} ${lastName}`} className={cls} loading="lazy" />;
  }
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const hue = [...(firstName + lastName)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={`${cls} grid place-items-center font-semibold text-white`}
      style={{ backgroundColor: `hsl(${hue} 55% 55%)` }}
      aria-label={`${firstName} ${lastName}`}
    >
      {initials}
    </div>
  );
}
