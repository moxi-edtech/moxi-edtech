import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  badge?: ReactNode;
  className?: string;
};

export function SectionTitle({ children, action, onAction, badge, className = "" }: Props) {
  return (
    <div className={`flex items-center justify-between gap-2 px-0.5 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          {children}
        </span>
        {badge}
      </div>
      {action && (
        <button
          onClick={onAction}
          type="button"
          className="group inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
        >
          <span>{action}</span>
          <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
        </button>
      )}
    </div>
  );
}

