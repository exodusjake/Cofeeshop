"use client";
import { Award } from "lucide-react";
import { Badge, Card, EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { useApi } from "@/components/providers";
import { fmtDate } from "@/lib/utils";
import type { Rewards } from "@/lib/types";

export default function RewardsPage() {
  const { data, error, loading, reload } = useApi<Rewards>("/api/account/rewards");
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? "Could not load rewards."} onRetry={reload} />;
  const pct = Math.min(100, Math.round((data.points / data.nextTierAt) * 100));
  return (
    <div className="space-y-6">
      <h1 className="gold-text text-4xl">Rewards</h1>
      <Card className="p-7">
        <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-full border border-gold/60 bg-gold/10"><Award className="h-7 w-7 text-gold" aria-hidden /></span>
          <div><p className="font-serif text-4xl text-gold">{data.points} <span className="text-base text-muted">points</span></p><Badge>{data.tier} member</Badge></div></div>
        <div className="mt-6"><div className="h-2 overflow-hidden rounded-full bg-cream/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-r from-champagne to-gold" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted">{data.points >= 1000 ? "You've reached our highest tier." : `${data.nextTierAt - data.points} points to the next tier.`} Earn 1 point for every ₱10 spent on completed orders.</p></div>
      </Card>
      <h2 className="text-2xl">History</h2>
      {data.history.length ? (
        <ul className="divide-y divide-line card-lux">
          {data.history.map((h) => <li key={h.id} className="flex items-center justify-between p-4 text-sm"><div><p>{h.description}</p><p className="text-xs text-muted">{fmtDate(h.createdAt)}</p></div><span className={h.points >= 0 ? "text-success" : "text-danger"}>{h.points >= 0 ? "+" : ""}{h.points}</span></li>)}
        </ul>
      ) : <EmptyState title="No points yet" text="Complete an order to start earning." />}
    </div>
  );
}
