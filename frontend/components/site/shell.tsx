"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Coffee, LogOut, MapPin, Menu, Phone, ShoppingBag, ShieldCheck, User as UserIcon, X, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useCart } from "@/components/providers";
import { cn, safeHref } from "@/lib/utils";

export type SiteSettings = Record<string, string>;

// Brand glyphs (lucide dropped brand icons)
type IconProps = { className?: string };
const Svg = ({ className, children }: IconProps & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
const Instagram = ({ className }: IconProps) => <Svg className={className}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></Svg>;
const Facebook = ({ className }: IconProps) => <Svg className={className}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /></Svg>;
const Music2 = ({ className }: IconProps) => <Svg className={className}><path d="M14 3v12.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c0 2.5 2 4.5 5 4.5" /></Svg>;

export function Logo({ settings, className }: { settings: SiteSettings; className?: string }) {
  const name = settings["site.name"] || "NOCTURNE CAFÉ";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {settings["site.logo"] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeHref(settings["site.logo"])} alt={name} className="h-9 w-auto max-w-40 object-contain" />
      ) : (
        <>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-gold/60 bg-gold/10"><Coffee className="h-4.5 w-4.5 text-gold" aria-hidden /></span>
          <span className="font-serif text-lg tracking-[0.18em] text-cream">{name}</span>
        </>
      )}
    </span>
  );
}

const NAV = [
  { key: "home", href: "/", label: "Home" },
  { key: "menu", href: "/menu", label: "Menu" },
  { key: "about", href: "/about", label: "About" },
  { key: "gallery", href: "/gallery", label: "Gallery" },
  { key: "events", href: "/events", label: "Events" },
  { key: "contact", href: "/contact", label: "Contact" },
];

export function Navbar({ settings, hideNav = [] }: { settings: SiteSettings; hideNav?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout, loading } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => { setOpen(false); setMenu(false); }, [pathname]);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const links = NAV.filter((n) => !hideNav.includes(n.key));
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 transition-all", scrolled || open ? "border-b border-line bg-bg/90 backdrop-blur-xl" : "bg-gradient-to-b from-bg/80 to-transparent")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link href="/" aria-label="Home"><Logo settings={settings} /></Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((n) => (
            <li key={n.key}>
              <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                className={cn("relative rounded-full px-4 py-2 text-sm tracking-wide transition-colors hover:text-gold", active(n.href) ? "text-gold" : "text-cream/85")}>
                {n.label}
                {active(n.href) && <motion.span layoutId="nav-dot" className="absolute inset-x-4 -bottom-0.5 h-px bg-gold" />}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/cart" aria-label={`Cart, ${count} items`} className="relative grid h-10 w-10 place-items-center rounded-full text-cream transition hover:bg-cream/10 hover:text-gold">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-semibold text-bg">{count}</span>}
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {loading ? <span className="h-10 w-24" /> : user ? (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
                  <UserIcon className="h-4 w-4" aria-hidden />{user.fullName.split(" ")[0]}
                </Button>
                <AnimatePresence>
                  {menu && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="menu"
                      className="card-lux absolute right-0 mt-2 w-56 overflow-hidden bg-surface p-1.5 shadow-2xl">
                      <MenuLink href="/account" icon={<UserIcon className="h-4 w-4" />}>My Account</MenuLink>
                      <MenuLink href="/account/orders" icon={<ShoppingBag className="h-4 w-4" />}>My Orders</MenuLink>
                      {isAdmin && <MenuLink href="/admin" icon={<ShieldCheck className="h-4 w-4" />}>Admin Dashboard</MenuLink>}
                      <button role="menuitem" onClick={async () => { await logout(); router.push("/"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-cream/10">
                        <LogOut className="h-4 w-4" />Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link href="/signin">Sign In</Link></Button>
                <Button asChild size="sm"><Link href="/signup">Sign Up</Link></Button>
              </>
            )}
          </div>

          <button className="grid h-10 w-10 place-items-center rounded-full text-cream hover:bg-cream/10 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line bg-bg lg:hidden">
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
              {links.map((n) => (
                <li key={n.key}><Link href={n.href} className={cn("block rounded-xl px-4 py-3 text-lg font-serif", active(n.href) ? "bg-gold/10 text-gold" : "text-cream")}>{n.label}</Link></li>
              ))}
              <li className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
                {user ? (
                  <>
                    <Button asChild variant="outline"><Link href="/account">My Account</Link></Button>
                    {isAdmin && <Button asChild variant="subtle"><Link href="/admin">Admin Dashboard</Link></Button>}
                    <Button variant="ghost" onClick={async () => { await logout(); router.push("/"); }}>Sign out</Button>
                  </>
                ) : (
                  <><Button asChild><Link href="/signup">Sign Up</Link></Button><Button asChild variant="outline"><Link href="/signin">Sign In</Link></Button></>
                )}
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link role="menuitem" href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-cream hover:bg-cream/10">{icon}{children}</Link>;
}

export function Footer({ settings, show = true, text }: { settings: SiteSettings; show?: boolean; text?: string }) {
  if (!show) return null;
  const socials = [
    { k: "social.instagram", icon: Instagram, label: "Instagram" },
    { k: "social.facebook", icon: Facebook, label: "Facebook" },
    { k: "social.tiktok", icon: Music2, label: "TikTok" },
  ].filter((s) => settings[s.k]);
  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo settings={settings} />
          <p className="mt-4 text-sm text-muted">{text || settings["site.tagline"]}</p>
          <div className="mt-5 flex gap-2">
            {socials.map((s) => (
              <a key={s.k} href={safeHref(settings[s.k])} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="grid h-10 w-10 place-items-center rounded-full border border-line text-gold transition hover:bg-gold/10"><s.icon className="h-4 w-4" /></a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm uppercase tracking-widest text-gold">Explore</h3>
          <ul className="space-y-2 text-sm text-muted">
            {["/menu|Menu", "/about|Our Story", "/gallery|Gallery", "/events|Events", "/contact|Contact", "/order-tracking|Track Order"].map((l) => { const [h, t] = l.split("|"); return <li key={h}><Link href={h} className="hover:text-gold">{t}</Link></li>; })}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm uppercase tracking-widest text-gold">Visit</h3>
          <ul className="space-y-3 text-sm text-muted">
            {settings["contact.address"] && <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{settings["contact.address"]}</li>}
            {settings["contact.phone"] && <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={`tel:${settings["contact.phone"].replace(/\s/g, "")}`} className="hover:text-gold">{settings["contact.phone"]}</a></li>}
            {settings["contact.email"] && <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={`mailto:${settings["contact.email"]}`} className="hover:text-gold">{settings["contact.email"]}</a></li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm uppercase tracking-widest text-gold">Hours</h3>
          <p className="flex gap-2 whitespace-pre-line text-sm text-muted"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{settings["hours.text"]}</p>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">{settings["footer.text"]}</div>
    </footer>
  );
}
