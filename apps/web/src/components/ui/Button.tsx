"use client";

import type { ButtonHTMLAttributes } from 'react';

type Tone = "teal" | "green" | "blue" | "red" | "gray" | "emerald" | "navy";
type Variant = "solid" | "outline" | "default" | "danger" | "ghost" | "secondary";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const solidByTone: Record<Tone, { bg: string; hover: string; ring: string; text?: string }> = {
  teal: { bg: "bg-teal-600", hover: "hover:bg-teal-700", ring: "focus-visible:ring-teal-600/60" },
  green: { bg: "bg-green-600", hover: "hover:bg-green-700", ring: "focus-visible:ring-green-600/60" },
  blue: { bg: "bg-blue-600", hover: "hover:bg-blue-700", ring: "focus-visible:ring-blue-600/60" },
  red: { bg: "bg-red-600", hover: "hover:bg-red-700", ring: "focus-visible:ring-red-600/60" },
  gray: { bg: "bg-gray-600", hover: "hover:bg-gray-700", ring: "focus-visible:ring-gray-600/60" },
  emerald: { bg: "bg-emerald-600", hover: "hover:bg-emerald-700", ring: "focus-visible:ring-emerald-600/60" },
  navy: { bg: "bg-moxinexa-navy", hover: "hover:bg-moxinexa-navy/90", ring: "focus-visible:ring-moxinexa-navy/60" },
};

const outlineByTone: Record<Tone, { base: string; hover: string; ring: string; text: string; border: string }> = {
  teal: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
  green: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
  blue: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
  red: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
  gray: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
  emerald: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
  navy: { base: "bg-white", hover: "hover:bg-gray-50", ring: "focus-visible:ring-gray-400/60", text: "text-gray-700", border: "border border-gray-300" },
};

const sizeMap: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-6 py-3",
  lg: "px-8 py-3 text-base",
};

export default function Button({
  tone = "navy",
  variant = "solid",
  size = "md",
  fullWidth,
  className,
  disabled,
  loading,
  children,
  ...rest
}: ButtonProps) {
  const base = "rounded-lg transition-colors focus:outline-none focus-visible:ring-2 inline-flex items-center justify-center gap-2 font-medium";

  const sizing = sizeMap[size];

  const disabledStyles = disabled || loading
    ? "disabled:bg-gray-200 disabled:text-gray-500 disabled:border disabled:border-gray-300 disabled:shadow-none disabled:hover:bg-gray-200 disabled:cursor-not-allowed"
    : "";

  const toneStyles = variant === "solid"
    ? `${solidByTone[tone].bg} ${solidByTone[tone].hover} text-white ${solidByTone[tone].ring}`
    : variant === "danger"
    ? "bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-600/60"
    : variant === "ghost"
    ? "bg-transparent hover:bg-gray-100 text-gray-700 focus-visible:ring-gray-400/60"
    : `${outlineByTone[tone].base} ${outlineByTone[tone].hover} ${outlineByTone[tone].ring} ${outlineByTone[tone].text} ${outlineByTone[tone].border}`;

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(base, sizing, toneStyles, disabledStyles, fullWidth ? "w-full" : "", className)}
    >
      {loading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>}
      {children}
    </button>
  );
}
