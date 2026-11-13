"use client";
import * as React from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { RequireAuth } from "@/components/site/order-ui";
import { ProductImage } from "@/components/site/product-card";
import { SectionHeading } from "@/components/site/home-sections";
import { useCart } from "@/components/providers";
import { peso } from "@/lib/utils";

function CartView() {
  const { cart, loading, update, remove } = useCart();
  if (loading && !cart) return <PageLoader />;
  const items = cart?.items ?? [];
  const unavailable = items.some((i) => !i.available);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <SectionHeading eyebrow="Your order" title="Shopping Cart" />
      {items.length === 0 ? (
        <EmptyState title="Your cart is empty" text="Add a drink or a pastry to get started." action={<Button asChild><Link href="/menu">Browse the menu</Link></Button>} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <ul className="space-y-4">
            {items.map((i) => (
              <li key={i.id} className="card-lux flex gap-4 p-4">
                <ProductImage src={i.imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg text-cream">{i.name}</h3>
                      <p className="text-xs text-muted">{[i.size, i.temperature, ...i.addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")}</p>
                      {i.notes && <p className="mt-1 text-xs italic text-muted">“{i.notes}”</p>}
                      {!i.available && <p role="alert" className="mt-1 text-xs text-danger">Currently unavailable. Please remove it to continue.</p>}
                    </div>
                    <p className="font-serif text-lg text-gold">{peso(i.lineTotal)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-line" role="group" aria-label={`Quantity for ${i.name}`}>
                      <button className="grid h-9 w-9 place-items-center text-gold disabled:opacity-40" disabled={i.quantity <= 1} onClick={() => void update(i.id, i.quantity - 1)} aria-label="Decrease"><Minus className="h-4 w-4" /></button>
                      <span className="w-7 text-center text-sm" aria-live="polite">{i.quantity}</span>
                      <button className="grid h-9 w-9 place-items-center text-gold disabled:opacity-40" disabled={i.quantity >= 50} onClick={() => void update(i.id, i.quantity + 1)} aria-label="Increase"><Plus className="h-4 w-4" /></button>
                    </div>
                    <button onClick={() => void remove(i.id)} className="flex items-center gap-1 text-sm text-muted hover:text-danger" aria-label={`Remove ${i.name}`}><Trash2 className="h-4 w-4" />Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card-lux h-fit space-y-4 p-6 lg:sticky lg:top-24" aria-label="Order summary">
            <h2 className="text-2xl">Order Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Items</dt><dd>{cart?.itemCount}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-lg"><dt>Subtotal</dt><dd className="font-serif text-gold">{peso(cart?.subtotal ?? 0)}</dd></div>
            </dl>
            <p className="text-xs text-muted">Delivery fee and promo codes are applied at checkout. Prices are confirmed by the café at order time.</p>
            <Button asChild size="lg" className="w-full" disabled={unavailable}><Link href="/checkout"><ShoppingBag className="h-4 w-4" aria-hidden />Checkout</Link></Button>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function CartPage() { return <RequireAuth><CartView /></RequireAuth>; }
