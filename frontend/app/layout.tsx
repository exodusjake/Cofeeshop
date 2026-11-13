import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getPublicSettings } from "@/services/server";
import { safeHref } from "@/lib/utils";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap" });

export const dynamic = "force-dynamic"; // site settings (name, theme, favicon) are CMS-driven and must never be stale

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSettings();
  const name = s["site.name"] || "NOCTURNE CAFÉ";
  return {
    title: { default: `${name} — ${s["site.tagline"] || "Where Every Sip Meets the Night."}`, template: `%s · ${name}` },
    description: "Premium coffee, pastries and late-night indulgence. Order online for pickup or delivery.",
    icons: s["site.favicon"] ? { icon: safeHref(s["site.favicon"]) } : undefined,
  };
}

export const viewport: Viewport = { themeColor: "#0D0B0B", width: "device-width", initialScale: 1 };

const THEME_MAP: Record<string, string> = {
  "theme.color.background": "--bg", "theme.color.surface": "--surface", "theme.color.gold": "--gold",
  "theme.color.champagne": "--champagne", "theme.color.cream": "--cream", "theme.color.muted": "--muted",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getPublicSettings();
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(THEME_MAP)) if (/^#[0-9a-fA-F]{6}$/.test(s[k] ?? "")) vars[v] = s[k];
  const css = Object.keys(vars).length ? `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <head>{css && <style dangerouslySetInnerHTML={{ __html: css }} />}</head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
