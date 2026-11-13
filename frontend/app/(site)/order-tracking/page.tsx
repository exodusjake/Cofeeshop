"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { OrderList, RequireAuth } from "@/components/site/order-ui";
import { SectionHeading } from "@/components/site/home-sections";
import { useApi } from "@/components/providers";
import type { OrderSummary } from "@/lib/types";

function Tracking() {
  const { data, error, loading, reload } = useApi<OrderSummary[]>("/api/orders");
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const active = (data ?? []).filter((o) => !["Completed", "Cancelled"].includes(o.status));
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <SectionHeading eyebrow="Live" title="Order Tracking" subtitle="Follow your current orders from the bar to your hands." />
      {active.length ? <OrderList orders={active} /> : <EmptyState title="No active orders" text="Orders you place will show up here while we prepare them." action={<Button asChild><Link href="/menu">Order something</Link></Button>} />}
      <p className="mt-8 text-center text-sm text-muted"><Link href="/account/orders" className="text-gold hover:underline">View full order history</Link></p>
    </div>
  );
}
export default function OrderTrackingPage() { return <RequireAuth><Tracking /></RequireAuth>; }

