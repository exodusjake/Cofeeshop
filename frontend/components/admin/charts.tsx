"use client";
import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { peso } from "@/lib/utils";
import type { Dashboard } from "@/lib/types";

const GOLD = "#D5AC70";
const CAT = ["#D5AC70", "#7FB5A0", "#C9806B", "#7E9CC9", "#B596C9", "#E3CF9F", "#9A8B78"];
const axis = { stroke: "#B6A795", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "#181310", border: "1px solid rgba(213,172,112,.3)", borderRadius: 12, color: "#F2E8D8" }, labelStyle: { color: "#D5AC70" }, itemStyle: { color: "#F2E8D8" } };

export function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`card-lux p-5 ${className ?? ""}`}><h2 className="mb-4 text-lg text-cream">{title}</h2><div className="h-64">{children}</div></section>;
}

const money = (v: unknown) => peso(Number(v));
const short = (v: number) => (v >= 1000 ? `₱${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₱${v}`);

export function DailySales({ data }: { data: Dashboard["dailySales"] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.5} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="rgba(213,172,112,.1)" vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" /><YAxis {...axis} tickFormatter={short} width={56} />
        <Tooltip {...tip} formatter={(v) => [money(v), "Sales"]} />
        <Area type="monotone" dataKey="value" stroke={GOLD} strokeWidth={2} fill="url(#g)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MonthlyRevenue({ data }: { data: Dashboard["monthlyRevenue"] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="rgba(213,172,112,.1)" vertical={false} />
        <XAxis dataKey="label" {...axis} tickFormatter={(v: string) => v.split(" ")[0]} /><YAxis {...axis} tickFormatter={short} width={56} />
        <Tooltip {...tip} formatter={(v) => [money(v), "Revenue"]} cursor={{ fill: "rgba(213,172,112,.08)" }} />
        <Bar dataKey="value" fill={GOLD} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BestSellers({ data }: { data: Dashboard["bestSellers"] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke="rgba(213,172,112,.1)" horizontal={false} />
        <XAxis type="number" {...axis} allowDecimals={false} /><YAxis type="category" dataKey="name" {...axis} width={120} />
        <Tooltip {...tip} formatter={(v, n) => [n === "quantity" ? `${v} sold` : money(v), n === "quantity" ? "Units" : "Revenue"]} cursor={{ fill: "rgba(213,172,112,.08)" }} />
        <Bar dataKey="quantity" fill={GOLD} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OrderStats({ data }: { data: Dashboard["orderStatistics"] }) {
  const rows = data.filter((d) => d.count > 0);
  if (!rows.length) return <p className="grid h-full place-items-center text-sm text-muted">No orders yet.</p>;
  return (
    <div className="flex h-full items-center gap-4">
      <ResponsiveContainer width="55%" height="100%"><PieChart><Pie data={rows} dataKey="count" nameKey="status" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="none">{rows.map((_, i) => <Cell key={i} fill={CAT[i % CAT.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 text-xs">{rows.map((r, i) => <li key={r.status} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: CAT[i % CAT.length] }} />{r.status}</span><b>{r.count}</b></li>)}</ul>
    </div>
  );
}

export function CategoryRevenue({ data }: { data: Dashboard["revenueByCategory"] }) {
  if (!data.length) return <p className="grid h-full place-items-center text-sm text-muted">No sales yet.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="rgba(213,172,112,.1)" vertical={false} />
        <XAxis dataKey="label" {...axis} interval={0} tick={{ fontSize: 10, fill: "#B6A795" }} /><YAxis {...axis} tickFormatter={short} width={56} />
        <Tooltip {...tip} formatter={(v) => [money(v), "Revenue"]} cursor={{ fill: "rgba(213,172,112,.08)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={CAT[i % CAT.length]} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
