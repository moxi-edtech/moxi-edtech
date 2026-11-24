"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { BookOpen, FileText, Printer, RefreshCw, Search, User } from "lucide-react";
import { emitirDocumento, abrirParaImpressao, consultarDocumentoIndividual, DocumentoOperacaoErro, type DocumentoNextAction } from "@/lib/documentos/emissaoClient";
import type { TipoDocumentoEmitivel } from "@/lib/documentos/printUrl";

// Mesmo union que a rota de emissão aceita. Estava aqui duplicado (e uma
// terceira vez, mais curto, em DocumentosEmissaoHub.tsx — esse é outro
// componente e não se toca); passa a haver uma só definição.
type DocumentoTipo = TipoDocumentoEmitivel;

const TIPOS: Array<{
  id: DocumentoTipo;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    id: "declaracao_frequencia",
    title: "Declaração Simples",
    description: "Frequência e matrícula (passaportes, abonos, viagens).",
    icon: FileText,
  },
  {
    id: "declaracao_notas",
    title: "Declaração com Notas",
    description: "Declaração oficial com notas e aproveitamento escolar.",
    icon: BookOpen,
  },
  {
    id: "boletim_trimestral",
    title: "Boletim Trimestral",
    description: "Notas organizadas por trimestre para acompanhamento escolar.",
    icon: BookOpen,
  },
  {
    id: "cartao_estudante",
    title: "Cartão de Estudante",
    description: "Identificação estudantil rápida.",
    icon: FileText,
  },
  {
    id: "ficha_inscricao",
    title: "Ficha de Inscrição",
    description: "Dados básicos para inscrição.",
    icon: FileText,
  },
  {
    id: "comprovante_matricula",
    title: "Boletim de Matrícula",
    description: "Comprovativo oficial de vinculação.",
    icon: BookOpen,
  },
  {
    id: "historico",
    title: "Histórico Escolar",
    description: "Histórico oficial baseado no ano letivo encerrado.",
    icon: BookOpen,
  },
  {
    id: "certificado",
    title: "Certificado de Habilitações",
    description: "Documento final emitido após o fechamento do histórico.",
    icon: FileText,
  },
];

export default function DocumentosEmissaoHubClient({
  escolaId,
  alunoId,
  defaultTipo,
}: {
  escolaId: string;
  alunoId?: string | null;
  defaultTipo?: DocumentoTipo | null;
}) {
  const escolaParam = escolaId;
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; label: string; highlight?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<{ id: string; label: string } | null>(null);
  const [tipo, setTipo] = useState<DocumentoTipo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<DocumentoNextAction | null>(null);
  const reportError = useCallback((err: unknown, fallback: string) => {
    setError(err instanceof Error ? err.message : fallback);
    setErrorAction(err instanceof DocumentoOperacaoErro ? err.nextAction : null);
  }, []);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [metodo, setMetodo] = useState<"cash" | "tpa" | "transfer">("tpa");
  const [reference, setReference] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [printQueue, setPrintQueue] = useState<Array<{ label: string; url: string }>>([]);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const documentRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const paymentRequestRef = useRef<{ intentId: string; key: string } | null>(null);
  type EmissaoIndividualEstado = {
    status: "issued" | "paid" | "free" | "pending_payment" | "verification" | "approval";
    granted: boolean;
    valor?: number;
    pedidoId?: string | null;
    pagamentoIntentId?: string | null;
    servicoCodigo?: string;
    docId?: string;
    printUrl?: string;
    pagamentoObrigatorio?: boolean;
  };
  const [documentState, setDocumentState] = useState<EmissaoIndividualEstado | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [anoLetivoOptions, setAnoLetivoOptions] = useState<Array<{ id: string; nome: string; ano_letivo: number; status: string }>>([]);
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] = useState<string>("");
  const [loadingAnoLetivo, setLoadingAnoLetivo] = useState(false);
  const selectedAnoLetivoId = useMemo(
    () => anoLetivoOptions.some((item) => item.id === anoLetivoSelecionado) ? anoLetivoSelecionado : null,
    [anoLetivoOptions, anoLetivoSelecionado],
  );
  const selectedAnoLetivo = anoLetivoOptions.find((item) => item.id === selectedAnoLetivoId) ?? null;
  const alunoIdParam = alunoId ?? searchParams?.get("alunoId");
  const tipoParam = (defaultTipo ?? (searchParams?.get("tipo") as DocumentoTipo | null)) ?? null;


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);


  useEffect(() => {
    if (!alunoIdParam || selectedAluno) return;

    const loadAluno = async () => {
      try {
        const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoIdParam)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok || !json?.item) return;
        const label = json.item.nome || json.item.nome_completo || "Aluno";
        setSelectedAluno({ id: json.item.id, label });
        setQuery(label);
      } catch (err) {
        console.error("Erro ao carregar aluno:", err);
      }
    };

    loadAluno();
  }, [alunoIdParam, selectedAluno]);

  useEffect(() => {
    if (tipoParam && TIPOS.some((t) => t.id === tipoParam)) {
      setTipo(tipoParam);
    }
  }, [tipoParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("documentos_emissao_metodo");
    if (stored === "cash" || stored === "tpa" || stored === "transfer") {
      setMetodo(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("documentos_emissao_metodo", metodo);
  }, [metodo]);

  useEffect(() => {
    if (metodo === "tpa") {
      referenceInputRef.current?.focus();
    }
  }, [metodo]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const q = debouncedQuery.trim();
      if (!q || q.length < 2) {
        if (active) setResults([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          status: "ativo",
          pageSize: "8",
        });
        const res = await fetch(`/api/secretaria/alunos?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao buscar alunos");
        const rows = (json.items || json.data || []) as any[];
        const mapped = rows.map((row) => ({
          id: row.id,
          label: row.nome_completo || row.nome || "Aluno",
          highlight: row.numero_processo || row.bi_numero || null,
        }));
        if (active) setResults(mapped);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    let active = true;
    const loadAnoLetivo = async () => {
      if (!escolaParam) return;
      setLoadingAnoLetivo(true);
      try {
        const res = await fetch(`/api/secretaria/school-sessions?escolaId=${encodeURIComponent(escolaParam)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar anos letivos");
        const items = Array.isArray(json.data) ? json.data : [];
        const mapped = items
          .filter((item) => Number.isFinite(item?.ano_letivo))
          .map((item) => ({
            id: String(item.id),
            nome: String(item.nome ?? item.ano_letivo),
            ano_letivo: Number(item.ano_letivo),
            status: String(item.status ?? ""),
          }));
        if (active) {
          setAnoLetivoOptions(mapped);
          setAnoLetivoSelecionado((previous) => {
            if (mapped.some((item) => item.id === previous)) return previous;
            if (academicYearId && mapped.some((item) => item.id === academicYearId)) return academicYearId;
            return (mapped.find((item) => item.status === "ativa") ?? mapped[0])?.id ?? "";
          });
        }
      } catch {
        if (active) setAnoLetivoOptions([]);
      } finally {
        if (active) setLoadingAnoLetivo(false);
      }
    };

    loadAnoLetivo();
    return () => {
      active = false;
    };
  }, [escolaParam, academicYearId]);

  const normalizedResults = useMemo(() => results.slice(0, 6), [results]);

  // A RPC é a única fonte de taxa, elegibilidade e próxima ação.
  const valorBase = Number(documentState?.valor ?? 0);
  const isPago = documentState?.pagamentoObrigatorio === true;
  const operationBusy = submitting || paymentBusy;
  const canSubmit = Boolean(selectedAluno?.id && tipo && selectedAnoLetivoId &&
    !operationBusy && !statusLoading);

  const handleSelectAluno = (id: string, label: string) => {
    setSelectedAluno({ id, label });
    setQuery(label);
  };

  async function consultarEstado(action: "status" | "solicitar" = "status"): Promise<EmissaoIndividualEstado> {
    if (!selectedAluno?.id || !tipo || !selectedAnoLetivoId) {
      throw new Error("Selecione aluno, documento e ano letivo.");
    }
    return await consultarDocumentoIndividual({
      escolaId,
      alunoId: selectedAluno.id,
      tipoDocumento: tipo,
      anoLetivoId: selectedAnoLetivoId,
      action,
    }) as EmissaoIndividualEstado;
  }

  useEffect(() => {
    let active = true;
    setDocumentState(null);
    setSuccess(null);
    setError(null);
    setErrorAction(null);
    paymentRequestRef.current = null;
    documentRequestRef.current = null;
    if (!selectedAluno?.id || !tipo || !selectedAnoLetivoId) {
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    consultarDocumentoIndividual({
      escolaId,
      alunoId: selectedAluno.id,
      tipoDocumento: tipo,
      anoLetivoId: selectedAnoLetivoId,
      action: "status",
    }).then((data) => {
      if (active) setDocumentState(data as EmissaoIndividualEstado);
    }).catch((err: unknown) => {
      if (active) reportError(err, "Falha ao consultar documento.");
    }).finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, [escolaId, selectedAluno?.id, tipo, selectedAnoLetivoId, reportError]);

  const handleRefresh = async () => {
    setStatusLoading(true);
    setError(null);
    setErrorAction(null);
    try {
      setDocumentState(await consultarEstado());
    } catch (err) {
      setDocumentState(null);
      reportError(err, "Não foi possível atualizar o estado.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSolicitar = async () => {
    if (!canSubmit) return;
    setStatusLoading(true);
    setError(null);
    setErrorAction(null);
    try {
      let estado = await consultarEstado("solicitar");
      setDocumentState(estado);
      // A aprovação permanece explícita e auditada pelo endpoint existente.
      if (estado.status === "approval" && estado.pedidoId) {
        const response = await fetch("/api/secretaria/documentos/aprovacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedidoId: estado.pedidoId, decision: "approve" }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Não foi possível aprovar o pedido.");
        }
        estado = await consultarEstado();
        setDocumentState(estado);
        if (estado.granted) setSuccess("Emissão aprovada. Pode emitir e imprimir.");
      }
    } catch (err) {
      setDocumentState(null);
      reportError(err, "Não foi possível aprovar a emissão.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePagamento = async () => {
    if (!canSubmit || !selectedAluno?.id || !selectedAnoLetivoId || !documentState) return;
    if (documentState.status !== "pending_payment") return;
    setPaymentBusy(true);
    setError(null);
    setErrorAction(null);
    try {
      let estado = documentState;
      if (!estado.pedidoId || !estado.pagamentoIntentId) {
        estado = await consultarEstado("solicitar");
        setDocumentState(estado);
      }
      if (estado.status !== "pending_payment") return;
      if (!estado.pedidoId || !estado.pagamentoIntentId || !estado.servicoCodigo ||
          !(Number(estado.valor) > 0)) {
        throw new Error("A intenção de pagamento ainda não está pronta.");
      }
      if (metodo === "tpa" && !reference.trim()) throw new Error("Introduza a referência do TPA.");
      if (metodo === "transfer" && !evidenceUrl.trim()) throw new Error("Indique o comprovativo da transferência.");

      if (!paymentRequestRef.current || paymentRequestRef.current.intentId !== estado.pagamentoIntentId) {
        paymentRequestRef.current = { intentId: estado.pagamentoIntentId, key: crypto.randomUUID() };
      }
      const pagamentoRes = await fetch("/api/secretaria/balcao/pagamentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": paymentRequestRef.current.key,
        },
        body: JSON.stringify({
          aluno_id: selectedAluno.id, ano_letivo_id: selectedAnoLetivoId,
          mensalidade_id: null, valor: Number(estado.valor), metodo,
          reference: reference.trim() || null,
          evidence_url: evidenceUrl.trim() || null, gateway_ref: null,
          meta: {
            origem: "documentos_emissao_individual",
            pedido_id: estado.pedidoId,
            pagamento_intent_id: estado.pagamentoIntentId,
            servico_codigo: estado.servicoCodigo,
          },
        }),
      });
      const response = await pagamentoRes.json().catch(() => ({}));
      if (!pagamentoRes.ok || !response?.ok) throw new Error(response?.error || "Não foi possível registar o pagamento.");
      const next = await consultarEstado();
      setDocumentState(next);
      setSuccess(next.granted
        ? "Pagamento confirmado. Agora pode emitir o documento."
        : "Pagamento registado. A emissão ficará disponível depois da validação financeira.");
    } catch (err) {
      reportError(err, "Pagamento não confirmado. Consulte o estado antes de repetir.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleEmitir = async () => {
    if (!canSubmit || !selectedAluno?.id || !tipo || !selectedAnoLetivoId || !documentState?.granted) return;
    if (documentState.status === "issued" && documentState.printUrl) {
      const impressao = abrirParaImpressao(documentState.printUrl);
      if (!impressao.ok) setPrintQueue((prev) => [{ label: selectedAluno.label, url: impressao.url }, ...prev]);
      return;
    }
    setSubmitting(true);
    setError(null);
    setErrorAction(null);
    setSuccess(null);
    try {
      const fingerprint = JSON.stringify({
        escolaId, alunoId: selectedAluno.id, tipoDocumento: tipo,
        anoLetivoId: selectedAnoLetivoId,
      });
      if (!documentRequestRef.current || documentRequestRef.current.fingerprint !== fingerprint) {
        documentRequestRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const emissao = await emitirDocumento({
        escolaId, alunoId: selectedAluno.id, tipoDocumento: tipo,
        idempotencyKey: documentRequestRef.current.key,
        anoLetivoId: selectedAnoLetivoId,
        anoLetivo: tipo === "boletim_trimestral" ? selectedAnoLetivo?.ano_letivo ?? null : null,
      });
      if (!emissao.ok) {
        setErrorAction(emissao.nextAction ?? null);
        throw new Error(emissao.error);
      }
      setDocumentState({
        ...documentState, status: "issued", granted: true,
        docId: emissao.docId, printUrl: emissao.printUrl,
      });
      setSuccess("Documento emitido. Pode imprimir novamente sem nova cobrança.");
      const impressao = abrirParaImpressao(emissao.printUrl);
      if (!impressao.ok) setPrintQueue((prev) => [{ label: selectedAluno.label, url: impressao.url }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na emissão. Consulte o estado antes de repetir.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Emissão individual</h2>
        <p className="text-sm text-muted-foreground">
          Selecione o aluno, o documento e o ano letivo. Emita, pague ou aprove conforme a situação do serviço.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quem precisa do documento?
        </label>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            disabled={operationBusy || statusLoading}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedAluno(null);
            }}
            placeholder="Buscar aluno por nome, processo ou BI..."
            className="w-full rounded-xl border border-border bg-muted px-10 py-3 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/10"
          />
          {loading && (
            <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald" />
          )}
        </div>

        {query && normalizedResults.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-card shadow-sm">
            {normalizedResults.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={operationBusy || statusLoading}
                onClick={() => handleSelectAluno(item.id, item.label)}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm hover:bg-muted"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.highlight || "Aluno"}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedAluno && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            Selecionado: <span className="font-semibold">{selectedAluno.label}</span>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {TIPOS.map((doc) => {
          const isActive = tipo === doc.id;
          const Icon = doc.icon;
          return (
            <button
              key={doc.id}
              type="button"
              disabled={operationBusy || statusLoading}
              onClick={() => setTipo(doc.id)}
              className={`rounded-xl border px-5 py-6 text-left transition-all ${
                isActive
                  ? "border-amber bg-amber-50 shadow-sm"
                  : "border-border bg-card hover:border-amber/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${isActive ? "bg-amber/20 text-amber" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{doc.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {tipo && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ano letivo
          </label>
          <select
            value={anoLetivoSelecionado}
            onChange={(event) => setAnoLetivoSelecionado(event.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            disabled={operationBusy || statusLoading || loadingAnoLetivo || anoLetivoOptions.length === 0}
          >
            <option value="" disabled>
              {loadingAnoLetivo ? "A carregar..." : "Selecione o ano letivo"}
            </option>
            {anoLetivoOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </section>
      )}

      {isPago && documentState?.status === "pending_payment" && (
        <section>
          <div className="rounded-xl border border-border bg-muted p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Registar pagamento do serviço</h3>
              <p className="text-sm font-semibold text-foreground">Taxa configurada: {valorBase.toLocaleString("pt-AO")} Kz</p>
              <p className="text-xs text-muted-foreground">Numerário validado no balcão. TPA e transferência requerem confirmação financeira.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "tpa", label: "TPA" },
                { id: "transfer", label: "Transferência" },
                { id: "cash", label: "Numerário" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMetodo(item.id as typeof metodo)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    metodo === item.id
                      ? "border-amber bg-amber-50 text-amber"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {metodo === "tpa" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Referência do Pagamento</label>
                <input
                  ref={referenceInputRef}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
            )}
            {metodo === "transfer" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Comprovativo (URL)</label>
                <input
                  value={evidenceUrl}
                  onChange={(event) => setEvidenceUrl(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        </section>
      )}
      {selectedAluno && tipo && (
        <section aria-label="Rever emissão" className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
          <h3 className="font-bold text-foreground">Rever antes de confirmar</h3>
          <p className="mt-1">Aluno: <strong>{selectedAluno.label}</strong></p>
          <p>Documento: <strong>{TIPOS.find((item) => item.id === tipo)?.title}</strong></p>
          <p>Ano letivo: <strong>{selectedAnoLetivo?.nome ?? "Selecione o ano letivo"}</strong></p>
          <p>Taxa: <strong>{!documentState ? "Por verificar" : documentState.status === "issued" ? "Sem nova cobrança" : isPago ? `${valorBase.toLocaleString("pt-AO")} Kz` : "Gratuito"}</strong></p>
          <p className="mt-2 text-muted-foreground">
            {statusLoading ? "A verificar a situação do documento..." :
              documentState?.status === "issued" ? "Documento emitido. Reimpressões não geram cobrança." :
              documentState?.status === "paid" ? "Pagamento confirmado. Pronto para emitir." :
              documentState?.status === "free" ? "Sem taxa pendente. Pronto para emitir." :
              documentState?.status === "verification" ? "Pagamento em validação. Aguarde a confirmação financeira." :
              documentState?.status === "approval" ? "Aguarda aprovação da secretaria." :
              documentState?.status === "pending_payment" ? "Emissão bloqueada até ao registo e validação do pagamento." :
              error ? "Não foi possível confirmar a situação. Resolva a pendência ou tente novamente." : !selectedAnoLetivoId ? "Selecione o ano letivo." : "Consulte a situação do documento."}
          </p>
        </section>
      )}
      {success && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>
      )}
      {error && (
        <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {errorAction && (
            <a href={errorAction.href}
              className="inline-flex items-center rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
              {errorAction.label}
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {documentState?.status === "issued" && documentState.printUrl ? (
          <>
            <button type="button" onClick={handleEmitir} disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <Printer className="h-4 w-4" /> Imprimir novamente
            </button>
            <a href={documentState.printUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground">
              Abrir documento
            </a>
          </>
        ) : documentState?.granted ? (
          <button type="button" onClick={handleEmitir} disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Emitir e imprimir
          </button>
        ) : documentState?.status === "pending_payment" ? (
          <button type="button" onClick={handlePagamento} disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {paymentBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            Registar pagamento
          </button>
        ) : documentState?.status === "approval" ? (
          <button type="button" onClick={handleSolicitar} disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <FileText className="h-4 w-4" /> Aprovar emissão
          </button>
        ) : null}
        {selectedAluno && tipo && selectedAnoLetivoId && (
          <button type="button" onClick={handleRefresh} disabled={submitting || paymentBusy || statusLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
            {error ? "Tentar novamente" : "Atualizar estado"}
          </button>
        )}
      </div>

      {printQueue.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="font-semibold mb-2">Documentos prontos para impressão</div>
          <div className="space-y-2">
            {printQueue.map((doc, index) => (
              <a
                key={`${doc.url}-${index}`}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl border border-emerald-200 bg-card px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Abrir documento
              </a>
            ))}
          </div>
        </div>
      )}

    </main>
  );
}
