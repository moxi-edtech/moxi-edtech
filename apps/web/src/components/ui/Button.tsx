import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonTone =
  | "amber"
  | "blue"
  | "emerald"
  | "gray"
  | "green"
  | "gold"
  | "navy"
  | "neutral"
  | "ok"
  | "red"
  | "slate"
  | "teal"
  | "violet"
  | "warn"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  fullWidth?: boolean
  loading?: boolean
  tone?: ButtonTone
}

const toneClasses: Record<ButtonTone, string> = {
  amber: "bg-klasse-gold-500 text-white hover:bg-klasse-gold-600",
  blue: "bg-slate-600 text-white hover:bg-slate-700",
  emerald: "bg-klasse-green-600 text-white hover:bg-klasse-green-700",
  gray: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  green: "bg-klasse-green-600 text-white hover:bg-klasse-green-700",
  gold: "bg-klasse-gold text-white hover:bg-[#D4A32C]", // Using the color from TipoPresencaStep.tsx
  navy: "bg-slate-900 text-white hover:bg-slate-800",
  neutral: "bg-slate-200 text-slate-800 hover:bg-slate-300",
  ok: "bg-klasse-green-600 text-white hover:bg-klasse-green-700",
  red: "bg-red-600 text-white hover:bg-red-700",
  slate: "bg-slate-900 text-white hover:bg-slate-800",
  teal: "bg-teal-600 text-white hover:bg-teal-700",
  violet: "bg-violet-600 text-white hover:bg-violet-700",
  warn: "bg-klasse-gold-500 text-white hover:bg-klasse-gold-600",
}

const outlineToneClasses: Record<ButtonTone, string> = {
  amber: "border-klasse-gold-400 text-klasse-gold-700 hover:bg-klasse-gold-50",
  blue: "border-slate-500 text-slate-600 hover:bg-slate-50",
  emerald: "border-klasse-green-500 text-klasse-green-600 hover:bg-klasse-green-50",
  gray: "border-slate-300 text-slate-700 hover:bg-slate-50",
  green: "border-klasse-green-500 text-klasse-green-600 hover:bg-klasse-green-50",
  gold: "border-klasse-gold text-klasse-gold hover:bg-klasse-gold/10", // Using the color from TipoPresencaStep.tsx
  navy: "border-slate-700 text-slate-700 hover:bg-slate-50",
  neutral: "border-slate-300 text-slate-700 hover:bg-slate-50",
  ok: "border-klasse-green-500 text-klasse-green-600 hover:bg-klasse-green-50",
  red: "border-red-500 text-red-600 hover:bg-red-50",
  slate: "border-slate-700 text-slate-700 hover:bg-slate-50",
  teal: "border-teal-500 text-teal-600 hover:bg-teal-50",
  violet: "border-violet-500 text-violet-600 hover:bg-violet-50",
  warn: "border-klasse-gold-400 text-klasse-gold-700 hover:bg-klasse-gold-50",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, fullWidth, loading, tone, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const toneClass = tone
      ? variant === "outline"
        ? outlineToneClasses[tone]
        : toneClasses[tone]
      : ""
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          fullWidth ? "w-full" : "",
          toneClass
        )}
        ref={ref}
        disabled={props.disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
