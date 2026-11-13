"use client";
import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { HomeSections } from "@/components/site/home-sections";
import { Footer, Navbar } from "@/components/site/shell";
import { ErrorState, PageLoader } from "@/components/ui/misc";
import { api, ApiError } from "@/services/api";
import type { GalleryImage, HomeData, Homepage, Paged, Product, Promotion, Review } from "@/lib/types";

const MAP: Record<string, string> = { "theme.color.background": "--bg", "theme.color.surface": "--surface", "theme.color.gold": "--gold", "theme.color.champagne": "--champagne", "theme.color.cream": "--cream", "theme.color.muted": "--muted" };

/** Renders the DRAFT homepage exactly as customers would see it after publishing. Admin-only (API enforces it). */
export default function PreviewPage() {
  const [data, setData] = React.useState<HomeData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    Promise.all([
      api.get<Homepage>("/api/admin/content/homepage"), api.get<Record<string, string>>("/api/admin/content/pages"),
      api.get<Paged<Product>>("/api/products?featured=true&pageSize=8"), api.get<Paged<Product>>("/api/products?signature=true&pageSize=8"),
      api.get<GalleryImage[]>("/api/gallery"), api.get<Promotion[]>("/api/promotions"), api.get<Review[]>("/api/reviews"),
    ]).then(([homepage, pages, f, s, gallery, promotions, reviews]) =>
      setData({ homepage: { ...homepage, isPublished: true }, pages, featured: f.items, signature: s.items, gallery, promotions, reviews }))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load preview."));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <PageLoader />;
  const s = data.homepage.settings;
  const style = Object.fromEntries(Object.entries(MAP).filter(([k]) => /^#[0-9a-fA-F]{6}$/.test(s[k] ?? "")).map(([k, v]) => [v, s[k]])) as React.CSSProperties;
  const footer = data.homepage.sections.find((x) => x.key === "footer");
  return (
    <div style={{ ...style, background: "var(--bg)", color: "var(--cream)" }} className="-m-4 min-h-screen sm:-m-8">
      <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-gold px-4 py-2 text-sm font-medium text-bg">
        <span className="flex items-center gap-2"><Eye className="h-4 w-4" aria-hidden />Draft preview. Customers do not see this until you publish.</span>
        <Link href="/admin/content" className="underline">Back to editor</Link>
      </div>
      <div className="relative [&_header]:!absolute">
        <Navbar settings={s} hideNav={(s["site.nav.hide"] ?? "").split(",").filter(Boolean)} />
        <main className="pt-18"><HomeSections data={data} /></main>
        <Footer settings={s} show={!!footer?.isEnabled} text={footer?.content?.text} />
      </div>
    </div>
  );
}
