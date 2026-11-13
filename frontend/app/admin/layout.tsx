"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Boxes, ExternalLink, FileText, FolderTree, ImageIcon, LayoutDashboard, LogOut, Menu, MessageSquare, Package, Palette, Settings, ShoppingBag, Tag, Users, X, Coffee,
} from "lucide-react";
import { RequireAuth } from "@/components/site/order-ui";
import { useAuth } from "@/components/providers";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/promotions", label: "Promotions", icon: Tag },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/admin/content", label: "Content Management", icon: FileText },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/appearance", label: "Website Appearance", icon: Palette },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [path]);

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="mb-6 flex items-center gap-2 px-3"><span className="grid h-9 w-9 place-items-center rounded-full border border-gold/60 bg-gold/10"><Coffee className="h-4 w-4 text-gold" aria-hidden /></span><span className="font-serif tracking-widest">NOCTURNE<span className="block text-[10px] tracking-[0.3em] text-gold">ADMIN</span></span></div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto scroll-thin">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? path === n.href : path.startsWith(n.href);
          return <li key={n.href}><Link href={n.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-gold/15 text-gold" : "text-cream/80 hover:bg-cream/10")}><n.icon className="h-4 w-4" aria-hidden />{n.label}</Link></li>;
        })}
      </ul>
      <div className="mt-4 space-y-0.5 border-t border-line pt-4">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream/80 hover:bg-cream/10"><ExternalLink className="h-4 w-4" aria-hidden />View Website</Link>
        <button onClick={async () => { await logout(); router.push("/signin"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-cream/10"><LogOut className="h-4 w-4" aria-hidden />Logout</button>
        <p className="truncate px-3 pt-2 text-xs text-muted">{user?.email}</p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface/70 p-4 lg:block">{nav}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-serif tracking-widest text-gold">ADMIN</span>
        <button onClick={() => setOpen(true)} aria-label="Open admin menu" className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream/10"><Menu className="h-6 w-6" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface p-4"><button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 text-muted"><X className="h-5 w-5" /></button>{nav}</div>
        </div>
      )}
      <main id="main" className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth admin><Shell>{children}</Shell></RequireAuth>;
}
