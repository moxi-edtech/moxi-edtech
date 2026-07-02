"use client";

import { ArrowRight, Clock, ExternalLink, FileText, Loader2, Phone, School, Target, Users } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  CRM_STAGES,
  CRM_PLAN_OPTIONS,
  COMMERCIAL_STATUS_OPTIONS,
  getLeadConversionBlockers,
  type PartnerLoginMember,
} from "./partner-dashboard-model";

type CrmLeadDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCrmLead: any | null;
  commercialPlan: "essencial" | "profissional" | "premium";
  setCommercialPlan: (plan: "essencial" | "profissional" | "premium") => void;
  commercialAlunos: number;
  setCommercialAlunos: (alunos: number) => void;
  commercialTrialDays: number;
  setCommercialTrialDays: (days: number) => void;
  commercialTaxaAtivacao: number;
  setCommercialTaxaAtivacao: (taxa: number) => void;
  commercialMensalidade: number;
  setCommercialMensalidade: (mensalidade: number) => void;
  commercialStatus: "rascunho" | "proposta_enviada" | "aceite_comercial" | "aguardando_contrato_klasse";
  setCommercialStatus: (status: "rascunho" | "proposta_enviada" | "aceite_comercial" | "aguardando_contrato_klasse") => void;
  handleOpenCommercialProposal: () => void;
  openingProposalFile: boolean;
  proposalDocumentFile: File | null;
  setProposalDocumentFile: (file: File | null) => void;
  handleUploadCommercialProposal: () => void;
  uploadingProposalFile: boolean;
  handleSaveCommercialTerms: () => void;
  savingCommercialTerms: boolean;
  selectedStageToChange: string;
  setSelectedStageToChange: (stage: string) => void;
  lossReasonText: string;
  setLossReasonText: (text: string) => void;
  handleUpdateLeadStage: (id: string, stage: string) => void;
  updatingLeadStage: boolean;
  convertingLead: boolean;
  handleConvertLeadToOnboarding: () => void;
  selectedLeadResponsavelId: string;
  setSelectedLeadResponsavelId: (id: string) => void;
  partnerMembers: PartnerLoginMember[];
  memberId: string;
  memberName: string;
  nextLeadAction: string;
  setNextLeadAction: (action: string) => void;
  nextLeadActionDate: string;
  setNextLeadActionDate: (date: string) => void;
  leadActionNotes: string;
  setLeadActionNotes: (notes: string) => void;
  handleUpdateLeadAction: () => void;
  savingLeadAction: boolean;
  loadingHistory: boolean;
  leadHistory: any[];
};

export function CrmLeadDetailsSheet({
  open,
  onOpenChange,
  selectedCrmLead,
  commercialPlan,
  setCommercialPlan,
  commercialAlunos,
  setCommercialAlunos,
  commercialTrialDays,
  setCommercialTrialDays,
  commercialTaxaAtivacao,
  setCommercialTaxaAtivacao,
  commercialMensalidade,
  setCommercialMensalidade,
  commercialStatus,
  setCommercialStatus,
  handleOpenCommercialProposal,
  openingProposalFile,
  proposalDocumentFile,
  setProposalDocumentFile,
  handleUploadCommercialProposal,
  uploadingProposalFile,
  handleSaveCommercialTerms,
  savingCommercialTerms,
  selectedStageToChange,
  setSelectedStageToChange,
  lossReasonText,
  setLossReasonText,
  handleUpdateLeadStage,
  updatingLeadStage,
  convertingLead,
  handleConvertLeadToOnboarding,
  selectedLeadResponsavelId,
  setSelectedLeadResponsavelId,
  partnerMembers,
  memberId,
  memberName,
  nextLeadAction,
  setNextLeadAction,
  nextLeadActionDate,
  setNextLeadActionDate,
  leadActionNotes,
  setLeadActionNotes,
  handleUpdateLeadAction,
  savingLeadAction,
  loadingHistory,
  leadHistory,
}: CrmLeadDetailsSheetProps) {
  const selectedCommercialStatusMeta = COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === commercialStatus) || COMMERCIAL_STATUS_OPTIONS[0];
  const selectedLeadDraft = selectedCrmLead ? {
    ...selectedCrmLead,
    plano_estimado: commercialPlan,
    alunos_estimados: commercialAlunos,
    trial_days: commercialTrialDays,
    taxa_ativacao: commercialTaxaAtivacao,
    mensalidade_kz: commercialMensalidade,
    commercial_status: commercialStatus,
  } : null;
  const selectedLeadConversionBlockers = selectedLeadDraft ? getLeadConversionBlockers(selectedLeadDraft) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto h-full bg-white flex flex-col gap-6 p-8 border-zinc-200/60 shadow-2xl">
        {selectedCrmLead && (
          <div className="flex flex-col gap-6 h-full">
            {/* Header details */}
            <div className="border-b border-zinc-100 pb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Lead Comercial do CRM</span>
                <Badge className={`border border-zinc-200/10 font-semibold uppercase text-[8px] px-2 py-0.5 rounded-md shadow-none ${
                  CRM_STAGES[selectedCrmLead.etapa as keyof typeof CRM_STAGES]?.color || "bg-zinc-100 text-zinc-600"
                }`}>
                  {CRM_STAGES[selectedCrmLead.etapa as keyof typeof CRM_STAGES]?.label || selectedCrmLead.etapa}
                </Badge>
              </div>
              <h3 className="font-bold text-zinc-950 text-xl tracking-tight leading-tight">
                {selectedCrmLead.nome_escola}
              </h3>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-600 border-zinc-200/60 shadow-none">
                  Plano Estimado: {selectedCrmLead.plano_estimado}
                </Badge>
                {selectedCrmLead.alunos_estimados > 0 && (
                  <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-600 border-zinc-200/60 shadow-none font-mono">
                    {selectedCrmLead.alunos_estimados} Alunos
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-600 border-zinc-200/60 shadow-none">
                  Segmento: {selectedCrmLead.segmento}
                </Badge>
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-600 border-zinc-200/60 shadow-none font-mono">
                  Trial: {selectedCrmLead.trial_days ?? 15} dias
                </Badge>
                {selectedCrmLead.marketing_lead_id ? (
                  <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200/70 shadow-none">
                    Originado do marketing
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-600 border-zinc-200/60 shadow-none font-mono">
                  Taxa: Kz {(selectedCrmLead.taxa_ativacao ?? 0).toLocaleString('pt-PT')}
                </Badge>
                {selectedCrmLead.mensalidade_kz ? (
                  <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-zinc-50 text-zinc-600 border-zinc-200/60 shadow-none font-mono">
                    Mensalidade: Kz {(selectedCrmLead.mensalidade_kz ?? 0).toLocaleString('pt-PT')}
                  </Badge>
                ) : null}
                {selectedCrmLead.commercial_status ? (
                  <Badge className={`${COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === selectedCrmLead.commercial_status)?.color || "bg-zinc-100 text-zinc-700"} border-none text-[9px] font-semibold uppercase tracking-wider shadow-none`}>
                    {COMMERCIAL_STATUS_OPTIONS.find((item) => item.value === selectedCrmLead.commercial_status)?.label || selectedCrmLead.commercial_status}
                  </Badge>
                ) : null}
              </div>
            </div>

            {/* Informações Gerais do Lead */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <Users size={14} className="text-zinc-400" />
                Informações de Contato
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 rounded-xl border border-zinc-200/50 bg-zinc-50/50 p-4">
                <div>
                  <span className="block text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Contato Decisor</span>
                  <span className="text-xs font-semibold text-zinc-800">{selectedCrmLead.nome_contacto || <span className="italic font-medium text-zinc-400">Não informado</span>}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Telefone</span>
                  <span className="text-xs font-semibold text-zinc-800 font-mono">{selectedCrmLead.telefone || <span className="italic font-medium text-zinc-400">Não informado</span>}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="block text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">E-mail Comercial</span>
                  <span className="text-xs font-semibold text-zinc-800">{selectedCrmLead.email || <span className="italic font-medium text-zinc-400">Não informado</span>}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <FileText size={14} className="text-zinc-400" />
                Proposta Comercial
              </h4>
              <div className="space-y-3 rounded-xl border border-zinc-200/50 bg-zinc-50/40 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Plano</label>
                    <select
                      value={commercialPlan}
                      onChange={(e) => setCommercialPlan(e.target.value as "essencial" | "profissional" | "premium")}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none cursor-pointer"
                    >
                      {CRM_PLAN_OPTIONS.map((plan) => (
                        <option key={plan.value} value={plan.value}>{plan.label}</option>
                      ))}
                    </select>
                    {(() => {
                      const tiers = { essencial: 1, profissional: 2, premium: 3 };
                      const recommended = commercialAlunos <= 600 ? "essencial" : commercialAlunos <= 1500 ? "profissional" : "premium";
                      const isBelow = tiers[commercialPlan] < tiers[recommended];
                      if (isBelow) {
                        return (
                          <p className="mt-1 text-[9px] font-bold text-amber-600 animate-pulse">
                            ⚠️ Recomendado: Plano {recommended.charAt(0).toUpperCase() + recommended.slice(1)} para {commercialAlunos} alunos.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Alunos Estimados</label>
                    <input
                      type="number"
                      min={0}
                      value={commercialAlunos}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value || 0));
                        setCommercialAlunos(val);
                        if (val <= 600) {
                          setCommercialPlan("essencial");
                        } else if (val <= 1500) {
                          setCommercialPlan("profissional");
                        } else {
                          setCommercialPlan("premium");
                        }
                      }}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Trial (dias)</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={commercialTrialDays}
                      onChange={(e) => setCommercialTrialDays(Math.min(30, Math.max(0, Number(e.target.value || 0))))}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Taxa de Ativação (Kz)</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={commercialTaxaAtivacao}
                      onChange={(e) => setCommercialTaxaAtivacao(Math.max(0, Number(e.target.value || 0)))}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Mensalidade (Kz)</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={commercialMensalidade}
                      onChange={(e) => setCommercialMensalidade(Math.max(0, Number(e.target.value || 0)))}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Status Comercial</label>
                    <select
                      value={commercialStatus}
                      onChange={(e) => setCommercialStatus(e.target.value as (typeof COMMERCIAL_STATUS_OPTIONS)[number]["value"])}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none cursor-pointer"
                    >
                      {COMMERCIAL_STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200/70 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`${selectedCommercialStatusMeta.color} border-none text-[9px] font-semibold uppercase tracking-wider shadow-none`}>
                      {selectedCommercialStatusMeta.label}
                    </Badge>
                    {selectedCrmLead.aceite_comercial_at ? (
                      <span className="text-[10px] font-medium text-zinc-500">
                        Aceite em {format(new Date(selectedCrmLead.aceite_comercial_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-zinc-600">
                    <p>Plano: <span className="font-semibold text-zinc-900">{CRM_PLAN_OPTIONS.find((plan) => plan.value === commercialPlan)?.label || commercialPlan}</span></p>
                    <p>Alunos: <span className="font-semibold text-zinc-900">{commercialAlunos}</span></p>
                    <p>Trial: <span className="font-semibold text-zinc-900">{commercialTrialDays} dias</span></p>
                    <p>Taxa: <span className="font-semibold text-zinc-900">Kz {commercialTaxaAtivacao.toLocaleString("pt-PT")}</span></p>
                    <p className="col-span-2">Mensalidade: <span className="font-semibold text-zinc-900">Kz {commercialMensalidade.toLocaleString("pt-PT")}</span></p>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white/80 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Documento da Proposta</p>
                      <p className="mt-1 text-xs font-medium text-zinc-700">
                        {selectedCrmLead.proposal_file_name || "Nenhum anexo comercial enviado ainda."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams({
                            escola: selectedCrmLead.nome_escola,
                            contacto: selectedCrmLead.nome_contacto || "",
                            plano: commercialPlan,
                            alunos: String(commercialAlunos),
                            trial: String(commercialTrialDays),
                            taxa: String(commercialTaxaAtivacao),
                            mensalidade: String(commercialMensalidade),
                          });
                          window.open(`/crm/proposta/preview?${params.toString()}`, '_blank');
                        }}
                        variant="outline"
                        className="h-9 rounded-lg border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 flex items-center gap-1"
                      >
                        <ExternalLink size={11} className="text-zinc-400" />
                        Preview
                      </Button>
                      {selectedCrmLead.proposal_file_name ? (
                        <Button
                          onClick={handleOpenCommercialProposal}
                          disabled={openingProposalFile}
                          variant="outline"
                          className="h-9 rounded-lg border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
                        >
                          {openingProposalFile ? "A abrir..." : "Abrir"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setProposalDocumentFile(e.target.files?.[0] ?? null)}
                      className="block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-medium text-zinc-700"
                    />
                    <Button
                      onClick={handleUploadCommercialProposal}
                      disabled={uploadingProposalFile || !proposalDocumentFile}
                      className="h-9 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 border-none"
                    >
                      {uploadingProposalFile ? "A enviar..." : "Anexar proposta"}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Estes dados definem a proposta comercial, registam o aceite e seguem para o onboarding quando a negociação estiver pronta.
                </p>
                <Button
                  onClick={handleSaveCommercialTerms}
                  disabled={savingCommercialTerms}
                  className="w-full h-9 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 border-none"
                >
                  {savingCommercialTerms ? "A guardar..." : "Salvar Termos Comerciais"}
                </Button>
              </div>
            </div>

            {/* Stage Update Area */}
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <Target size={14} className="text-zinc-400" />
                Mover Etapa Comercial
              </h4>
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-50/40 border border-zinc-200/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Nova Etapa</label>
                    <select
                      value={selectedStageToChange}
                      onChange={(e) => setSelectedStageToChange(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none cursor-pointer"
                    >
                      {Object.entries(CRM_STAGES).map(([code, meta]) => (
                        <option key={code} value={code}>{meta.label}</option>
                      ))}
                    </select>
                  </div>
                  {selectedStageToChange === 'perdido' && (
                    <div>
                      <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Motivo da Perda</label>
                      <input
                        type="text"
                        value={lossReasonText}
                        onChange={(e) => setLossReasonText(e.target.value)}
                        placeholder="Ex: Sem orçamento"
                        className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-medium text-zinc-700 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleUpdateLeadStage(selectedCrmLead.id, selectedStageToChange)}
                  disabled={updatingLeadStage || (selectedStageToChange === 'perdido' && !lossReasonText.trim())}
                  className="w-full mt-2 h-9 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 border-none"
                >
                  {updatingLeadStage ? "A atualizar..." : "Confirmar Mudança de Etapa"}
                </Button>
              </div>
            </div>

            {/* Conversion to onboarding */}
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <School size={14} className="text-zinc-400" />
                Conversão para Onboarding
              </h4>
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                {selectedCrmLead.onboarding_request_id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">Lead convertido em pedido de onboarding</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        Token: <span className="font-mono">{selectedCrmLead.tracking_token || "gerado"}</span>
                      </p>
                    </div>
                    {selectedCrmLead.tracking_token && (
                      <Link
                        href={`/onboarding/acompanhar/${selectedCrmLead.tracking_token}`}
                        target="_blank"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white no-underline hover:bg-emerald-700"
                      >
                        Abrir portal de onboarding <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-medium leading-relaxed text-emerald-800">
                      Quando a negociação estiver ganha, crie o pedido de onboarding com os dados deste lead. O provisionamento e o setup da escola acontecem depois, em fluxos separados.
                    </p>
                    {selectedLeadConversionBlockers.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">Pré-requisitos pendentes</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {selectedLeadConversionBlockers.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button
                      onClick={handleConvertLeadToOnboarding}
                      disabled={convertingLead || selectedCrmLead.etapa === "perdido" || selectedLeadConversionBlockers.length > 0}
                      className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 border-none"
                    >
                      {convertingLead ? (
                        <>
                          <Loader2 size={14} className="animate-spin mr-1.5" />
                          A criar onboarding...
                        </>
                      ) : (
                        <>
                          Criar pedido de onboarding <ArrowRight size={14} className="ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* CRM Lead Next Action & Logging */}
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <Phone size={14} className="text-zinc-400" />
                Registrar Contato & Próximo Passo
              </h4>
              <div className="space-y-3 p-4 rounded-xl bg-zinc-50/40 border border-zinc-200/50">
                <div>
                  <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Responsável pelo Follow-up</label>
                  <select
                    value={selectedLeadResponsavelId}
                    onChange={(e) => setSelectedLeadResponsavelId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none cursor-pointer"
                  >
                    {(partnerMembers.length > 0 ? partnerMembers : [{ membro_id: memberId, membro_nome: memberName } as PartnerLoginMember]).map((member) => (
                      <option key={member.membro_id} value={member.membro_id}>
                        {member.membro_nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Próxima Ação Comercial</label>
                    <input
                      type="text"
                      value={nextLeadAction}
                      onChange={(e) => setNextLeadAction(e.target.value)}
                      placeholder="Ex: Enviar proposta comercial"
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Prazo da Ação</label>
                    <input
                      type="date"
                      value={nextLeadActionDate}
                      onChange={(e) => setNextLeadActionDate(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-semibold uppercase text-zinc-400 tracking-wider">Notas da Ligação / Reunião</label>
                  <textarea
                    value={leadActionNotes}
                    onChange={(e) => setLeadActionNotes(e.target.value)}
                    placeholder="Descreva o que foi conversado e alinhe o próximo passo (ex: Reunião excelente com diretor, demonstrou interesse no plano profissional. Próximo passo: formalizar proposta de valores)."
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-medium text-zinc-700 focus:outline-none placeholder-zinc-400 resize-none"
                  />
                </div>

                <Button
                  onClick={handleUpdateLeadAction}
                  disabled={savingLeadAction || !nextLeadAction.trim()}
                  className="w-full h-9 rounded-lg bg-zinc-950 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 border-none"
                >
                  {savingLeadAction ? "A registrar..." : "Salvar Ação & Registrar Notas"}
                </Button>
              </div>
            </div>

            {/* Lead interaction timeline logs */}
            <div className="space-y-3.5 border-t border-zinc-100 pt-4 flex-1 flex flex-col min-h-0">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                <Clock size={14} className="text-zinc-400" />
                Histórico de Interações do Lead
              </h4>
              
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {loadingHistory ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
                  </div>
                ) : leadHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center">
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Nenhum histórico comercial registrado</p>
                  </div>
                ) : (
                  <div className="relative pl-4 border-l border-zinc-100 space-y-4 py-1 ml-2">
                    {leadHistory.map((logItem) => {
                      const isMove = logItem.acao === 'CRM_LEAD_STAGE_MOVE';
                      const actionLabel =
                        logItem.acao === 'CRM_LEAD_COMMERCIAL_UPDATED'
                          ? `${logItem.member_name} atualizou a proposta`
                          : logItem.acao === 'CRM_LEAD_PROPOSAL_UPLOADED'
                            ? `${logItem.member_name} anexou um documento`
                            : logItem.acao === 'CRM_LEAD_CONVERTED_TO_ONBOARDING'
                              ? "Lead convertido para onboarding"
                              : `${logItem.member_name} inseriu notas`;
                      return (
                        <div key={logItem.id} className="relative group/timeline">
                          <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border border-white shadow-sm ring-4 ${
                            isMove ? 'bg-amber-400 ring-zinc-100/50' : 'bg-blue-500 ring-zinc-100/50'
                          }`} />
                          
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-zinc-900">
                                {isMove ? 'Etapa comercial alterada' : actionLabel}
                              </span>
                              <span className="text-[9px] font-medium text-zinc-400 font-mono">
                                {format(new Date(logItem.created_at), "dd MMM, HH:mm", { locale: pt })}
                              </span>
                            </div>

                            {isMove ? (
                              <div className="text-xs font-medium text-zinc-600 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
                                Mapeamento de: <span className="font-semibold uppercase text-[9px] text-zinc-500">{CRM_STAGES[logItem.origem_etapa]?.label || logItem.origem_etapa}</span> ➔ <span className="font-semibold uppercase text-[9px] text-emerald-600">{CRM_STAGES[logItem.nova_etapa]?.label || logItem.nova_etapa}</span>
                                {logItem.motivo_perda && (
                                  <p className="mt-1 font-medium text-rose-600 bg-rose-500/5 border border-rose-500/10 p-2 rounded-md text-[10px]">
                                    Motivo da Perda: {logItem.motivo_perda}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs font-medium text-zinc-600 bg-zinc-50 rounded-lg p-3 border border-zinc-200/50 leading-relaxed shadow-sm">
                                {logItem.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
