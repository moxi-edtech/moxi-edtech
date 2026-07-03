"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Headphones,
  Layers3,
  PhoneCall,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  COMMERCIAL_STATUS_OPTIONS,
  CRM_STAGES,
  getOnboardingLifecycleMeta,
  IMPLANTATION_STATUS_CONFIG,
  ONBOARDING_STATUS_CONFIG,
  PARTNER_CONTEXTUAL_POPS,
  SUPPORT_STATUS_CONFIG,
  getImplantationProgress,
  isSchoolOperational,
  isSchoolSetupCompleted,
  getLatestOnboardingCall,
  getStepMeta,
  type OnboardingEscola,
  type PartnerCommissionItem,
  type PartnerCrmLead,
  type PartnerLoginMember,
  type PartnerPopGuide,
  type PartnerPopPhase,
  type PartnerSupportTicket,
} from "./partner-dashboard-model";

type Escola360TabContentProps = {
  codigo: string;
  currentMemberId: string;
  schoolsList: OnboardingEscola[];
  crmLeads: PartnerCrmLead[];
  supportTickets: PartnerSupportTicket[];
  commissionItems: PartnerCommissionItem[];
  partnerMembers: PartnerLoginMember[];
  onOpenSchoolDetails: (school: OnboardingEscola) => void;
  onOpenLead: (lead: PartnerCrmLead) => void;
  onRegisterCall: (school: OnboardingEscola) => void;
};

type RiskLevel = "baixo" | "medio" | "alto";

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return format(date, "dd/MM/yyyy", { locale: pt });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(value || 0)
    .replace("AOA", "Kz");
}

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isOpenTicket(ticket: PartnerSupportTicket) {
  return ticket.status !== "resolvido";
}

function isTicketOverdue(ticket: PartnerSupportTicket) {
  const now = Date.now();
  return (
    isOpenTicket(ticket) &&
    ((!ticket.first_responded_at && new Date(ticket.first_response_due_at).getTime() < now) ||
      new Date(ticket.resolution_due_at).getTime() < now)
  );
}

function riskMeta(level: RiskLevel) {
  if (level === "alto") {
    return {
      label: "Risco alto",
      icon: ShieldAlert,
      badge: "bg-rose-50 text-rose-700 border-rose-100",
      panel: "border-rose-200 bg-rose-50/50",
    };
  }
  if (level === "medio") {
    return {
      label: "Atenção",
      icon: AlertTriangle,
      badge: "bg-amber-50 text-amber-700 border-amber-100",
      panel: "border-amber-200 bg-amber-50/50",
    };
  }
  return {
    label: "Controlado",
    icon: ShieldCheck,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    panel: "border-emerald-200 bg-emerald-50/50",
  };
}

function uniquePops(pops: PartnerPopGuide[]) {
  const seen = new Set<string>();
  return pops.filter((pop) => {
    if (seen.has(pop.id)) return false;
    seen.add(pop.id);
    return true;
  });
}

function phaseForStep(stepCode?: string | null): PartnerPopPhase {
  if (!stepCode) return "onboarding";
  if (["diagnostico", "planilhas"].includes(stepCode)) return "onboarding";
  if (["validacao", "config"].includes(stepCode)) return "setup";
  if (["treinamento", "live"].includes(stepCode)) return "treinamento";
  return "onboarding";
}

function contextualPopsForSchool(school: OnboardingEscola, hasLead: boolean, hasOpenTickets: boolean, hasCommissions: boolean) {
  const nextStep = (school.steps ?? []).find((step) => step.status !== "concluido");
  const primaryPhase = school.status === "activo" ? "suporte" : phaseForStep(nextStep?.code);
  const phases: PartnerPopPhase[] = [primaryPhase];

  if (hasLead) phases.unshift("comercial");
  if (hasOpenTickets) phases.push("suporte");
  if (hasCommissions) phases.push("financeiro");
  if (school.implantation_status === "aceite_validado") phases.push("treinamento");

  return uniquePops(PARTNER_CONTEXTUAL_POPS.filter((pop) => phases.includes(pop.phase))).slice(0, 5);
}

export function Escola360TabContent({
  codigo,
  currentMemberId,
  schoolsList,
  crmLeads,
  supportTickets,
  commissionItems,
  partnerMembers,
  onOpenSchoolDetails,
  onOpenLead,
  onRegisterCall,
}: Escola360TabContentProps) {
  const [search, setSearch] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "pendente" | "em_configuracao" | "activo" | "cancelado">("all");
  const [slaFilter, setSlaFilter] = useState<"all" | "ok" | "fora_sla">("all");
  const [portfolioFilter, setPortfolioFilter] = useState<"all" | "minha" | "com_lead" | "sem_lead" | "com_ticket" | "com_comissao">("all");
  const lastRiskSyncRef = useRef("");

  const rows = useMemo(() => {
    return schoolsList.map((school) => {
      const schoolName = normalize(school.escola);
      const lead = crmLeads.find((item) => {
        const leadName = normalize(item.nome_escola);
        return (
          (school.crm_lead_id && item.id === school.crm_lead_id) ||
          (school.onboarding_request_id && item.onboarding_request_id === school.onboarding_request_id) ||
          (school.id && item.onboarding_request_id === school.id) ||
          (school.token && item.onboarding_tracking_token === school.token) ||
          (school.token && item.tracking_token === school.token) ||
          (leadName && schoolName && (leadName === schoolName || leadName.includes(schoolName) || schoolName.includes(leadName)))
        );
      }) ?? null;

      const tickets = supportTickets.filter((ticket) => {
        const ticketName = normalize(ticket.escola_nome);
        return (
          (school.token && ticket.tracking_token === school.token) ||
          (ticketName && schoolName && (ticketName === schoolName || ticketName.includes(schoolName) || schoolName.includes(ticketName)))
        );
      });

      const commissions = commissionItems.filter((commission) => {
        const commissionSchoolName = normalize(commission.escola_nome);
        return commissionSchoolName && schoolName && (commissionSchoolName === schoolName || commissionSchoolName.includes(schoolName) || schoolName.includes(commissionSchoolName));
      });

      const openTickets = tickets.filter(isOpenTicket);
      const overdueTickets = tickets.filter(isTicketOverdue);
      const steps = school.steps ?? [];
      const lateSteps = steps.filter((step) => step.status !== "concluido" && step.deadline && new Date(step.deadline).getTime() < Date.now());
      const progress = getImplantationProgress(school);
      const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
      const pendingUploads = (school.uploads ?? []).filter((upload) =>
        ["pendente", "processando", "pendencia_cliente", "em_revisao_parceiro"].includes(upload.status)
      );
      const paidCommissions = commissions.filter((commission) => commission.status === "paid");
      const availableCommissions = commissions.filter((commission) => commission.status === "approved" && !commission.payout_status);
      const blockedCommissions = commissions.filter((commission) => commission.status === "blocked");
      const latestCall = getLatestOnboardingCall(school);

      const riskReasons: string[] = [];
      if (overdueTickets.length > 0) riskReasons.push(`${overdueTickets.length} ticket(s) fora do SLA`);
      if (lateSteps.length > 0) riskReasons.push(`${lateSteps.length} etapa(s) atrasada(s)`);
      if (pendingUploads.length > 0) riskReasons.push(`${pendingUploads.length} documento(s) pendente(s)`);
      if (!latestCall && school.status !== "activo") riskReasons.push("sem follow-up registrado");
      if (blockedCommissions.length > 0) riskReasons.push("comissão bloqueada");

      const risk: RiskLevel = overdueTickets.length > 0 || lateSteps.length > 1
        ? "alto"
        : riskReasons.length > 0
          ? "medio"
          : "baixo";
      const riskScore = Math.min(
        100,
        (overdueTickets.length * 30) +
          (lateSteps.length * 20) +
          (pendingUploads.length * 10) +
          (!latestCall && school.status !== "activo" ? 15 : 0) +
          (blockedCommissions.length * 25)
      );
      const contextualPops = contextualPopsForSchool(
        school,
        Boolean(lead),
        openTickets.length > 0,
        commissions.length > 0
      );

      return {
        school,
        lead,
        tickets,
        openTickets,
        overdueTickets,
        lateSteps,
        pendingUploads,
        commissions,
        paidCommissions,
        availableCommissions,
        blockedCommissions,
        latestCall,
        progress,
        progressPercent,
        risk,
        riskScore,
        riskReasons,
        contextualPops,
      };
    });
  }, [commissionItems, crmLeads, schoolsList, supportTickets]);

  const filteredRows = useMemo(() => {
    const needle = normalize(search);
    return rows.filter((row) => {
      const responsibleId = row.lead?.responsavel_membro_id || row.lead?.membro_id || "";
      if (operatorFilter !== "all" && responsibleId !== operatorFilter) return false;
      if (riskFilter !== "all" && row.risk !== riskFilter) return false;
      if (onboardingFilter !== "all" && row.school.status !== onboardingFilter) return false;
      if (slaFilter === "fora_sla" && row.overdueTickets.length === 0 && row.lateSteps.length === 0) return false;
      if (slaFilter === "ok" && (row.overdueTickets.length > 0 || row.lateSteps.length > 0)) return false;
      if (portfolioFilter === "minha" && responsibleId !== currentMemberId) return false;
      if (portfolioFilter === "com_lead" && !row.lead) return false;
      if (portfolioFilter === "sem_lead" && row.lead) return false;
      if (portfolioFilter === "com_ticket" && row.openTickets.length === 0) return false;
      if (portfolioFilter === "com_comissao" && row.commissions.length === 0) return false;
      if (!needle) return true;
      return [
        row.school.escola,
        row.school.director_nome,
        row.school.escola_email,
        row.school.escola_tel,
        row.lead?.nome_contacto,
        row.lead?.telefone,
      ]
        .map(normalize)
        .join(" ")
        .includes(needle);
    });
  }, [currentMemberId, onboardingFilter, operatorFilter, portfolioFilter, riskFilter, rows, search, slaFilter]);

  const riskPayload = useMemo(() => {
    return rows
      .filter((row) => row.school.onboarding_request_id || row.school.id)
      .map((row) => ({
        onboarding_request_id: row.school.onboarding_request_id || row.school.id,
        risk_score: row.riskScore,
        risk_level: row.risk,
        risk_reasons: row.riskReasons,
        snapshot: {
          open_tickets: row.openTickets.length,
          overdue_tickets: row.overdueTickets.length,
          late_steps: row.lateSteps.length,
          pending_uploads: row.pendingUploads.length,
          blocked_commissions: row.blockedCommissions.length,
          has_lead: Boolean(row.lead),
        },
      }));
  }, [rows]);

  useEffect(() => {
    if (riskPayload.length === 0) return;
    const fingerprint = JSON.stringify(riskPayload);
    if (lastRiskSyncRef.current === fingerprint) return;
    lastRiskSyncRef.current = fingerprint;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/influencers/${codigo}/school-360/risk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: riskPayload }),
        signal: controller.signal,
      }).catch(() => null);
    }, 800);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [codigo, riskPayload]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.school.status === "activo") acc.active += 1;
        if (row.risk !== "baixo") acc.risk += 1;
        acc.openTickets += row.openTickets.length;
        acc.availableCommissionKz += row.availableCommissions.reduce((sum, item) => sum + Number(item.valor_kz || 0), 0);
        return acc;
      },
      { total: 0, active: 0, risk: 0, openTickets: 0, availableCommissionKz: 0 },
    );
  }, [rows]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Carteira operacional</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Painel 360 da Escola</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar escola, diretor ou telefone"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 sm:w-80"
            />
          </div>
          <select
            value={operatorFilter}
            onChange={(event) => setOperatorFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos operadores</option>
            {partnerMembers.map((member) => (
              <option key={member.membro_id} value={member.membro_id}>
                {member.membro_nome}
              </option>
            ))}
          </select>
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos riscos</option>
            <option value="alto">Risco alto</option>
            <option value="medio">Atenção</option>
            <option value="baixo">Controlado</option>
          </select>
          <select
            value={onboardingFilter}
            onChange={(event) => setOnboardingFilter(event.target.value as typeof onboardingFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos status</option>
            <option value="pendente">Pendente</option>
            <option value="em_configuracao">Onboarding em curso</option>
            <option value="activo">Ativa</option>
            <option value="cancelado">Cancelada</option>
          </select>
          <select
            value={slaFilter}
            onChange={(event) => setSlaFilter(event.target.value as typeof slaFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos SLA</option>
            <option value="fora_sla">Fora do SLA</option>
            <option value="ok">SLA em dia</option>
          </select>
          <select
            value={portfolioFilter}
            onChange={(event) => setPortfolioFilter(event.target.value as typeof portfolioFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Toda carteira</option>
            <option value="minha">Minha carteira</option>
            <option value="com_lead">Com lead</option>
            <option value="sem_lead">Sem lead</option>
            <option value="com_ticket">Com ticket</option>
            <option value="com_comissao">Com comissão</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <Users className="mb-3 h-5 w-5 text-zinc-400" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Escolas na carteira</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <BadgeCheck className="mb-3 h-5 w-5 text-emerald-500" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Provisionadas</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.active}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <ShieldAlert className="mb-3 h-5 w-5 text-rose-500" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Com risco</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{summary.risk}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <Banknote className="mb-3 h-5 w-5 text-sky-500" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Payout disponível</p>
            <p className="mt-1 text-xl font-bold text-sky-600 font-mono">{formatCurrency(summary.availableCommissionKz)}</p>
          </CardContent>
        </Card>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Layers3 className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">Nenhuma escola encontrada para os filtros atuais.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRows.map((row) => {
            const risk = riskMeta(row.risk);
            const RiskIcon = risk.icon;
            const onboardingStatus = ONBOARDING_STATUS_CONFIG[row.school.status as keyof typeof ONBOARDING_STATUS_CONFIG];
            const lifecycleMeta = getOnboardingLifecycleMeta(row.school);
            const implantationStatus = IMPLANTATION_STATUS_CONFIG[
              (row.school.implantation_status || "implantacao_em_andamento") as keyof typeof IMPLANTATION_STATUS_CONFIG
            ];
            const lead = row.lead;
            const leadStage = lead?.etapa ? CRM_STAGES[lead.etapa] : null;
            const commercial = lead?.commercial_status
              ? COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === lead.commercial_status)
              : null;
            const nextStep = (row.school.steps ?? []).find((step) => step.status !== "concluido");

            return (
              <article key={row.school.token || row.school.escola} className={`rounded-2xl border bg-white p-5 shadow-sm ${risk.panel}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-bold text-slate-950">{row.school.escola}</h3>
                      <Badge className={`border text-[9px] font-bold uppercase tracking-wider ${lifecycleMeta.color}`}>
                        {lifecycleMeta.shortLabel}
                      </Badge>
                      <Badge className={`border text-[9px] font-bold uppercase tracking-wider ${onboardingStatus?.color || "bg-slate-100 text-slate-700"}`}>
                        {onboardingStatus?.label || row.school.status}
                      </Badge>
                      <Badge className={`border text-[9px] font-bold uppercase tracking-wider ${risk.badge}`}>
                        <RiskIcon className="mr-1 h-3 w-3" />
                        {risk.label} · {row.riskScore}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                      <span>{row.school.director_nome || "Diretor não informado"}</span>
                      <span>{row.school.escola_tel || row.school.director_tel || "Telefone não informado"}</span>
                      <span>{row.school.escola_email || "Email não informado"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lead ? (
                      <Button size="sm" variant="outline" tone="slate" onClick={() => onOpenLead(lead)}>
                        <Target />
                        Lead
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" tone="slate" onClick={() => onOpenSchoolDetails(row.school)}>
                      <Layers3 />
                      Detalhes
                    </Button>
                    {row.school.status !== "activo" ? (
                      <Button size="sm" tone="slate" onClick={() => onRegisterCall(row.school)}>
                        <PhoneCall />
                        Follow-up
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Target className="h-4 w-4" />
                      Lead / Contrato
                    </div>
                    {row.lead ? (
                      <div className="space-y-2 text-xs text-slate-600">
                        <p className="font-bold text-slate-900">{leadStage?.label || row.lead.etapa}</p>
                        <p>Plano: <span className="font-bold">{row.lead.plano_estimado || row.school.plano_label || "N/I"}</span></p>
                        <p>Alunos: <span className="font-bold">{row.lead.alunos_estimados || row.school.total_alunos || "N/I"}</span></p>
                        {row.lead.onboarding_request_id || row.school.onboarding_request_id ? (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">FK lead/onboarding ligada</p>
                        ) : null}
                        {commercial ? (
                          <Badge className={`${commercial.color} border border-slate-200/40 text-[9px] font-bold uppercase`}>
                            {commercial.label}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs font-semibold text-slate-400">Sem lead ligado automaticamente.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <FileCheck2 className="h-4 w-4" />
                      Onboarding
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <p className="font-bold text-slate-900">{lifecycleMeta.label}</p>
                      <p>Próxima etapa: <span className="font-bold text-slate-900">{nextStep ? getStepMeta(nextStep.code, nextStep.owner).short : isSchoolOperational(row.school) ? "Concluído" : isSchoolSetupCompleted(row.school) ? "Readiness operacional" : "Setup escolar no portal"}</span></p>
                      <p>Prazo: <span className={row.lateSteps.length > 0 ? "font-bold text-rose-700" : "font-bold"}>{formatDate(nextStep?.deadline)}</span></p>
                      <p>Docs pendentes: <span className="font-bold">{row.pendingUploads.length}</span></p>
                      <p>Último follow-up: <span className="font-bold">{row.latestCall ? formatDate(row.latestCall.realizado_em) : "Sem registro"}</span></p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Implantação
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500">
                          <span>Checklist</span>
                          <span>{row.progress.completed}/{row.progress.total}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.progressPercent}%` }} />
                        </div>
                      </div>
                      <Badge className={`border text-[9px] font-bold uppercase ${implantationStatus.color}`}>
                        {implantationStatus.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Headphones className="h-4 w-4" />
                      Suporte / SLA
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <p>Tickets abertos: <span className="font-bold">{row.openTickets.length}</span></p>
                      <p>Fora do SLA: <span className={row.overdueTickets.length > 0 ? "font-bold text-rose-700" : "font-bold"}>{row.overdueTickets.length}</span></p>
                      {row.tickets[0] ? (
                        <Badge className={`${SUPPORT_STATUS_CONFIG[row.tickets[0].status]?.color || "bg-slate-100 text-slate-700"} border text-[9px] font-bold uppercase`}>
                          Último: {SUPPORT_STATUS_CONFIG[row.tickets[0].status]?.label || row.tickets[0].status}
                        </Badge>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400">Sem chamados.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1.15fr]">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Banknote className="h-4 w-4" />
                      Comissões
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">Aprovadas</p>
                        <p className="font-bold text-slate-900">{formatCurrency(row.availableCommissions.reduce((sum, item) => sum + Number(item.valor_kz || 0), 0))}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">Pagas</p>
                        <p className="font-bold text-slate-900">{formatCurrency(row.paidCommissions.reduce((sum, item) => sum + Number(item.valor_kz || 0), 0))}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-slate-400">Bloqueadas</p>
                        <p className="font-bold text-slate-900">{row.blockedCommissions.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <TrendingUp className="h-4 w-4" />
                      Risco operacional
                    </div>
                    {row.riskReasons.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.riskReasons.map((reason) => (
                          <span key={reason} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Sem riscos críticos nos dados atuais.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <BookOpenCheck className="h-4 w-4" />
                      POPs da fase
                    </div>
                    <div className="space-y-2">
                      {row.contextualPops.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-400">Sem POP contextual para esta fase.</p>
                      ) : (
                        row.contextualPops.map((pop) => (
                          <a
                            key={pop.id}
                            href={pop.href}
                            target="_blank"
                            rel="noreferrer"
                            className="group block rounded-lg border border-slate-100 bg-slate-50 p-3 no-underline transition hover:border-slate-300 hover:bg-white"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{pop.code}</span>
                                  {pop.status === "needs_review" ? (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                                      revisar texto
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs font-bold text-slate-900">{pop.title}</p>
                                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                                  {pop.summary}
                                </p>
                              </div>
                              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-700" />
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
