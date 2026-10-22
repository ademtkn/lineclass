const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "Asia/Bishkek";

const dateTime = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}
