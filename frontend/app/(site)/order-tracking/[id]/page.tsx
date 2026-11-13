"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmButton, ErrorState, PageLoader } from "@/components/ui/misc";
import { OrderTimeline, RequireAuth, StatusBadge, payTone } from "@/components/site/order-ui";
import { useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { fmtDate, peso } from "@/lib/utils";
import type { Order } from "@/lib/types";

function Detail() {
  const { id } = useParams<{ id: string }>();
  const placed = useSearchParams().get("placed");
  const { toast } = useToast();
  const [order, setOrder] = React.useState<Order | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try { setOrder(await api.get<Order>(`/api/orders/${id}`)); setError(null); }
    catch (e) { setError(e instanceof ApiError && e.status === 404 ? "We couldn't find that order." : e instanceof ApiError ? e.message : "Could not load order."); }
  }, [id]);

  React.useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000); // live status
    return () => clearInterval(t);
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!order) return <PageLoader />;
  const o = order;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/order-tracking" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-gold"><ArrowLeft className="h-4 w-4" aria-hidden />All orders</Link>
      {placed && (
        <div role="status" className="mb-8 flex items-start gap-4 rounded-2xl border border-gold/40 bg-gold/10 p-6">
          <PartyPopper className="h-8 w-8 shrink-0 text-gold" aria-hidden />
          <div><h2 className="text-2xl text-cream">Order confirmed!</h2><p className="text-sm text-muted">Thank you, {o.customerName.split(" ")[0]}. We&apos;ve received order <b className="font-mono text-gold">{o.orderNumber}</b> and will start on it shortly.</p></div>
        </div>
      )}
      <div className="card-lux space-y-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs uppercase tracking-widest text-muted">Order</p><h1 className="font-mono text-2xl text-gold">{o.orderNumber}</h1><p className="text-sm text-muted">{fmtDate(o.createdAt)}</p></div>
          <div className="flex flex-wrap gap-2"><StatusBadge status={o.status} /><Badge tone="gray">{o.fulfillment}</Badge><Badge tone={payTone(o.paymentStatus)}>{o.paymentMethod.replace(/([A-Z])/g, " $1").trim()} · {o.paymentStatus}</Badge></div>
        </div>

        <OrderTimeline order={o} />

        <section aria-label="Items">
          <ul className="divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-3 text-sm">
                <div><p className="text-cream">{i.quantity}× {i.productName}</p><p className="text-xs text-muted">{[i.size, i.temperature, ...i.addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")}</p>{i.notes && <p className="text-xs italic text-muted">“{i.notes}”</p>}</div>
                <span>{peso(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{peso(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between text-success"><dt>Discount {o.promoCode && `(${o.promoCode})`}</dt><dd>−{peso(o.discount)}</dd></div>}
            {o.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{peso(o.deliveryFee)}</dd></div>}
            <div className="flex justify-between pt-2 text-xl"><dt>Total</dt><dd className="font-serif text-gold">{peso(o.total)}</dd></div>
          </dl>
        </section>

        {o.deliveryAddress && <section><h2 className="mb-1 text-lg">Delivering to</h2><p className="text-sm text-muted">{o.deliveryAddress}</p></section>}

        <section aria-label="History">
          <h2 className="mb-3 text-lg">Updates</h2>
          <ol className="space-y-3 border-l border-line pl-5">
            {[...o.history].reverse().map((h, i) => (
              <li key={i} className="relative text-sm"><span className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-gold" /><b className="text-cream">{h.status}</b> <span className="text-muted">· {fmtDate(h.at)}</span>{h.note && <p className="text-xs text-muted">{h.note}</p>}</li>
            ))}
          </ol>
        </section>

        {o.status === "Pending" && (
          <ConfirmButton variant="danger" size="sm" message="Cancel this order? This can't be undone." onConfirm={async () => {
            try { setOrder(await api.post<Order>(`/api/orders/${o.id}/cancel`)); toast("Order cancelled."); } catch (e) { toast(e instanceof ApiError ? e.message : "Could not cancel.", "err"); }
          }}>Cancel order</ConfirmButton>
        )}
        <Button asChild variant="outline"><Link href="/menu">Order again</Link></Button>
      </div>
    </div>
  );
}
export default function OrderDetailPage() { return <RequireAuth><React.Suspense><Detail /></React.Suspense></RequireAuth>; }
