import { Calendar, Check, CheckCircle2, Clock, Copy, ExternalLink, FileText, Phone, Send, Share2, Users } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getImplantationProgress,
  getLatestOnboardingCall,
  getLatestOnboardingCallForStep,
  getStepMeta,
  type OnboardingEscola,
} from "./partner-dashboard-model";

type OnboardingSchoolDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSchoolForDetails: OnboardingEscola | null;
  setSelectedSchoolForCall: (school: OnboardingEscola) => void;
  setSelectedStepCodeForCall: (stepCode: string) => void;
  setCallModalOpen: (open: boolean) => void;
  copyToClipboard: (text: string) => void;
};

export function OnboardingSchoolDetailsSheet({
  open,
  onOpenChange,
  selectedSchoolForDetails,
  setSelectedSchoolForCall,
  setSelectedStepCodeForCall,
  setCallModalOpen,
  copyToClipboard,
}: OnboardingSchoolDetailsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Sheet Drawer for Onboarding School Details */}
      <SheetContent className="sm:max-w-xl overflow-y-auto h-full bg-white flex flex-col gap-6 p-8 border-slate-200 shadow-2xl">
          {selectedSchoolForDetails && (
            <div className="flex flex-col gap-6 h-full">
              {/* Header */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escola em Onboarding</span>
                  <Badge className={`border-none font-bold uppercase text-[9px] px-2.5 py-0.5 rounded-lg ${
                    selectedSchoolForDetails.status === 'activo'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedSchoolForDetails.status === 'activo' ? 'Ativo' : 'Pendente'}
                  </Badge>
                </div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight leading-tight">
                  {selectedSchoolForDetails.escola}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                    Plano: {selectedSchoolForDetails.plano_label || selectedSchoolForDetails.plano || "Não informado"}
                  </Badge>
                  {selectedSchoolForDetails.total_alunos && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      {selectedSchoolForDetails.total_alunos} Alunos Estimados
                    </Badge>
                  )}
                  {selectedSchoolForDetails.escola_nif && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200">
                      NIF: {selectedSchoolForDetails.escola_nif}
                    </Badge>
                  )}
                  {getLatestOnboardingCall(selectedSchoolForDetails) && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border-blue-200">
                      Último follow-up: {format(new Date(getLatestOnboardingCall(selectedSchoolForDetails)!.realizado_em), "dd MMM, HH:mm", { locale: pt })}
                    </Badge>
                  )}
                </div>
                {selectedSchoolForDetails.status !== 'activo' && (
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        const nextPending = selectedSchoolForDetails.steps?.find((st) => st.status !== 'concluido');
                        setSelectedSchoolForCall(selectedSchoolForDetails);
                        setSelectedStepCodeForCall(nextPending?.code || "");
                        setCallModalOpen(true);
                      }}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
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
                      className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 shadow-none"
                    >
                      <Copy size={12} /> COPIAR LINK
                    </Button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Acompanhe o processo de ativação da sua escola (${selectedSchoolForDetails.escola}) em tempo real no nosso Portal de Ativação. Por lá, você poderá enviar documentos e planilhas pendentes, além de acompanhar o prazo de cada etapa.\n\nLink de acesso seguro: ${typeof window !== 'undefined' ? `${window.location.origin}/onboarding/acompanhar/${selectedSchoolForDetails.token}` : ''}`
                      )}${
                        selectedSchoolForDetails.director_tel || selectedSchoolForDetails.escola_tel
                          ? `&phone=${(selectedSchoolForDetails.director_tel || selectedSchoolForDetails.escola_tel || '').replace(/\D/g, '')}`
                          : ''
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-9 rounded-xl bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 px-3 text-[10px] font-black text-white flex items-center justify-center gap-1.5 shadow-none no-underline"
                    >
                      <Send size={12} /> COMPARTILHAR WHATSAPP
                    </a>
                  </div>
                </div>
              )}

              <Tabs defaultValue="progresso" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-2">
                  <TabsTrigger value="progresso" className="rounded-lg font-bold text-xs uppercase tracking-wider">
                    Progresso (SLA)
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
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-white/10 text-klasse-gold">
                            Resumo de Ativação
                          </span>
                          <h4 className="text-sm font-black tracking-tight">Etapas concluídas</h4>
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
                            <span className="text-base font-black text-white">{progressPercent}%</span>
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{completedSteps}/{steps.length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Checklist of Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
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
                              <div className="text-[7px] font-black uppercase text-slate-400">{meta.short}</div>
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
                                  <span className="flex items-center gap-1.5 text-klasse-green">
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
                                    className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-none"
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

                {/* TAB 2: Ficha da Escola */}
                <TabsContent value="ficha" className="m-0 flex-1 overflow-y-auto space-y-6 pr-1 pt-2">
                  {/* Informações de Contato */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      Contatos e Responsáveis
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Diretor</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.director_nome || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Telefone Diretor</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.director_tel || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">E-mail Escola</span>
                        <span className="text-xs font-bold text-slate-800 break-all">{selectedSchoolForDetails.escola_email || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Telefone Escola</span>
                        <span className="text-xs font-bold text-slate-800">{selectedSchoolForDetails.escola_tel || <span className="italic font-medium text-slate-400">Não informado</span>}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Morada</span>
                        <span className="text-xs font-bold text-slate-800">
                          {[selectedSchoolForDetails.escola_morada, selectedSchoolForDetails.escola_municipio, selectedSchoolForDetails.escola_provincia].filter(Boolean).join(', ') || <span className="italic font-medium text-slate-400">Não informada</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fila de Uploads */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
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
                          return (
                            <div key={up.id} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">{meta.short}</span>
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
                                  href={`https://<project-ref>.supabase.co/storage/v1/object/public/onboarding/${up.file_path}`}
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
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Timeline de Atividades */}
                  <div className="space-y-3.5 flex-grow flex flex-col min-h-0">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
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
                                  <span className="text-[10px] font-black text-slate-800">
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
