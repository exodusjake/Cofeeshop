import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-wide transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        gold: "bg-gradient-to-r from-champagne via-gold to-champagne text-bg shadow-[0_0_24px_-6px_var(--gold)] hover:shadow-[0_0_32px_-2px_var(--gold)] hover:brightness-110",
        outline: "border border-gold/60 text-gold hover:bg-gold/10",
        ghost: "text-cream hover:bg-cream/10",
        subtle: "bg-surface-2 text-cream hover:bg-cream/15 border border-line",
        danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
      },
      size: { sm: "h-9 px-4", md: "h-11 px-6", lg: "h-12 px-8 text-base", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
        {asChild ? children : (<>{loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}</>)}
      </Comp>
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
