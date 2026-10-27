'use client';

import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Loader2, CheckCircle2, Wallet, Clock, AlertCircle, Upload, XCircle, ChevronRight, } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BOLETIM_SERVICE_CODE, BOLETIM_LEGACY_SERVICE_CODE, isBoletimServiceCode } from "@/lib/aluno/boletimAccess";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
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
  pagamento_configurado?: boolean;
}

const DIGITAL_DOCUMENT_CODES = new Set([
  'DOC_DECLARACAO_FREQUENCIA',
  BOLETIM_SERVICE_CODE,
  'DOC_COMPROVANTE_MATRICULA',
  'DOC_CARTAO_ESTUDANTE',
  'DOC_FICHA_INSCRICAO',
  'DOC_HISTORICO_ESCOLAR',
  'DOC_CERTIFICADO_HABILITACOES',
]);

export function TabDocumentos({ embedded = false, focusServiceCode = null, onOpenNotas }: { embedded?: boolean; focusServiceCode?: string | null; onOpenNotas?: () => void } = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const escolaSlug = getEscolaParamFromPath(pathname);
  const { error, success } = useToast();
  const studentId = searchParams?.get("aluno") ?? null;
  const rawServiceCode = searchParams?.get("servico") ?? null;
  // Deep links legados continuam a abrir o único boletim, sem iniciar nova cobrança antiga.
  const requestedService = focusServiceCode ?? rawServiceCode;
  const serviceCode = requestedService === BOLETIM_LEGACY_SERVICE_CODE ? BOLETIM_SERVICE_CODE : requestedService;
  const academicYearId = searchParams?.get("ano_letivo_id") ?? null;
  const queryParams = new URLSearchParams();
  if (studentId) queryParams.set("studentId", studentId);
  if (academicYearId) queryParams.set("ano_letivo_id", academicYearId);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const [loading, setLoading] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentoCatalogo[]>([]);
  const [dadosPagamento, setDadosPagamento] = useState<{ iban?: string; banco?: string; titular_conta?: string; kwik_chave?: string } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  
  // Modal state
  const [selectedDoc, setSelectedDoc] = useState<DocumentoCatalogo | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const visibleDocs = docs.filter((doc) =>
    doc.codigo !== BOLETIM_LEGACY_SERVICE_CODE && (!serviceCode || doc.codigo === serviceCode)
  );

  const fetchCatalogo = useCallback(async (quiet = false) => {
    setCatalogError(null);
    if (!quiet) setFetching(true);
    try {
      const res = await fetch(`/api/aluno/documentos/catalogo${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Não foi possível carregar a Secretaria Digital.");
      setDocs(json.documentos ?? []);
      setDadosPagamento(json.dados_pagamento ?? null);
      return true;
    } catch (err) {
      if (!quiet) setDocs([]);
      setCatalogError(err instanceof Error ? err.message : "Não foi possível carregar os serviços.");
      return false;
    } finally {
      if (!quiet) setFetching(false);
    }
  }, [query]);

  useEffect(() => {
    setDocs([]);
    setSelectedDoc(null);
    setShowDrawer(false);
    void fetchCatalogo();
  }, [fetchCatalogo]);

  const hasPending = docs.some((item) => item.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const schedule = () => {
      if (stopped || document.hidden) return;
      timer = setTimeout(() => { timer = undefined; void refresh(); },
        Math.min(30_000 * 2 ** failures, 300_000));
    };
    const refresh = async () => {
      if (stopped || document.hidden || inFlight) return;
      inFlight = true;
      try {
        const succeeded = await fetchCatalogo(true);
        failures = succeeded ? 0 : Math.min(failures + 1, 4);
      } catch {
        failures = Math.min(failures + 1, 4);
      } finally {
        inFlight = false;
        schedule();
      }
    };
    const onVisible = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasPending, fetchCatalogo]);

  const handleAction = async (doc: DocumentoCatalogo) => {
    if (doc.pagamento_configurado === false) {
      error("Taxa não configurada", "A secretaria precisa definir o valor do boletim antes de o aluno fazer o pagamento.");
      return;
    }
    if (doc.status === 'granted') {
      if (DIGITAL_DOCUMENT_CODES.has(doc.codigo)) handleDownload(doc);
      else window.location.assign('/aluno/avisos');
    } else if (doc.status === 'rejected' && isBoletimServiceCode(doc.codigo)) {
      if (!doc.pagamento_intent_id) {
        error("Comprovativo não localizado", "Contacte a secretaria. Não solicite outro boletim nem pague novamente.");
        return;
      }
      setSelectedDoc(doc);
      setShowDrawer(true);
    } else if (doc.status === 'available' || doc.status === 'rejected') {
      handleRequest(doc);
    } else if (doc.status === 'pending_payment') {
      if (!doc.pagamento_intent_id) {
        error("Pagamento não localizado", "Actualize o estado do pedido ou contacte a secretaria. Não faça outro pagamento.");
        return;
      }
      setSelectedDoc(doc);
      setShowDrawer(true);
    } else if (doc.status === 'pending' || doc.status === 'blocked') {
      await fetchCatalogo();
      success("Pedido em acompanhamento", "O estado foi actualizado. Aguarde a confirmação da secretaria.");
    }
  };

  const handleRequest = async (doc: DocumentoCatalogo) => {
    setLoading(doc.codigo);
    try {
      const res = await fetch(`/api/aluno/documentos/solicitar${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: doc.codigo, ...(studentId ? { studentId } : {}), ...(academicYearId ? { ano_letivo_id: academicYearId } : {}) })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao solicitar documento');
      
      if (json.pagamento_id) {
        setSelectedDoc({ ...doc, pagamento_intent_id: json.pagamento_id });
        setShowDrawer(true);
      } else if (json.status === 'granted') {
        success("Documento gratuito disponível", "O documento foi emitido e já pode ser descarregado.");
      } else if (json.status === 'blocked') {
        success("Pedido gratuito enviado", "A secretaria precisa aprovar este documento antes da emissão.");
      } else {
        success("Solicitação enviada", json.message || "Seu pedido foi registrado com sucesso.");
      }
      
      void fetchCatalogo(true);
    } catch (err: unknown) {
      error("Erro na solicitação", err instanceof Error ? err.message : "Não foi possível processar o pedido.");
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async (doc: DocumentoCatalogo) => {
    setLoading(doc.codigo);
    try {
      const isBoletim = isBoletimServiceCode(doc.codigo);
      if (isBoletim) {
        const res = await fetch(`/api/aluno/boletim/pdf${query}`, { cache: "no-store" });
        if (!res.ok) {
          const json = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(json?.error || "Não foi possível descarregar o boletim.");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "boletim_de_notas.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 3000);
      } else {
        const type = doc.codigo === 'DOC_CARTAO_ESTUDANTE' ? 'cartao' : doc.codigo === 'DOC_FICHA_INSCRICAO' ? 'ficha' : doc.codigo === 'DOC_HISTORICO_ESCOLAR' ? 'historico' : doc.codigo === 'DOC_CERTIFICADO_HABILITACOES' ? 'certificado' : 'declaracao';
        const res = await fetch(`/api/aluno/documentos/emitir${query}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, serviceCode: doc.codigo, ...(studentId ? { studentId } : {}), ...(academicYearId ? { ano_letivo_id: academicYearId } : {}) })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao emitir documento');
        if (json.url) window.open(json.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      error("Erro no download", err instanceof Error ? err.message : "Não conseguimos obter o documento.");
      void fetchCatalogo(true);
    } finally {
      setLoading(null);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="animate-spin mb-3 h-7 w-7 text-emerald" />
        <p className="text-xs font-medium">A carregar os serviços da secretaria...</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 pb-8">
      {/* Cabeçalho */}
      {!embedded && <header className="px-1 space-y-1">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Secretaria Digital</h2>
        <p className="text-xs font-medium text-slate-500 leading-relaxed">
          Escolha o documento, envie o comprovativo de pagamento e acompanhe a validação da secretaria.
        </p>
      </header>}
      {embedded && <p className="text-sm leading-6 text-muted-foreground">Solicita documentos e acompanha o estado dos teus pedidos.</p>}

      {catalogError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900" role="alert">
          <p className="font-black">Não foi possível carregar os serviços.</p>
          <p className="mt-1 text-xs">{catalogError} Os seus pedidos anteriores não foram alterados.</p>
          <button type="button" onClick={() => void fetchCatalogo()} className="mt-3 min-h-11 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-ring">Tentar novamente</button>
        </div>
      ) : null}

      {visibleDocs.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-100/80 shadow-sm space-y-3">
          <AlertCircle className="mx-auto h-9 w-9 text-slate-300" />
          <p className="text-sm font-bold text-slate-700">
            {serviceCode ? "Este serviço já não está disponível na Secretaria Digital." : "Nenhum serviço de documentação disponível."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleDocs.map((doc) => (
             <AlunoCard
               key={doc.id}
               className="min-w-0 space-y-2 rounded-xl border-border bg-card p-3.5 shadow-none sm:p-4"
             >
               <div className="flex min-w-0 items-start gap-3">
                 <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                   doc.status === "granted" ? "border-emerald-100 bg-emerald-50 text-emerald-700" :
                   doc.status === "pending_payment" ? "border-amber-100 bg-amber-50 text-amber-700" :
                   doc.status === "pending" || doc.status === "blocked" ? "border-blue-100 bg-blue-50 text-blue-700" :
                   doc.status === "rejected" ? "border-rose-100 bg-rose-50 text-rose-700" :
                   "border-border bg-muted text-muted-foreground"
                 }`}>
                   <FileText aria-hidden="true" className="h-5 w-5" />
                 </div>
                 <div className="min-w-0 flex-1 space-y-1.5">
                   <div className="flex flex-wrap items-start gap-2">
                     <h3 className="min-w-0 break-words text-sm font-semibold leading-6 text-foreground sm:text-base">{doc.nome}</h3>
                     <span className="inline-flex max-w-full shrink-0 items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                       {doc.pagamento_configurado === false ? "Taxa por definir" : doc.valor > 0 ? formatKwanza(doc.valor) : "Gratuito"}
                     </span>
                   </div>
                   {doc.descricao && (
                     <p className="line-clamp-2 break-words text-sm leading-5 text-muted-foreground">{doc.descricao}</p>
                   )}
                   <div className="flex flex-wrap items-center gap-2">
                     {doc.pagamento_configurado !== false && <StatusBadge status={doc.status} />}
                     {doc.codigo === BOLETIM_SERVICE_CODE && doc.status === "granted" && (
                       onOpenNotas ? (
                         <button type="button" onClick={onOpenNotas} className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver notas</button>
                       ) : (
                         <Link href={buildPortalHref(escolaSlug, `/aluno/academico${studentId || academicYearId ? `?${new URLSearchParams({ ...(studentId ? { aluno: studentId } : {}), ...(academicYearId ? { ano_letivo_id: academicYearId } : {}) })}` : ""}`)} className="text-xs font-semibold text-primary underline">
                           Ver notas
                         </Link>
                       )
                     )}
                   </div>
                 </div>
               </div>
               <div className="flex min-w-0 items-center justify-start border-t border-border pt-2 sm:justify-end">
                 {loading === doc.codigo ? (
                   <span role="status" className="inline-flex h-11 items-center gap-2 text-sm text-muted-foreground">
                     <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> A processar
                   </span>
                 ) : doc.pagamento_configurado === false ? (
                   <p className="text-xs font-medium leading-5 text-amber-800">A escola precisa definir a taxa.</p>
                 ) : (
                   <button type="button" onClick={() => void handleAction(doc)}
                     className="inline-flex min-h-11 w-full items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                     aria-label={`${doc.status === "granted" ? "Descarregar" : doc.status === "pending" ? "Acompanhar" : "Solicitar"}: ${doc.nome}`}>
                     <ActionButton status={doc.status} codigo={doc.codigo} gratuito={doc.valor <= 0} />
                   </button>
                 )}
               </div>

              {/* Motivo de Rejeição (se houver) */}
              {doc.status === 'rejected' && doc.reject_reason && (
                <div className="mt-1 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed"><b>Motivo:</b> {doc.reject_reason}</span>
                </div>
              )}
            </AlunoCard>
          ))}
        </div>
      )}

      <ServicePaymentDrawer 
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSuccess={() => {
          success("Comprovativo enviado", "A secretaria vai verificar o teu comprovativo.");
          void fetchCatalogo(true);
        }}
        studentId={studentId}
        academicYearId={academicYearId}
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

function StatusBadge({ status }: { status: DocumentoStatus }) {
  switch (status) {
    case 'pending_payment':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700 border border-amber-200/60">
          <Wallet size={11} /> Pagamento pendente
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 border border-blue-200/60">
          <Clock size={11} /> Em análise
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
          <Clock size={11} /> Em análise
        </span>
      );
    case 'granted':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 size={11} /> Disponível
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

function ActionButton({ status, codigo, gratuito }: { status: DocumentoStatus; codigo: string; gratuito: boolean }) {
  switch (status) {
    case 'granted':
      if (!DIGITAL_DOCUMENT_CODES.has(codigo)) {
        return (
          <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm">
            Contactar secretaria
          </span>
        );
      }
      return (
        <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95">
          <Download size={14} /> Baixar
        </span>
      );
    case 'pending_payment':
      return (
        <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-600 active:scale-95">
          <Upload size={14} /> Pagar
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-2xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700">
          <Clock size={14} /> Acompanhar
        </span>
      );
    case 'blocked':
      return (
        <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-2xl bg-muted px-3 py-2.5 text-xs font-bold text-muted-foreground">
          <Clock size={14} /> Actualizar
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95">
          <Upload size={14} /> Reenviar
        </span>
      );
    default:
      return (
        <span className="inline-flex min-h-10 w-full items-center justify-center sm:w-auto gap-1 rounded-2xl bg-foreground px-4 py-2.5 text-xs font-bold text-background shadow-sm transition-all hover:bg-foreground/90 active:scale-95">
          {gratuito ? "Solicitar grátis" : "Solicitar"} <ChevronRight size={14} />
        </span>
      );
  }
}
