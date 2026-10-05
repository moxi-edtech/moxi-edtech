"use client";

import {
  BriefcaseBusiness,
  CreditCard,
  FileText,
  RefreshCcw,
  UserRound,
  GraduationCap,
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
  profile: UserRound,
  grade: GraduationCap,
} as const;

export function CommandCenterActionBar({
  value,
  onChange,
  label = "O que deseja fazer?",
}: {
  value: BalcaoActionId;
  onChange: (actionId: BalcaoActionId) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {getBalcaoWorkspaceActions().map((action) => {
          const Icon = ACTION_ICONS[action.id as keyof typeof ACTION_ICONS];
          const selected = value === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onChange(action.id)}
              className={[
                "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition",
                selected
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-900",
              ].join(" ")}
              title={action.description}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
