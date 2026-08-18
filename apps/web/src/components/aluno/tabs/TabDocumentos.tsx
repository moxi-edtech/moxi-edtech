'use client';

import { useState, useEffect } from "react";
import { FileText, Download, Loader2, CheckCircle2, Wallet, Clock, AlertCircle, Upload, XCircle, ChevronRight, ShieldCheck } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { formatKwanza } from "@/lib/formatters";
import { ServicePaymentDrawer } from "../layout/ServicePaymentDrawer";

type DocumentoStatus = 'available' | 'pending_payment' | 'pending' | 'blocked' | 'granted' | 'canceled' | 'rejected';

interface DocumentoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor: number;
  status: DocumentoStatus;
  pedido_id: string | null;
  pagamento_intent_id?: string | null;
  exige_pagamento_antes_de_liberar: boolean;
  reject_reason?: string | null;
}

const DIGITAL_DOCUMENT_CODES = new Set([
  'DOC_DECLARACAO_NOTAS',
  'DOC_DECLARACAO_FREQUENCIA',
  'DOC_BOLETIM_TRIMESTRAL',
  'DOC_COMPROVANTE_MATRICULA',
]);

export function TabDocumentos() {
  const searchParams = useSearchParams();
  const { error, success } = useToast();
  const studentId = searchParams?.get("aluno") ?? null;
  const serviceCode = searchParams?.get("servico") ?? null;
  const query = studentId ? `?studentId=${studentId}` : '';

  const [loading, setLoading] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentoCatalogo[]>([]);
  const [dadosPagamento, setDadosPagamento] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  
  // Modal state
  const [selectedDoc, setSelectedDoc] = useState<DocumentoCatalogo | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const visibleDocs = serviceCode ? docs.filter((doc) => doc.codigo === serviceCode) : docs;

  const fetchCatalogo = async () => {
    try {
      const res = await fetch(`/api/aluno/documentos/catalogo${query}`);
      const json = await res.json();
      if (json.ok) {
        setDocs(json.documentos);
        setDadosPagamento(json.dados_pagamento);
      }
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, [studentId]);

  const handleAction = async (doc: DocumentoCatalogo) => {
    if (doc.status === 'granted') {
      if (DIGITAL_DOCUMENT_CODES.has(doc.codigo)) handleDownload(doc);
      else window.location.assign('/aluno/avisos');
    } else if (doc.status === 'available' || doc.status === 'rejected') {
      handleRequest(doc);
    } else if (doc.status === 'pending_payment') {
      setSelectedDoc(doc);
      setShowDrawer(true);
    } else if (doc.status === 'pending' || doc.status === 'blocked') {
      await fetchCatalogo();
      success("Pedido em acompanhamento", "O estado foi actualizado. A secretaria será avisada quando houver uma decisão.");
    }
  };

  const handleRequest = async (doc: DocumentoCatalogo) => {
    setLoading(doc.codigo);
    try {
      const res = await fetch(`/api/aluno/documentos/solicitar${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: doc.codigo, ...(studentId ? { studentId } : {}) })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao solicitar documento');
      
      if (json.pagamento_id) {
        setSelectedDoc({ ...doc, pagamento_intent_id: json.pagamento_id });
        setShowDrawer(true);
      } else {
        success("Solicitação enviada", json.message || "Seu pedido foi registrado com sucesso.");
      }
      
      fetchCatalogo();
    } catch (err: unknown) {
      error("Erro na solicitação", err instanceof Error ? err.message : "Não foi possível processar o pedido.");
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async (doc: DocumentoCatalogo) => {
    setLoading(doc.codigo);
    try {
      const type = ['DOC_DECLARACAO_NOTAS', 'DOC_BOLETIM_TRIMESTRAL'].includes(doc.codigo) ? 'boletim' : 'declaracao';
      
      const res = await fetch(`/api/aluno/documentos/emitir${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, serviceCode: doc.codigo, ...(studentId ? { studentId } : {}) })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao emitir documento');
      
      if (json.url) {
        window.open(json.url, '_blank');
      }
    } catch (err: unknown) {
      error("Erro no download", err instanceof Error ? err.message : "Não conseguimos obter o documento.");
    } finally {
      setLoading(null);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="animate-spin mb-3 h-7 w-7 text-klasse-green" />
        <p className="text-xs font-medium">A carregar os serviços da secretaria...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <header className="px-1 space-y-1">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Secretaria Digital</h2>
        <p className="text-xs font-medium text-slate-500 leading-relaxed">
          Solicita e descarrega documentos oficiais com acompanhamento de estado em tempo real.
        </p>
      </header>

      {visibleDocs.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-100/80 shadow-sm space-y-3">
          <AlertCircle className="mx-auto h-9 w-9 text-slate-300" />
          <p className="text-sm font-bold text-slate-700">
            {serviceCode ? "Este serviço já não está disponível na Secretaria Digital." : "Nenhum serviço de documentação disponível."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleDocs.map((doc) => (
            <AlunoCard 
              key={doc.id}
              onClick={() => handleAction(doc)}
              className="group relative transition-all duration-300 hover:shadow-md active:scale-[0.99] border border-slate-100/80 bg-white p-5 sm:p-6 rounded-3xl space-y-4"
            >
              <div className="flex items-start justify-between gap-4 sm:gap-6">
                
                {/* Lado Esquerdo: Ícone + Conteúdo */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors shadow-sm ${
                    doc.status === 'granted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    doc.status === 'pending_payment' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    doc.status === 'pending' || doc.status === 'blocked' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                    doc.status === 'rejected' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    'bg-slate-50 text-slate-500 border border-slate-100'
                  }`}>
                    <FileText className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{doc.nome}</h3>
                      <span className="text-[11px] font-black text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full shrink-0">
                        {doc.valor > 0 ? formatKwanza(doc.valor) : 'Gratuito'}
                      </span>
                    </div>

                    {doc.descricao && (
                      <p className="text-xs text-slate-500 leading-relaxed font-normal">
                        {doc.descricao}
                      </p>
                    )}

                    <div className="pt-1">
                      <StatusBadge status={doc.status} />
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Botão de Ação */}
                <div className="shrink-0 pt-0.5">
                  {loading === doc.codigo ? (
                    <div className="flex h-10 w-10 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <ActionButton status={doc.status} codigo={doc.codigo} />
                  )}
                </div>
              </div>

              {/* Minimal Track & Trace Stepper (se o documento estiver em andamento) */}
              {doc.status !== 'available' && (
                <div className="pt-3 border-t border-slate-100">
                  <TrackAndTraceStepper status={doc.status} />
                </div>
              )}

              {/* Motivo de Rejeição (se houver) */}
              {doc.status === 'rejected' && doc.reject_reason && (
                <div className="mt-2 rounded-2xl bg-rose-50/70 p-3.5 text-xs font-medium text-rose-700 border border-rose-100/80 flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed"><b>Motivo da Secretaria:</b> {doc.reject_reason}</span>
                </div>
              )}
            </AlunoCard>
          ))}
        </div>
      )}

      {/* Card Informativo Espaçoso */}
      <div className="rounded-3xl bg-slate-50/80 border border-slate-100 p-5 flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/60 text-slate-500 shadow-sm">
          <ShieldCheck size={18} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-wider text-slate-700">Autenticidade & Segurança</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Todos os documentos emitidos possuem um <strong>QR Code com assinatura digital</strong> para validação instantânea pelas instituições parceiras.
          </p>
        </div>
      </div>

      <ServicePaymentDrawer 
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSuccess={() => {
          success("Comprovativo enviado", "Aguarde a validação pela secretaria.");
          fetchCatalogo();
        }}
        studentId={studentId}
        dadosPagamento={dadosPagamento}
        documento={selectedDoc ? {
          codigo: selectedDoc.codigo,
          nome: selectedDoc.nome,
          valor: selectedDoc.valor,
          intentId: selectedDoc.pagamento_intent_id
        } : null}
      />
    </div>
  );
}

// Track & Trace Sobrio e Minimalista
function TrackAndTraceStepper({ status }: { status: DocumentoStatus }) {
  const steps = [
    { label: "Solicitado", key: "requested" },
    { label: "Análise", key: "review" },
    { label: "Assinatura", key: "signing" },
    { label: "Pronto", key: "ready" },
  ];

  let currentStepIndex = 0;
  if (status === 'pending_payment') currentStepIndex = 1;
  else if (status === 'pending' || status === 'blocked') currentStepIndex = 2;
  else if (status === 'granted') currentStepIndex = 3;
  else if (status === 'rejected') currentStepIndex = 1;

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
        <span>Rastreamento do Pedido</span>
        <span className="text-slate-700 font-bold">Passo {currentStepIndex + 1} de {steps.length}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {steps.map((step, idx) => {
          const isPassed = idx <= currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-all ${
                  isPassed
                    ? status === 'rejected' && isCurrent
                      ? 'bg-rose-500'
                      : 'bg-emerald-600'
                    : 'bg-slate-100'
                }`}
              />
              <span className={`text-[9px] font-bold tracking-tight text-center ${
                isCurrent ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentoStatus }) {
  switch (status) {
    case 'pending_payment':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700 border border-amber-200/60">
          <Wallet size={11} /> Pagar para Liberar
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 border border-blue-200/60">
          <Clock size={11} /> Validando Comprovativo
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold text-rose-700 border border-rose-200/60">
          <XCircle size={11} /> Rejeitado
        </span>
      );
    case 'blocked':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 border border-blue-200/60">
          <Clock size={11} /> Em Processamento
        </span>
      );
    case 'granted':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 size={11} /> Disponível para Download
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
          Disponível
        </span>
      );
  }
}

function ActionButton({ status, codigo }: { status: DocumentoStatus; codigo: string }) {
  switch (status) {
    case 'granted':
      if (!DIGITAL_DOCUMENT_CODES.has(codigo)) {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm">
            Contactar secretaria
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95">
          <Download size={14} /> Baixar
        </span>
      );
    case 'pending_payment':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-600 active:scale-95">
          <Upload size={14} /> Pagar
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700">
          <Clock size={14} /> Acompanhar
        </span>
      );
    case 'blocked':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-600">
          <Clock size={14} /> Actualizar
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95">
          <Upload size={14} /> Reenviar
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95">
          Solicitar <ChevronRight size={14} />
        </span>
      );
  }
}
