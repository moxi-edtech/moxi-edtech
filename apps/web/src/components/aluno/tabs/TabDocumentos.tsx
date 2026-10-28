'use client';

import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Loader2, Clock, AlertCircle, Upload, ChevronRight } from "lucide-react";
import { PortalSurface } from "@/components/portal/ui/PortalSurface";
import { PortalEmptyState } from "@/components/portal/ui/PortalEmptyState";
import { PortalLoadingState } from "@/components/portal/ui/PortalLoadingState";
import { PortalStatus } from "@/components/portal/ui/PortalStatus";
import { PortalAction } from "@/components/portal/ui/PortalAction";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
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


/** O estado do pedido não garante que o ficheiro tenha sido emitido. */
function documentNotice(doc: DocumentoCatalogo) {
  switch (doc.status) {
    case "available":
      return { title: "Disponível para solicitar", message: doc.valor > 0
        ? "Solicita o documento e envia o comprovativo para continuar."
        : "Podes solicitar este documento gratuitamente." };
    case "pending_payment":
      return { title: "Solicitação realizada", message: "O teu pedido foi criado. Envia o comprovativo para a secretaria validar." };
    case "pending":
      return { title: "Comprovativo recebido", message: "Aguardando validação pela secretaria. Não precisas de pagar novamente." };
    case "blocked":
      return { title: "Solicitação recebida", message: "Aguardando análise pela secretaria. Consulta aqui as atualizações." };
    case "rejected":
      return { title: "Correção necessária", message: doc.reject_reason?.trim()
        ? `A secretaria solicitou uma correção: ${doc.reject_reason.trim()}.`
        : "O comprovativo não foi aceite. Consulta o pedido e envia um novo comprovativo." };
    case "granted":
      return { title: "Solicitação aprovada", message: "O pedido foi aprovado. Consulta a opção de visualizar ou descarregar quando o documento estiver disponível." };
    case "canceled":
      return { title: "Solicitação cancelada", message: "Este pedido foi cancelado. Contacta a secretaria se precisares de ajuda." };
  }
}

export function TabDocumentos({ embedded = false, focusServiceCode = null, onOpenNotas }: { embedded?: boolean; focusServiceCode?: string | null; onOpenNotas?: () => void } = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
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
      else {
         const nav = new URLSearchParams();
         if (studentId) nav.set("aluno", studentId);
         if (academicYearId) nav.set("ano_letivo_id", academicYearId);
         router.push(buildPortalHref(escolaSlug, `/aluno/avisos${nav.size ? `?${nav.toString()}` : ""}`));
       }
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
        success("Solicitação realizada", "Aguardando aprovação pela secretaria.");
      } else {
        success("Solicitação realizada", "O pedido foi recebido. Acompanha o estado nesta página.");
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

  if (fetching) return <PortalLoadingState label="A carregar documentos" rows={3} className="pb-4" />;

  return (
    <div className="min-w-0 space-y-4 pb-8">
      {/* Cabeçalho */}
      {!embedded && <header className="px-1 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Secretaria Digital</h2>
        <p className="text-sm leading-5 text-muted-foreground">
          Solicita documentos e acompanha os teus pedidos.
        </p>
      </header>}
      {embedded && <p className="text-sm leading-6 text-muted-foreground">Solicita documentos e acompanha o estado dos teus pedidos.</p>}

      {catalogError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground" role="alert">
          <p className="font-semibold">Não foi possível carregar os documentos.</p>
          <p className="mt-1 text-xs">{catalogError}</p>
          <PortalAction onClick={() => void fetchCatalogo()} variant="outline" className="mt-2">Tentar novamente</PortalAction>
        </div>
      ) : null}

      {!catalogError && (visibleDocs.length === 0 ? (
        <PortalEmptyState
           icon={<FileText className="h-5 w-5" />}
           title={serviceCode ? "Serviço indisponível" : "Sem documentos disponíveis"}
           description={serviceCode ? "Consulta outros serviços ou contacta a secretaria." : "A secretaria ainda não publicou serviços de documentação."}
         />
      ) : (
        <div className="space-y-2">
          {visibleDocs.map((doc) => (
             <PortalSurface key={doc.id} as="article" className="min-w-0 space-y-2 rounded-xl">
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
                   <PortalAction onClick={() => void handleAction(doc)}
                      variant={["pending", "blocked"].includes(doc.status) ? "outline" : "primary"}
                      className="w-full sm:w-auto"
                      ariaLabel={`${doc.status === "granted" ? "Ver documento" : doc.status === "pending" ? "Acompanhar" : "Solicitar"}: ${doc.nome}`}>
                      <ActionButton status={doc.status} codigo={doc.codigo} gratuito={doc.valor <= 0} />
                    </PortalAction>
                 )}
               </div>

              <div role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                 <p className="text-sm font-semibold text-foreground">{documentNotice(doc).title}</p>
                 <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{documentNotice(doc).message}</p>
               </div>
               {/* Motivo de Rejeição (se houver) */}
              {doc.status === 'rejected' && doc.reject_reason && (
                <div className="mt-1 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed"><b>Motivo:</b> {doc.reject_reason}</span>
                </div>
              )}
            </PortalSurface>
          ))}
        </div>
      ))}

      <ServicePaymentDrawer 
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSuccess={() => {
          success("Comprovativo recebido", "Aguardando validação pela secretaria. Não precisas de pagar novamente.");
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
  const states: Record<DocumentoStatus, { label: string; tone: "neutral" | "pending" | "success" | "danger" }> = {
    available: { label: "Disponível", tone: "neutral" },
    pending_payment: { label: "Pagamento pendente", tone: "pending" },
    pending: { label: "Em análise", tone: "pending" },
    blocked: { label: "Em análise", tone: "pending" },
    granted: { label: "Disponível", tone: "success" },
    canceled: { label: "Cancelado", tone: "neutral" },
    rejected: { label: "Rejeitado", tone: "danger" },
  };
  const entry = states[status];
  return <PortalStatus tone={entry.tone}>{entry.label}</PortalStatus>;
}

function ActionButton({ status, codigo, gratuito }: { status: DocumentoStatus; codigo: string; gratuito: boolean }) {
  switch (status) {
    case "granted":
      return DIGITAL_DOCUMENT_CODES.has(codigo)
        ? <><Download aria-hidden="true" className="h-4 w-4" /> Descarregar</>
        : <>Ver instruções</>;
    case "pending_payment":
      return <><Upload aria-hidden="true" className="h-4 w-4" /> Pagar</>;
    case "pending":
      return <><Clock aria-hidden="true" className="h-4 w-4" /> Acompanhar</>;
    case "blocked":
      return <><Clock aria-hidden="true" className="h-4 w-4" /> Actualizar</>;
    case "rejected":
      return <><Upload aria-hidden="true" className="h-4 w-4" /> Reenviar</>;
    default:
      return <>{gratuito ? "Solicitar grátis" : "Solicitar"} <ChevronRight aria-hidden="true" className="h-4 w-4" /></>;
  }
}
