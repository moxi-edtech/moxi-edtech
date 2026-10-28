import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  badge?: ReactNode;
  className?: string;
};

/** Small, readable headings. No shouting uppercase microcopy on mobile. */
export function SectionTitle({ children, action, onAction, badge, className = "" }: Props) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-semibold leading-5 text-foreground">{children}</span>
        {badge}
      </div>
      {action && onAction && (
        <button onClick={onAction} type="button"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted">
          {action} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
