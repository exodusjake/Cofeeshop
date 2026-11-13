"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, PageLoader } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";
import { FormError } from "@/components/site/auth-ui";
import { useApi, useAuth, useToast } from "@/components/providers";
import { api, ApiError } from "@/services/api";
import { fmtDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const { data, error, loading, reload } = useApi<Profile>("/api/account/profile");
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [f, setF] = React.useState({ fullName: "", phone: "", birthday: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (data) setF({ fullName: data.fullName, phone: data.phone ?? "", birthday: data.birthday ?? "" }); }, [data]);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? "Could not load profile."} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <h1 className="gold-text text-4xl">Profile</h1>
      <Card className="p-6">
        <form className="grid gap-5 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr(null);
          try { await api.put("/api/account/profile", { fullName: f.fullName, phone: f.phone || null, birthday: f.birthday || null }); await refresh(); reload(); toast("Profile updated."); }
          catch (x) { setErr(x instanceof ApiError ? x.message : "Could not update profile."); } finally { setBusy(false); }
        }}>
          <div className="sm:col-span-2"><FormError message={err} /></div>
          <Field label="Full name"><Input required minLength={2} maxLength={120} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="Email" hint="Email can't be changed here."><Input value={data.email} disabled /></Field>
          <Field label="Phone"><Input type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Birthday"><Input type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Button type="submit" loading={busy}>Save changes</Button></div>
        </form>
      </Card>
      <p className="text-xs text-muted">Member since {fmtDate(data.memberSince)}</p>
    </div>
  );
}
