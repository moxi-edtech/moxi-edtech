"use client";

import { useEffect, useRef } from "react";
import {
  BriefcaseBusiness,
  CreditCard,
  FileText,
  RefreshCcw,
  UserRound,
  GraduationCap,
  UserPlus,
} from "lucide-react";

import {
  getBalcaoWorkspaceActions,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";

const ACTION_ICONS = {
  desk: BriefcaseBusiness,
  payment: CreditCard,
  document: FileText,
  reenrollment: RefreshCcw,
  enrollment: UserPlus,
  profile: UserRound,
  grade: GraduationCap,
} as const;

export function CommandCenterActionBar({
  value,
  onChange,
  label = "O que deseja fazer?",
  hasStudent = true,
}: {
  value: BalcaoActionId;
  onChange: (actionId: BalcaoActionId) => void;
  label?: string;
  hasStudent?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const active = scroller.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!active) return;

    const targetLeft =
      active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
    scroller.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [value]);

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <div
        ref={scrollerRef}
        className="flex min-w-0 flex-wrap gap-1 rounded-xl bg-slate-100 p-1 max-lg:flex-nowrap max-lg:overflow-x-auto"
      >
        {getBalcaoWorkspaceActions()
          .filter((action) => hasStudent || !action.requiresStudent)
          .map((action) => {
          const Icon = ACTION_ICONS[action.id as keyof typeof ACTION_ICONS];
          const selected = value === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onChange(action.id)}
              aria-pressed={selected}
              className={[
                "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3B23C]",
                selected
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-900",
              ].join(" ")}
              title={action.description}
            >
              <Icon className={["h-3.5 w-3.5", selected ? "text-amber" : ""].join(" ")} />
              {action.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
