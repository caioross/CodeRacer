"use client";

import { cn } from "@/lib/utils";

// Button wrapped in a slowly-rotating conic-gradient border (docs §III.1).
// `className` sizes/positions the button; `innerClassName` styles the inner
// surface (text color, padding). Reduced-motion neutralizes the spin via the
// global CSS rule in globals.css.
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: string;
  innerClassName?: string;
};

export function StarBorder({
  children,
  className,
  innerClassName,
  color = "#00ff88",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "group relative inline-flex overflow-hidden rounded-lg p-[1.5px]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-[-200%] animate-cr-spin"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${color} 70deg, transparent 150deg, transparent 360deg)`
        }}
      />
      <span
        className={cn(
          "relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-[7px]",
          "bg-bg-card px-4 py-2 font-mono text-sm font-medium transition-colors",
          "group-hover:bg-bg-card/80",
          innerClassName
        )}
      >
        {children}
      </span>
    </button>
  );
}
