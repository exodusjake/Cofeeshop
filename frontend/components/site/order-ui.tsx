"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronRight, XCircle } from "lucide-react";
import { Badge, PageLoader } from "@/components/ui/misc";
import { useAuth } from "@/components/providers";
import { cn, fmtDate, peso } from "@/lib/utils";
import type { Order, OrderSummary } from "@/lib/types";

/** Client-side redirect for friendliness only; every API call is independently authorized by the backend. */
export function RequireAuth({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const path = usePathname();
  React.useEffect(() => { if (!loading && !user) router.replace(`/signin?next=${encodeURIComponent(path)}`); }, [loading, user, router, path]);
  if (loading || !user) return <PageLoader />;
  if (admin && !isAdmin) return <div className="mx-auto max-w-md p-16 text-center"><h1 className="text-3xl text-cream">Access denied</h1><p className="mt-2 text-muted">You don&apos;t have permission to view this area.</p></div>;
  return <>{children}</>;
}

export function statusTone(s: string): "gold" | "green" | "red" | "gray" | "blue" {
  if (s === "Completed") return "green";
  if (s === "Cancelled") return "red";
  if (s === "Pending") return "gray";
  if (s === "Out for Delivery" || s === "Ready for Pickup") return "blue";
  return "gold";
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)}>{status}</Badge>;
export const payTone = (s: string): "gold" | "green" | "red" | "gray" => (s === "Paid" ? "green" : s === "Failed" ? "red" : s === "Refunded" ? "gray" : "gold");

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === "Cancelled")
    return <div className="flex items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger"><XCircle className="h-5 w-5" aria-hidden />This order was cancelled.</div>;
  const steps = ["Pending", "Confirmed", "Preparing", order.fulfillment === "Delivery" ? "Out for Delivery" : "Ready for Pickup", "Completed"];
  const idx = steps.indexOf(order.status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="flex flex-col items-center text-center" aria-current={i === idx ? "step" : undefined}>
            <div className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={cn("absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2", i <= idx ? "bg-gold" : "bg-cream/15")} />}
              <span className={cn("relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 transition-colors", done ? "border-gold bg-gold text-bg" : "border-cream/20 bg-bg text-muted", i === idx && "ring-4 ring-gold/25")}>
                {done ? <Check className="h-4 w-4" aria-hidden /> : <span className="text-xs">{i + 1}</span>}
              </span>
            </div>
            <span className={cn("mt-2 text-[11px] leading-tight sm:text-xs", done ? "text-gold" : "text-muted")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/order-tracking/${o.id}`} className="card-lux flex items-center justify-between gap-4 p-5 transition hover:border-gold/50">
            <div className="min-w-0"><p className="font-mono text-sm text-gold">{o.orderNumber}</p><p className="text-xs text-muted">{fmtDate(o.createdAt)} · {o.itemCount} item{o.itemCount > 1 ? "s" : ""} · {o.fulfillment}</p></div>
            <div className="flex items-center gap-4"><StatusBadge status={o.status} /><span className="hidden font-serif text-lg sm:block">{peso(o.total)}</span><ChevronRight className="h-4 w-4 text-muted" aria-hidden /></div>
          </Link>
        </li>
      ))}
    </ul>
  );
}


