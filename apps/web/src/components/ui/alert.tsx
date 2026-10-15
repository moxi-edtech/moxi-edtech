import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

type NoticeProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  detail?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  tone?: "neutral" | "attention" | "critical" | "success"
}
const Notice = React.forwardRef<HTMLElement, NoticeProps>(({title,description,eyebrow,detail,action,icon,tone="neutral",className,...props},ref)=>(
  <section ref={ref} className={cn("min-w-0 rounded-2xl border bg-white p-5 sm:p-6",{
    "border-slate-200":tone==="neutral",
    "border-[#C8902A]/50":tone==="attention",
    "border-rose-300":tone==="critical",
    "border-[#2B6044]/40":tone==="success",
  },className)} {...props}>
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
      {icon&&<span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#2B6044]">{icon}</span>}
      <div className="min-w-0 flex-1">
        {eyebrow&&<p className="mb-2 text-xs font-semibold text-slate-600">{eyebrow}</p>}
        <h3 className="text-lg font-semibold leading-snug text-slate-950 sm:text-xl">{title}</h3>
        {description&&<div className="mt-2 text-sm leading-relaxed text-slate-700">{description}</div>}
        {detail&&<div className="mt-3 text-sm text-slate-700">{detail}</div>}
      </div>
    </div>
    {action&&<div className="mt-5 flex flex-wrap items-center gap-3 sm:pl-14">{action}</div>}
  </section>
))
Notice.displayName="Notice"
export { Alert, AlertTitle, AlertDescription, Notice }
