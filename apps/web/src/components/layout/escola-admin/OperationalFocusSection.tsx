"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ClipboardCheck,
  FileClock,
  Layers3,
  ShieldAlert,
  UserRoundSearch,
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import type { OperationalSnapshot } from "./dashboard.types";

type Props = {
  escolaId: string;
  snapshot: OperationalSnapshot;
};

type FocusCard = {
  key: string;
  label: string;
  value: number;
  description: string;
  href: string;
  cta: string;
  icon: React.ElementType;
  tone: string;
};

function FocusMetricCard({ card }: { card: FocusCard }) {
  const Icon = card.icon;
  const isZero = card.value === 0;

  return (
    <Link
      href={card.href}
      className="group flex h-[104px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 shadow-none hover:shadow-none"
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {card.label}
        </span>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] ${
            isZero ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {isZero ? "Estável" : "Acção"}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p className="text-[28px] font-black leading-none tracking-tight text-slate-900">
          {card.value}
        </p>
        <div className={`flex items-center justify-center rounded-lg p-1.5 transition-transform group-hover:scale-105 ${card.tone}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Link>
  );
}

export default function OperationalFocusSection({ escolaId, snapshot }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const horarioQuadroHref = snapshot.primeiraTurmaSemHorarioPublicadoId
    ? buildPortalHref(escolaParam, `/operacoes/horarios/quadro?turmaId=${snapshot.primeiraTurmaSemHorarioPublicadoId}`)
    : buildPortalHref(escolaParam, "/operacoes/horarios/quadro");

  const cards: FocusCard[] = [
    {
      key: "pendentes",
      label: "Cobranças Pendentes",
      value: snapshot.mensalidadesPendentes,
      description: "Mensalidades em aberto que ainda podem ser tratadas sem escalonamento.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas-alunos"),
      cta: "Ver mensalidades",
      icon: Banknote,
      tone: "bg-[#1F6B3B]/10 text-[#1F6B3B]",
    },
    {
      key: "admissoes",
      label: "Admissões Pendentes",
      value: snapshot.admissoesPendentes,
      description: "Candidaturas que ainda precisam de análise, aprovação ou fecho de conversão.",
      href: buildPortalHref(escolaParam, "/operacoes/admissoes"),
      cta: "Abrir admissões",
      icon: UserRoundSearch,
      tone: "bg-[#1F6B3B]/10 text-[#1F6B3B]",
    },
    {
      key: "matriculas",
      label: "Matrículas Pendentes",
      value: snapshot.matriculasPendentes,
      description: "Registos ainda em rascunho, pendentes ou indefinidos antes de entrar na rotina normal.",
      href: buildPortalHref(escolaParam, "/operacoes/matriculas"),
      cta: "Tratar matrículas",
      icon: ClipboardCheck,
      tone: "bg-[#1F6B3B]/10 text-[#1F6B3B]",
    },
    {
      key: "documentos",
      label: "Documentos em Fila",
      value: snapshot.documentosEmProcessamento,
      description: "Lotes de pautas, boletins ou certificados ainda em processamento.",
      href: buildPortalHref(escolaParam, "/operacoes/documentos-oficiais"),
      cta: "Ver documentos",
      icon: FileClock,
      tone: "bg-[#1F6B3B]/10 text-[#1F6B3B]",
    },
    {
      key: "inadimplencia",
      label: "Em Atraso",
      value: snapshot.mensalidadesInadimplentes,
      description: "Casos que já exigem contacto activo ou negociação com o encarregado.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas-alunos"),
      cta: "Ver carteira",
      icon: ShieldAlert,
      tone: "bg-[#E3B23C]/10 text-[#E3B23C]",
    },
    {
      key: "turmas",
      label: "Turmas Pendentes",
      value: snapshot.turmasPendentes,
      description: "Turmas ainda precisam de validação para liberar rotina académica e cobrança.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas"),
      cta: "Revisar turmas",
      icon: Layers3,
      tone: "bg-[#1F6B3B]/10 text-[#1F6B3B]",
    },
    {
      key: "horarios",
      label: "Sem Horário Publicado",
      value: snapshot.turmasSemHorarioPublicado,
      description: "Turmas activas ainda sem versão publicada do quadro oficial.",
      href: horarioQuadroHref,
      cta: "Publicar quadro",
      icon: CalendarClock,
      tone: "bg-[#E3B23C]/10 text-[#E3B23C]",
    },
    {
      key: "setup",
      label: "Bloqueios de Setup",
      value: snapshot.setupBlockers + snapshot.curriculoHorarioPendencias,
      description: "Pendências estruturais que ainda geram atrito operacional no arranque.",
      href: buildPortalHref(escolaParam, "/operacoes/configuracoes"),
      cta: "Finalizar setup",
      icon: AlertTriangle,
      tone: "bg-[#E3B23C]/10 text-[#E3B23C]",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Foco da Operação
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Filas e bloqueios que realmente movem a escola no dia-a-dia.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {cards.map((card) => (
          <FocusMetricCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
