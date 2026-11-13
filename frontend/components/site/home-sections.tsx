"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Clock, Gem, MapPin, Phone, Quote, Star, Tag, Wheat, Coffee as CoffeeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/misc";
import { ProductCard } from "@/components/site/product-card";
import { useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { cn, peso, safeHref } from "@/lib/utils";
import type { EventItem, HomeData, Section } from "@/lib/types";

const fade = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.7, ease: "easeOut" as const } };

export function SectionHeading({ eyebrow, title, subtitle, center = true }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <motion.div {...fade} className={cn("mb-12 max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-3 text-xs uppercase tracking-[0.35em] text-gold">{eyebrow}</p>}
      <h2 className="gold-text text-4xl sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-muted">{subtitle}</p>}
      <div className={cn("mt-6 h-px w-24 bg-gradient-to-r from-gold to-transparent", center && "mx-auto from-transparent via-gold to-transparent")} />
    </motion.div>
  );
}

const wrap = "mx-auto max-w-7xl px-4 sm:px-6";

export function parseEvents(pages: Record<string, string>): EventItem[] {
  try { const v = JSON.parse(pages["events.items"] ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function HomeSections({ data }: { data: HomeData }) {
  const sections = [...data.homepage.sections].filter((s) => s.isEnabled && s.key !== "footer").sort((a, b) => a.sortOrder - b.sortOrder);
  if (!data.homepage.isPublished) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div><h1 className="gold-text text-5xl">We&apos;ll be right back.</h1><p className="mt-4 text-muted">Our homepage is being refreshed. The menu is still open for ordering.</p>
          <Button asChild className="mt-6"><Link href="/menu">View Menu</Link></Button></div>
      </div>
    );
  }
  return (
    <>
      {sections.map((s, i) => (
        <SectionRenderer key={s.key} section={s} data={data} first={i === 0} />
      ))}
    </>
  );
}

function SectionRenderer({ section, data, first }: { section: Section; data: HomeData; first: boolean }) {
  const c = section.content ?? {};
  switch (section.key) {
    case "hero": return <Hero c={c} />;
    case "highlights": return <Highlights c={c} />;
    case "story": return <Story c={c} />;
    case "featured": return data.featured.length ? <ProductGrid id="featured" c={c} products={data.featured} /> : null;
    case "signature": return data.signature.length ? <ProductGrid id="signature" c={c} products={data.signature} alt /> : null;
    case "gallery": return data.gallery.length ? <GalleryStrip c={c} images={data.gallery} /> : null;
    case "promotions": return <Promotions c={c} promos={data.promotions} />;
    case "reviews": return data.reviews.length ? <Reviews c={c} reviews={data.reviews} /> : null;
    case "events": return <Events c={c} events={parseEvents(data.pages)} />;
    case "newsletter": return <Newsletter c={c} />;
    case "contact": return <ContactBlock c={c} settings={data.homepage.settings} />;
    default: return first ? null : null;
  }
}

function Hero({ c }: { c: Record<string, any> }) {
  return (
    <section className="relative -mt-18 flex min-h-[100svh] items-center overflow-hidden" aria-labelledby="hero-title">
      {c.backgroundImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeHref(c.backgroundImage)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/75 to-bg/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/60" />
      <div className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-gold/10 blur-[120px]" aria-hidden />
      <div className={cn(wrap, "relative z-10 pt-24")}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} className="max-w-3xl">
          {c.eyebrow && <p className="mb-6 text-xs uppercase tracking-[0.5em] text-gold">{c.eyebrow}</p>}
          <h1 id="hero-title" className="gold-text text-5xl leading-[1.05] sm:text-7xl lg:text-8xl">{c.title}</h1>
          {c.subtitle && <p className="mt-6 max-w-xl text-lg text-cream/80">{c.subtitle}</p>}
          <div className="mt-10 flex flex-wrap gap-4">
            {c.primaryButtonText && <Button asChild size="lg"><Link href={safeHref(c.primaryButtonLink, "/menu")}>{c.primaryButtonText}<ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>}
            {c.secondaryButtonText && <Button asChild size="lg" variant="outline"><Link href={safeHref(c.secondaryButtonLink, "/menu")}>{c.secondaryButtonText}</Link></Button>}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const ICONS = [Gem, CoffeeIcon, Clock, Wheat];
function Highlights({ c }: { c: Record<string, any> }) {
  const items: { title: string; text: string }[] = c.items ?? [];
  return (
    <section className={cn(wrap, "py-24")} aria-label={c.title}>
      <SectionHeading title={c.title} subtitle={c.subtitle} />
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((it, i) => { const Icon = ICONS[i % ICONS.length]; return (
          <motion.div key={i} {...fade} transition={{ ...fade.transition, delay: i * 0.1 }} className="card-lux p-8 text-center transition hover:border-gold/50">
            <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-gold/50 bg-gold/10"><Icon className="h-6 w-6 text-gold" aria-hidden /></span>
            <h3 className="text-2xl text-cream">{it.title}</h3><p className="mt-3 text-sm text-muted">{it.text}</p>
          </motion.div>); })}
      </div>
    </section>
  );
}

function Story({ c }: { c: Record<string, any> }) {
  return (
    <section id="story" className="relative overflow-hidden bg-surface/50 py-24">
      <div className={cn(wrap, "grid items-center gap-12 lg:grid-cols-2")}>
        <motion.div {...fade} className="relative overflow-hidden rounded-2xl border border-line">
          {c.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={safeHref(c.image)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />}
        </motion.div>
        <motion.div {...fade}>
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-gold">Since the first midnight</p>
          <h2 className="gold-text text-4xl sm:text-5xl">{c.title}</h2>
          <div className="mt-6 space-y-4 text-muted">{String(c.body ?? "").split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
          <Button asChild variant="outline" className="mt-8"><Link href="/about">Read more<ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        </motion.div>
      </div>
    </section>
  );
}

function ProductGrid({ id, c, products, alt }: { id: string; c: Record<string, any>; products: HomeData["featured"]; alt?: boolean }) {
  return (
    <section id={id} className={cn(alt ? "bg-surface/50 py-24" : "py-24")}>
      <div className={wrap}>
        <SectionHeading eyebrow={alt ? "Signature" : "Featured"} title={c.title} subtitle={c.subtitle} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{products.slice(0, 8).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
        <div className="mt-12 text-center"><Button asChild variant="outline"><Link href="/menu">Explore the full menu<ArrowRight className="h-4 w-4" aria-hidden /></Link></Button></div>
      </div>
    </section>
  );
}

export function GalleryGrid({ images }: { images: HomeData["gallery"] }) {
  return (
    <div className="columns-2 gap-4 md:columns-3">
      {images.map((g, i) => (
        <motion.figure key={g.id} {...fade} transition={{ ...fade.transition, delay: (i % 3) * 0.08 }} className="group relative mb-4 overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={safeHref(g.imageUrl)} alt={g.caption ?? "Nocturne Café"} loading="lazy" className="w-full transition-transform duration-700 group-hover:scale-105" />
          {g.caption && <figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-bg to-transparent p-4 text-sm text-cream transition-transform duration-300 group-hover:translate-y-0">{g.caption}</figcaption>}
        </motion.figure>
      ))}
    </div>
  );
}

function GalleryStrip({ c, images }: { c: Record<string, any>; images: HomeData["gallery"] }) {
  return (
    <section id="gallery" className={cn(wrap, "py-24")}>
      <SectionHeading eyebrow="Gallery" title={c.title} subtitle={c.subtitle} />
      <GalleryGrid images={images.slice(0, 6)} />
      <div className="mt-8 text-center"><Button asChild variant="outline"><Link href="/gallery">See all photos</Link></Button></div>
    </section>
  );
}

function Promotions({ c, promos }: { c: Record<string, any>; promos: HomeData["promotions"] }) {
  return (
    <section id="promotions" className="bg-surface/50 py-24">
      <div className={wrap}>
        <SectionHeading eyebrow="Promotions" title={c.title} subtitle={c.subtitle} />
        {c.message && <motion.p {...fade} className="mx-auto mb-10 flex max-w-2xl items-center justify-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-5 py-3 text-center text-sm text-gold"><Tag className="h-4 w-4 shrink-0" aria-hidden />{c.message}</motion.p>}
        <div className="grid gap-6 md:grid-cols-2">
          {promos.map((p) => (
            <motion.div key={p.id} {...fade} className="card-lux flex gap-5 p-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl text-cream">{p.title}</h3>
                <p className="mt-2 text-sm text-muted">{p.description}</p>
                {p.code && <p className="mt-4 text-sm text-muted">Use code <Badge className="ml-1 font-mono tracking-widest">{p.code}</Badge></p>}
                {p.minSubtotal > 0 && <p className="mt-1 text-xs text-muted">Min. order {peso(p.minSubtotal)}</p>}
              </div>
            </motion.div>
          ))}
          {promos.length === 0 && <p className="col-span-full text-center text-muted">New offers are brewing. Check back soon.</p>}
        </div>
      </div>
    </section>
  );
}

function Reviews({ c, reviews }: { c: Record<string, any>; reviews: HomeData["reviews"] }) {
  return (
    <section id="reviews" className={cn(wrap, "py-24")}>
      <SectionHeading eyebrow="Reviews" title={c.title} subtitle={c.subtitle} />
      <div className="grid gap-6 md:grid-cols-3">
        {reviews.slice(0, 6).map((r, i) => (
          <motion.blockquote key={r.id} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className="card-lux flex flex-col p-7">
            <Quote className="mb-3 h-6 w-6 text-gold/60" aria-hidden />
            <p className="flex-1 text-cream/90">{r.comment}</p>
            <footer className="mt-5 flex items-center justify-between text-sm">
              <cite className="not-italic text-muted">{r.authorName}</cite>
              <span className="flex" aria-label={`${r.rating} out of 5 stars`}>{Array.from({ length: 5 }).map((_, k) => <Star key={k} className={cn("h-4 w-4", k < r.rating ? "fill-gold text-gold" : "text-muted/40")} aria-hidden />)}</span>
            </footer>
          </motion.blockquote>
        ))}
      </div>
    </section>
  );
}

export function EventList({ events }: { events: EventItem[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {events.map((e, i) => (
        <motion.div key={i} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className="card-lux p-7">
          <CalendarDays className="mb-4 h-6 w-6 text-gold" aria-hidden />
          <h3 className="text-2xl text-cream">{e.title}</h3>
          <p className="mt-1 text-sm text-gold">{e.date}</p>
          <p className="mt-3 text-sm text-muted">{e.description}</p>
        </motion.div>
      ))}
      {events.length === 0 && <p className="col-span-full text-center text-muted">No upcoming events right now.</p>}
    </div>
  );
}

function Events({ c, events }: { c: Record<string, any>; events: EventItem[] }) {
  return (
    <section id="events" className="bg-surface/50 py-24">
      <div className={wrap}>
        <SectionHeading eyebrow="Events" title={c.title} subtitle={c.subtitle} />
        <EventList events={events} />
      </div>
    </section>
  );
}

export function NewsletterForm({ buttonText = "Subscribe" }: { buttonText?: string }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <form className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      try { const r = await api.post<{ message: string }>("/api/newsletter", { email }); toast(r.message); setEmail(""); }
      catch (err) { toast(err instanceof ApiError ? err.message : "Could not subscribe.", "err"); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <Input id="nl-email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
      <Button type="submit" loading={busy}>{buttonText}</Button>
    </form>
  );
}

function Newsletter({ c }: { c: Record<string, any> }) {
  return (
    <section id="newsletter" className={cn(wrap, "py-24")}>
      <div className="card-lux relative overflow-hidden p-10 text-center sm:p-16">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl" aria-hidden />
        <h2 className="gold-text relative text-4xl sm:text-5xl">{c.title}</h2>
        <p className="relative mx-auto mb-8 mt-4 max-w-xl text-muted">{c.subtitle}</p>
        <div className="relative"><NewsletterForm buttonText={c.buttonText} /></div>
      </div>
    </section>
  );
}

function ContactBlock({ c, settings }: { c: Record<string, any>; settings: Record<string, string> }) {
  return (
    <section id="contact" className={cn(wrap, "py-24")}>
      <SectionHeading eyebrow="Contact" title={c.title} subtitle={c.subtitle} />
      <div className="grid gap-6 md:grid-cols-3">
        {[{ icon: MapPin, t: "Address", v: settings["contact.address"] }, { icon: Phone, t: "Call", v: settings["contact.phone"] }, { icon: Clock, t: "Hours", v: settings["hours.text"] }].map((x) => (
          <motion.div key={x.t} {...fade} className="card-lux p-7 text-center"><x.icon className="mx-auto mb-3 h-6 w-6 text-gold" aria-hidden /><h3 className="text-xl">{x.t}</h3><p className="mt-2 whitespace-pre-line text-sm text-muted">{x.v}</p></motion.div>
        ))}
      </div>
    </section>
  );
}
