"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  ExternalLink,
  FileText,
  Filter,
  Search,
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Biblioteca operacional</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">POPs do CRM</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar POP, código ou fase"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 sm:w-80"
            />
          </div>
          <select
            value={phaseFilter}
            onChange={(event) => setPhaseFilter(event.target.value as typeof phaseFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todas as fases</option>
            {Object.entries(PHASE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos estados</option>
            <option value="actual">Atualizado</option>
            <option value="needs_review">Revisar texto</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <BookOpenCheck className="mb-3 h-5 w-5 text-slate-400" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">POPs publicados</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-emerald-100 bg-emerald-50/40 shadow-sm">
          <CardContent className="p-5">
            <FileText className="mb-3 h-5 w-5 text-emerald-600" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Setup + Treinamento</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{summary.setup + summary.treinamento}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-sky-100 bg-sky-50/40 shadow-sm">
          <CardContent className="p-5">
            <Filter className="mb-3 h-5 w-5 text-sky-600" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-sky-700">Fases cobertas</p>
            <p className="mt-1 text-2xl font-black text-sky-700">{Object.keys(PHASE_LABELS).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-100 bg-amber-50/40 shadow-sm">
          <CardContent className="p-5">
            <FileText className="mb-3 h-5 w-5 text-amber-600" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Precisam revisão</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{summary.needsReview}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredPops.map((pop) => (
          <a
            key={pop.id}
            href={pop.href}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`border text-[9px] font-black uppercase tracking-wider shadow-none ${PHASE_STYLES[pop.phase]}`}>
                    {PHASE_LABELS[pop.phase]}
                  </Badge>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{pop.code}</span>
                  {pop.status === "needs_review" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase text-amber-700">
                      revisar texto
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-base font-black text-slate-950">{pop.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">{pop.summary}</p>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-700" />
            </div>
          </a>
        ))}
      </div>

      {filteredPops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <BookOpenCheck className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">Nenhum POP encontrado para os filtros atuais.</p>
        </div>
      ) : null}
    </div>
  );
}
