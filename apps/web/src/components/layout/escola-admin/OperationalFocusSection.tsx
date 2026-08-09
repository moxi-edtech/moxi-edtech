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
      title={card.description}
      className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-klasse-green/40 hover:shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${card.tone}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-600 truncate group-hover:text-slate-900 transition-colors">
            {card.label}
          </span>
        </div>
        {!isZero && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-klasse-green animate-pulse" />
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className={`text-2xl font-extrabold tracking-tight font-sora ${isZero ? "text-slate-400" : "text-slate-900"}`}>
          {card.value}
        </span>
        <span className="text-xs font-bold text-slate-300 group-hover:text-klasse-green transition-colors">
          &rarr;
        </span>
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
      tone: "bg-klasse-gold/15 text-klasse-gold-600",
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
      tone: "bg-klasse-gold/15 text-klasse-gold-600",
    },
    {
      key: "setup",
      label: "Bloqueios de Setup",
      value: snapshot.setupBlockers + snapshot.curriculoHorarioPendencias,
      description: "Pendências estruturais que ainda geram atrito no arranque do ano.",
      href: buildPortalHref(escolaParam, "/operacoes/configuracoes"),
      cta: "Finalizar setup",
      icon: AlertTriangle,
      tone: "bg-klasse-gold/15 text-klasse-gold-600",
    },
  ];

  return (
    <section className="space-y-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 font-sora">
            Foco da Operação
          </h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Filas e bloqueios que realmente movem a escola no dia-a-dia.
          </p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <FocusMetricCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
