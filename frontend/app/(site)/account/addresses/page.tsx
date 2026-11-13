"use client";
import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, ConfirmButton, EmptyState, ErrorState, PageLoader } from "@/components/ui/misc";
import { AddressForm } from "@/components/site/address-form";
import { useApi, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import type { Address } from "@/lib/types";

export default function Addresses() {
  const { data, error, loading, reload } = useApi<Address[]>("/api/account/addresses");
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<Address | "new" | null>(null);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="gold-text text-4xl">Saved Addresses</h1>{!editing && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden />Add address</Button>}</div>
      {editing && <Card className="p-6"><h2 className="mb-4 text-2xl">{editing === "new" ? "New address" : "Edit address"}</h2>
        <AddressForm initial={editing === "new" ? undefined : editing} onSaved={() => { setEditing(null); reload(); toast("Address saved."); }} onCancel={() => setEditing(null)} /></Card>}
      {data && data.length === 0 && !editing && <EmptyState title="No saved addresses" text="Add one to speed up delivery checkout." />}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between"><h3 className="text-xl">{a.label}</h3>{a.isDefault && <Badge>Default</Badge>}</div>
            <p className="mt-2 text-sm text-muted">{a.recipient} · {a.phone}<br />{[a.line1, a.line2, a.city, a.postalCode].filter(Boolean).join(", ")}</p>
            {a.notes && <p className="mt-1 text-xs italic text-muted">{a.notes}</p>}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="subtle" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Button>
              <ConfirmButton size="sm" variant="danger" message="Delete this address?" onConfirm={async () => { try { await api.del(`/api/account/addresses/${a.id}`); reload(); } catch (e) { toast(e instanceof ApiError ? e.message : "Could not delete.", "err"); } }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</ConfirmButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
