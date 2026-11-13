"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { AuthShell, FormError, safeNext } from "@/components/site/auth-ui";
import { useAuth, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";

function SignInForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unverified, setUnverified] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to order, track and earn rewards."
      footer={<>New to Nocturne? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-gold hover:underline">Create an account</Link></>}>
      <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null); setUnverified(false);
        try {
          const u = await login(email.trim(), password, remember);
          router.push(safeNext(next, u.roles.includes("Admin") ? "/admin" : "/account"));
        } catch (err) {
          const ae = err as ApiError;
          setError(ae.message ?? "Could not sign in."); setUnverified(ae.code === "email_not_confirmed");
        } finally { setBusy(false); }
      }}>
        <FormError message={error} />
        {unverified && <Button type="button" variant="outline" size="sm" onClick={async () => { await api.post("/api/auth/resend-confirmation", { email }); toast("Verification email sent."); }}>Resend verification email</Button>}
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted"><input type="checkbox" className="accent-[var(--gold)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
          <Link href="/forgot-password" className="text-gold hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={busy}>Sign In</Button>
      </form>
    </AuthShell>
  );
}

export default function SignInPage() { return <React.Suspense><SignInForm /></React.Suspense>; }
