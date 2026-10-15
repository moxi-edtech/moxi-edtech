import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NoticeTone = "neutral" | "attention" | "critical" | "success";
type NoticeProps = {
  title?: string;
  description?: ReactNode;
  eyebrow?: string;
  tone?: NoticeTone;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert" | "region";
};
/** Visual primitive only: financial and academic decisions stay in domain components. */
export function Notice({ title, description, eyebrow, tone = "neutral", action, children, className, role = "status" }: NoticeProps) {
  const border = { neutral: "border-slate-200", attention: "border-[#C8902A]/50", critical: "border-rose-300", success: "border-[#2B6044]/40" }[tone];
  return <section role={role} aria-label={title || eyebrow || "Aviso"} className={cn("relative mb-6 rounded-2xl border bg-white p-5 text-slate-900 sm:p-6", border, className)}>
    {eyebrow && <p className="mb-2 text-xs font-semibold text-[#2B6044]">{eyebrow}</p>}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {title && <h3 className="text-lg font-semibold leading-snug sm:text-xl">{title}</h3>}
        {description && <div className="mt-2 text-sm leading-relaxed text-slate-600">{description}</div>}
        {children}
      </div>
      {action && <div className="shrink-0 [&_a]:min-h-11 [&_button]:min-h-11 [&_a]:focus-visible:outline-2 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-[#2B6044]">{action}</div>}
    </div>
  </section>;
}
