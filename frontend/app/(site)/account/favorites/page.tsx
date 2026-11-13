"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { ProductCard, useFavorites } from "@/components/site/product-card";
import { useApi } from "@/components/providers";
import type { Product } from "@/lib/types";

export default function Favorites() {
  const { ids } = useFavorites();
  const { data, error, loading, reload } = useApi<Product[]>("/api/account/favorites");
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  // un-hearted items drop out of the list immediately
  const items = (data ?? []).filter((p) => ids.has(p.id));
  return (
    <div className="space-y-6">
      <h1 className="gold-text text-4xl">Favorites</h1>
      {items.length ? <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
        : <EmptyState title="No favorites yet" text="Tap the heart on any menu item to save it here." action={<Button asChild><Link href="/menu">Explore the menu</Link></Button>} />}
    </div>
  );
}
