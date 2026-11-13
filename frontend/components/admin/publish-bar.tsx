"use client";
import * as React from "react";
import { Eye, Rocket, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmButton } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { fmtDate } from "@/lib/utils";
import type { Homepage } from "@/lib/types";

/** Shared draft/publish controls. Draft edits are invisible to customers until Publish is pressed. */
export function PublishBar({ refreshKey = 0, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const { toast } = useToast();
  const { data, reload } = useApi<Homepage>("/api/admin/content/homepage", [refreshKey]);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (kind: "publish" | "unpublish") => {
    setBusy(kind);
    try { await api.post(`/api/admin/content/${kind}`, { note: note.trim() || null }); toast(kind === "publish" ? "Published! Customers now see your changes." : "Homepage unpublished."); setNote(""); reload(); onChanged?.(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Failed.", "err"); } finally { setBusy(null); }
  };

  return (
    <div className="card-lux sticky top-14 z-20 mb-6 flex flex-wrap items-center gap-3 border-gold/30 bg-surface/95 p-4 backdrop-blur lg:top-2">
      <div className="mr-auto flex flex-wrap items-center gap-2 text-sm">
        {data?.isPublished ? <Badge tone="green">Live</Badge> : <Badge tone="red">Unpublished</Badge>}
        {data?.hasUnpublishedChanges ? <Badge>Unpublished changes</Badge> : <Badge tone="gray">Up to date</Badge>}
        {data?.lastPublishedAt && <span className="text-xs text-muted">Last published {fmtDate(data.lastPublishedAt)}</span>}
      </div>
      <Input aria-label="Publish note" placeholder="Change note (optional)" className="h-9 w-56" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button variant="subtle" size="sm" onClick={() => window.open("/admin/preview", "_blank")}><Eye className="h-4 w-4" aria-hidden />Preview</Button>
      <Button size="sm" loading={busy === "publish"} onClick={() => run("publish")}><Rocket className="h-4 w-4" aria-hidden />Publish</Button>
      {data?.isPublished && <ConfirmButton size="sm" variant="danger" message="Unpublish the homepage? Visitors will see a 'be right back' page until you publish again." onConfirm={() => run("unpublish")}><EyeOff className="h-4 w-4" aria-hidden />Unpublish</ConfirmButton>}
    </div>
  );
}
