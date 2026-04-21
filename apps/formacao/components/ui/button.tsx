"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
          "h-10 px-4 py-2",
          variant === "default" && "bg-slate-900 text-white hover:bg-slate-800",
          variant === "outline" && "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
          variant === "ghost" && "bg-transparent text-slate-700 hover:bg-slate-100",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

