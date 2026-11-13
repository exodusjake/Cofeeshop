"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Skeleton, ErrorState, EmptyState } from "@/components/ui/misc";
import { ProductCard } from "@/components/site/product-card";
import { SectionHeading } from "@/components/site/home-sections";
import { useApi } from "@/components/providers";
import { qs } from "@/services/api";
import { cn } from "@/lib/utils";
import type { Category, Paged, Product } from "@/lib/types";

export default function MenuPage() {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cat, setCat] = React.useState<number | null>(null);
  React.useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);

  const cats = useApi<Category[]>("/api/categories");
  const products = useApi<Paged<Product>>(`/api/products${qs({ q: debounced, categoryId: cat, pageSize: 100 })}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <SectionHeading eyebrow="Our Menu" title="Crafted for the Night" subtitle="Everything is made to order. Tap a drink to choose your size, temperature and add-ons." />

      <div className="mb-10 flex flex-col gap-5">
        <div className="relative mx-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="search" className="sr-only">Search the menu</label>
          <Input id="search" type="search" placeholder="Search drinks, pastries, desserts…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
        </div>
        <div role="tablist" aria-label="Categories" className="scroll-thin flex gap-2 overflow-x-auto pb-2 sm:justify-center">
          {[{ id: null as number | null, name: "All" }, ...(cats.data ?? []).map((c) => ({ id: c.id as number | null, name: c.name }))].map((c) => (
            <button key={c.name} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}
              className={cn("whitespace-nowrap rounded-full border px-5 py-2 text-sm transition", cat === c.id ? "border-gold bg-gold text-bg" : "border-line text-cream hover:border-gold/60")}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {products.error ? <ErrorState message={products.error} onRetry={products.reload} /> :
        products.loading && !products.data ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
        ) : products.data && products.data.items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{products.data.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
        ) : <EmptyState title="Nothing found" text="Try a different search or category." />}
    </div>
  );
}
