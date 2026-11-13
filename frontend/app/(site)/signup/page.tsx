"use client";
import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { AuthShell, FormError } from "@/components/site/auth-ui";
import { useAuth } from "@/components/providers";
import { ApiError } from "@/services/api";

export default function SignUpPage() {
  const { register } = useAuth();
  const [f, setF] = React.useState({ fullName: "", email: "", password: "", confirm: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const mismatch = f.confirm.length > 0 && f.password !== f.confirm;

  if (done) return (
    <AuthShell title="Check your inbox">
      <div className="space-y-4 text-center"><MailCheck className="mx-auto h-12 w-12 text-gold" aria-hidden /><p className="text-muted">{done}</p>
        <Button asChild variant="outline"><Link href="/signin">Go to Sign In</Link></Button></div>
    </AuthShell>
  );

  return (
    <AuthShell title="Join Nocturne" subtitle="Create an account to order and earn rewards." footer={<>Already a member? <Link href="/signin" className="text-gold hover:underline">Sign in</Link></>}>
      <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault(); if (mismatch) return;
        setBusy(true); setError(null);
        try { const r = await register(f.fullName.trim(), f.email.trim(), f.password, f.confirm); setDone(r.message); }
        catch (err) { setError(err instanceof ApiError ? err.message : "Could not create account."); }
        finally { setBusy(false); }
      }}>
        <FormError message={error} />
        <Field label="Full name"><Input autoComplete="name" required minLength={2} maxLength={120} value={f.fullName} onChange={set("fullName")} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" required value={f.email} onChange={set("email")} /></Field>
        <Field label="Password" hint="At least 8 characters with upper-case, lower-case and a number."><Input type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set("password")} /></Field>
        <Field label="Confirm password" error={mismatch ? "Passwords do not match." : undefined}><Input type="password" autoComplete="new-password" required value={f.confirm} onChange={set("confirm")} /></Field>
        <Button type="submit" className="w-full" size="lg" loading={busy} disabled={mismatch}>Create Account</Button>
      </form>
    </AuthShell>
  );
}
