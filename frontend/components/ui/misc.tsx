"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card-lux", className)} {...p} />;
}

export function Badge({ className, tone = "gold", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "gold" | "green" | "red" | "gray" | "blue" }) {
  const tones = {
    gold: "bg-gold/15 text-gold border-gold/30",
    green: "bg-success/15 text-success border-success/30",
    red: "bg-danger/15 text-danger border-danger/30",
    gray: "bg-cream/10 text-muted border-cream/15",
    blue: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-cream/10", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-label="Loading" className={cn("h-5 w-5 animate-spin text-gold", className)} />;
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card-lux mx-auto my-10 flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card-lux flex flex-col items-center gap-2 p-10 text-center">
      <h3 className="text-xl text-cream">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export const Switch = React.forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...p }, ref) => (
    <SwitchPrimitive.Root ref={ref} className={cn("peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-line bg-cream/15 transition-colors data-[state=checked]:bg-gold focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-50", className)} {...p}>
      <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-cream shadow transition-transform data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-bg" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = "Switch";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <DialogPrimitive.Content className={cn("card-lux fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-surface p-6 shadow-2xl", className)}>
        <DialogPrimitive.Title className="text-2xl text-cream">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className={description ? "mt-1 text-sm text-muted" : "sr-only"}>{description ?? title}</DialogPrimitive.Description>
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close aria-label="Close" className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-cream"><X className="h-5 w-5" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;
export const TabsList = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn("scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-line", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn("-mb-px whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm text-muted transition-colors hover:text-cream data-[state=active]:border-gold data-[state=active]:text-gold", className)} {...p} />
);

export function ConfirmButton({ children, onConfirm, message, ...p }: React.ComponentProps<typeof Button> & { onConfirm: () => void; message: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button {...p}>{children}</Button></DialogTrigger>
      <DialogContent title="Are you sure?" description={message}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button variant="danger" onClick={() => { setOpen(false); onConfirm(); }}>Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
