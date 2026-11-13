"use client";
import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { Field, Input, Textarea } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { ImageField, PageHeader } from "@/components/admin/common";
import { PublishBar } from "@/components/admin/publish-bar";
import { ProductImage } from "@/components/site/product-card";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import type { Homepage, Paged, Product } from "@/lib/types";

const COLORS: [string, string][] = [["theme.color.background", "Background"], ["theme.color.surface", "Secondary background"], ["theme.color.gold", "Gold"], ["theme.color.champagne", "Champagne gold"], ["theme.color.cream", "Cream white"], ["theme.color.muted", "Muted text"]];
const NAV: [string, string][] = [["about", "About"], ["gallery", "Gallery"], ["events", "Events"], ["contact", "Contact"]];

export default function AdminAppearance() {
  const { toast } = useToast();
  const settings = useApi<Record<string, string>>("/api/admin/settings");
  const home = useApi<Homepage>("/api/admin/content/homepage");
  const products = useApi<Paged<Product>>("/api/admin/products?pageSize=100");
  const [s, setS] = React.useState<Record<string, string> | null>(null);
  const [hero, setHero] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState(0);

  React.useEffect(() => { if (settings.data) setS(settings.data); }, [settings.data]);
  React.useEffect(() => { const h = home.data?.sections.find((x) => x.key === "hero"); if (h) setHero(h.content.backgroundImage ?? ""); }, [home.data]);

  if ((settings.loading && !settings.data) || !s) return settings.error ? <ErrorState message={settings.error} onRetry={settings.reload} /> : <PageLoader />;
  const set = (k: string, val: string) => setS({ ...s, [k]: val });
  const hidden = (s["site.nav.hide"] ?? "").split(",").filter(Boolean);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const keys = ["site.name", "site.tagline", "site.logo", "site.favicon", ...COLORS.map((c) => c[0]), "contact.address", "contact.phone", "contact.email", "hours.text", "social.instagram", "social.facebook", "social.tiktok", "footer.text", "site.nav.hide"];
      await api.put("/api/admin/settings", { settings: Object.fromEntries(keys.map((k) => [k, s[k] ?? ""])) });
      const h = home.data;
      if (h) await api.put("/api/admin/content/homepage", { sections: h.sections.map((x) => x.key === "hero" ? { ...x, content: { ...x.content, backgroundImage: hero } } : x) });
      toast("Draft saved. Publish to make it live."); setV((x) => x + 1); home.reload();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Could not save."); } finally { setBusy(false); }
  };

  const toggleProduct = async (p: Product, featured: boolean) => {
    try {
      await api.put(`/api/admin/products/${p.id}`, { name: p.name, description: p.description, imageUrl: p.imageUrl, price: p.price, categoryId: p.categoryId, isAvailable: p.isAvailable, isFeatured: featured, isSignature: p.isSignature, supportsHot: p.supportsHot, supportsCold: p.supportsCold, variants: p.variants, addons: p.addons, trackStock: p.trackStock, quantityOnHand: p.quantityOnHand ?? 0, reorderLevel: p.reorderLevel ?? 5 });
      products.reload(); toast(featured ? "Added to Featured." : "Removed from Featured.");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); }
  };

  return (
    <>
      <PageHeader title="Website Appearance" subtitle="Logo, colors, contact details and more. Saved as a draft until you publish." />
      <PublishBar refreshKey={v} onChanged={() => { settings.reload(); home.reload(); }} />
      <FormError message={err} />
      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <section className="card-lux space-y-4 p-5"><h2 className="text-xl">Brand</h2>
          <Field label="Site name"><Input value={s["site.name"] ?? ""} onChange={(e) => set("site.name", e.target.value)} /></Field>
          <Field label="Tagline"><Input value={s["site.tagline"] ?? ""} onChange={(e) => set("site.tagline", e.target.value)} /></Field>
          <ImageField label="Website logo" value={s["site.logo"] ?? ""} onChange={(x) => set("site.logo", x)} />
          <ImageField label="Favicon" value={s["site.favicon"] ?? ""} onChange={(x) => set("site.favicon", x)} />
          <ImageField label="Hero background image" value={hero} onChange={setHero} />
        </section>

        <section className="card-lux space-y-4 p-5"><h2 className="text-xl">Theme colors</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {COLORS.map(([k, label]) => (
              <Field key={k} label={label}><div className="flex items-center gap-2"><input type="color" aria-label={`${label} picker`} className="h-11 w-12 cursor-pointer rounded-lg border border-line bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(s[k] ?? "") ? s[k] : "#000000"} onChange={(e) => set(k, e.target.value)} /><Input value={s[k] ?? ""} maxLength={7} onChange={(e) => set(k, e.target.value)} /></div></Field>
            ))}
          </div>
        </section>

        <section className="card-lux space-y-4 p-5"><h2 className="text-xl">Contact &amp; hours</h2>
          <Field label="Address"><Input value={s["contact.address"] ?? ""} onChange={(e) => set("contact.address", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Phone"><Input value={s["contact.phone"] ?? ""} onChange={(e) => set("contact.phone", e.target.value)} /></Field><Field label="Email"><Input type="email" value={s["contact.email"] ?? ""} onChange={(e) => set("contact.email", e.target.value)} /></Field></div>
          <Field label="Opening hours" hint="One line per range."><Textarea rows={4} value={s["hours.text"] ?? ""} onChange={(e) => set("hours.text", e.target.value)} /></Field>
        </section>

        <section className="card-lux space-y-4 p-5"><h2 className="text-xl">Social media &amp; footer</h2>
          <Field label="Instagram URL"><Input value={s["social.instagram"] ?? ""} onChange={(e) => set("social.instagram", e.target.value)} /></Field>
          <Field label="Facebook URL"><Input value={s["social.facebook"] ?? ""} onChange={(e) => set("social.facebook", e.target.value)} /></Field>
          <Field label="TikTok URL"><Input value={s["social.tiktok"] ?? ""} onChange={(e) => set("social.tiktok", e.target.value)} /></Field>
          <Field label="Footer text"><Input value={s["footer.text"] ?? ""} onChange={(e) => set("footer.text", e.target.value)} /></Field>
        </section>

        <section className="card-lux space-y-3 p-5"><h2 className="text-xl">Navigation visibility</h2><p className="text-sm text-muted">Hide links from the top navigation. Pages stay reachable by URL.</p>
          {NAV.map(([k, label]) => <label key={k} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">{label}<Switch aria-label={`Show ${label}`} checked={!hidden.includes(k)} onCheckedChange={(on) => set("site.nav.hide", (on ? hidden.filter((h) => h !== k) : [...hidden, k]).join(","))} /></label>)}
        </section>

        <section className="card-lux space-y-3 p-5"><h2 className="text-xl">Featured products</h2><p className="text-sm text-muted">Applies immediately (products are live data).</p>
          <ul className="scroll-thin max-h-80 space-y-2 overflow-y-auto pr-1">
            {products.data?.items.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line p-2"><ProductImage src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg" /><span className="flex-1 truncate text-sm">{p.name}</span><Switch aria-label={`Feature ${p.name}`} checked={p.isFeatured} onCheckedChange={(on) => toggleProduct(p, on)} /></li>)}
          </ul>
        </section>
      </div>
      <div className="mt-6"><Button size="lg" loading={busy} onClick={save}><Save className="h-4 w-4" aria-hidden />Save draft</Button></div>
    </>
  );
}
