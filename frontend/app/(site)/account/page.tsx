"use client";
import Link from "next/link";
import { Gift, Heart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageLoader } from "@/components/ui/misc";
import { OrderList } from "@/components/site/order-ui";
import { useApi, useAuth } from "@/components/providers";
import type { OrderSummary, Rewards } from "@/lib/types";

export default function Overview() {
  const { user } = useAuth();
  const orders = useApi<OrderSummary[]>("/api/orders");
  const rewards = useApi<Rewards>("/api/account/rewards");
  const favs = useApi<number[]>("/api/account/favorites/ids");
  if (orders.loading && !orders.data) return <PageLoader />;
  const active = (orders.data ?? []).filter((o) => !["Completed", "Cancelled"].includes(o.status));

  return (
    <div className="space-y-8">
      <div><h1 className="gold-text text-4xl">Hello, {user?.fullName.split(" ")[0]}</h1><p className="mt-1 text-muted">Here&apos;s what&apos;s happening with your Nocturne account.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ icon: Package, label: "Total orders", v: orders.data?.length ?? 0, href: "/account/orders" }, { icon: Gift, label: `Reward points (${rewards.data?.tier ?? "Bronze"})`, v: rewards.data?.points ?? 0, href: "/account/rewards" }, { icon: Heart, label: "Favorites", v: favs.data?.length ?? 0, href: "/account/favorites" }].map((c) => (
          <Link key={c.label} href={c.href}><Card className="p-5 transition hover:border-gold/50"><c.icon className="mb-2 h-5 w-5 text-gold" aria-hidden /><p className="font-serif text-3xl">{c.v}</p><p className="text-xs text-muted">{c.label}</p></Card></Link>
        ))}
      </div>
      <section><h2 className="mb-4 text-2xl">Current orders</h2>
        {active.length ? <OrderList orders={active} /> : <EmptyState title="No active orders" text="Hungry? Your next order will appear here while it's being prepared." action={<Button asChild><Link href="/menu">Browse the menu</Link></Button>} />}
      </section>
    </div>
  );
}
