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

export { Alert, AlertTitle, AlertDescription }

/**
 * Notice is the shared presentation layer for contextual school messages.
 * Domain components resolve status, permissions and actions before rendering it.
 * The existing Alert primitive is retained for backwards compatibility.
 */
export type NoticeTone = "neutral" | "attention" | "critical" | "success";
export type NoticeProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  detail?: React.ReactNode;
  tone?: NoticeTone;
  className?: string;
  children?: React.ReactNode;
  role?: "status" | "alert" | "region";
};
const noticeTones: Record<NoticeTone,string> = {
  neutral: "border-border bg-card",
  attention: "border-amber/40 bg-card text-foreground",
  critical: "border-destructive/40 bg-card text-foreground",
  success: "border-emerald/30 bg-card text-foreground",
};
export function Notice({title,description,eyebrow,icon,action,detail,tone="neutral",className,children,role="region"}: NoticeProps) {
  return (
    <section role={role} aria-label={typeof title === "string" ? title : undefined}
      className={cn("min-w-0 rounded-2xl border p-5 sm:p-6",noticeTones[tone],className)}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          {(eyebrow || icon) && <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
            {eyebrow && <span>{eyebrow}</span>}
          </div>}
          <h3 className="break-words text-lg font-semibold leading-snug tracking-tight text-foreground">{title}</h3>
          {description && <div className="text-sm leading-6 text-muted-foreground">{description}</div>}
          {detail && <div className="pt-1 text-sm leading-6 text-muted-foreground">{detail}</div>}
        </div>
        {action && <div className="flex shrink-0 items-center sm:self-center [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_button]:min-h-11 [&_button]:rounded-xl [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2">{action}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}
