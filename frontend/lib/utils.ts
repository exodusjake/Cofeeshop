import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(n);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

/** Only allow safe link targets coming from CMS content (no javascript: / data: URLs). */
export function safeHref(href?: string | null, fallback = "#") {
  if (!href) return fallback;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h) || /^tel:/i.test(h)) return h;
  return fallback;
}
