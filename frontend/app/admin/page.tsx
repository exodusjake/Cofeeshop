"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ErrorState, PageLoader } from "@/components/ui/misc";
import { PageHeader, StatCard } from "@/components/admin/common";
import { BestSellers, CategoryRevenue, ChartCard, DailySales, MonthlyRevenue, OrderStats } from "@/components/admin/charts";
import { useApi } from "@/components/providers";
import { peso } from "@/lib/utils";
import type { Dashboard } from "@/lib/types";

export default function AdminDashboard() {
  const { data: d, error, loading, reload } = useApi<Dashboard>("/api/admin/dashboard");
  if (loading && !d) return <PageLoader />;
  if (error || !d) return <ErrorState message={error ?? "Could not load dashboard."} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live figures from your SQL Server database." />
      {d.lowStockCount > 0 && <Link href="/admin/inventory" className="mb-6 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold"><AlertTriangle className="h-4 w-4" aria-hidden />{d.lowStockCount} product{d.lowStockCount > 1 ? "s are" : " is"} low on stock.</Link>}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <StatCard label="Total sales" value={peso(d.totalSales)} />
        <StatCard label="Total orders" value={d.totalOrders} />
        <StatCard label="Customers" value={d.totalCustomers} />
        <StatCard label="Pending orders" value={d.pendingOrders} />
        <StatCard label="Today's revenue" value={peso(d.todayRevenue)} />
        <StatCard label="Active products" value={d.activeProducts} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily sales (14 days)"><DailySales data={d.dailySales} /></ChartCard>
        <ChartCard title="Monthly revenue"><MonthlyRevenue data={d.monthlyRevenue} /></ChartCard>
        <ChartCard title="Best-selling products"><BestSellers data={d.bestSellers} /></ChartCard>
        <ChartCard title="Order statistics"><OrderStats data={d.orderStatistics} /></ChartCard>
        <ChartCard title="Revenue by category" className="lg:col-span-2"><CategoryRevenue data={d.revenueByCategory} /></ChartCard>
      </div>
    </>
  );
}
