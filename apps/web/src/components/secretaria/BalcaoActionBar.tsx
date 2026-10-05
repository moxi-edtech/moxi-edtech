"use client";

import {
  BriefcaseBusiness,
  CreditCard,
  FileText,
  RefreshCcw,
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
} as const;

export function BalcaoActionBar({
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {getBalcaoWorkspaceActions().map((action) => {
          const Icon = ACTION_ICONS[action.id as keyof typeof ACTION_ICONS];
          const selected = value === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onChange(action.id)}
              className={[
                "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition",
                selected
                  ? "border-emerald/30 bg-emerald/10 text-emerald"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald/20 hover:bg-emerald/5 hover:text-emerald",
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
