"use client";
import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Dialog, DialogContent, EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/form";
import { PageHeader, Pager, Table } from "@/components/admin/common";
import { StatusBadge } from "@/components/site/order-ui";
import { useApi, useAuth, useToast } from "@/components/providers";
import { api, ApiError, qs } from "@/services/api";
import { fmtDate, peso } from "@/lib/utils";
import type { AdminUser, Address, OrderSummary, Paged } from "@/lib/types";

type Detail = { user: AdminUser; orders: OrderSummary[]; addresses: Address[] };

function UserDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const { data, error, reload } = useApi<Detail>(`/api/admin/users/${id}`);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); reload(); onChanged(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={data?.user.fullName ?? "Customer"} description={data?.user.email} className="max-w-2xl">
        {error ? <ErrorState message={error} /> : !data ? <PageLoader /> : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              {data.user.roles.map((r) => <Badge key={r}>{r}</Badge>)}{data.user.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}{data.user.emailConfirmed ? <Badge tone="blue">Email verified</Badge> : <Badge tone="gray">Unverified</Badge>}
            </div>
            <p className="text-muted">Joined {fmtDate(data.user.createdAt)} · {data.user.orderCount} orders · {peso(data.user.totalSpent)} spent{data.user.phone ? ` · ${data.user.phone}` : ""}</p>
            {data.user.id !== me?.id && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={data.user.isActive ? "danger" : "gold"} onClick={() => act(() => api.put(`/api/admin/users/${id}/status`, { isActive: !data.user.isActive }), data.user.isActive ? "Account disabled." : "Account reactivated.")}>{data.user.isActive ? "Disable account" : "Reactivate account"}</Button>
                <Select aria-label="Role" className="h-9 w-44" value={data.user.roles[0] ?? "Customer"} onChange={(e) => act(() => api.put(`/api/admin/users/${id}/role`, { role: e.target.value }), "Role updated.")}><option>Customer</option><option>Admin</option></Select>
              </div>
            )}
            <div><h3 className="mb-2 text-lg">Orders</h3>
              {data.orders.length ? <ul className="divide-y divide-line rounded-xl border border-line">{data.orders.map((o) => <li key={o.id} className="flex items-center justify-between gap-3 p-3"><Link href={`/admin/orders/${o.id}`} className="font-mono text-gold hover:underline">{o.orderNumber}</Link><span className="text-muted">{fmtDate(o.createdAt)}</span><StatusBadge status={o.status} /><span>{peso(o.total)}</span></li>)}</ul> : <p className="text-muted">No orders yet.</p>}</div>
            {data.addresses.length > 0 && <div><h3 className="mb-2 text-lg">Addresses</h3><ul className="space-y-1 text-muted">{data.addresses.map((a) => <li key={a.id}>{a.label}: {[a.line1, a.line2, a.city].filter(Boolean).join(", ")}</li>)}</ul></div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCustomers() {
  const [q, setQ] = React.useState(""); const [dq, setDq] = React.useState("");
  const [role, setRole] = React.useState(""); const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<string | null>(null);
  React.useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useApi<Paged<AdminUser>>(`/api/admin/users${qs({ q: dq, role, page, pageSize: 15 })}`);
  return (
    <>
      <PageHeader title="Customers" subtitle="Manage registered accounts. Every action here is audited." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search users" className="pl-11" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Role" className="sm:w-48" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option>Customer</option><option>Admin</option></Select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : data?.items.length ? (
        <>
          <Table head={["Name", "Email", "Role", "Orders", "Spent", "Status", ""]}>
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-cream/5"><td className="px-4 py-3 text-cream">{u.fullName}</td><td className="px-4 py-3 text-muted">{u.email}</td><td className="px-4 py-3">{u.roles.join(", ")}</td><td className="px-4 py-3">{u.orderCount}</td><td className="px-4 py-3 font-serif">{peso(u.totalSpent)}</td>
                <td className="px-4 py-3">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="subtle" onClick={() => setOpen(u.id)}>View</Button></td></tr>
            ))}
          </Table>
          <Pager data={data} onPage={setPage} />
        </>
      ) : <EmptyState title="No users found" />}
      {open && <UserDialog id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
