import { getT } from "@/lib/i18n/server";

/** Tüm sayfaların altındaki imza; kelime sırası dile göre değiştiği için şablondan kurulur. */
export async function Footer() {
  const { t } = await getT();
  const parts = t("footer.text").split(/(\{app\}|\{brand\})/);

  return (
    <footer className="mt-8 border-t border-slate-100 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center text-xs text-slate-400">
      <p>
        {parts.map((part, i) =>
          part === "{app}" ? (
            <span key={i} className="font-semibold text-slate-500">LineClass</span>
          ) : part === "{brand}" ? (
            <a
              key={i}
              href="https://line.kg"
              target="_blank"
              rel="noopener"
              className="inline-block py-2 font-semibold text-brand-600 underline-offset-2 hover:underline"
            >
              line.kg
            </a>
          ) : (
            part
          ),
        )}
      </p>
      <p className="mt-1">© {new Date().getFullYear()} line.kg</p>
    </footer>
  );
}
