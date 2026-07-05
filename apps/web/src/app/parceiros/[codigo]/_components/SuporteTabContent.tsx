"use client";

import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Clock, Download, Headphones, Loader2, Plus, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_CHANNEL_OPTIONS,
  SUPPORT_SEVERITY_CONFIG,
  SUPPORT_STATUS_CONFIG,
  type OnboardingEscola,
  type PartnerLoginMember,
  type PartnerSupportCategory,
  type PartnerSupportChannel,
  type PartnerSupportSeverity,
  type PartnerSupportStatus,
  type PartnerSupportSummary,
  type PartnerSupportTicket,
} from "./partner-dashboard-model";

type SuporteTabContentProps = {
  loadingSupport: boolean;
  savingSupportTicket: boolean;
  supportTickets: PartnerSupportTicket[];
  supportSummary: PartnerSupportSummary | null;
  schoolsList: OnboardingEscola[];
  partnerMembers: PartnerLoginMember[];
  newSupportSchoolToken: string;
  setNewSupportSchoolToken: (value: string) => void;
  newSupportSchoolName: string;
  setNewSupportSchoolName: (value: string) => void;
  newSupportTitle: string;
  setNewSupportTitle: (value: string) => void;
  newSupportDescription: string;
  setNewSupportDescription: (value: string) => void;
  newSupportCanal: PartnerSupportChannel;
  setNewSupportCanal: (value: PartnerSupportChannel) => void;
  newSupportCategoria: PartnerSupportCategory;
  setNewSupportCategoria: (value: PartnerSupportCategory) => void;
  newSupportGravidade: PartnerSupportSeverity;
  setNewSupportGravidade: (value: PartnerSupportSeverity) => void;
  newSupportResponsavelId: string;
  setNewSupportResponsavelId: (value: string) => void;
  supportUpdateNote: string;
  setSupportUpdateNote: (value: string) => void;
  supportEscalationReason: string;
  setSupportEscalationReason: (value: string) => void;
  loadSupportTickets: (showLoading?: boolean) => void;
  handleCreateSupportTicket: () => void;
  handleUpdateSupportTicket: (
    ticketId: string,
    status: PartnerSupportStatus,
    escalationReason?: string
  ) => void;
};

function getDeadlineState(ticket: PartnerSupportTicket) {
  const now = Date.now();
  const responseOverdue = !ticket.first_responded_at && new Date(ticket.first_response_due_at).getTime() < now;
  const resolutionOverdue = ticket.status !== "resolvido" && new Date(ticket.resolution_due_at).getTime() < now;

  if (ticket.status === "resolvido") return { label: "Resolvido", color: "text-emerald-700", overdue: false };
  if (resolutionOverdue) return { label: "Resolução vencida", color: "text-rose-700", overdue: true };
  if (responseOverdue) return { label: "Resposta vencida", color: "text-rose-700", overdue: true };
  return { label: "Dentro do SLA", color: "text-emerald-700", overdue: false };
}

function escapeCsv(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(/"/g, '""');
  return `"${normalized}"`;
}

export function SuporteTabContent({
  loadingSupport,
  savingSupportTicket,
  supportTickets,
  supportSummary,
  schoolsList,
  partnerMembers,
  newSupportSchoolToken,
  setNewSupportSchoolToken,
  newSupportSchoolName,
  setNewSupportSchoolName,
  newSupportTitle,
  setNewSupportTitle,
  newSupportDescription,
  setNewSupportDescription,
  newSupportCanal,
  setNewSupportCanal,
  newSupportCategoria,
  setNewSupportCategoria,
  newSupportGravidade,
  setNewSupportGravidade,
  newSupportResponsavelId,
  setNewSupportResponsavelId,
  supportUpdateNote,
  setSupportUpdateNote,
  supportEscalationReason,
  setSupportEscalationReason,
  loadSupportTickets,
  handleCreateSupportTicket,
  handleUpdateSupportTicket,
}: SuporteTabContentProps) {
  const handleExportSupportCsv = () => {
    const currentMonthKey = format(new Date(), "yyyy-MM");
    const monthlyTickets = supportTickets.filter((ticket) => format(new Date(ticket.created_at), "yyyy-MM") === currentMonthKey);
    const rows = [
      [
        "ticket_id",
        "escola",
        "status",
        "gravidade",
        "categoria",
        "canal",
        "criado_em",
        "primeira_resposta_limite",
        "resolucao_limite",
        "primeira_resposta_em",
        "resolvido_em",
        "escalado_em",
        "responsavel",
        "titulo",
        "escalation_reason",
        "notes",
      ].join(","),
      ...monthlyTickets.map((ticket) => [
        escapeCsv(ticket.id),
        escapeCsv(ticket.escola_nome),
        escapeCsv(ticket.status),
        escapeCsv(ticket.gravidade),
        escapeCsv(ticket.categoria),
        escapeCsv(ticket.canal),
        escapeCsv(ticket.created_at),
        escapeCsv(ticket.first_response_due_at),
        escapeCsv(ticket.resolution_due_at),
        escapeCsv(ticket.first_responded_at),
        escapeCsv(ticket.resolved_at),
        escapeCsv(ticket.escalated_at),
        escapeCsv(ticket.responsavel_membro_nome),
        escapeCsv(ticket.titulo),
        escapeCsv(ticket.escalation_reason),
        escapeCsv(ticket.notes),
      ].join(",")),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `partner_support_sla_${currentMonthKey}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Operação AELS</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Suporte L1</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Registre chamados da escola, acompanhe SLA de primeira resposta e escale para KLASSE quando sair do suporte operacional.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleExportSupportCsv}
            disabled={supportTickets.length === 0}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} />
            Exportar SLA
          </Button>
          <Button
            onClick={() => loadSupportTickets(true)}
            disabled={loadingSupport}
            className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800"
          >
            {loadingSupport ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <Headphones className="mb-3 h-5 w-5 text-zinc-500" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Abertos</p>
            <p className="mt-1 font-mono text-2xl font-bold text-zinc-900">{supportSummary?.open ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <AlertTriangle className="mb-3 h-5 w-5 text-rose-500" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Resposta vencida</p>
            <p className="mt-1 font-mono text-2xl font-bold text-rose-600">{supportSummary?.overdue_response ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <Clock className="mb-3 h-5 w-5 text-amber-500" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Resolução vencida</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-600">{supportSummary?.overdue_resolution ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-500" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Resolvidos</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{supportSummary?.resolved ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-zinc-200/50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
          <CardContent className="p-5">
            <ShieldAlert className="mb-3 h-5 w-5 text-purple-500" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Escalados</p>
            <p className="mt-1 font-mono text-2xl font-bold text-purple-600">{supportSummary?.escalated ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-2xl border-zinc-200/70 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-zinc-900">Novo ticket</CardTitle>
            <CardDescription className="text-xs">
              Use a ativação existente quando houver token; para escola avulsa, preencha o nome manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Escola em ativação</label>
              <select
                value={newSupportSchoolToken}
                onChange={(event) => {
                  const token = event.target.value;
                  setNewSupportSchoolToken(token);
                  const school = schoolsList.find((item) => item.token === token);
                  setNewSupportSchoolName(school?.escola ?? "");
                }}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              >
                <option value="">Selecionar ou informar manualmente</option>
                {schoolsList
                  .filter((school) => Boolean(school.token))
                  .map((school) => (
                    <option key={school.token} value={school.token}>
                      {school.escola}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome da escola</label>
              <input
                value={newSupportSchoolName}
                onChange={(event) => setNewSupportSchoolName(event.target.value)}
                disabled={Boolean(newSupportSchoolToken)}
                placeholder="Ex: Colégio Nova Esperança"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white disabled:cursor-not-allowed disabled:text-zinc-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Título</label>
              <input
                value={newSupportTitle}
                onChange={(event) => setNewSupportTitle(event.target.value)}
                placeholder="Ex: Secretaria não consegue validar comprovativo"
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Canal</label>
                <select
                  value={newSupportCanal}
                  onChange={(event) => setNewSupportCanal(event.target.value as PartnerSupportChannel)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                >
                  {SUPPORT_CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Categoria</label>
                <select
                  value={newSupportCategoria}
                  onChange={(event) => setNewSupportCategoria(event.target.value as PartnerSupportCategory)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                >
                  {SUPPORT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Gravidade</label>
                <select
                  value={newSupportGravidade}
                  onChange={(event) => setNewSupportGravidade(event.target.value as PartnerSupportSeverity)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                >
                  {Object.entries(SUPPORT_SEVERITY_CONFIG).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label} · {meta.sla}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Responsável</label>
              <select
                value={newSupportResponsavelId}
                onChange={(event) => setNewSupportResponsavelId(event.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              >
                <option value="">Operador atual</option>
                {partnerMembers.map((member) => (
                  <option key={member.membro_id} value={member.membro_id}>{member.membro_nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Descrição</label>
              <textarea
                value={newSupportDescription}
                onChange={(event) => setNewSupportDescription(event.target.value)}
                rows={4}
                placeholder="Contexto, contacto feito, evidência recebida e próximo passo."
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              />
            </div>

            <Button
              onClick={handleCreateSupportTicket}
              disabled={savingSupportTicket}
              className="h-11 w-full rounded-xl bg-zinc-900 text-xs font-semibold uppercase tracking-wider text-white hover:bg-zinc-800 transition-all border-none"
            >
              {savingSupportTicket ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Abrir ticket
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/70 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-zinc-900">Fila de atendimento</CardTitle>
            <CardDescription className="text-xs">
              Os tickets vencidos sobem primeiro. Use nota curta antes de escalar ou resolver.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={supportUpdateNote}
                onChange={(event) => setSupportUpdateNote(event.target.value)}
                placeholder="Nota rápida para próxima ação"
                className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              />
              <input
                value={supportEscalationReason}
                onChange={(event) => setSupportEscalationReason(event.target.value)}
                placeholder="Motivo de escalação para KLASSE"
                className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
              />
            </div>

            {supportTickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
                <Headphones className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                <p className="text-sm font-bold text-zinc-600">Nenhum ticket registrado.</p>
                <p className="mt-1 text-xs text-zinc-500">Abra chamados quando a escola pedir ajuda operacional.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {supportTickets.map((ticket) => {
                  const statusMeta = SUPPORT_STATUS_CONFIG[ticket.status] ?? SUPPORT_STATUS_CONFIG.aberto;
                  const severityMeta = SUPPORT_SEVERITY_CONFIG[ticket.gravidade] ?? SUPPORT_SEVERITY_CONFIG.media;
                  const deadlineState = getDeadlineState(ticket);

                  return (
                    <div key={ticket.id} className={`rounded-xl border p-4 ${
                      deadlineState.overdue ? "border-rose-200 bg-rose-50/30" : "border-zinc-200 bg-zinc-50/60"
                    }`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge className={`${statusMeta.color} rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-none`}>
                              {statusMeta.label}
                            </Badge>
                            <Badge className={`${severityMeta.color} rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-none`}>
                              {severityMeta.label}
                            </Badge>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${deadlineState.color}`}>
                              {deadlineState.label}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-zinc-900">{ticket.titulo}</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-600">{ticket.escola_nome}</p>
                          {ticket.descricao && (
                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">{ticket.descricao}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <span>{ticket.canal}</span>
                            <span>{ticket.categoria}</span>
                            <span>Resp.: {ticket.responsavel_membro_nome || "Sem responsável"}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-zinc-500">
                            <span>Resposta: {format(new Date(ticket.first_response_due_at), "dd/MM HH:mm", { locale: pt })}</span>
                            <span>Resolução: {format(new Date(ticket.resolution_due_at), "dd/MM HH:mm", { locale: pt })}</span>
                          </div>
                          {ticket.escalation_reason ? (
                            <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-rose-600">Motivo da escalação</p>
                              <p className="mt-1 leading-relaxed">{ticket.escalation_reason}</p>
                            </div>
                          ) : null}
                          {ticket.notes ? (
                            <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-700">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Notas operacionais</p>
                              <p className="mt-1 whitespace-pre-line leading-relaxed">{ticket.notes}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {ticket.status === "aberto" && (
                            <Button
                              onClick={() => handleUpdateSupportTicket(ticket.id, "em_atendimento")}
                              disabled={savingSupportTicket}
                              className="h-8 rounded-lg bg-zinc-950 px-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-zinc-800"
                            >
                              <Headphones size={12} />
                              Atender
                            </Button>
                          )}
                          {ticket.status !== "resolvido" && (
                            <>
                              <Button
                                onClick={() => handleUpdateSupportTicket(ticket.id, "aguardando_cliente")}
                                disabled={savingSupportTicket}
                                className="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-50"
                              >
                                <Clock size={12} />
                                Cliente
                              </Button>
                              <Button
                                onClick={() => handleUpdateSupportTicket(ticket.id, "escalado_klasse", supportEscalationReason)}
                                disabled={savingSupportTicket}
                                className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[10px] font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100"
                              >
                                <ShieldAlert size={12} />
                                Escalar
                              </Button>
                              <Button
                                onClick={() => handleUpdateSupportTicket(ticket.id, "resolvido")}
                                disabled={savingSupportTicket}
                                className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"
                              >
                                <Send size={12} />
                                Resolver
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
