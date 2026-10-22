import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  title: "LineClass",
  description: "Öğrenci gözlem ve not takip sistemi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f63db",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full`}>
      <body className="flex min-h-dvh flex-col font-sans">
        {/* *:w-full: flex sütununda mx-auto ile ortalanan içerik daralmasın */}
        <div className="flex flex-1 flex-col *:w-full">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
