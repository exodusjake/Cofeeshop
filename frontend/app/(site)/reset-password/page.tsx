"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { AuthShell, FormError } from "@/components/site/auth-ui";
import { api, ApiError } from "@/services/api";

function ResetForm() {
  const sp = useSearchParams();
  const email = sp.get("email") ?? ""; const token = sp.get("token") ?? "";
  const [pw, setPw] = React.useState(""); const [confirm, setConfirm] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const mismatch = confirm.length > 0 && pw !== confirm;

  if (!email || !token) return <AuthShell title="Invalid link"><p className="text-center text-muted">This reset link is incomplete. <Link href="/forgot-password" className="text-gold hover:underline">Request a new one</Link>.</p></AuthShell>;
  return (
    <AuthShell title="Choose a new password">
      {msg ? <div className="space-y-4 text-center"><p className="text-muted" role="status">{msg}</p><Button asChild><Link href="/signin">Sign In</Link></Button></div> : (
        <form className="space-y-5" onSubmit={async (e) => {
          e.preventDefault(); if (mismatch) return; setBusy(true); setError(null);
          try { setMsg((await api.post<{ message: string }>("/api/auth/reset-password", { email, token, newPassword: pw })).message); }
          catch (err) { setError(err instanceof ApiError ? err.message : "Could not reset password."); }
          finally { setBusy(false); }
        }}>
          <FormError message={error} />
          <Field label="New password" hint="At least 8 characters with upper-case, lower-case and a number."><Input type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Confirm password" error={mismatch ? "Passwords do not match." : undefined}><Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <Button type="submit" className="w-full" size="lg" loading={busy} disabled={mismatch}>Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
export default function ResetPasswordPage() { return <React.Suspense><ResetForm /></React.Suspense>; }
