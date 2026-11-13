"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge, ErrorState, PageLoader, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, Pager, Table } from "@/components/admin/common";
import { PublishBar } from "@/components/admin/publish-bar";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError, qs } from "@/services/api";
import { fmtDate } from "@/lib/utils";
import type { Paged } from "@/lib/types";

type Audit = { id: number; userEmail: string | null; action: string; entityType: string; entityId: string | null; details: string | null; ipAddress: string | null; createdAt: string };

function General() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Record<string, string>>("/api/admin/settings");
  const [fee, setFee] = React.useState("");
  const [v, setV] = React.useState(0);
  React.useEffect(() => { if (data) setFee(data["delivery.fee"] ?? "50"); }, [data]);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <PublishBar refreshKey={v} />
      <div className="card-lux max-w-md space-y-4 p-5">
        <h2 className="text-xl">Ordering</h2>
        <Field label="Delivery fee (₱)" hint="Applied to delivery orders. Takes effect when published."><Input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
        <Button onClick={async () => { try { await api.put("/api/admin/settings", { settings: { "delivery.fee": String(Number(fee) || 0) } }); toast("Saved as draft. Publish to apply."); setV((x) => x + 1); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } }}>Save draft</Button>
      </div>
      <div className="card-lux max-w-xl space-y-2 p-5 text-sm text-muted"><h2 className="text-xl text-cream">Payments</h2>
        <p>Cash on Pickup and Cash on Delivery are always available. GCash and card payments require a payment-provider integration (see <code>docs/PAYMENTS.md</code>); until configured they are rejected at checkout so no payment is ever faked.</p></div>
    </div>
  );
}

function AuditLog() {
  const [page, setPage] = React.useState(1);
  const { data, error, loading, reload } = useApi<Paged<Audit>>(`/api/admin/audit-logs${qs({ page, pageSize: 25 })}`);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? "Could not load audit log."} onRetry={reload} />;
  return (<><Table head={["When", "Admin", "Action", "Target", "Details", "IP"]}>{data.items.map((a) => <tr key={a.id}><td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(a.createdAt)}</td><td className="px-4 py-3">{a.userEmail}</td><td className="px-4 py-3"><Badge>{a.action}</Badge></td><td className="px-4 py-3 text-muted">{a.entityType}{a.entityId ? ` #${a.entityId}` : ""}</td><td className="max-w-xs truncate px-4 py-3 text-muted" title={a.details ?? ""}>{a.details}</td><td className="px-4 py-3 text-xs text-muted">{a.ipAddress}</td></tr>)}</Table><Pager data={data} onPage={setPage} /></>);
}

function Newsletter() {
  const { data, error, loading, reload } = useApi<{ id: number; email: string; subscribedAt: string; isActive: boolean }[]>("/api/admin/newsletter");
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return <Table head={["Email", "Subscribed", "Status"]}>{data?.map((s) => <tr key={s.id}><td className="px-4 py-3">{s.email}</td><td className="px-4 py-3 text-muted">{fmtDate(s.subscribedAt)}</td><td className="px-4 py-3">{s.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</td></tr>)}</Table>;
}

export default function AdminSettings() {
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs defaultValue="general">
        <TabsList><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="audit">Audit log</TabsTrigger><TabsTrigger value="newsletter">Newsletter</TabsTrigger></TabsList>
        <TabsContent value="general"><General /></TabsContent>
        <TabsContent value="audit"><AuditLog /></TabsContent>
        <TabsContent value="newsletter"><Newsletter /></TabsContent>
      </Tabs>
    </>
  );
}
