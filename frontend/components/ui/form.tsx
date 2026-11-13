import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border border-line bg-bg/60 px-4 text-sm text-cream placeholder:text-muted/60 transition-colors focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, "h-11", className)} {...p} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "min-h-24 py-3", className)} {...p} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) => (
    <select ref={ref} className={cn(field, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 fill=%22none%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23D5AC70%22 stroke-width=%221.5%22/></svg>')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10", className)} {...p}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Label = React.forwardRef<React.ComponentRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(
  ({ className, ...p }, ref) => <LabelPrimitive.Root ref={ref} className={cn("mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted", className)} {...p} />,
);
Label.displayName = "Label";

/** Label + control + error text in one go. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
