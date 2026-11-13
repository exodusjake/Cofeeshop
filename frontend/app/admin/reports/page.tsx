"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, PageLoader } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { PageHeader, StatCard } from "@/components/admin/common";
import { BestSellers, CategoryRevenue, ChartCard, DailySales, MonthlyRevenue } from "@/components/admin/charts";
import { useApi } from "@/components/providers";
import { peso } from "@/lib/utils";
import type { Dashboard } from "@/lib/types";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AdminReports() {
  const { data: d, error, loading, reload } = useApi<Dashboard>("/api/admin/dashboard");
  const [from, setFrom] = React.useState(() => iso(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = React.useState(() => iso(new Date()));
  if (loading && !d) return <PageLoader />;
  if (error || !d) return <ErrorState message={error ?? "Could not load report."} onRetry={reload} />;
  const avg = d.totalOrders ? d.totalSales / d.totalOrders : 0;
  const end = new Date(to); end.setDate(end.getDate() + 1);
  return (
    <>
      <PageHeader title="Reports" subtitle="Sales performance from your order database." />
      <div className="card-lux mb-6 flex flex-wrap items-end gap-3 p-4">
        <div><label htmlFor="from" className="mb-1.5 block text-xs uppercase tracking-widest text-muted">From</label><Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label htmlFor="to" className="mb-1.5 block text-xs uppercase tracking-widest text-muted">To</label><Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button asChild><a href={`/api/admin/reports/sales.csv?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(end.toISOString())}`} download><Download className="h-4 w-4" aria-hidden />Export orders (CSV)</a></Button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total sales" value={peso(d.totalSales)} /><StatCard label="Orders" value={d.totalOrders} /><StatCard label="Avg. order value" value={peso(avg)} /><StatCard label="Today" value={peso(d.todayRevenue)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily sales"><DailySales data={d.dailySales} /></ChartCard>
        <ChartCard title="Monthly revenue"><MonthlyRevenue data={d.monthlyRevenue} /></ChartCard>
        <ChartCard title="Best sellers"><BestSellers data={d.bestSellers} /></ChartCard>
        <ChartCard title="Revenue by category"><CategoryRevenue data={d.revenueByCategory} /></ChartCard>
      </div>
    </>
  );
}
