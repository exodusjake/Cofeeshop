"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Gift, Heart, LayoutDashboard, LogOut, MapPin, Package, Settings, User } from "lucide-react";
import { RequireAuth } from "@/components/site/order-ui";
import { useAuth } from "@/components/providers";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/favorites", label: "Favorites", icon: Heart },
  { href: "/account/rewards", label: "Rewards", icon: Gift },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  return (
    <RequireAuth>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[15rem_1fr]">
        <aside>
          <p className="mb-4 hidden text-sm text-muted lg:block">Signed in as<br /><b className="text-cream">{user?.fullName}</b></p>
          <nav aria-label="Account" className="scroll-thin -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
            {NAV.map((n) => {
              const active = n.href === "/account" ? path === n.href : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition", active ? "bg-gold/15 text-gold" : "text-cream/80 hover:bg-cream/10")}>
                  <n.icon className="h-4 w-4" aria-hidden />{n.label}
                </Link>
              );
            })}
            <button onClick={async () => { await logout(); router.push("/"); }} className="flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm text-danger hover:bg-cream/10"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
          </nav>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </RequireAuth>
  );
}
