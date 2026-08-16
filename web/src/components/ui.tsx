"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn, initials } from "@/src/lib/utils";

/* ---------------- Button ---------------- */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-brand-primary text-white hover:bg-brand-onTertiary",
        light: "bg-white text-ink border-[1.5px] border-ink-muted/40 hover:bg-surface-alt",
        ghost: "bg-transparent text-ink hover:bg-surface-alt",
        danger: "bg-danger text-white hover:brightness-95",
        dark: "bg-ink text-white hover:bg-ink-soft",
      },
      size: {
        md: "h-11 px-5 text-[15px]",
        lg: "h-13 px-8 text-base h-[52px]",
        sm: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ---------------- Input ---------------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink placeholder:text-ink-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-ink-soft", className)} {...props} />;
}

/* ---------------- Card ---------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-white shadow-soft", className)} {...props} />;
}

/* ---------------- Spinner ---------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-6 w-6 animate-spin text-brand-primary", className)} />;
}

export function FullSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || "avatar"}
        style={{ width: size, height: size }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        "flex items-center justify-center rounded-full bg-brand-tertiary font-bold text-brand-onTertiary",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "muted" | "danger";
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-tertiary text-brand-onTertiary",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    muted: "bg-surface-alt text-ink-muted",
    danger: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)}>
      {children}
    </span>
  );
}
