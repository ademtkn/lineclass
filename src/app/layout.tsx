import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { I18nProvider } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: "LineClass", description: t("app.tagline") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f63db",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dict } = await getT();
  return (
    <html lang={locale} className={`${geistSans.variable} h-full`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <I18nProvider locale={locale} dict={dict}>
          {/* *:w-full: flex sütununda mx-auto ile ortalanan içerik daralmasın */}
          <div className="flex flex-1 flex-col *:w-full">{children}</div>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
