"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  ExternalLink,
  FileText,
  Filter,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
  PARTNER_CONTEXTUAL_POPS,
  type PartnerPopPhase,
} from "./partner-dashboard-model";

const PHASE_LABELS: Record<PartnerPopPhase, string> = {
  comercial: "Comercial",
  onboarding: "Onboarding",
  setup: "Setup",
  treinamento: "Treinamento",
  suporte: "Suporte",
  financeiro: "Financeiro",
  equipe: "Equipe",
};

const PHASE_STYLES: Record<PartnerPopPhase, string> = {
  comercial: "bg-blue-50 text-blue-700 border-blue-100",
  onboarding: "bg-amber-50 text-amber-700 border-amber-100",
  setup: "bg-emerald-50 text-emerald-700 border-emerald-100",
  treinamento: "bg-purple-50 text-purple-700 border-purple-100",
  suporte: "bg-rose-50 text-rose-700 border-rose-100",
  financeiro: "bg-sky-50 text-sky-700 border-sky-100",
  equipe: "bg-slate-100 text-slate-700 border-slate-200",
};

const OPERATIONAL_STAGES = [
  {
    key: "stage_comercial",
    title: "1. Captação e Negociação Comercial",
    description: "Instruções para qualificação de leads, definição de termos e propostas.",
    phases: ["comercial"] as PartnerPopPhase[],
  },
  {
    key: "stage_setup",
    title: "2. Ativação Técnica e Setup Escolar",
    description: "Guias de triagem, cadastro de alunos, turmas, disciplinas e formação.",
    phases: ["onboarding", "setup", "treinamento"] as PartnerPopPhase[],
  },
  {
    key: "stage_financeiro",
    title: "3. Políticas Financeiras e Cobranças",
    description: "Configurações de propinas, mensalidades, acompanhamento de comissões e saques.",
    phases: ["financeiro"] as PartnerPopPhase[],
  },
  {
    key: "stage_suporte",
    title: "4. Suporte Operacional e Gestão de Equipe",
    description: "Atendimento L1 (SLAs de incidentes), monitor de jobs e gestão de membros.",
    phases: ["suporte", "equipe"] as PartnerPopPhase[],
  },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function PopsLibraryTabContent() {
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<"all" | PartnerPopPhase>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "actual" | "needs_review">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredPops = useMemo(() => {
    const needle = normalize(search);
    return PARTNER_CONTEXTUAL_POPS.filter((pop) => {
      if (phaseFilter !== "all" && pop.phase !== phaseFilter) return false;
      if (statusFilter !== "all" && pop.status !== statusFilter) return false;
      if (!needle) return true;

      return normalize([pop.code, pop.title, pop.summary, PHASE_LABELS[pop.phase]].join(" ")).includes(needle);
    });
  }, [phaseFilter, search, statusFilter]);

  const summary = useMemo(() => {
    return PARTNER_CONTEXTUAL_POPS.reduce(
      (acc, pop) => {
        acc.total += 1;
        acc[pop.phase] += 1;
        if (pop.status === "needs_review") acc.needsReview += 1;
        return acc;
      },
      {
        total: 0,
        comercial: 0,
        onboarding: 0,
        setup: 0,
        treinamento: 0,
        suporte: 0,
        financeiro: 0,
        equipe: 0,
        needsReview: 0,
      },
    );
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header section */}
      <div className="flex flex-col gap-4 border-b border-zinc-200/50 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Biblioteca operacional</p>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">POPs do CRM</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Manuais de Procedimento Padrão organizados cronologicamente pelo ciclo de vida da escola.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/50 mr-2">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="Exibição em Grade"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "list" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              }`}
              title="Exibição em Lista"
            >
              <List size={15} />
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar POP, código ou fase"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-xs font-semibold text-zinc-700 outline-none transition focus:border-zinc-400 sm:w-64"
            />
          </div>
          <select
            value={phaseFilter}
            onChange={(event) => setPhaseFilter(event.target.value as typeof phaseFilter)}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 outline-none cursor-pointer focus:border-zinc-400"
          >
            <option value="all">Fase específica</option>
            {Object.entries(PHASE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 outline-none cursor-pointer focus:border-zinc-400"
          >
            <option value="all">Estado</option>
            <option value="actual">Atualizado</option>
            <option value="needs_review">Revisão pendente</option>
          </select>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-500">
              <BookOpenCheck size={16} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Total de POPs</p>
              <p className="text-lg font-bold text-zinc-900 mt-0.5">{summary.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[#1F6B3B]">
              <FileText size={16} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Configuração</p>
              <p className="text-lg font-bold text-[#1F6B3B] mt-0.5">{summary.setup + summary.treinamento}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600">
              <Filter size={16} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Fases Cobertas</p>
              <p className="text-lg font-bold text-sky-600 mt-0.5">{Object.keys(PHASE_LABELS).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <FileText size={16} />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Revisões Pendentes</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{summary.needsReview}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Structured Chronological Sections */}
      <div className="space-y-8">
        {OPERATIONAL_STAGES.map((stage) => {
          const popsInStage = filteredPops.filter((pop) => stage.phases.includes(pop.phase));

          if (popsInStage.length === 0) return null;

          return (
            <div key={stage.key} className="space-y-3.5">
              <div className="border-l-2 border-zinc-900 pl-4 py-0.5">
                <h3 className="text-sm font-bold text-zinc-900 tracking-tight">{stage.title}</h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">{stage.description}</p>
              </div>

              {viewMode === "grid" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {popsInStage.map((pop) => (
                    <a
                      key={pop.id}
                      href={pop.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group block rounded-2xl border border-zinc-200 bg-white p-5 no-underline shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:border-zinc-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4 h-full">
                        <div className="min-w-0 flex flex-col justify-between h-full">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`border text-[8px] font-bold uppercase tracking-wider shadow-none ${PHASE_STYLES[pop.phase]}`}>
                                {PHASE_LABELS[pop.phase]}
                              </Badge>
                              <span className="text-[9px] font-mono font-bold text-zinc-400">{pop.code}</span>
                              {pop.status === "needs_review" ? (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-700 border border-amber-200/50">
                                  revisar texto
                                </span>
                              ) : null}
                            </div>
                            <h4 className="mt-3 text-xs font-bold text-zinc-900 group-hover:text-zinc-950">{pop.title}</h4>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 font-semibold">{pop.summary}</p>
                          </div>
                        </div>
                        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-300 transition group-hover:text-zinc-700" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="border border-zinc-200/60 rounded-2xl bg-white divide-y divide-zinc-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  {popsInStage.map((pop) => (
                    <a
                      key={pop.id}
                      href={pop.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-4 p-3.5 hover:bg-zinc-50/50 no-underline transition-all"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-[9px] font-mono font-bold text-zinc-400 shrink-0 w-20">{pop.code}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-zinc-800 group-hover:text-zinc-950 truncate">{pop.title}</h4>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pop.summary}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className={`border text-[8px] font-bold uppercase tracking-wider shadow-none ${PHASE_STYLES[pop.phase]}`}>
                          {PHASE_LABELS[pop.phase]}
                        </Badge>
                        {pop.status === "needs_review" ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-700 border border-amber-200/50">
                            Revisar
                          </span>
                        ) : null}
                        <ExternalLink size={13} className="text-zinc-300 transition group-hover:text-zinc-600" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <BookOpenCheck className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
          <p className="text-xs font-semibold text-zinc-500">Nenhum POP encontrado para os filtros atuais.</p>
        </div>
      ) : null}
    </div>
  );
}
