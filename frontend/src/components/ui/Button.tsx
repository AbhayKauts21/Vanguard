import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

/* CLEO button variants — glass aesthetic. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cleo-cyan)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--cleo-cyan)] text-black hover:bg-[var(--cleo-cyan)]/80",
        ghost:
          "bg-transparent text-[var(--cleo-text-secondary)] hover:bg-[var(--cleo-bg-glass-hover)] hover:text-[var(--cleo-text-primary)]",
        outline:
          "border border-[var(--cleo-border)] bg-transparent text-[var(--cleo-text-secondary)] hover:border-[var(--cleo-border-hover)] hover:text-[var(--cleo-text-primary)]",
        glass:
          "border border-[var(--cleo-border)] bg-[var(--cleo-bg-glass)] text-[var(--cleo-text-primary)] backdrop-blur-sm hover:bg-[var(--cleo-bg-glass-hover)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-base",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/* Shared button primitive. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
