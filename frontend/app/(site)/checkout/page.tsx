"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, MapPin, Smartphone, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { FormError } from "@/components/site/auth-ui";
import { RequireAuth } from "@/components/site/order-ui";
import { AddressForm } from "@/components/site/address-form";
import { SectionHeading } from "@/components/site/home-sections";
import { useApi, useCart } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { cn, peso } from "@/lib/utils";
import type { Address, Order } from "@/lib/types";

type Fulfil = "Pickup" | "Delivery";
type Pay = "CashOnPickup" | "CashOnDelivery" | "GCash" | "Card";

function Checkout() {
  const router = useRouter();
  const { cart, loading, reload } = useCart();
  const addresses = useApi<Address[]>("/api/account/addresses");
  const settings = useApi<Record<string, string>>("/api/settings/public");
  const [fulfil, setFulfil] = React.useState<Fulfil>("Pickup");
  const [pay, setPay] = React.useState<Pay>("CashOnPickup");
  const [addressId, setAddressId] = React.useState<number | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [promo, setPromo] = React.useState("");
  const [promoRes, setPromoRes] = React.useState<{ valid: boolean; message: string | null; discount: number; title: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (addresses.data && addressId == null) setAddressId(addresses.data.find((a) => a.isDefault)?.id ?? addresses.data[0]?.id ?? null); }, [addresses.data, addressId]);
  React.useEffect(() => { setPay(fulfil === "Pickup" ? "CashOnPickup" : "CashOnDelivery"); }, [fulfil]);

  const subtotal = cart?.subtotal ?? 0;
  const fee = fulfil === "Delivery" ? Number(settings.data?.["delivery.fee"] ?? 50) : 0;
  const discount = promoRes?.valid ? promoRes.discount : 0;
  const total = Math.max(0, subtotal - discount + fee);

  if (loading && !cart) return <PageLoader />;
  if (!cart || cart.items.length === 0) return <div className="mx-auto max-w-2xl px-4 py-20"><EmptyState title="Nothing to check out" text="Your cart is empty." action={<Button asChild><Link href="/menu">Browse the menu</Link></Button>} /></div>;

  const applyPromo = async () => {
    if (!promo.trim()) return;
    try { setPromoRes(await api.post("/api/orders/promo-check", { code: promo.trim(), subtotal })); }
    catch (e) { setPromoRes({ valid: false, message: e instanceof ApiError ? e.message : "Could not check code.", discount: 0, title: null }); }
  };

  const place = async () => {
    setBusy(true); setError(null);
    try {
      const o = await api.post<Order>("/api/orders", {
        fulfillment: fulfil, paymentMethod: pay, addressId: fulfil === "Delivery" ? addressId : null,
        phone: phone.trim() || null, notes: notes.trim() || null, promoCode: promoRes?.valid ? promo.trim() : null,
      });
      await reload();
      router.push(`/order-tracking/${o.id}?placed=1`);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not place your order."); }
    finally { setBusy(false); }
  };

  const options: { v: Pay; icon: typeof Banknote; label: string; sub: string; show: boolean; online?: boolean }[] = [
    { v: "CashOnPickup", icon: Store, label: "Cash on Pickup", sub: "Pay at the counter", show: fulfil === "Pickup" },
    { v: "CashOnDelivery", icon: Banknote, label: "Cash on Delivery", sub: "Pay your rider", show: fulfil === "Delivery" },
    { v: "GCash", icon: Smartphone, label: "GCash", sub: "Requires payment provider setup", show: true, online: true },
    { v: "Card", icon: CreditCard, label: "Credit / Debit Card", sub: "Requires payment provider setup", show: true, online: true },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <SectionHeading eyebrow="Almost there" title="Checkout" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section className="card-lux p-6" aria-labelledby="h-fulfil">
            <h2 id="h-fulfil" className="mb-4 text-2xl">How would you like it?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["Pickup", Store, "Collect at the café"], ["Delivery", Truck, "To your door"]] as const).map(([v, Icon, sub]) => (
                <button key={v} onClick={() => setFulfil(v)} aria-pressed={fulfil === v} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", fulfil === v ? "border-gold bg-gold/10" : "border-line hover:border-gold/40")}>
                  <Icon className="h-6 w-6 text-gold" aria-hidden /><span><span className="block font-medium">{v}</span><span className="text-xs text-muted">{sub}</span></span>
                </button>
              ))}
            </div>

            {fulfil === "Delivery" && (
              <div className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-lg"><MapPin className="h-4 w-4 text-gold" aria-hidden />Delivery address</h3>
                {addresses.data && addresses.data.length > 0 && (
                  <div className="space-y-2">
                    {addresses.data.map((a) => (
                      <label key={a.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm", addressId === a.id ? "border-gold bg-gold/10" : "border-line")}>
                        <input type="radio" name="addr" className="mt-1 accent-[var(--gold)]" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                        <span><b className="text-cream">{a.label}</b> · {a.recipient} · {a.phone}<br /><span className="text-muted">{[a.line1, a.line2, a.city, a.postalCode].filter(Boolean).join(", ")}</span></span>
                      </label>
                    ))}
                  </div>
                )}
                {adding || (addresses.data && addresses.data.length === 0) ? (
                  <div className="mt-4 rounded-xl border border-line p-4"><AddressForm onSaved={(a) => { addresses.reload(); setAddressId(a.id); setAdding(false); }} onCancel={addresses.data?.length ? () => setAdding(false) : undefined} /></div>
                ) : <Button variant="subtle" size="sm" className="mt-3" onClick={() => setAdding(true)}>+ Add new address</Button>}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Contact phone" hint="Leave blank to use your profile number."><Input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" /></Field>
              <Field label="Order notes"><Textarea rows={1} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-11" /></Field>
            </div>
          </section>

          <section className="card-lux p-6" aria-labelledby="h-pay">
            <h2 id="h-pay" className="mb-4 text-2xl">Payment</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.filter((o) => o.show).map((o) => (
                <button key={o.v} onClick={() => setPay(o.v)} aria-pressed={pay === o.v} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", pay === o.v ? "border-gold bg-gold/10" : "border-line hover:border-gold/40")}>
                  <o.icon className="h-6 w-6 text-gold" aria-hidden /><span><span className="block font-medium">{o.label}</span><span className="text-xs text-muted">{o.sub}</span></span>
                </button>
              ))}
            </div>
            {(pay === "GCash" || pay === "Card") && <p className="mt-3 rounded-lg border border-line p-3 text-xs text-muted">Online payments are only available once the café has connected a payment provider. Card details are never stored by this website.</p>}
          </section>
        </div>

        <aside className="card-lux h-fit space-y-4 p-6 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="text-2xl">Summary</h2>
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm scroll-thin">
            {cart.items.map((i) => <li key={i.id} className="flex justify-between gap-2"><span className="text-muted">{i.quantity}× {i.name}{i.size ? ` (${i.size.split(" ")[0]})` : ""}</span><span>{peso(i.lineTotal)}</span></li>)}
          </ul>
          <div className="flex gap-2">
            <Input aria-label="Promo code" placeholder="Promo code" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
            <Button variant="outline" onClick={applyPromo}>Apply</Button>
          </div>
          {promoRes && <p role="status" className={cn("text-xs", promoRes.valid ? "text-success" : "text-danger")}>{promoRes.valid ? `“${promoRes.title}” applied: −${peso(promoRes.discount)}` : promoRes.message}</p>}
          <dl className="space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{peso(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>−{peso(discount)}</dd></div>}
            {fee > 0 && <div className="flex justify-between"><dt className="text-muted">Delivery fee</dt><dd>{peso(fee)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 text-xl"><dt>Total</dt><dd className="font-serif text-gold">{peso(total)}</dd></div>
          </dl>
          <FormError message={error} />
          <Button size="lg" className="w-full" onClick={place} loading={busy} disabled={fulfil === "Delivery" && addressId == null}>Place Order</Button>
        </aside>
      </div>
    </div>
  );
}

export default function CheckoutPage() { return <RequireAuth><Checkout /></RequireAuth>; }
