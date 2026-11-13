"use client";
import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmButton, Dialog, DialogContent, ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { PageHeader, Table } from "@/components/admin/common";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import type { Category } from "@/lib/types";

function CategoryForm({ cat, onDone }: { cat: Category | null; onDone: (saved: boolean) => void }) {
  const [f, setF] = React.useState({ name: cat?.name ?? "", description: cat?.description ?? "", sortOrder: cat?.sortOrder ?? 0, isActive: cat?.isActive ?? true });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { const body = { ...f, description: f.description || null }; cat ? await api.put(`/api/admin/categories/${cat.id}`, body) : await api.post("/api/admin/categories", body); onDone(true); }
      catch (x) { setErr(x instanceof ApiError ? x.message : "Could not save."); } finally { setBusy(false); }
    }}>
      <FormError message={err} />
      <Field label="Name"><Input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Description"><Input maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Sort order"><Input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></Field>
      <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">Visible on the menu<Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} aria-label="Visible" /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onDone(false)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
    </form>
  );
}

export default function AdminCategories() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Category[]>("/api/admin/categories");
  const [editing, setEditing] = React.useState<Category | "new" | null>(null);
  return (
    <>
      <PageHeader title="Categories" actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden />New category</Button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : (
        <Table head={["Name", "Slug", "Order", "Products", "Visible", ""]}>
          {data?.map((c) => (
            <tr key={c.id} className="hover:bg-cream/5"><td className="px-4 py-3 text-cream">{c.name}</td><td className="px-4 py-3 text-muted">{c.slug}</td><td className="px-4 py-3">{c.sortOrder}</td><td className="px-4 py-3">{c.productCount}</td>
              <td className="px-4 py-3">{c.isActive ? <Badge tone="green">Visible</Badge> : <Badge tone="gray">Hidden</Badge>}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="subtle" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Button>
                <ConfirmButton size="sm" variant="danger" message={`Delete "${c.name}"?`} onConfirm={async () => { try { await api.del(`/api/admin/categories/${c.id}`); reload(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</ConfirmButton></div></td></tr>
          ))}
        </Table>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && <DialogContent title={editing === "new" ? "New category" : `Edit ${editing.name}`}><CategoryForm cat={editing === "new" ? null : editing} onDone={(s) => { setEditing(null); if (s) reload(); }} /></DialogContent>}
      </Dialog>
    </>
  );
}
