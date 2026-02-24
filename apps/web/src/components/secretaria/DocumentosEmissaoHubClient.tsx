"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, FileText, RefreshCw, Search, User } from "lucide-react";

type DocumentoTipo =
  | "declaracao_frequencia"
  | "declaracao_notas"
  | "cartao_estudante"
  | "ficha_inscricao";

type DocumentoResponse = {
  ok: boolean;
  docId?: string;
  hash?: string;
  publicId?: string;
  tipo?: DocumentoTipo;
  error?: string;
};

type ServicoItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor_base: number;
  ativo: boolean;
};

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
    description: "Aproveitamento escolar para transferência.",
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; label: string; highlight?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<{ id: string; label: string } | null>(null);
  const [tipo, setTipo] = useState<DocumentoTipo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [servicos, setServicos] = useState<ServicoItem[]>([]);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [metodo, setMetodo] = useState<"cash" | "tpa" | "transfer" | "mcx" | "kiwk">("cash");
  const [reference, setReference] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [printQueue, setPrintQueue] = useState<Array<{ label: string; url: string }>>([]);
  const alunoIdParam = alunoId ?? searchParams?.get("alunoId");
  const tipoParam = (defaultTipo ?? (searchParams?.get("tipo") as DocumentoTipo | null)) ?? null;

  type BalcaoDecision = {
    decision: "GRANTED" | "BLOCKED" | "PENDING";
    reason_detail?: string | null;
    pedido_id?: string | null;
    payment_intent_id?: string | null;
  };

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
    const loadServicos = async () => {
      if (!escolaId) return;
      setLoadingServicos(true);
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/servicos`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar serviços");
        if (active) {
          setServicos(Array.isArray(json.items) ? json.items : []);
        }
      } catch (err) {
        if (active) setServicos([]);
      } finally {
        if (active) setLoadingServicos(false);
      }
    };

    loadServicos();
    return () => {
      active = false;
    };
  }, [escolaId]);

  const normalizedResults = useMemo(() => results.slice(0, 6), [results]);

  const selectedServico = useMemo(() => {
    if (!tipo) return null;
    const normalized = tipo.replace("declaracao_", "decl");
    const tokens = [tipo, normalized].flatMap((value) => value.split("_"));
    return (
      servicos.find((servico) => {
        const haystack = `${servico.codigo} ${servico.nome} ${servico.descricao ?? ""}`.toLowerCase();
        return tokens.some((token) => token && haystack.includes(token));
      }) ?? null
    );
  }, [servicos, tipo]);

  const isPago = Boolean(selectedServico && Number(selectedServico.valor_base ?? 0) > 0);
  const valorBase = Number(selectedServico?.valor_base ?? 0);

  const canSubmit = Boolean(selectedAluno?.id && tipo && !submitting);

  const handleSelectAluno = (id: string, label: string) => {
    setSelectedAluno({ id, label });
    setQuery(label);
  };

  const handleEmitir = async () => {
    if (!selectedAluno?.id || !tipo) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isPago && !selectedServico) {
        throw new Error("Serviço não encontrado no catálogo.");
      }

      if (isPago && metodo === "tpa" && !reference.trim()) {
        throw new Error("Referência obrigatória para TPA.");
      }

      if (isPago && metodo === "transfer" && !evidenceUrl.trim()) {
        throw new Error("Comprovativo obrigatório para Transferência.");
      }

      let pedidoId: string | null = null;
      let intentId: string | null = null;

      if (isPago && selectedServico) {
        const supabase = (await import("@/lib/supabase/client")).createClient();
        const { data, error: intentError } = await supabase.rpc("balcao_criar_pedido_e_decidir", {
          p_servico_codigo: selectedServico.codigo,
          p_aluno_id: selectedAluno.id,
          p_contexto: {},
        });

        if (intentError || !data) {
          throw new Error(intentError?.message || "Erro ao criar pedido.");
        }

        const decision = data as BalcaoDecision;
        if (decision.decision === "BLOCKED") {
          throw new Error(decision.reason_detail || "Serviço bloqueado.");
        }

        pedidoId = decision.pedido_id ?? null;
        intentId = decision.payment_intent_id ?? null;
      }

      if (isPago && intentId) {
        const idempotencyKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const pagamentoRes = await fetch("/api/secretaria/balcao/pagamentos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            aluno_id: selectedAluno.id,
            mensalidade_id: null,
            valor: valorBase,
            metodo,
            reference: reference || null,
            evidence_url: evidenceUrl || null,
            gateway_ref: null,
            meta: {
              origem: "documentos_emissao",
              pedido_id: pedidoId,
              pagamento_intent_id: intentId,
              servico_codigo: selectedServico?.codigo ?? null,
            },
          }),
        });
        const pagamentoJson = await pagamentoRes.json().catch(() => ({}));
        if (!pagamentoRes.ok || !pagamentoJson?.ok) {
          throw new Error(pagamentoJson?.error || "Falha ao registrar pagamento.");
        }
      }

      const res = await fetch("/api/secretaria/documentos/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunoId: selectedAluno.id, tipoDocumento: tipo, escolaId }),
      });
      const json = (await res.json().catch(() => ({}))) as DocumentoResponse;
      if (!res.ok || !json.ok || !json.docId) {
        throw new Error(json.error || "Falha ao emitir documento");
      }

      const destino =
        tipo === "declaracao_frequencia"
          ? `/secretaria/documentos/${json.docId}/frequencia/print`
          : tipo === "declaracao_notas"
          ? `/secretaria/documentos/${json.docId}/notas/print`
          : tipo === "cartao_estudante"
          ? `/secretaria/documentos/${json.docId}/cartao/print`
          : `/secretaria/documentos/${json.docId}/ficha/print`;

      const popup = window.open(destino, "_blank", "noopener,noreferrer");
      if (!popup) {
        setPrintQueue((prev) => [{ label: selectedAluno.label, url: destino }, ...prev]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao emitir documento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Balcão de Emissão Rápida</h1>
        <p className="text-sm text-slate-500">
          Selecione o aluno, escolha o tipo de declaração e imprima na hora.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quem precisa do documento?
        </label>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedAluno(null);
            }}
            placeholder="Buscar aluno por nome, processo ou BI..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          />
          {loading && (
            <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-klasse-green" />
          )}
        </div>

        {query && normalizedResults.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            {normalizedResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectAluno(item.id, item.label)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.highlight || "Aluno"}</div>
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
          const serviceMatch = selectedServico && tipo === doc.id ? selectedServico : null;
          const priceLabel = serviceMatch ? Number(serviceMatch.valor_base ?? 0) : null;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => setTipo(doc.id)}
              className={`rounded-2xl border px-5 py-6 text-left transition-all ${
                isActive
                  ? "border-klasse-gold bg-amber-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-klasse-gold/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${isActive ? "bg-klasse-gold/20 text-klasse-gold" : "bg-slate-100 text-slate-500"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{doc.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{doc.description}</p>
                  {priceLabel !== null && (
                    <p className={`mt-2 text-xs font-semibold ${priceLabel > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {priceLabel > 0 ? `Documento pago · ${priceLabel} Kz` : "Documento grátis"}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {isPago && selectedServico && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Checkout rápido</h3>
            <p className="text-xs text-slate-500">Documento pago · {valorBase} Kz</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { id: "cash", label: "Cash" },
              { id: "tpa", label: "TPA" },
              { id: "transfer", label: "Transfer" },
              { id: "mcx", label: "MCX" },
              { id: "kiwk", label: "KIWK" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMetodo(item.id as typeof metodo)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  metodo === item.id
                    ? "border-klasse-gold bg-amber-50 text-klasse-gold"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {metodo === "tpa" && (
            <div>
              <label className="text-xs font-semibold text-slate-600">Referência</label>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          )}
          {metodo === "transfer" && (
            <div>
              <label className="text-xs font-semibold text-slate-600">Comprovativo (URL)</label>
              <input
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {printQueue.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="font-semibold mb-2">Documentos prontos para impressão</div>
          <div className="space-y-2">
            {printQueue.map((doc, index) => (
              <button
                key={`${doc.url}-${index}`}
                type="button"
                onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}
                className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Abrir documento
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleEmitir}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
          {isPago ? "Pagar e Emitir" : "Emitir e Imprimir"}
        </button>
      </div>
    </main>
  );
}
