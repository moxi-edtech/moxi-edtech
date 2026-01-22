"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Loader2, Search, User } from "lucide-react";

type DocumentoTipo = "declaracao_frequencia" | "declaracao_notas";

type DocumentoResponse = {
  ok: boolean;
  docId?: string;
  hash?: string;
  publicId?: string;
  tipo?: DocumentoTipo;
  error?: string;
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
];

export default function DocumentosEmissaoHub({ escolaId }: { escolaId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; label: string; highlight?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<{ id: string; label: string } | null>(null);
  const [tipo, setTipo] = useState<DocumentoTipo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

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
      } catch (err) {
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

  const normalizedResults = useMemo(() => results.slice(0, 6), [results]);

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
          : `/secretaria/documentos/${json.docId}/notas/print`;

      router.push(destino);
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
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-klasse-green" />
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
                  <div className="text-xs text-slate-500">{item.highlight || item.type}</div>
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
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleEmitir}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Emitir e Imprimir
        </button>
      </div>
    </main>
  );
}
