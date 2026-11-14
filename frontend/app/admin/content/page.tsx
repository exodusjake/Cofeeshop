"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ErrorState, PageLoader, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ImageField, PageHeader } from "@/components/admin/common";
import { PublishBar } from "@/components/admin/publish-bar";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { fmtDate } from "@/lib/utils";
import type { EventItem, Homepage, Revision, Section } from "@/lib/types";

type FieldDef = { name: string; label: string; type?: "text" | "textarea" | "image" };
const FIELDS: Record<string, FieldDef[]> = {
  hero: [{ name: "eyebrow", label: "Eyebrow text" }, { name: "title", label: "Homepage title" }, { name: "subtitle", label: "Hero subtitle", type: "textarea" }, { name: "backgroundImage", label: "Background image", type: "image" }, { name: "primaryButtonText", label: "Primary button text" }, { name: "primaryButtonLink", label: "Primary button link" }, { name: "secondaryButtonText", label: "Secondary button text" }, { name: "secondaryButtonLink", label: "Secondary button link" }],
  highlights: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  story: [{ name: "title", label: "Title" }, { name: "body", label: "Story text", type: "textarea" }, { name: "image", label: "Image", type: "image" }],
  featured: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  signature: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  quote: [{ name: "text", label: "Quote", type: "textarea" }, { name: "author", label: "Signature line" }, { name: "image", label: "Background photo", type: "image" }],
  gallery: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  promotions: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }, { name: "message", label: "Promotional message (banner)" }],
  reviews: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  events: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  newsletter: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }, { name: "buttonText", label: "Button text" }],
  contact: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }],
  footer: [{ name: "text", label: "Footer message" }],
};

function SectionCard({ s, i, last, onChange, onMove }: { s: Section; i: number; last: boolean; onChange: (s: Section) => void; onMove: (d: -1 | 1) => void }) {
  const [open, setOpen] = React.useState(false);
  const set = (k: string, v: unknown) => onChange({ ...s, content: { ...s.content, [k]: v } });
  const items: { title: string; text: string }[] = s.content.items ?? [];
  return (
    <li className="card-lux">
      <div className="flex items-center gap-3 p-4">
        <div className="flex flex-col"><button aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => onMove(-1)} className="text-muted hover:text-gold disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button aria-label={`Move ${s.name} down`} disabled={last} onClick={() => onMove(1)} className="text-muted hover:text-gold disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button></div>
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}><span className="truncate text-lg text-cream">{s.name}</span><ChevronDown className={`h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden /></button>
        {!s.isEnabled && <Badge tone="gray">Hidden</Badge>}
        <Switch checked={s.isEnabled} onCheckedChange={(v) => onChange({ ...s, isEnabled: v })} aria-label={`Show ${s.name} section`} />
      </div>
      {open && (
        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
          {(FIELDS[s.key] ?? []).map((f) => f.type === "image" ? <ImageField key={f.name} label={f.label} value={s.content[f.name] ?? ""} onChange={(v) => set(f.name, v)} />
            : <Field key={f.name} label={f.label} className={f.type === "textarea" ? "sm:col-span-2" : ""}>{f.type === "textarea" ? <Textarea rows={5} value={s.content[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} /> : <Input value={s.content[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />}</Field>)}
          {s.key === "highlights" && (
            <div className="space-y-3 sm:col-span-2"><p className="text-xs uppercase tracking-widest text-muted">Highlight cards</p>
              {items.map((it, idx) => (
                <div key={idx} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Input aria-label="Card title" value={it.title} onChange={(e) => set("items", items.map((x, j) => j === idx ? { ...x, title: e.target.value } : x))} />
                  <Input aria-label="Card text" value={it.text} onChange={(e) => set("items", items.map((x, j) => j === idx ? { ...x, text: e.target.value } : x))} />
                  <button aria-label="Remove card" onClick={() => set("items", items.filter((_, j) => j !== idx))} className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button size="sm" variant="subtle" onClick={() => set("items", [...items, { title: "", text: "" }])}><Plus className="h-4 w-4" />Add card</Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function HomepageTab({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Homepage>("/api/admin/content/homepage");
  const [sections, setSections] = React.useState<Section[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (data) setSections([...data.sections].sort((a, b) => a.sortOrder - b.sortOrder)); }, [data]);
  if (loading && !data) return <PageLoader />;
  if (error || !sections) return <ErrorState message={error ?? "Could not load content."} onRetry={reload} />;

  const move = (i: number, d: -1 | 1) => setSections((x) => { const n = [...x!]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const save = async () => {
    setBusy(true);
    try { await api.put("/api/admin/content/homepage", { sections: sections.map((s, i) => ({ ...s, sortOrder: i + 1 })) }); toast("Draft saved. Publish to make it live."); reload(); onSaved(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not save.", "err"); } finally { setBusy(false); }
  };
  return (
    <>
      <p className="mb-4 text-sm text-muted">Reorder sections, switch them on or off, and edit their text. Nothing changes for customers until you publish.</p>
      <ul className="space-y-3">{sections.map((s, i) => <SectionCard key={s.key} s={s} i={i} last={i === sections.length - 1} onChange={(ns) => setSections((x) => x!.map((y) => y.key === ns.key ? ns : y))} onMove={(d) => move(i, d)} />)}</ul>
      <div className="mt-6"><Button loading={busy} onClick={save}><Save className="h-4 w-4" aria-hidden />Save draft</Button></div>
    </>
  );
}

function PagesTab({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Record<string, string>>("/api/admin/content/pages");
  const [p, setP] = React.useState<Record<string, string> | null>(null);
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (data) { setP(data); try { setEvents(JSON.parse(data["events.items"] ?? "[]")); } catch { setEvents([]); } } }, [data]);
  if (loading && !data) return <PageLoader />;
  if (error || !p) return <ErrorState message={error ?? "Could not load."} onRetry={reload} />;
  const set = (k: string, v: string) => setP({ ...p, [k]: v });
  return (
    <div className="space-y-6">
      <div className="card-lux grid gap-4 p-5"><h2 className="text-xl">About page</h2>
        <Field label="Title"><Input value={p["about.title"] ?? ""} onChange={(e) => set("about.title", e.target.value)} /></Field>
        <Field label="Text" hint="Separate paragraphs with a blank line."><Textarea rows={8} value={p["about.body"] ?? ""} onChange={(e) => set("about.body", e.target.value)} /></Field></div>
      <div className="card-lux grid gap-4 p-5"><h2 className="text-xl">Contact page</h2><Field label="Intro text"><Textarea rows={2} value={p["contact.intro"] ?? ""} onChange={(e) => set("contact.intro", e.target.value)} /></Field></div>
      <div className="card-lux space-y-3 p-5"><h2 className="text-xl">Events</h2>
        <Field label="Intro text"><Input value={p["events.intro"] ?? ""} onChange={(e) => set("events.intro", e.target.value)} /></Field>
        {events.map((ev, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
            <Input aria-label="Event title" placeholder="Title" value={ev.title} onChange={(e) => setEvents(events.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
            <Input aria-label="Event date" placeholder="When" value={ev.date} onChange={(e) => setEvents(events.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
            <Input aria-label="Event description" className="sm:col-span-2" placeholder="Description" value={ev.description} onChange={(e) => setEvents(events.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            <button onClick={() => setEvents(events.filter((_, j) => j !== i))} className="flex items-center gap-1 text-xs text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" />Remove event</button>
          </div>
        ))}
        <Button size="sm" variant="subtle" onClick={() => setEvents([...events, { title: "", date: "", description: "" }])}><Plus className="h-4 w-4" />Add event</Button>
      </div>
      <Button loading={busy} onClick={async () => {
        setBusy(true);
        try { await api.put("/api/admin/content/pages", { pages: { ...p, "events.items": JSON.stringify(events) } }); toast("Draft saved. Publish to make it live."); reload(); onSaved(); }
        catch (e) { toast(e instanceof ApiError ? e.message : "Could not save.", "err"); } finally { setBusy(false); }
      }}><Save className="h-4 w-4" aria-hidden />Save draft</Button>
    </div>
  );
}

function HistoryTab({ onSaved, version }: { onSaved: () => void; version: number }) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useApi<Revision[]>("/api/admin/content/history", [version]);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <ul className="space-y-2">
      {data?.map((r) => (
        <li key={r.id} className="card-lux flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div><Badge tone={r.action === "Publish" ? "green" : r.action === "Unpublish" ? "red" : "gold"}>{r.action}</Badge> <span className="ml-2 text-cream">{r.note}</span><p className="mt-1 text-xs text-muted">{r.changedBy} · {fmtDate(r.createdAt)}</p></div>
          <Button size="sm" variant="subtle" onClick={async () => { try { await api.post(`/api/admin/content/history/${r.id}/restore`); toast("Revision loaded into your draft. Review it, then publish."); reload(); onSaved(); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } }}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Restore to draft</Button>
        </li>
      ))}
    </ul>
  );
}

export default function AdminContent() {
  const [v, setV] = React.useState(0);
  const bump = () => setV((x) => x + 1);
  return (
    <>
      <PageHeader title="Content Management" subtitle="Control what customers see. Save drafts, preview, then publish." />
      <PublishBar refreshKey={v} onChanged={bump} />
      <Tabs defaultValue="homepage">
        <TabsList><TabsTrigger value="homepage">Homepage sections</TabsTrigger><TabsTrigger value="pages">Pages &amp; events</TabsTrigger><TabsTrigger value="history">Change history</TabsTrigger></TabsList>
        <TabsContent value="homepage" key={`h${v}`}><HomepageTab onSaved={bump} /></TabsContent>
        <TabsContent value="pages" key={`p${v}`}><PagesTab onSaved={bump} /></TabsContent>
        <TabsContent value="history"><HistoryTab onSaved={bump} version={v} /></TabsContent>
      </Tabs>
    </>
  );
}
