"use client";
import * as React from "react";
import { Archive, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmButton, Dialog, DialogContent, EmptyState, ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { ImageField, PageHeader, Table } from "@/components/admin/common";
import { ProductImage } from "@/components/site/product-card";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError, qs } from "@/services/api";
import { peso } from "@/lib/utils";
import type { Addon, Category, Paged, Product, Variant } from "@/lib/types";

type Form = {
  name: string; description: string; imageUrl: string; price: string; categoryId: number | "";
  isAvailable: boolean; isFeatured: boolean; isSignature: boolean; supportsHot: boolean; supportsCold: boolean;
  variants: Variant[]; addons: Addon[]; trackStock: boolean; quantityOnHand: number; reorderLevel: number;
};
const blank = (cat: number | ""): Form => ({ name: "", description: "", imageUrl: "", price: "", categoryId: cat, isAvailable: true, isFeatured: false, isSignature: false, supportsHot: false, supportsCold: false, variants: [], addons: [], trackStock: false, quantityOnHand: 0, reorderLevel: 5 });
const fromProduct = (p: Product): Form => ({ name: p.name, description: p.description, imageUrl: p.imageUrl ?? "", price: String(p.price), categoryId: p.categoryId, isAvailable: p.isAvailable, isFeatured: p.isFeatured, isSignature: p.isSignature, supportsHot: p.supportsHot, supportsCold: p.supportsCold, variants: p.variants, addons: p.addons, trackStock: p.trackStock, quantityOnHand: p.quantityOnHand ?? 0, reorderLevel: p.reorderLevel ?? 5 });

function ProductEditor({ product, categories, onDone }: { product: Product | null; categories: Category[]; onDone: (saved: boolean) => void }) {
  const { toast } = useToast();
  const [f, setF] = React.useState<Form>(product ? fromProduct(product) : blank(categories[0]?.id ?? ""));
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const body = { ...f, price: Number(f.price), imageUrl: f.imageUrl || null, categoryId: Number(f.categoryId) };
    try { product ? await api.put(`/api/admin/products/${product.id}`, body) : await api.post("/api/admin/products", body); toast("Product saved. It is live on the menu."); onDone(true); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Could not save product."); } finally { setBusy(false); }
  };

  const toggles: [keyof Form, string][] = [["isAvailable", "Available"], ["isFeatured", "Featured"], ["isSignature", "Signature"], ["supportsHot", "Hot option"], ["supportsCold", "Iced option"], ["trackStock", "Track stock"]];

  return (
    <form onSubmit={save} className="space-y-5">
      <FormError message={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><Input required maxLength={150} value={f.name} onChange={(e) => up("name", e.target.value)} /></Field>
        <Field label="Price (₱)"><Input required type="number" min="0.01" step="0.01" value={f.price} onChange={(e) => up("price", e.target.value)} /></Field>
        <Field label="Category"><Select required value={f.categoryId} onChange={(e) => up("categoryId", Number(e.target.value))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <ImageField label="Image" value={f.imageUrl} onChange={(v) => up("imageUrl", v)} />
        <Field label="Description" className="sm:col-span-2"><Textarea required maxLength={1000} value={f.description} onChange={(e) => up("description", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {toggles.map(([k, label]) => <label key={k} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">{label}<Switch checked={f[k] as boolean} onCheckedChange={(v) => up(k, v as never)} aria-label={label} /></label>)}
      </div>
      {f.trackStock && <div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity on hand"><Input type="number" min={0} value={f.quantityOnHand} onChange={(e) => up("quantityOnHand", Number(e.target.value))} /></Field><Field label="Reorder level"><Input type="number" min={0} value={f.reorderLevel} onChange={(e) => up("reorderLevel", Number(e.target.value))} /></Field></div>}

      <fieldset className="rounded-xl border border-line p-4"><legend className="px-2 text-xs uppercase tracking-widest text-muted">Sizes</legend>
        {f.variants.map((v, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <Input aria-label="Size name" placeholder="Medium (16oz)" value={v.name} onChange={(e) => up("variants", f.variants.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <Input aria-label="Price difference" type="number" step="0.01" className="w-28" value={v.priceDelta} onChange={(e) => up("variants", f.variants.map((x, j) => j === i ? { ...x, priceDelta: Number(e.target.value) } : x))} />
            <label className="flex items-center gap-1 text-xs text-muted"><input type="radio" name="defv" className="accent-[var(--gold)]" checked={v.isDefault} onChange={() => up("variants", f.variants.map((x, j) => ({ ...x, isDefault: j === i })))} />Default</label>
            <button type="button" aria-label="Remove size" onClick={() => up("variants", f.variants.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="subtle" onClick={() => up("variants", [...f.variants, { name: "", priceDelta: 0, isDefault: f.variants.length === 0 }])}><Plus className="h-4 w-4" />Add size</Button>
      </fieldset>

      <fieldset className="rounded-xl border border-line p-4"><legend className="px-2 text-xs uppercase tracking-widest text-muted">Add-ons</legend>
        {f.addons.map((a, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <Input aria-label="Add-on name" placeholder="Extra shot" value={a.name} onChange={(e) => up("addons", f.addons.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <Input aria-label="Add-on price" type="number" min={0} step="0.01" className="w-28" value={a.price} onChange={(e) => up("addons", f.addons.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
            <Switch aria-label="Add-on active" checked={a.isActive ?? true} onCheckedChange={(v) => up("addons", f.addons.map((x, j) => j === i ? { ...x, isActive: v } : x))} />
            <button type="button" aria-label="Remove add-on" onClick={() => up("addons", f.addons.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="subtle" onClick={() => up("addons", [...f.addons, { name: "", price: 0, isActive: true }])}><Plus className="h-4 w-4" />Add add-on</Button>
      </fieldset>

      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onDone(false)}>Cancel</Button><Button type="submit" loading={busy}>{product ? "Save changes" : "Create product"}</Button></div>
    </form>
  );
}

export default function AdminProducts() {
  const { toast } = useToast();
  const [q, setQ] = React.useState(""); const [dq, setDq] = React.useState("");
  const [cat, setCat] = React.useState("");
  React.useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);
  const cats = useApi<Category[]>("/api/admin/categories");
  const { data, error, loading, reload } = useApi<Paged<Product>>(`/api/admin/products${qs({ q: dq, categoryId: cat, pageSize: 100 })}`);
  const [editing, setEditing] = React.useState<Product | "new" | null>(null);

  const patch = async (p: Product, change: Partial<Product>) => {
    const m = { ...p, ...change };
    try {
      await api.put(`/api/admin/products/${p.id}`, { name: m.name, description: m.description, imageUrl: m.imageUrl, price: m.price, categoryId: m.categoryId, isAvailable: m.isAvailable, isFeatured: m.isFeatured, isSignature: m.isSignature, supportsHot: m.supportsHot, supportsCold: m.supportsCold, variants: m.variants, addons: m.addons, trackStock: m.trackStock, quantityOnHand: m.quantityOnHand ?? 0, reorderLevel: m.reorderLevel ?? 5 });
      reload();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Update failed.", "err"); }
  };

  return (
    <>
      <PageHeader title="Products" subtitle="Changes publish to the customer menu immediately." actions={<Button onClick={() => setEditing("new")} disabled={!cats.data?.length}><Plus className="h-4 w-4" aria-hidden />New product</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search products" className="pl-11" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Category" className="sm:w-56" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : data?.items.length ? (
        <Table head={["Product", "Category", "Price", "Available", "Featured", ""]}>
          {data.items.map((p) => (
            <tr key={p.id} className="hover:bg-cream/5">
              <td className="px-4 py-3"><div className="flex items-center gap-3"><ProductImage src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg" /><div><p className="text-cream">{p.name}</p>{p.isSignature && <Badge className="mt-0.5"><Star className="mr-1 h-3 w-3" />Signature</Badge>}</div></div></td>
              <td className="px-4 py-3 text-muted">{p.categoryName}</td><td className="px-4 py-3 font-serif">{peso(p.price)}</td>
              <td className="px-4 py-3"><Switch checked={p.isAvailable} onCheckedChange={(v) => patch(p, { isAvailable: v })} aria-label={`${p.name} available`} /></td>
              <td className="px-4 py-3"><Switch checked={p.isFeatured} onCheckedChange={(v) => patch(p, { isFeatured: v })} aria-label={`${p.name} featured`} /></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">
                <Button size="sm" variant="subtle" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Button>
                <ConfirmButton size="sm" variant="danger" message={`Archive "${p.name}"? It disappears from the menu; past orders are kept.`} onConfirm={async () => { try { await api.del(`/api/admin/products/${p.id}`); toast("Product archived."); reload(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } }}><Archive className="h-3.5 w-3.5" aria-hidden />Archive</ConfirmButton></div></td>
            </tr>
          ))}
        </Table>
      ) : <EmptyState title="No products" text="Create your first product." />}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && <DialogContent title={editing === "new" ? "New product" : `Edit ${editing.name}`} className="max-w-3xl">
          <ProductEditor key={editing === "new" ? "new" : editing.id} product={editing === "new" ? null : editing} categories={cats.data ?? []} onDone={(saved) => { setEditing(null); if (saved) reload(); }} />
        </DialogContent>}
      </Dialog>
    </>
  );
}
