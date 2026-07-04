"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
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
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-3 ${card.tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
            isZero ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {isZero ? "Estável" : "Pede acção"}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
        <p className="mt-2 text-sm text-slate-500">{card.description}</p>
      </div>

      <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-klasse-green transition group-hover:gap-2">
        {card.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

export default function OperationalFocusSection({ escolaId, snapshot }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  const cards: FocusCard[] = [
    {
      key: "pendentes",
      label: "Cobranças Pendentes",
      value: snapshot.mensalidadesPendentes,
      description: "Mensalidades em aberto que ainda podem ser tratadas sem escalonamento.",
      href: buildPortalHref(escolaParam, "/operacoes/recebimentos"),
      cta: "Abrir recebimentos",
      icon: Banknote,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      key: "admissoes",
      label: "Admissões Pendentes",
      value: snapshot.admissoesPendentes,
      description: "Candidaturas que ainda precisam de análise, aprovação ou fecho de conversão.",
      href: buildPortalHref(escolaParam, "/operacoes/admissoes"),
      cta: "Abrir admissões",
      icon: UserRoundSearch,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      key: "matriculas",
      label: "Matrículas Pendentes",
      value: snapshot.matriculasPendentes,
      description: "Registos ainda em rascunho, pendentes ou indefinidos antes de entrar na rotina normal.",
      href: buildPortalHref(escolaParam, "/operacoes/matriculas"),
      cta: "Tratar matrículas",
      icon: ClipboardCheck,
      tone: "bg-indigo-50 text-indigo-700",
    },
    {
      key: "documentos",
      label: "Documentos em Fila",
      value: snapshot.documentosEmProcessamento,
      description: "Lotes de pautas, boletins ou certificados ainda em processamento.",
      href: buildPortalHref(escolaParam, "/operacoes/documentos-oficiais"),
      cta: "Ver documentos",
      icon: FileClock,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      key: "inadimplencia",
      label: "Em Atraso",
      value: snapshot.mensalidadesInadimplentes,
      description: "Casos que já exigem contacto activo ou negociação com o encarregado.",
      href: buildPortalHref(escolaParam, "/financeiro/radar"),
      cta: "Ver carteira",
      icon: ShieldAlert,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      key: "turmas",
      label: "Turmas Pendentes",
      value: snapshot.turmasPendentes,
      description: "Turmas ainda precisam de validação para liberar rotina académica e cobrança.",
      href: buildPortalHref(escolaParam, "/operacoes/turmas"),
      cta: "Revisar turmas",
      icon: Layers3,
      tone: "bg-cyan-50 text-cyan-700",
    },
    {
      key: "horarios",
      label: "Sem Horário Publicado",
      value: snapshot.turmasSemHorarioPublicado,
      description: "Turmas activas ainda sem versão publicada do quadro oficial.",
      href: buildPortalHref(escolaParam, "/horarios/quadro"),
      cta: "Publicar quadro",
      icon: CalendarClock,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      key: "setup",
      label: "Bloqueios de Setup",
      value: snapshot.setupBlockers + snapshot.curriculoHorarioPendencias,
      description: "Pendências estruturais que ainda geram atrito operacional no arranque.",
      href: buildPortalHref(escolaParam, "/operacoes/configuracoes"),
      cta: "Finalizar setup",
      icon: AlertTriangle,
      tone: "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
            Foco da Operação
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Filas e bloqueios que realmente movem a escola no dia-a-dia.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card) => (
          <FocusMetricCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
