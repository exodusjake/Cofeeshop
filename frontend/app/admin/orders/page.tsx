"use client";
import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/form";
import { Pager, PageHeader, STATUSES, Table } from "@/components/admin/common";
import { StatusBadge, payTone } from "@/components/site/order-ui";
import { useApi } from "@/components/providers";
import { qs } from "@/services/api";
import { fmtDate, peso } from "@/lib/utils";
import type { OrderSummary, Paged } from "@/lib/types";

export default function AdminOrders() {
  const [q, setQ] = React.useState(""); const [dq, setDq] = React.useState("");
  const [status, setStatus] = React.useState(""); const [page, setPage] = React.useState(1);
  React.useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useApi<Paged<OrderSummary>>(`/api/admin/orders${qs({ q: dq, status, page, pageSize: 15 })}`);

  return (
    <>
      <PageHeader title="Orders" subtitle="Review, confirm and fulfil customer orders." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search orders" className="pl-11" placeholder="Search order #, customer, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Filter by status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : data && data.items.length ? (
        <>
          <Table head={["Order", "Customer", "Date", "Type", "Payment", "Total", "Status"]}>
            {data.items.map((o) => (
              <tr key={o.id} className="hover:bg-cream/5">
                <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-mono text-gold hover:underline">{o.orderNumber}</Link></td>
                <td className="px-4 py-3">{o.customerName}</td><td className="px-4 py-3 text-muted">{fmtDate(o.createdAt)}</td><td className="px-4 py-3">{o.fulfillment}</td>
                <td className="px-4 py-3"><Badge tone={payTone(o.paymentStatus)}>{o.paymentStatus}</Badge></td><td className="px-4 py-3 font-serif">{peso(o.total)}</td><td className="px-4 py-3"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </Table>
          <Pager data={data} onPage={setPage} />
        </>
      ) : <EmptyState title="No orders found" text="Try a different search or filter." />}
    </>
  );
}
