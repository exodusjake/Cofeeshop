"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Coffee, Heart, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { useAuth, useCart, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { peso, safeHref, cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

// ---------- favorites (shared across cards) ----------
const FavCtx = React.createContext<{ ids: Set<number>; toggle: (id: number) => Promise<void> }>({ ids: new Set(), toggle: async () => {} });
export const useFavorites = () => React.useContext(FavCtx);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [ids, setIds] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    api.get<number[]>("/api/account/favorites/ids").then((x) => setIds(new Set(x))).catch(() => {});
  }, [user]);

  const toggle = async (id: number) => {
    if (!user) { router.push("/signin?next=/menu"); return; }
    const has = ids.has(id);
    setIds((s) => { const n = new Set(s); if (has) n.delete(id); else n.add(id); return n; });
    try { has ? await api.del(`/api/account/favorites/${id}`) : await api.put(`/api/account/favorites/${id}`); }
    catch (e) {
      setIds((s) => { const n = new Set(s); if (has) n.add(id); else n.delete(id); return n; });
      toast(e instanceof ApiError ? e.message : "Could not update favorites.", "err");
    }
  };
  return <FavCtx.Provider value={{ ids, toggle }}>{children}</FavCtx.Provider>;
}

export function ProductImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return <div className={cn("grid place-items-center bg-gradient-to-br from-surface-2 to-bg", className)}><Coffee className="h-10 w-10 text-gold/50" aria-hidden /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={safeHref(src)} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}

export function ProductCard({ product: p, index = 0 }: { product: Product; index?: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const { add } = useCart();
  const { ids, toggle } = useFavorites();
  const [busy, setBusy] = React.useState(false);
  const fav = ids.has(p.id);
  const canQuickAdd = p.inStock && p.isAvailable;

  const quickAdd = async () => {
    if (!user) { router.push(`/signin?next=/menu/${p.id}`); return; }
    setBusy(true);
    await add({
      productId: p.id, quantity: 1,
      variantId: p.variants.find((v) => v.isDefault)?.id ?? p.variants[0]?.id ?? null,
      temperature: p.supportsHot ? "Hot" : p.supportsCold ? "Iced" : null, addonIds: [],
    });
    setBusy(false);
  };

  return (
    <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05 }}
      className="card-lux group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[0_20px_50px_-20px_var(--gold)]">
      <Link href={`/menu/${p.id}`} className="relative block aspect-[4/3] overflow-hidden" aria-label={`${p.name}, details`}>
        <ProductImage src={p.imageUrl} alt={p.name} className="h-full w-full transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.isFeatured && <Badge><Star className="mr-1 h-3 w-3" aria-hidden />Featured</Badge>}
          {!p.inStock && <Badge tone="red">Sold out</Badge>}
        </div>
      </Link>
      <button onClick={() => void toggle(p.id)} aria-pressed={fav} aria-label={fav ? `Remove ${p.name} from favorites` : `Save ${p.name} to favorites`}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg/70 backdrop-blur transition hover:scale-110">
        <Heart className={cn("h-4.5 w-4.5", fav ? "fill-gold text-gold" : "text-cream")} aria-hidden />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs uppercase tracking-widest text-muted">{p.categoryName}</p>
        <h3 className="text-xl text-cream"><Link href={`/menu/${p.id}`} className="hover:text-gold">{p.name}</Link></h3>
        <p className="line-clamp-2 flex-1 text-sm text-muted">{p.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-serif text-xl text-gold">{peso(p.price)}</span>
          <Button size="sm" variant="outline" onClick={quickAdd} loading={busy} disabled={!canQuickAdd} aria-label={`Add ${p.name} to cart`}><Plus className="h-4 w-4" aria-hidden />Add</Button>
        </div>
      </div>
    </motion.article>
  );
}
