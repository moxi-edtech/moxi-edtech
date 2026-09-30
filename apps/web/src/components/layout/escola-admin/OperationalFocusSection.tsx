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
import SecaoLabel from "@/components/shared/SecaoLabel";
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
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${card.tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="truncate text-xs font-semibold text-slate-600">{card.label}</span>
      </div>

      <div className="mt-3">
        <span className={`text-2xl font-black ${isZero ? "text-slate-400" : "text-slate-900"}`}>
          {card.value}
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
      label: snapshot.mensalidadesCompetencia
        ? `Cobranças Pendentes (${snapshot.mensalidadesCompetencia})`
        : "Cobranças Pendentes",
      value: snapshot.mensalidadesPendentes,
      description: "Mensalidades em aberto na competência operacional seleccionada.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas-alunos"),
      cta: "Ver mensalidades",
      icon: Banknote,
      tone: "bg-emerald/10 text-emerald",
    },
    {
      key: "admissoes",
      label: "Admissões Pendentes",
      value: snapshot.admissoesPendentes,
      description: "Candidaturas que ainda precisam de análise, aprovação ou fecho de conversão.",
      href: buildPortalHref(escolaParam, "/operacoes/admissoes"),
      cta: "Abrir admissões",
      icon: UserRoundSearch,
      tone: "bg-emerald/10 text-emerald",
    },
    {
      key: "matriculas",
      label: "Matrículas Pendentes",
      value: snapshot.matriculasPendentes,
      description: "Registos ainda em rascunho ou pendentes antes de entrar na rotina normal.",
      href: buildPortalHref(escolaParam, "/operacoes/matriculas"),
      cta: "Tratar matrículas",
      icon: ClipboardCheck,
      tone: "bg-emerald/10 text-emerald",
    },
    {
      key: "documentos",
      label: "Documentos em Fila",
      value: snapshot.documentosEmProcessamento,
      description: "Lotes de pautas, boletins ou certificados ainda em processamento.",
      href: buildPortalHref(escolaParam, "/operacoes/documentos-oficiais"),
      cta: "Ver documentos",
      icon: FileClock,
      tone: "bg-emerald/10 text-emerald",
    },
    {
      key: "inadimplencia",
      label: "Em Atraso",
      value: snapshot.mensalidadesInadimplentes,
      description: "Casos que já exigem contacto activo ou negociação com o encarregado.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas-alunos"),
      cta: "Ver carteira",
      icon: ShieldAlert,
      tone: "bg-amber/15 text-amber-600",
    },
    {
      key: "turmas",
      label: "Turmas Pendentes",
      value: snapshot.turmasPendentes,
      description: "Turmas que ainda precisam de validação para liberar a rotina académica.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas"),
      cta: "Revisar turmas",
      icon: Layers3,
      tone: "bg-emerald/10 text-emerald",
    },
    {
      key: "horarios",
      label: "Sem Horário Publicado",
      value: snapshot.turmasSemHorarioPublicado,
      description: "Turmas activas ainda sem versão publicada do quadro oficial de horários.",
      href: horarioQuadroHref,
      cta: "Publicar quadro",
      icon: CalendarClock,
      tone: "bg-amber/15 text-amber-600",
    },
    {
      key: "setup",
      label: "Bloqueios de Setup",
      value: snapshot.setupBlockers + snapshot.curriculoHorarioPendencias,
      description: "Pendências estruturais que ainda geram atrito no arranque do ano.",
      href: buildPortalHref(escolaParam, "/operacoes/configuracoes"),
      cta: "Finalizar setup",
      icon: AlertTriangle,
      tone: "bg-amber/15 text-amber-600",
    },
  ];

  return (
    // Vive dentro do modal "Fila operacional", por isso não repete título próprio.
    <section className="space-y-3">
      <SecaoLabel>Foco da operação</SecaoLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <FocusMetricCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
