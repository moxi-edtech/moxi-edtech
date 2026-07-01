import { 
  Calendar, 
  Check, 
  CheckCircle2, 
  Clock, 
  Copy, 
  ExternalLink, 
  FileText, 
  Phone, 
  Send, 
  Share2, 
  Users, 
  CheckSquare, 
  AlertCircle, 
  UploadCloud, 
  Loader2, 
  Download,
  ShieldCheck,
  Activity,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getImplantationProgress,
  getLatestOnboardingCall,
  getLatestOnboardingCallForStep,
  getOnboardingLifecycleMeta,
  getStepMeta,
  IMPLANTATION_STATUS_CONFIG,
  isSchoolOperational,
  type OnboardingEscola,
  type OnboardingImplantationItem,
  type OnboardingUpload,
} from "./partner-dashboard-model";

type OnboardingSchoolDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSchoolForDetails: OnboardingEscola | null;
  setSelectedSchoolForCall: (school: OnboardingEscola) => void;
  setSelectedStepCodeForCall: (stepCode: string) => void;
  setCallModalOpen: (open: boolean) => void;
  copyToClipboard: (text: string) => void;
  implantationChecklistDraft: OnboardingImplantationItem[];
  handleToggleImplantationItem: (code: string) => void;
  handleChangeImplantationNote: (code: string, note: string) => void;
  handleSaveImplantationChecklist: () => Promise<void>;
  savingImplantationChecklist: boolean;
  codigo: string;
  loadData: (force?: boolean) => Promise<void>;
};

export function OnboardingSchoolDetailsSheet({
  open,
  onOpenChange,
  selectedSchoolForDetails,
  setSelectedSchoolForCall,
  setSelectedStepCodeForCall,
  setCallModalOpen,
  copyToClipboard,
  implantationChecklistDraft,
  handleToggleImplantationItem,
  handleChangeImplantationNote,
  handleSaveImplantationChecklist,
  savingImplantationChecklist,
  codigo,
  loadData,
}: OnboardingSchoolDetailsSheetProps) {
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null);
  const [signedBy, setSignedBy] = useState("");
  const [signedRole, setSignedRole] = useState("Director Geral");
  const [signedAt, setSignedAt] = useState("");
  const [acceptanceNotes, setAcceptanceNotes] = useState("");
  const [submittingAcceptance, setSubmittingAcceptance] = useState(false);
  const [uploadTriageDrafts, setUploadTriageDrafts] = useState<Record<string, {
    status: string;
    document_type: string;
    note: string;
  }>>({});
  const [savingUploadTriageId, setSavingUploadTriageId] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const lifecycleMeta = selectedSchoolForDetails ? getOnboardingLifecycleMeta(selectedSchoolForDetails) : null;

  const documentTypeOptions = [
    { value: "legal", label: "Legal" },
    { value: "planilha", label: "Planilha" },
    { value: "contrato", label: "Contrato" },
    { value: "logotipo", label: "Logotipo" },
    { value: "pauta", label: "Pauta" },
    { value: "termo_aceite", label: "Termo de Aceite" },
    { value: "outro", label: "Outro" },
  ];

  const partnerTriageStatusOptions = [
    { value: "em_revisao_parceiro", label: "Em revisão parceiro" },
    { value: "pendencia_cliente", label: "Pendência cliente" },
    { value: "pronto_para_klasse", label: "Pronto para KLASSE" },
  ];

  const getUploadTriageDraft = (upload: OnboardingUpload) => (
    uploadTriageDrafts[upload.id] ?? {
      status: ["em_revisao_parceiro", "pendencia_cliente", "pronto_para_klasse"].includes(upload.status)
        ? upload.status
        : "em_revisao_parceiro",
      document_type: upload.document_type || "",
      note: upload.partner_review_note || upload.rejection_reason || "",
    }
  );

  const updateUploadTriageDraft = (upload: OnboardingUpload, changes: Partial<{
    status: string;
    document_type: string;
    note: string;
  }>) => {
    setUploadTriageDrafts((current) => ({
      ...current,
      [upload.id]: {
        ...getUploadTriageDraft(upload),
        ...changes,
      },
    }));
  };

  const handleSaveUploadTriage = async (upload: OnboardingUpload) => {
    if (!selectedSchoolForDetails?.token) return;
    const draft = getUploadTriageDraft(upload);
    if (!draft.document_type) {
      toast.error("Classifique o tipo de documento antes de salvar.");
      return;
    }
    if (draft.status === "pendencia_cliente" && !draft.note.trim()) {
      toast.error("Informe a pendência que deve ser devolvida ao cliente.");
      return;
    }

    setSavingUploadTriageId(upload.id);
    try {
      const response = await fetch(`/api/influencers/${codigo}/onboarding/${selectedSchoolForDetails.token}/uploads/${upload.id}/triage`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          document_type: draft.document_type,
          note: draft.note.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error || "Falha ao salvar triagem documental.");
        return;
      }

      toast.success("Triagem documental salva.");
      setUploadTriageDrafts((current) => {
        const next = { ...current };
        delete next[upload.id];
        return next;
      });
      await loadData(false);
    } catch (err: any) {
      toast.error(err.message || "Falha ao salvar triagem documental.");
    } finally {
      setSavingUploadTriageId(null);
    }
  };

  const handleUploadAndValidateAcceptance = async () => {
    if (!selectedSchoolForDetails?.token || !acceptanceFile || !signedBy.trim() || !signedAt.trim()) {
      toast.error("Preencha todos os campos obrigatórios e anexe o arquivo.");
      return;
    }

    setSubmittingAcceptance(true);
    try {
      const formData = new FormData();
      formData.append("file", acceptanceFile);
      formData.append("signed_by", signedBy);
      formData.append("signed_role", signedRole);
      formData.append("signed_at", new Date(signedAt).toISOString());
      formData.append("notes", acceptanceNotes);

      const res = await fetch(`/api/influencers/${codigo}/onboarding/${selectedSchoolForDetails.token}/acceptance`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || "Erro ao validar o Termo de Aceite.");
        return;
      }

      toast.success("Termo de Aceite validado. A comissão de activação pode seguir o próximo passo.");
      setAcceptanceFile(null);
      setSignedBy("");
      setSignedAt("");
      setAcceptanceNotes("");
      await loadData(false);
    } catch (err: any) {
      toast.error(err.message || "Erro de conexão ao validar Termo de Aceite.");
    } finally {
      setSubmittingAcceptance(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Sheet Drawer for Onboarding School Details */}
      <SheetContent className="sm:max-w-xl overflow-y-auto h-full bg-white flex flex-col gap-6 p-8 border-slate-200 shadow-2xl">
          {selectedSchoolForDetails && (
            <div className="flex flex-col gap-6 h-full">
              {/* Header */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Escola em Onboarding</span>
                  <Badge className={`border font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-lg ${lifecycleMeta?.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {lifecycleMeta?.shortLabel || 'Onboarding'}
                  </Badge>
                </div>
                <h3 className="font-bold text-slate-900 text-xl tracking-tight leading-tight">
                  {selectedSchoolForDetails.escola}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                    Plano: {selectedSchoolForDetails.plano_label || selectedSchoolForDetails.plano || "Não informado"}
                  </Badge>
                  {selectedSchoolForDetails.total_alunos && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      {selectedSchoolForDetails.total_alunos} Alunos Estimados
                    </Badge>
                  )}
                  {selectedSchoolForDetails.escola_nif && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      NIF: {selectedSchoolForDetails.escola_nif}
                    </Badge>
                  )}
                  {getLatestOnboardingCall(selectedSchoolForDetails) && (
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border-blue-200">
                      Último follow-up: {format(new Date(getLatestOnboardingCall(selectedSchoolForDetails)!.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                    </Badge>
                  )}
                </div>
                {lifecycleMeta ? (
                  <div className={`mt-4 rounded-2xl border p-3 ${lifecycleMeta.color}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest">{lifecycleMeta.label}</p>
                    <p className="mt-1 text-xs font-medium leading-relaxed">
                      {lifecycleMeta.description}
                    </p>
                  </div>
                ) : null}
                {selectedSchoolForDetails.operational_readiness?.summary && !isSchoolOperational(selectedSchoolForDetails) ? (
                  <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-rose-800">
                    <p className="text-[10px] font-black uppercase tracking-widest">Readiness operacional pendente</p>
                    <p className="mt-1 text-xs font-medium leading-relaxed">
                      A escola já pode estar provisionada ou com setup concluído, mas ainda não está operacional em todos os portais.
                    </p>
                    {selectedSchoolForDetails.operational_readiness?.blockers?.length ? (
                      <div className="mt-2 space-y-1">
                        {selectedSchoolForDetails.operational_readiness.blockers.slice(0, 3).map((blocker, index) => (
                          <p key={`${blocker.code || blocker.title || "blocker"}-${index}`} className="text-[11px] leading-relaxed">
                            • {blocker.title || blocker.code}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {selectedSchoolForDetails.status !== 'activo' && (
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        const nextPending = selectedSchoolForDetails.steps?.find((st) => st.status !== 'concluido');
                        setSelectedSchoolForCall(selectedSchoolForDetails);
                        setSelectedStepCodeForCall(nextPending?.code || "");
                        setCallModalOpen(true);
                      }}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
                    >
                      <Phone size={12} className="text-slate-400" />
                      REGISTRAR LIGAÇÃO
                    </Button>
                  </div>
                )}
              </div>

              {/* Share/Copy tracking link */}
              {selectedSchoolForDetails.token && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Share2 size={12} className="text-[#1F6B3B]" /> LINK DE ACOMPANHAMENTO DA ESCOLA
                    </span>
                    <Link
                      href={`/onboarding/acompanhar/${selectedSchoolForDetails.token}`}
                      target="_blank"
                      className="text-[10px] font-bold text-[#1F6B3B] hover:underline flex items-center gap-1 no-underline"
                    >
                      Ver página pública <ExternalLink size={10} />
                    </Link>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
                    <span className="text-xs font-mono font-medium text-slate-500 truncate flex-1 select-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : '';
                        copyToClipboard(trackingUrl);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-colors"
                      title="Copiar Link"
                    >
                      <Copy size={12} />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : '';
                        copyToClipboard(trackingUrl);
                      }}
                      className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 shadow-none"
                    >
                      <Copy size={12} /> COPIAR LINK
                    </Button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Acompanhe o processo de onboarding da sua escola (${selectedSchoolForDetails.escola}) em tempo real no nosso Portal de Onboarding. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : ''}`
                      )}${
                        selectedSchoolForDetails.director_tel || selectedSchoolForDetails.escola_tel
                          ? `&phone=${(selectedSchoolForDetails.director_tel || selectedSchoolForDetails.escola_tel || '').replace(/\D/g, '')}`
                          : ''
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-9 rounded-xl bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 px-3 text-[10px] font-bold text-white flex items-center justify-center gap-1.5 shadow-none no-underline"
                    >
                      <Send size={12} /> COMPARTILHAR WHATSAPP
                    </a>
                  </div>
                </div>
              )}

              <Tabs defaultValue="progresso" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl mb-2">
                  <TabsTrigger value="progresso" className="rounded-lg font-bold text-xs uppercase tracking-wider">
                    Progresso (SLA)
                  </TabsTrigger>
                  <TabsTrigger value="implantacao" className="rounded-lg font-bold text-xs uppercase tracking-wider">
                    Implantação
                  </TabsTrigger>
                  <TabsTrigger value="ficha" className="rounded-lg font-bold text-xs uppercase tracking-wider">
                    Ficha da Escola
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: Progresso e Etapas */}
                <TabsContent value="progresso" className="m-0 flex-1 overflow-y-auto space-y-6 pr-1 pt-2">
                  {/* Progress circular indicator */}
                  {(() => {
                    const steps = selectedSchoolForDetails.steps || [];
                    const completedSteps = steps.filter(s => s.status === 'concluido').length;
                    const progressPercent = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
                    
                    return (
                      <div className="bg-slate-950 text-white rounded-3xl p-5 shadow-lg flex items-center justify-between border border-white/5 gap-4">
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-white/10 text-klasse-gold">
                            Resumo de Ativação
                          </span>
                          <h4 className="text-sm font-bold tracking-tight">Etapas concluídas</h4>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            O onboarding é composto por 7 fases oficiais síncronas.
                          </p>
                        </div>
                        
                        <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                            <circle cx="40" cy="40" r="34" stroke="#E3B23C" strokeWidth="6" fill="transparent"
                              strokeDasharray={2 * Math.PI * 34}
                              strokeDashoffset={2 * Math.PI * 34 * (1 - progressPercent / 100)}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-base font-bold text-white">{progressPercent}%</span>
                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{completedSteps}/{steps.length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Checklist of Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Roteiro de Ativação
                    </h4>
                    
                    <div className="space-y-3">
                      {(selectedSchoolForDetails.steps || []).map((step, index) => {
                        const isCompleted = step.status === "concluido";
                        const isProgress = step.status === "em_progresso";
                        const isOverdue = step.deadline && new Date() >= new Date(step.deadline) && !isCompleted;
                        const meta = getStepMeta(step.code, step.owner as any);
                        const latestStepCall = getLatestOnboardingCallForStep(selectedSchoolForDetails, step.code, step.title);

                        return (
                          <div key={step.code} className={`bg-white border rounded-2xl p-4 transition-all flex items-start gap-3.5 shadow-sm hover:shadow-md ${isProgress ? 'border-[#1F6B3B] ring-1 ring-[#1F6B3B]/10' : 'border-slate-200'}`}>
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-0.5">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs
                                ${isCompleted ? 'bg-[#E8F5EE] text-[#1F6B3B]' : isProgress ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                {isCompleted ? <Check size={14} /> : index + 1}
                              </div>
                              <div className="text-[7px] font-bold uppercase text-slate-400">{meta.short}</div>
                            </div>
                            
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <h5 className="font-bold text-slate-900 text-xs truncate">{step.title}</h5>
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border
                                    ${step.owner === 'escola' ? 'bg-blue-50 text-blue-700 border-blue-100' : step.owner === 'parceiro' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                    {meta.ownerLabel}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border
                                    ${isCompleted ? 'bg-[#E8F5EE] text-[#1F6B3B] border-emerald-100' : isOverdue ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                    {isCompleted ? 'Concluído' : isOverdue ? 'Atrasado SLA' : 'No Prazo'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-semibold">
                                {step.deadline && (
                                  <span className="flex items-center gap-1.5">
                                    <Calendar size={10} /> Limite: {format(new Date(step.deadline), "dd 'de' MMMM", { locale: pt })}
                                  </span>
                                )}
                                {step.completed_at && (
                                  <span className="flex items-center gap-1.5 text-[#1F6B3B]">
                                    <CheckCircle2 size={10} /> Concluído a: {format(new Date(step.completed_at), "dd/MM/yyyy", { locale: pt })}
                                  </span>
                                )}
                              </div>
                              {latestStepCall && (
                                <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] font-semibold text-blue-700">
                                  Última ligação nesta etapa: {latestStepCall.member_name} · {format(new Date(latestStepCall.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                                </div>
                              )}
                              {!isCompleted && (
                                <div className="pt-1">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSchoolForCall(selectedSchoolForDetails);
                                      setSelectedStepCodeForCall(step.code);
                                      setCallModalOpen(true);
                                    }}
                                    className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
                                  >
                                    <Phone size={11} className="text-slate-400" />
                                    REGISTRAR LIGAÇÃO DE FOLLOW-UP
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: Implantação e Checklist */}
                <TabsContent value="implantacao" className="m-0 flex-1 overflow-y-auto space-y-6 pr-1 pt-2">
                  {/* Status da Implantação */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#1F6B3B]" />
                      Estado de Implantação
                    </h4>
                    {(() => {
                      const impStatus = selectedSchoolForDetails.implantation_status || "implantacao_em_andamento";
                      const statusMeta = IMPLANTATION_STATUS_CONFIG[impStatus as keyof typeof IMPLANTATION_STATUS_CONFIG] || IMPLANTATION_STATUS_CONFIG.implantacao_em_andamento;
                      return (
                        <div className={`p-4 rounded-2xl border ${statusMeta.color} flex items-center justify-between`}>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Atual</p>
                            <p className="text-xs font-bold mt-0.5">{statusMeta.label}</p>
                          </div>
                          {impStatus === "aceite_validado" ? (
                            <Badge className="bg-emerald-600 text-white font-bold uppercase text-[8px] border-none px-2 py-0.5 rounded shadow-none">Ativação Pronta</Badge>
                          ) : impStatus === "aguardando_aceite" ? (
                            <Badge className="bg-amber-500 text-white font-bold uppercase text-[8px] border-none px-2 py-0.5 rounded shadow-none animate-pulse">Aguardando Termo</Badge>
                          ) : (
                            <Badge className="bg-blue-600 text-white font-bold uppercase text-[8px] border-none px-2 py-0.5 rounded shadow-none">Em Progresso</Badge>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Checklist */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <CheckSquare size={14} className="text-slate-400" />
                        Checklist de Implantação Técnica
                      </h4>
                      {savingImplantationChecklist && (
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1F6B3B]" /> A salvar...
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Estes itens operacionais devem estar concluídos para formalizar a entrega que ativa a escola e libera as comissões.
                    </p>

                    <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                      {implantationChecklistDraft.map((item) => (
                        <div key={item.code} className="flex flex-col gap-2 p-3 rounded-xl border border-slate-200/60 bg-white shadow-sm">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleToggleImplantationItem(item.code)}
                              disabled={savingImplantationChecklist || selectedSchoolForDetails.implantation_status === 'aceite_validado'}
                              className="w-4 h-4 text-[#1F6B3B] border-slate-300 rounded focus:ring-[#1F6B3B] cursor-pointer disabled:opacity-50"
                            />
                            <span className={`text-xs font-bold ${item.completed ? 'text-[#1F6B3B]' : 'text-slate-700'}`}>
                              {item.label}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={item.note || ''}
                            onChange={(e) => handleChangeImplantationNote(item.code, e.target.value)}
                            placeholder="Adicionar nota técnica..."
                            disabled={savingImplantationChecklist || selectedSchoolForDetails.implantation_status === 'aceite_validado'}
                            className="w-full text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:bg-white placeholder-slate-400"
                          />
                        </div>
                      ))}
                      {selectedSchoolForDetails.implantation_status !== 'aceite_validado' && (
                        <Button
                          onClick={handleSaveImplantationChecklist}
                          disabled={savingImplantationChecklist}
                          className="w-full bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white rounded-xl font-bold text-xs h-10 mt-2 border-none"
                        >
                          {savingImplantationChecklist ? "A salvar checklist..." : "Salvar Checklist Técnica"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Validação Automática do Sistema (Real-Time) */}
                  {selectedSchoolForDetails.operational_readiness && (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Activity size={14} className="text-[#1F6B3B]" />
                        Prontidão Operacional Automática (Real-Time)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Validação automática baseada nos registros reais do banco de dados da escola.
                      </p>

                      <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
                        {/* Resumo de Status */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">Maturidade do Sistema:</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            selectedSchoolForDetails.operational_readiness.summary?.operational_ok 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {selectedSchoolForDetails.operational_readiness.summary?.operational_ok ? "100% Pronta" : "Pendente"}
                          </span>
                        </div>

                         {/* Listar Bloqueadores Críticos se houver */}
                         {selectedSchoolForDetails.operational_readiness.blockers && 
                          selectedSchoolForDetails.operational_readiness.blockers.filter((b: any) => b.severity === 'critical' || b.severity === 'high').length > 0 ? (
                           <div className="space-y-2">
                             <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Bloqueadores Críticos no Banco ({
                               selectedSchoolForDetails.operational_readiness.blockers.filter((b: any) => b.severity === 'critical' || b.severity === 'high').length
                             })</p>
                             <div className="space-y-1.5">
                               {selectedSchoolForDetails.operational_readiness.blockers
                                 .filter((b: any) => b.severity === 'critical' || b.severity === 'high')
                                 .map((blocker: any, idx: number) => (
                                   <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-xs font-medium animate-in fade-in slide-in-from-top-1">
                                     <AlertCircle size={13} className="shrink-0 mt-0.5 text-rose-600" />
                                     <div>
                                       <p className="font-bold">{blocker.area?.toUpperCase()}: {blocker.title}</p>
                                       {blocker.detail && <p className="text-[10px] text-rose-600/90 mt-0.5 leading-relaxed">{blocker.detail}</p>}
                                     </div>
                                   </div>
                                 ))}
                             </div>
                           </div>
                         ) : (
                           <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                             <CheckCircle2 size={14} className="text-emerald-600" />
                             Nenhum bloqueador crítico de banco detectado. O sistema está estruturalmente pronto!
                           </div>
                         )}

                         {/* Listar Alertas Recomendados se houver */}
                         {selectedSchoolForDetails.operational_readiness.blockers && 
                          selectedSchoolForDetails.operational_readiness.blockers.filter((b: any) => b.severity === 'medium' || b.severity === 'low').length > 0 && (
                           <div className="space-y-2 pt-2 border-t border-slate-100">
                             <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Alertas Recomendados ({
                               selectedSchoolForDetails.operational_readiness.blockers.filter((b: any) => b.severity === 'medium' || b.severity === 'low').length
                             })</p>
                             <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                               {selectedSchoolForDetails.operational_readiness.blockers
                                 .filter((b: any) => b.severity === 'medium' || b.severity === 'low')
                                 .map((blocker: any, idx: number) => (
                                   <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-100/60 text-amber-800 text-xs font-medium animate-in fade-in slide-in-from-top-1">
                                     <Info size={13} className="shrink-0 mt-0.5 text-amber-600" />
                                     <div>
                                       <p className="font-bold">{blocker.area?.toUpperCase()}: {blocker.title}</p>
                                       {blocker.detail && <p className="text-[10px] text-amber-600/90 mt-0.5 leading-relaxed">{blocker.detail}</p>}
                                     </div>
                                   </div>
                                 ))}
                             </div>
                           </div>
                         )}
                      </div>
                    </div>
                  )}

                  {/* Termo de Aceite */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <FileText size={14} className="text-slate-400" />
                      Termo de Aceite da Implantação
                    </h4>

                    {selectedSchoolForDetails.implantation_status === "aceite_validado" ? (
                      <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[#1f6b3b] text-xs font-bold">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          Termo de Aceite validado com sucesso!
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed text-emerald-800">
                          Este aceite libera a comissão de activação para o fluxo financeiro. O setup académico final da escola continua no portal da escola.
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <p>Signatário: <span className="font-bold text-slate-800">{selectedSchoolForDetails.acceptance_signed_by}</span></p>
                          <p>Cargo: <span className="font-bold text-slate-800">{selectedSchoolForDetails.acceptance_signed_role || "Diretor Geral"}</span></p>
                          <p className="col-span-2">Assinado em: <span className="font-bold text-slate-800">{selectedSchoolForDetails.acceptance_signed_at ? format(new Date(selectedSchoolForDetails.acceptance_signed_at), "dd/MM/yyyy HH:mm", { locale: pt }) : "N/I"}</span></p>
                          {selectedSchoolForDetails.acceptance_notes && <p className="col-span-2">Notas: <span className="font-semibold text-slate-500 italic">"{selectedSchoolForDetails.acceptance_notes}"</span></p>}
                        </div>
                        {selectedSchoolForDetails.acceptance_term_file_path && (
                          <Button asChild className="w-full h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-zinc-700 shadow-none">
                            <a href={`${supabaseUrl}/storage/v1/object/public/onboarding/${selectedSchoolForDetails.acceptance_term_file_path}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 no-underline">
                              <Download size={13} /> Descarregar Termo de Aceite
                            </a>
                          </Button>
                        )}
                      </div>
                    ) : selectedSchoolForDetails.implantation_status === "aguardando_aceite" ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                        <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                          O checklist técnico está concluído. Para liberar a comissão de activação e o próximo passo financeiro, anexe o Termo de Aceite assinado pelo diretor e submeta.
                        </p>
                        <div className="space-y-3 bg-white border border-slate-200/50 p-3.5 rounded-xl">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nome do Diretor/Signatário</label>
                            <input
                              type="text"
                              value={signedBy}
                              onChange={(e) => setSignedBy(e.target.value)}
                              placeholder="Ex: Dr. António Manuel"
                              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:bg-white outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cargo</label>
                              <input
                                type="text"
                                value={signedRole}
                                onChange={(e) => setSignedRole(e.target.value)}
                                placeholder="Ex: Diretor Geral"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:bg-white outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Data de Assinatura</label>
                              <input
                                type="date"
                                value={signedAt}
                                onChange={(e) => setSignedAt(e.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:bg-white outline-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Observações de Aceite (opcional)</label>
                            <textarea
                              value={acceptanceNotes}
                              onChange={(e) => setAcceptanceNotes(e.target.value)}
                              placeholder="Notas ou comentários adicionais..."
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white outline-none resize-none"
                            />
                          </div>
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ficheiro do Termo (.pdf, imagens, Word)</label>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                              onChange={(e) => setAcceptanceFile(e.target.files?.[0] ?? null)}
                              className="block w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <Button
                            onClick={handleUploadAndValidateAcceptance}
                            disabled={submittingAcceptance || !signedBy.trim() || !signedAt.trim() || !acceptanceFile}
                            className="w-full bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white rounded-xl font-bold text-xs h-10 mt-2 border-none"
                          >
                            {submittingAcceptance ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-white" />
                                Validando Termo...
                              </>
                            ) : (
                              <>
                                <UploadCloud size={14} className="mr-1.5 text-white" />
                                Submeter e Validar Termo de Aceite
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-amber-955">Checklist Incompleto</h5>
                          <p className="text-[11px] text-amber-900 mt-1 leading-relaxed font-semibold">
                            Para poder carregar o Termo de Aceite assinado, você precisa primeiro concluir todos os 8 itens do Checklist de Implantação técnica acima e clicar em "Salvar Checklist Técnica".
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* TAB 3: Ficha da Escola */}
                <TabsContent value="ficha" className="m-0 flex-1 overflow-y-auto space-y-6 pr-1 pt-2">
                  {/* Informações de Contato */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      Contatos e Responsáveis
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                      <div>
                        <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">Diretor</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.director_nome || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">Telefone Diretor</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.director_tel || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">E-mail Escola</span>
                        <span className="text-xs font-bold text-slate-800 break-all">{selectedSchoolForDetails.escola_email || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">Telefone Escola</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.escola_tel || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider">Morada</span>
                        <span className="text-xs font-bold text-slate-800">
                          {[selectedSchoolForDetails.escola_morada, selectedSchoolForDetails.escola_municipio, selectedSchoolForDetails.escola_provincia].filter(Boolean).join(', ') || <span className="italic font-medium text-slate-400">Não informada</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fila de Uploads */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <FileText size={14} className="text-slate-400" />
                      Arquivos e Staging de Importação
                    </h4>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {!selectedSchoolForDetails.uploads || selectedSchoolForDetails.uploads.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhum upload realizado pela escola</p>
                        </div>
                      ) : (
                        selectedSchoolForDetails.uploads.map((up) => {
                          const meta = getStepMeta(up.step_code, up.created_by as any);
                          const triageDraft = getUploadTriageDraft(up);
                          const isFinalReviewed = up.status === "aprovado" || up.status === "rejeitado";
                          return (
                            <div key={up.id} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide">{meta.short}</span>
                                <Badge className={`border-none font-bold uppercase text-[8px] px-2 py-0.5 rounded-md ${
                                  up.status === 'aprovado'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : up.status === 'rejeitado'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {up.status}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-bold">
                                <span className="truncate max-w-[200px]" title={up.file_path.split('/').pop()}>
                                  {up.file_path.split('/').pop()}
                                </span>
                                <a
                                  href={`${supabaseUrl}/storage/v1/object/public/onboarding/${up.file_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-700 underline text-[9px] font-semibold"
                                >
                                  BAIXAR
                                </a>
                              </div>

                              {up.status === 'rejeitado' && up.rejection_reason && (
                                <div className="mt-1 rounded-lg bg-rose-50 border border-rose-100 p-2 text-[9px] font-semibold text-rose-700 leading-relaxed">
                                  Motivo da rejeição: {up.rejection_reason}
                                </div>
                              )}
                              {up.partner_reviewed_at && (
                                <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-[9px] font-semibold text-slate-500 leading-relaxed">
                                  Triado por {up.partner_reviewed_by_name || "parceiro"} em {format(new Date(up.partner_reviewed_at), "dd/MM HH:mm", { locale: pt })}
                                  {up.partner_review_note ? ` · ${up.partner_review_note}` : ""}
                                </div>
                              )}
                              {!isFinalReviewed && (
                                <div className="mt-1 grid gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <select
                                      value={triageDraft.document_type}
                                      onChange={(event) => updateUploadTriageDraft(up, { document_type: event.target.value })}
                                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-slate-400"
                                    >
                                      <option value="">Classificar documento</option>
                                      {documentTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={triageDraft.status}
                                      onChange={(event) => updateUploadTriageDraft(up, { status: event.target.value })}
                                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-slate-400"
                                    >
                                      {partnerTriageStatusOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <textarea
                                    value={triageDraft.note}
                                    onChange={(event) => updateUploadTriageDraft(up, { note: event.target.value })}
                                    rows={2}
                                    placeholder="Comentário para cliente, KLASSE ou nota interna"
                                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-slate-400"
                                  />
                                  <Button
                                    onClick={() => handleSaveUploadTriage(up)}
                                    disabled={savingUploadTriageId === up.id}
                                    className="h-8 rounded-lg bg-slate-950 px-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-slate-800"
                                  >
                                    {savingUploadTriageId === up.id ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
                                    Salvar triagem
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Timeline de Atividades */}
                  <div className="space-y-3.5 flex-grow flex flex-col min-h-0">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-400" />
                      Timeline de Atividades (SLA)
                    </h4>
                    <div className="overflow-y-auto pr-1 space-y-4 max-h-[250px]">
                      {!selectedSchoolForDetails.calls || selectedSchoolForDetails.calls.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nenhum contato registrado</p>
                        </div>
                      ) : (
                        <div className="relative pl-4 border-l border-slate-100 space-y-4 py-1 ml-2">
                          {selectedSchoolForDetails.calls.map((call) => (
                            <div key={call.id} className="relative group/timeline">
                              <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-sm ring-4 ring-blue-50" />
                              
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-slate-800">
                                    {call.member_name} realizou ligação
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-400">
                                    {format(new Date(call.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                                  </span>
                                </div>
                                {call.step_title && (
                                  <Badge className="w-fit border-none bg-blue-50 text-blue-700 font-bold text-[8px] px-1.5 py-0.5 rounded">
                                    Etapa: {call.step_title}
                                  </Badge>
                                )}
                                <p className="text-xs font-medium text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100/50 leading-relaxed shadow-sm">
                                  {call.notes}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
      </SheetContent>
    </Sheet>
  );
}
