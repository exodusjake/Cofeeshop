"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, EmptyState, ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { ImageField, PageHeader } from "@/components/admin/common";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { safeHref } from "@/lib/utils";
import type { GalleryImage } from "@/lib/types";

export default function AdminGallery() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<GalleryImage[]>("/api/admin/gallery");
  const [url, setUrl] = React.useState(""); const [caption, setCaption] = React.useState("");
  const guard = async (fn: () => Promise<unknown>) => { try { await fn(); reload(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } };
  const save = (g: GalleryImage, ch: Partial<GalleryImage>) => guard(() => api.put(`/api/admin/gallery/${g.id}`, { ...g, ...ch }));

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Gallery" subtitle="Visible images appear on the homepage gallery and the Gallery page." />
      <div className="card-lux mb-8 grid gap-4 p-5 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <ImageField label="New image" value={url} onChange={setUrl} />
        <div><label className="mb-1.5 block text-xs uppercase tracking-widest text-muted" htmlFor="cap">Caption</label><Input id="cap" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
        <Button disabled={!url} onClick={() => guard(async () => { await api.post("/api/admin/gallery", { imageUrl: url, caption: caption || null, sortOrder: (data?.length ?? 0) + 1, isVisible: true }); setUrl(""); setCaption(""); toast("Image added."); })}><Plus className="h-4 w-4" aria-hidden />Add</Button>
      </div>
      {data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((g) => (
            <div key={g.id} className="card-lux overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={safeHref(g.imageUrl)} alt={g.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="space-y-3 p-3">
                <Input aria-label="Caption" defaultValue={g.caption ?? ""} maxLength={200} onBlur={(e) => e.target.value !== (g.caption ?? "") && save(g, { caption: e.target.value })} />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted">Visible<Switch aria-label="Visible" checked={g.isVisible} onCheckedChange={(v) => save(g, { isVisible: v })} /></label>
                  <Input aria-label="Order" type="number" className="h-9 w-16" defaultValue={g.sortOrder} onBlur={(e) => Number(e.target.value) !== g.sortOrder && save(g, { sortOrder: Number(e.target.value) })} />
                  <ConfirmButton size="icon" variant="danger" aria-label="Delete image" message="Remove this image from the gallery?" onConfirm={() => guard(() => api.del(`/api/admin/gallery/${g.id}`))}><Trash2 className="h-4 w-4" /></ConfirmButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No images" text="Upload your first gallery photo above." />}
    </>
  );
}
