"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, ConfirmButton, ErrorState, PageLoader } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/form";
import { OrderTimeline, StatusBadge, payTone } from "@/components/site/order-ui";
import { useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { fmtDate, peso } from "@/lib/utils";
import type { Order } from "@/lib/types";

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [o, setO] = React.useState<Order | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try { setO(await api.get<Order>(`/api/admin/orders/${id}`)); setError(null); } catch (e) { setError(e instanceof ApiError ? e.message : "Could not load order."); }
  }, [id]);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!o) return <PageLoader />;

  const next = o.fulfillment === "Delivery"
    ? ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Completed"] : ["Pending", "Confirmed", "Preparing", "Ready for Pickup", "Completed"];
  const nextStatus = next[next.indexOf(o.status) + 1];
  const closed = o.status === "Completed" || o.status === "Cancelled";

  const setStatus = async (status: string) => {
    setBusy(true);
    try { setO(await api.put<Order>(`/api/admin/orders/${o.id}/status`, { status, note: note.trim() || null })); setNote(""); toast(`Order marked ${status}.`); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Update failed.", "err"); } finally { setBusy(false); }
  };
  const setPayment = async (status: string) => {
    try { setO(await api.put<Order>(`/api/admin/orders/${o.id}/payment`, { status })); toast("Payment status updated."); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Update failed.", "err"); }
  };

  return (
    <>
      <Link href="/admin/orders" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-gold print:hidden"><ArrowLeft className="h-4 w-4" aria-hidden />All orders</Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card className="space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h1 className="font-mono text-2xl text-gold">{o.orderNumber}</h1><p className="text-sm text-muted">{fmtDate(o.createdAt)}</p></div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={o.status} /><Badge tone="gray">{o.fulfillment}</Badge></div>
            </div>
            <OrderTimeline order={o} />
            <ul className="divide-y divide-line text-sm">
              {o.items.map((i) => <li key={i.id} className="flex justify-between gap-4 py-3"><div><p>{i.quantity}× {i.productName}</p><p className="text-xs text-muted">{[i.size, i.temperature, ...i.addons.map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")}</p>{i.notes && <p className="text-xs italic text-muted">“{i.notes}”</p>}</div><span>{peso(i.lineTotal)}</span></li>)}
            </ul>
            <dl className="space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{peso(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between text-success"><dt>Discount {o.promoCode && `(${o.promoCode})`}</dt><dd>−{peso(o.discount)}</dd></div>}
              {o.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-muted">Delivery fee</dt><dd>{peso(o.deliveryFee)}</dd></div>}
              <div className="flex justify-between pt-2 text-xl"><dt>Total</dt><dd className="font-serif text-gold">{peso(o.total)}</dd></div>
            </dl>
          </Card>
          <Card className="p-6"><h2 className="mb-3 text-xl">History</h2>
            <ol className="space-y-2 text-sm">{[...o.history].reverse().map((h, i) => <li key={i}><b>{h.status}</b> <span className="text-muted">· {fmtDate(h.at)}{h.note ? ` · ${h.note}` : ""}</span></li>)}</ol></Card>
        </div>

        <div className="space-y-6 print:hidden">
          <Card className="space-y-3 p-6">
            <h2 className="text-xl">Update status</h2>
            {closed ? <p className="text-sm text-muted">This order is {o.status.toLowerCase()} and can no longer change.</p> : (
              <>
                <Input aria-label="Status note" placeholder="Optional note for the customer" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
                {o.status === "Pending" ? <Button className="w-full" loading={busy} onClick={() => setStatus("Confirmed")}><Check className="h-4 w-4" aria-hidden />Confirm order</Button>
                  : nextStatus && <Button className="w-full" loading={busy} onClick={() => setStatus(nextStatus)}>Mark as {nextStatus}</Button>}
                <Select aria-label="Set status" value="" onChange={(e) => e.target.value && setStatus(e.target.value)}><option value="">Set another status…</option>{next.concat("Cancelled").filter((s) => s !== o.status).map((s) => <option key={s}>{s}</option>)}</Select>
                <ConfirmButton variant="danger" className="w-full" message="Cancel this order? Stock will be restored." onConfirm={() => setStatus("Cancelled")}><X className="h-4 w-4" aria-hidden />Cancel order</ConfirmButton>
              </>
            )}
          </Card>
          <Card className="space-y-3 p-6">
            <h2 className="text-xl">Payment</h2>
            <p className="text-sm text-muted">{o.paymentMethod.replace(/([A-Z])/g, " $1").trim()}</p>
            <Badge tone={payTone(o.paymentStatus)}>{o.paymentStatus}</Badge>
            <Select aria-label="Payment status" value={o.paymentStatus} onChange={(e) => setPayment(e.target.value)}>{["Pending", "Paid", "Failed", "Refunded"].map((s) => <option key={s}>{s}</option>)}</Select>
          </Card>
          <Card className="space-y-1 p-6 text-sm">
            <h2 className="mb-2 text-xl">Customer</h2>
            <p>{o.customerName}</p><p className="text-muted">{o.customerEmail}</p><p className="text-muted">{o.customerPhone}</p>
            {o.deliveryAddress && <p className="pt-2 text-muted">{o.deliveryAddress}</p>}
            {o.notes && <p className="pt-2 italic text-muted">“{o.notes}”</p>}
          </Card>
          <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print receipt</Button>
        </div>
      </div>

      {/* Print-only receipt */}
      <div className="print-area hidden print:block" aria-hidden>
        <h1 style={{ fontSize: 22, fontFamily: "serif" }}>NOCTURNE CAFÉ</h1><p>Receipt · {o.orderNumber}</p><p>{fmtDate(o.createdAt)}</p><hr />
        <p>{o.customerName} · {o.customerPhone}</p>{o.deliveryAddress && <p>{o.deliveryAddress}</p>}<hr />
        {o.items.map((i) => <p key={i.id}>{i.quantity}× {i.productName} {[i.size, i.temperature].filter(Boolean).join(" ")} {i.addons.map((a) => `+${a.name}`).join(" ")} — {peso(i.lineTotal)}</p>)}<hr />
        <p>Subtotal: {peso(o.subtotal)}</p>{o.discount > 0 && <p>Discount: −{peso(o.discount)}</p>}{o.deliveryFee > 0 && <p>Delivery: {peso(o.deliveryFee)}</p>}
        <p><b>Total: {peso(o.total)}</b></p><p>Payment: {o.paymentMethod} ({o.paymentStatus})</p><p>Thank you for visiting Nocturne Café.</p>
      </div>
    </>
  );
}
