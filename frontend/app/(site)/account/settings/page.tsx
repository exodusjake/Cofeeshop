"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { useAuth, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = React.useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const mismatch = f.confirm.length > 0 && f.next !== f.confirm;
  return (
    <div className="space-y-6">
      <h1 className="gold-text text-4xl">Account Settings</h1>
      <Card className="p-6">
        <h2 className="mb-1 text-2xl">Change password</h2><p className="mb-5 text-sm text-muted">Signed in as {user?.email}</p>
        <form className="grid max-w-md gap-5" onSubmit={async (e) => {
          e.preventDefault(); if (mismatch) return; setBusy(true); setErr(null);
          try { await api.post("/api/auth/change-password", { currentPassword: f.current, newPassword: f.next }); setF({ current: "", next: "", confirm: "" }); toast("Password changed."); }
          catch (x) { setErr(x instanceof ApiError ? x.message : "Could not change password."); } finally { setBusy(false); }
        }}>
          <FormError message={err} />
          <Field label="Current password"><Input type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters with upper-case, lower-case and a number."><Input type="password" autoComplete="new-password" required minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
          <Field label="Confirm new password" error={mismatch ? "Passwords do not match." : undefined}><Input type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
          <Button type="submit" loading={busy} disabled={mismatch}>Update password</Button>
        </form>
      </Card>
      <Card className="p-6"><h2 className="mb-3 text-2xl">Session</h2><Button variant="danger" onClick={async () => { await logout(); router.push("/"); }}>Sign out</Button></Card>
    </div>
  );
}
