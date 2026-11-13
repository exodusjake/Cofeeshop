"use client";
import { Star, Trash2 } from "lucide-react";
import { Badge, ConfirmButton, EmptyState, ErrorState, PageLoader, Switch } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/common";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { cn, fmtDate } from "@/lib/utils";
import type { Review } from "@/lib/types";

export default function AdminReviews() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Review[]>("/api/admin/reviews");
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Reviews" subtitle="Only approved reviews are shown on the homepage." />
      {data?.length ? (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="card-lux flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><b className="text-cream">{r.authorName}</b><span className="flex" aria-label={`${r.rating} stars`}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "fill-gold text-gold" : "text-muted/40")} />)}</span><span className="text-xs text-muted">{fmtDate(r.createdAt)}</span>{!r.isApproved && <Badge tone="gray">Pending</Badge>}</div>
                <p className="mt-2 text-sm text-muted">{r.comment}</p>
              </div>
              <div className="flex items-center gap-4"><label className="flex items-center gap-2 text-xs text-muted">Approved<Switch aria-label="Approved" checked={r.isApproved} onCheckedChange={async (v) => { try { await api.put(`/api/admin/reviews/${r.id}/approval`, { isActive: v }); reload(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } }} /></label>
                <ConfirmButton size="sm" variant="danger" message="Delete this review permanently?" onConfirm={async () => { await api.del(`/api/admin/reviews/${r.id}`); reload(); }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</ConfirmButton></div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No reviews yet" />}
    </>
  );
}
