/** Tüm sayfalar oturuma bağlı (dinamik) olduğu için bu Suspense yedeği anında gösterilir. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-[68px] border-b border-slate-100 bg-white" />
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 py-5 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card flex flex-col items-center gap-3 py-5">
            <div className="size-20 rounded-full bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
