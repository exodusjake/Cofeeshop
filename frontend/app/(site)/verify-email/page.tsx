"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { AuthShell } from "@/components/site/auth-ui";
import { api, ApiError } from "@/services/api";

function Verify() {
  const sp = useSearchParams();
  const [state, setState] = React.useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = React.useState("");
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return; ran.current = true;
    const userId = sp.get("userId"), token = sp.get("token");
    if (!userId || !token) { setState("err"); setMsg("This verification link is incomplete."); return; }
    api.post<{ message: string }>("/api/auth/confirm-email", { userId, token })
      .then((r) => { setState("ok"); setMsg(r.message); })
      .catch((e) => { setState("err"); setMsg(e instanceof ApiError ? e.message : "Verification failed."); });
  }, [sp]);

  return (
    <AuthShell title="Email verification">
      <div className="space-y-4 text-center">
        {state === "loading" && <Spinner className="mx-auto h-8 w-8" />}
        {state === "ok" && <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />}
        {state === "err" && <XCircle className="mx-auto h-12 w-12 text-danger" aria-hidden />}
        <p className="text-muted" role="status">{state === "loading" ? "Verifying…" : msg}</p>
        {state !== "loading" && <Button asChild><Link href="/signin">Go to Sign In</Link></Button>}
      </div>
    </AuthShell>
  );
}
export default function VerifyEmailPage() { return <React.Suspense><Verify /></React.Suspense>; }
