"use client";
import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { safeHref } from "@/lib/utils";
import type { Paged } from "@/lib/types";

export const STATUSES = ["Pending", "Confirmed", "Preparing", "Ready for Pickup", "Out for Delivery", "Completed", "Cancelled"];

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="gold-text text-3xl sm:text-4xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Responsive table: scrolls horizontally on small screens. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card-lux scroll-thin overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-widest text-muted"><tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({ data, onPage }: { data: Paged<unknown>; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>{data.total} total</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="subtle" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</Button>
        <span>Page {data.page} of {pages}</span>
        <Button size="sm" variant="subtle" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** URL input + upload button. Uploads go through the validated /api/admin/media endpoint. */
export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={safeHref(value)} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-line text-muted"><ImagePlus className="h-4 w-4" aria-hidden /></span>}
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/api/media/… or https://…" aria-label={`${label} URL`} />
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setBusy(true);
          try { const m = await api.upload<{ url: string }>("/api/admin/media", f); onChange(m.url); toast("Image uploaded."); }
          catch (err) { toast(err instanceof ApiError ? err.message : "Upload failed.", "err"); }
          finally { setBusy(false); e.target.value = ""; }
        }} />
        <Button type="button" variant="subtle" size="sm" onClick={() => ref.current?.click()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}</Button>
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card-lux p-5"><p className="text-xs uppercase tracking-widest text-muted">{label}</p><p className="mt-2 font-serif text-3xl text-cream">{value}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</div>
  );
}
