/** Tüm sayfaların altındaki imza. */
export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-100 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center text-xs text-slate-400">
      <p>
        <span className="font-semibold text-slate-500">LineClass</span> bir{" "}
        <a
          href="https://line.kg"
          target="_blank"
          rel="noopener"
          className="font-semibold text-brand-600 underline-offset-2 hover:underline"
        >
          line.kg
        </a>{" "}
        uygulamasıdır.
      </p>
      <p className="mt-1">© {new Date().getFullYear()} line.kg</p>
    </footer>
  );
}
