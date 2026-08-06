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
      className="group flex flex-col justify-between min-h-[128px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-md hover:translate-y-[-1px]"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 line-clamp-1">
            {card.label}
          </span>
          <span
            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              isZero ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "bg-amber-50 text-amber-700 border border-amber-200/50"
            }`}
          >
            {isZero ? "Estável" : "Acção"}
          </span>
        </div>

        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
          {card.description}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
        <div>
          <p className="text-2xl font-black leading-none tracking-tight text-slate-900 font-sora">
            {card.value}
          </p>
          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-[#1F6B3B] transition-colors mt-1 inline-block">
            {card.cta} &rarr;
          </span>
        </div>
        <div className={`flex items-center justify-center rounded-xl p-2.5 transition-transform group-hover:scale-105 ${card.tone}`}>
          <Icon className="h-5 w-5" />
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
      tone: "bg-klasse-green/10 text-klasse-green",
    },
    {
      key: "admissoes",
      label: "Admissões Pendentes",
      value: snapshot.admissoesPendentes,
      description: "Candidaturas que ainda precisam de análise, aprovação ou fecho de conversão.",
      href: buildPortalHref(escolaParam, "/operacoes/admissoes"),
      cta: "Abrir admissões",
      icon: UserRoundSearch,
      tone: "bg-klasse-green/10 text-klasse-green",
    },
    {
      key: "matriculas",
      label: "Matrículas Pendentes",
      value: snapshot.matriculasPendentes,
      description: "Registos ainda em rascunho ou pendentes antes de entrar na rotina normal.",
      href: buildPortalHref(escolaParam, "/operacoes/matriculas"),
      cta: "Tratar matrículas",
      icon: ClipboardCheck,
      tone: "bg-klasse-green/10 text-klasse-green",
    },
    {
      key: "documentos",
      label: "Documentos em Fila",
      value: snapshot.documentosEmProcessamento,
      description: "Lotes de pautas, boletins ou certificados ainda em processamento.",
      href: buildPortalHref(escolaParam, "/operacoes/documentos-oficiais"),
      cta: "Ver documentos",
      icon: FileClock,
      tone: "bg-klasse-green/10 text-klasse-green",
    },
    {
      key: "inadimplencia",
      label: "Em Atraso",
      value: snapshot.mensalidadesInadimplentes,
      description: "Casos que já exigem contacto activo ou negociação com o encarregado.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas-alunos"),
      cta: "Ver carteira",
      icon: ShieldAlert,
      tone: "bg-klasse-gold/10 text-klasse-gold",
    },
    {
      key: "turmas",
      label: "Turmas Pendentes",
      value: snapshot.turmasPendentes,
      description: "Turmas que ainda precisam de validação para liberar a rotina académica.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas"),
      cta: "Revisar turmas",
      icon: Layers3,
      tone: "bg-klasse-green/10 text-klasse-green",
    },
    {
      key: "horarios",
      label: "Sem Horário Publicado",
      value: snapshot.turmasSemHorarioPublicado,
      description: "Turmas activas ainda sem versão publicada do quadro oficial de horários.",
      href: horarioQuadroHref,
      cta: "Publicar quadro",
      icon: CalendarClock,
      tone: "bg-klasse-gold/10 text-klasse-gold",
    },
    {
      key: "setup",
      label: "Bloqueios de Setup",
      value: snapshot.setupBlockers + snapshot.curriculoHorarioPendencias,
      description: "Pendências estruturais que ainda geram atrito no arranque do ano.",
      href: buildPortalHref(escolaParam, "/operacoes/configuracoes"),
      cta: "Finalizar setup",
      icon: AlertTriangle,
      tone: "bg-klasse-gold/10 text-klasse-gold",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 font-sora">
            Foco da Operação
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Filas e bloqueios que realmente movem a escola no dia-a-dia.
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <FocusMetricCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
