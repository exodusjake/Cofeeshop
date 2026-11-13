"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { OrderList } from "@/components/site/order-ui";
import { useApi } from "@/components/providers";
import type { OrderSummary } from "@/lib/types";

export default function MyOrders() {
  const { data, error, loading, reload } = useApi<OrderSummary[]>("/api/orders");
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <h1 className="gold-text text-4xl">My Orders</h1>
      {data && data.length ? <OrderList orders={data} /> : <EmptyState title="No orders yet" text="Your order history will appear here." action={<Button asChild><Link href="/menu">Start your first order</Link></Button>} />}
    </div>
  );
}
