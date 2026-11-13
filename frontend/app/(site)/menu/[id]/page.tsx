"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge, ErrorState, PageLoader } from "@/components/ui/misc";
import { ProductImage, useFavorites } from "@/components/site/product-card";
import { useApi, useAuth, useCart } from "@/components/providers";
import { cn, peso } from "@/lib/utils";
import type { Product } from "@/lib/types";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { add } = useCart();
  const { ids, toggle } = useFavorites();
  const { data: p, error, loading, reload } = useApi<Product>(`/api/products/${id}`);

  const [variantId, setVariantId] = React.useState<number | null>(null);
  const [temp, setTemp] = React.useState<string | null>(null);
  const [addons, setAddons] = React.useState<number[]>([]);
  const [qty, setQty] = React.useState(1);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!p) return;
    setVariantId(p.variants.find((v) => v.isDefault)?.id ?? p.variants[0]?.id ?? null);
    setTemp(p.supportsHot ? "Hot" : p.supportsCold ? "Iced" : null);
  }, [p]);

  if (loading) return <PageLoader />;
  if (error || !p) return <ErrorState message={error ?? "This item is no longer available."} onRetry={reload} />;

  const variant = p.variants.find((v) => v.id === variantId);
  const addonTotal = p.addons.filter((a) => a.id != null && addons.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const unit = p.price + (variant?.priceDelta ?? 0) + addonTotal;
  const fav = ids.has(p.id);

  const submit = async () => {
    if (!user) { router.push(`/signin?next=/menu/${p.id}`); return; }
    setBusy(true);
    const ok = await add({ productId: p.id, variantId, temperature: temp, addonIds: addons, quantity: qty, notes: notes.trim() || undefined });
    setBusy(false);
    if (ok) router.push("/cart");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/menu" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" aria-hidden />Back to menu</Link>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="card-lux overflow-hidden"><ProductImage src={p.imageUrl} alt={p.name} className="aspect-square w-full" /></div>

        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge tone="gray">{p.categoryName}</Badge>{p.isFeatured && <Badge>Featured</Badge>}{!p.inStock && <Badge tone="red">Sold out</Badge>}</div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <h1 className="gold-text text-4xl sm:text-5xl">{p.name}</h1>
            <button onClick={() => void toggle(p.id)} aria-pressed={fav} aria-label={fav ? "Remove from favorites" : "Save to favorites"} className="mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line hover:border-gold">
              <Heart className={cn("h-5 w-5", fav ? "fill-gold text-gold" : "text-cream")} aria-hidden />
            </button>
          </div>
          <p className="mt-4 text-muted">{p.description}</p>
          <p className="mt-6 font-serif text-3xl text-gold" aria-live="polite">{peso(unit * qty)}</p>

          {p.variants.length > 0 && (
            <fieldset className="mt-8"><legend className="mb-3 text-xs uppercase tracking-widest text-muted">Size</legend>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <button key={v.id} onClick={() => setVariantId(v.id ?? null)} aria-pressed={variantId === v.id}
                    className={cn("rounded-full border px-4 py-2 text-sm transition", variantId === v.id ? "border-gold bg-gold/15 text-gold" : "border-line hover:border-gold/50")}>
                    {v.name}{v.priceDelta !== 0 && <span className="ml-1 text-muted">{v.priceDelta > 0 ? "+" : "−"}{peso(Math.abs(v.priceDelta))}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {(p.supportsHot || p.supportsCold) && (
            <fieldset className="mt-6"><legend className="mb-3 text-xs uppercase tracking-widest text-muted">Served</legend>
              <div className="flex gap-2">
                {[p.supportsHot && "Hot", p.supportsCold && "Iced"].filter(Boolean).map((t) => (
                  <button key={t as string} onClick={() => setTemp(t as string)} aria-pressed={temp === t}
                    className={cn("rounded-full border px-5 py-2 text-sm transition", temp === t ? "border-gold bg-gold/15 text-gold" : "border-line hover:border-gold/50")}>{t}</button>
                ))}
              </div>
            </fieldset>
          )}

          {p.addons.length > 0 && (
            <fieldset className="mt-6"><legend className="mb-3 text-xs uppercase tracking-widest text-muted">Add-ons</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {p.addons.map((a) => {
                  const on = a.id != null && addons.includes(a.id);
                  return (
                    <label key={a.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition", on ? "border-gold bg-gold/10" : "border-line hover:border-gold/40")}>
                      <span className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={on} onChange={() => setAddons((x) => on ? x.filter((i) => i !== a.id) : [...x, a.id!])} />{a.name}</span>
                      <span className="text-muted">{a.price > 0 ? `+${peso(a.price)}` : "Free"}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-6"><label htmlFor="notes" className="mb-1.5 block text-xs uppercase tracking-widest text-muted">Special instructions</label>
            <Textarea id="notes" maxLength={300} rows={2} placeholder="Less sweet, extra hot, no ice…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-full border border-line" role="group" aria-label="Quantity">
              <button className="grid h-11 w-11 place-items-center text-gold disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center" aria-live="polite">{qty}</span>
              <button className="grid h-11 w-11 place-items-center text-gold disabled:opacity-40" onClick={() => setQty((q) => Math.min(50, q + 1))} disabled={qty >= 50} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
            </div>
            <Button size="lg" className="flex-1" onClick={submit} loading={busy} disabled={!p.inStock || !p.isAvailable}>
              {user ? `Add to Cart · ${peso(unit * qty)}` : "Sign in to order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
