"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/misc";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[75vh] max-w-md place-items-center px-4 py-14">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full">
        <div className="mb-8 text-center"><h1 className="gold-text text-4xl">{title}</h1>{subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}</div>
        <Card className="p-7">{children}</Card>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </motion.div>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{message}</p> : null;
}

export function safeNext(next: string | null, fallback = "/account") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
