"use client";

import { ExternalLink, GraduationCap, KeyRound, Wallet } from "lucide-react";

export type EnrollmentPostAction = "portal" | "notas" | "mensalidade";

type Props = {
  onAction: (action: EnrollmentPostAction) => void;
};

const actions: Array<{
  id: EnrollmentPostAction;
  label: string;
  description: string;
  icon: typeof KeyRound;
}> = [
  {
    id: "portal",
    label: "Liberar portal",
    description: "Gerar credenciais do aluno",
    icon: KeyRound,
  },
  {
    id: "notas",
    label: "Lançar notas",
    description: "Abrir o lançamento académico",
    icon: GraduationCap,
  },
  {
    id: "mensalidade",
    label: "Pagar mensalidade",
    description: "Registar a próxima cobrança",
    icon: Wallet,
  },
];

export function EnrollmentPostActions({ onAction }: Props) {
  return (
    <section className="rounded-2xl border border-[#1F6B3B]/15 bg-[#1F6B3B]/5 p-4 text-left">
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-[#1F6B3B]">Próximas ações</p>
        <p className="mt-1 text-xs text-slate-500">Continue o atendimento sem voltar ao menu.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {actions.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onAction(id)}
            className="group flex items-center gap-3 rounded-xl border border-white bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#1F6B3B]/30 hover:shadow-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1F6B3B]/10 text-[#1F6B3B]">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-800">{label}</span>
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">{description}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-[#1F6B3B]" />
          </button>
        ))}
      </div>
    </section>
  );
}
