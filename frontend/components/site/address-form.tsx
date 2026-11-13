"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { api, ApiError } from "@/services/api";
import type { Address } from "@/lib/types";

type Draft = Omit<Address, "id">;
const empty: Draft = { label: "Home", recipient: "", phone: "", line1: "", line2: "", city: "", postalCode: "", notes: "", isDefault: false };

export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [f, setF] = React.useState<Draft>(initial ? { ...initial } : empty);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try {
        const body = { ...f, line2: f.line2 || null, postalCode: f.postalCode || null, notes: f.notes || null };
        onSaved(initial ? await api.put<Address>(`/api/account/addresses/${initial.id}`, body) : await api.post<Address>("/api/account/addresses", body));
      } catch (err) { setError(err instanceof ApiError ? err.message : "Could not save address."); }
      finally { setBusy(false); }
    }}>
      <div className="sm:col-span-2"><FormError message={error} /></div>
      <Field label="Label"><Input required maxLength={40} value={f.label} onChange={set("label")} placeholder="Home, Office…" /></Field>
      <Field label="Recipient"><Input required maxLength={120} value={f.recipient} onChange={set("recipient")} /></Field>
      <Field label="Phone"><Input required type="tel" maxLength={30} value={f.phone} onChange={set("phone")} /></Field>
      <Field label="City"><Input required maxLength={100} value={f.city} onChange={set("city")} /></Field>
      <Field label="Street address" className="sm:col-span-2"><Input required maxLength={200} value={f.line1} onChange={set("line1")} /></Field>
      <Field label="Unit / building (optional)"><Input maxLength={200} value={f.line2 ?? ""} onChange={set("line2")} /></Field>
      <Field label="Postal code (optional)"><Input maxLength={20} value={f.postalCode ?? ""} onChange={set("postalCode")} /></Field>
      <Field label="Delivery notes (optional)" className="sm:col-span-2"><Input maxLength={300} value={f.notes ?? ""} onChange={set("notes")} placeholder="Landmarks, gate code…" /></Field>
      <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2"><input type="checkbox" className="accent-[var(--gold)]" checked={f.isDefault} onChange={(e) => setF((x) => ({ ...x, isDefault: e.target.checked }))} />Make this my default address</label>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={busy}>Save address</Button>{onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}</div>
    </form>
  );
}
