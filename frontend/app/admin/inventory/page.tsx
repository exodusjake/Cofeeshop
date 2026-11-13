"use client";
import * as React from "react";
import { Badge, ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PageHeader, Table } from "@/components/admin/common";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";

type Inv = { productId: number; productName: string; categoryName: string; trackStock: boolean; quantityOnHand: number; reorderLevel: number; isLow: boolean };

function Row({ row, onSaved }: { row: Inv; onSaved: () => void }) {
  const { toast } = useToast();
  const [r, setR] = React.useState(row);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setR(row), [row]);
  const dirty = JSON.stringify(r) !== JSON.stringify(row);
  return (
    <tr className="hover:bg-cream/5">
      <td className="px-4 py-3 text-cream">{r.productName}</td><td className="px-4 py-3 text-muted">{r.categoryName}</td>
      <td className="px-4 py-3"><Switch checked={r.trackStock} onCheckedChange={(v) => setR({ ...r, trackStock: v })} aria-label={`Track stock for ${r.productName}`} /></td>
      <td className="px-4 py-3"><Input aria-label="Quantity" type="number" min={0} className="h-9 w-24" disabled={!r.trackStock} value={r.quantityOnHand} onChange={(e) => setR({ ...r, quantityOnHand: Number(e.target.value) })} /></td>
      <td className="px-4 py-3"><Input aria-label="Reorder level" type="number" min={0} className="h-9 w-24" disabled={!r.trackStock} value={r.reorderLevel} onChange={(e) => setR({ ...r, reorderLevel: Number(e.target.value) })} /></td>
      <td className="px-4 py-3">{row.trackStock ? row.isLow ? <Badge tone="red">Low</Badge> : <Badge tone="green">OK</Badge> : <Badge tone="gray">Untracked</Badge>}</td>
      <td className="px-4 py-3 text-right"><Button size="sm" disabled={!dirty} loading={busy} onClick={async () => {
        setBusy(true);
        try { await api.put(`/api/admin/inventory/${r.productId}`, { trackStock: r.trackStock, quantityOnHand: r.quantityOnHand, reorderLevel: r.reorderLevel }); toast("Inventory updated."); onSaved(); }
        catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } finally { setBusy(false); }
      }}>Save</Button></td>
    </tr>
  );
}

export default function AdminInventory() {
  const { data, error, loading, reload } = useApi<Inv[]>("/api/admin/inventory");
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Inventory" subtitle="Tracked items are decremented at checkout and restored when an order is cancelled." />
      <Table head={["Product", "Category", "Track", "On hand", "Reorder at", "Status", ""]}>{data?.map((r) => <Row key={r.productId} row={r} onSaved={reload} />)}</Table>
    </>
  );
}
