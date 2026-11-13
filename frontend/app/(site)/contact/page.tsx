import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { serverGet } from "@/services/server";
import { SectionHeading } from "@/components/site/home-sections";
import { ErrorState } from "@/components/ui/misc";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  try {
    const [s, pages] = await Promise.all([serverGet<Record<string, string>>("/api/settings/public"), serverGet<Record<string, string>>("/api/content/pages")]);
    const rows = [
      { icon: MapPin, t: "Visit us", v: s["contact.address"] },
      { icon: Phone, t: "Call us", v: s["contact.phone"], href: s["contact.phone"] && `tel:${s["contact.phone"].replace(/\s/g, "")}` },
      { icon: Mail, t: "Email us", v: s["contact.email"], href: s["contact.email"] && `mailto:${s["contact.email"]}` },
      { icon: Clock, t: "Opening hours", v: s["hours.text"] },
    ];
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Contact" title="Come in from the dark" subtitle={pages["contact.intro"]} />
        <div className="grid gap-6 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.t} className="card-lux flex gap-4 p-7">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold/10"><r.icon className="h-5 w-5 text-gold" aria-hidden /></span>
              <div><h3 className="text-xl">{r.t}</h3>
                {r.href ? <a href={r.href} className="mt-1 block text-muted hover:text-gold">{r.v}</a> : <p className="mt-1 whitespace-pre-line text-muted">{r.v}</p>}</div>
            </div>
          ))}
        </div>
      </div>
    );
  } catch { return <ErrorState message="We couldn't load this page. Please try again shortly." />; }
}
