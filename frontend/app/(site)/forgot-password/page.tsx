"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { AuthShell, FormError } from "@/components/site/auth-ui";
import { api, ApiError } from "@/services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <AuthShell title="Forgot password?" subtitle="We'll email you a link to choose a new one." footer={<Link href="/signin" className="text-gold hover:underline">Back to sign in</Link>}>
      {msg ? <p className="text-center text-muted" role="status">{msg}</p> : (
        <form className="space-y-5" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { setMsg((await api.post<{ message: string }>("/api/auth/forgot-password", { email: email.trim() })).message); }
          catch (err) { setError(err instanceof ApiError ? err.message : "Something went wrong."); }
          finally { setBusy(false); }
        }}>
          <FormError message={error} />
          <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" className="w-full" size="lg" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
