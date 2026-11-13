"use client";
import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmButton, Dialog, DialogContent, ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { ImageField, PageHeader, Table } from "@/components/admin/common";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import type { Promotion } from "@/lib/types";

const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

function PromoForm({ promo, onDone }: { promo: Promotion | null; onDone: (s: boolean) => void }) {
  const [f, setF] = React.useState({ title: promo?.title ?? "", description: promo?.description ?? "", imageUrl: promo?.imageUrl ?? "", code: promo?.code ?? "", discountType: promo?.discountType ?? "Percent", discountValue: promo?.discountValue ?? 10, minSubtotal: promo?.minSubtotal ?? 0, startsAt: toLocal(promo?.startsAt ?? null), endsAt: toLocal(promo?.endsAt ?? null), isActive: promo?.isActive ?? true });
  const [err, setErr] = React.useState<string | null>(null); const [busy, setBusy] = React.useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      const body = { ...f, description: f.description || null, imageUrl: f.imageUrl || null, code: f.code || null, startsAt: toIso(f.startsAt), endsAt: toIso(f.endsAt) };
      try { promo ? await api.put(`/api/admin/promotions/${promo.id}`, body) : await api.post("/api/admin/promotions", body); onDone(true); }
      catch (x) { setErr(x instanceof ApiError ? x.message : "Could not save."); } finally { setBusy(false); }
    }}>
      <FormError message={err} />
      <Field label="Title"><Input required maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Description"><Textarea maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <ImageField label="Image" value={f.imageUrl} onChange={(v) => setF({ ...f, imageUrl: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Promo code (optional)" hint="Customers enter this at checkout."><Input maxLength={40} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Minimum order (₱)"><Input type="number" min={0} value={f.minSubtotal} onChange={(e) => setF({ ...f, minSubtotal: Number(e.target.value) })} /></Field>
        <Field label="Discount type"><Select value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value })}><option value="Percent">Percent (%)</option><option value="Fixed">Fixed (₱)</option></Select></Field>
        <Field label="Discount value"><Input type="number" min={0} step="0.01" value={f.discountValue} onChange={(e) => setF({ ...f, discountValue: Number(e.target.value) })} /></Field>
        <Field label="Starts"><Input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></Field>
        <Field label="Ends"><Input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Field>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">Active<Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} aria-label="Active" /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onDone(false)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
    </form>
  );
}

export default function AdminPromotions() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Promotion[]>("/api/admin/promotions");
  const [editing, setEditing] = React.useState<Promotion | "new" | null>(null);
  return (
    <>
      <PageHeader title="Promotions" subtitle="Active promotions appear on the homepage; codes work at checkout." actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden />New promotion</Button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : (
        <Table head={["Title", "Code", "Discount", "Window", "Status", ""]}>
          {data?.map((p) => (
            <tr key={p.id} className="hover:bg-cream/5"><td className="px-4 py-3 text-cream">{p.title}</td><td className="px-4 py-3 font-mono text-gold">{p.code ?? "—"}</td>
              <td className="px-4 py-3">{p.discountType === "Percent" ? `${p.discountValue}%` : `₱${p.discountValue}`}</td>
              <td className="px-4 py-3 text-xs text-muted">{p.startsAt ? new Date(p.startsAt).toLocaleDateString() : "Now"} → {p.endsAt ? new Date(p.endsAt).toLocaleDateString() : "No end"}</td>
              <td className="px-4 py-3">{p.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="subtle" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Button>
                <ConfirmButton size="sm" variant="danger" message={`Delete "${p.title}"?`} onConfirm={async () => { try { await api.del(`/api/admin/promotions/${p.id}`); reload(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</ConfirmButton></div></td></tr>
          ))}
        </Table>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && <DialogContent title={editing === "new" ? "New promotion" : "Edit promotion"} className="max-w-2xl"><PromoForm promo={editing === "new" ? null : editing} onDone={(s) => { setEditing(null); if (s) reload(); }} /></DialogContent>}
      </Dialog>
    </>
  );
}
