"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

type Atendimento = {
  id: string;
  aluno_id: string | null;
  operador_id: string | null;
  status: string;
  motivo: string;
  resolucao: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  alunos?: {
    nome?: string | null;
    nome_completo?: string | null;
    bi_numero?: string | null;
  } | null;
};

type AlunoResult = {
  id: string;
  nome?: string | null;
  nome_completo?: string | null;
  bi_numero?: string | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function FilaAtendimentoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState("aberto");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Atendimento[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [motivo, setMotivo] = useState("");
  const [alunoQuery, setAlunoQuery] = useState("");
  const [alunoResults, setAlunoResults] = useState<AlunoResult[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<AlunoResult | null>(null);
  const [creating, setCreating] = useState(false);

  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [resolucao, setResolucao] = useState("");
  const [savingFinal, setSavingFinal] = useState(false);

  const debouncedAlunoQuery = useDebounce(alunoQuery.trim(), 300);

  const totalAbertos = useMemo(
    () => items.filter((item) => item.status === "aberto").length,
    [items]
  );

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        const res = await fetch(`/api/secretaria/atendimentos?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar fila");
        setItems(json.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar fila");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, status]);

  useEffect(() => {
    if (!open) return;
    if (!debouncedAlunoQuery || debouncedAlunoQuery.length < 2) {
      setAlunoResults([]);
      return;
    }

    const load = async () => {
      try {
        const params = new URLSearchParams({
          q: debouncedAlunoQuery,
          status: "ativo",
          pageSize: "6",
        });
        const res = await fetch(`/api/secretaria/alunos?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao buscar alunos");
        setAlunoResults(json.items || json.data || []);
      } catch {
        setAlunoResults([]);
      }
    };

    load();
  }, [open, debouncedAlunoQuery]);

  const handleCreate = async () => {
    if (!motivo.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/secretaria/atendimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: motivo.trim(),
          aluno_id: selectedAluno?.id ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao registrar atendimento");
      setMotivo("");
      setAlunoQuery("");
      setSelectedAluno(null);
      setStatus("aberto");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar atendimento");
    } finally {
      setCreating(false);
    }
  };

  const handleFinalizar = async () => {
    if (!finalizingId || !resolucao.trim()) return;
    setSavingFinal(true);
    try {
      const res = await fetch(`/api/secretaria/atendimentos/${finalizingId}/finalizar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolucao: resolucao.trim(), status: "fechado" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao finalizar atendimento");
      setFinalizingId(null);
      setResolucao("");
      setStatus("aberto");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar atendimento");
    } finally {
      setSavingFinal(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fila de Atendimento</h2>
            <p className="text-xs text-slate-500">{totalAbertos} atendimentos em aberto</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {["aberto", "em_atendimento", "fechado"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    className={cx(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      status === item
                        ? "bg-klasse-gold text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {item.replace("_", " ")}
                  </button>
                ))}
              </div>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
              {items.length === 0 && !loading ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  Nenhum atendimento encontrado.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {item.alunos?.nome_completo || item.alunos?.nome || "Atendimento sem aluno"}
                        </div>
                        <div className="text-xs text-slate-500">{item.motivo}</div>
                      </div>
                      <span
                        className={cx(
                          "rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                          item.status === "fechado"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "em_atendimento"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{new Date(item.iniciado_em).toLocaleString("pt-PT")}</span>
                      {item.status !== "fechado" ? (
                        <button
                          type="button"
                          onClick={() => setFinalizingId(item.id)}
                          className="text-klasse-gold font-semibold"
                        >
                          Finalizar
                        </button>
                      ) : null}
                    </div>

                    {finalizingId === item.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={resolucao}
                          onChange={(event) => setResolucao(event.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                          placeholder="Descreva a resolução..."
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFinalizingId(null);
                              setResolucao("");
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleFinalizar}
                            disabled={savingFinal || !resolucao.trim()}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {savingFinal ? "Salvando..." : "Concluir"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Novo atendimento</h3>
              <p className="text-xs text-slate-500">Registrar motivo antes de iniciar.</p>
              <div className="mt-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={alunoQuery}
                    onChange={(event) => {
                      setAlunoQuery(event.target.value);
                      setSelectedAluno(null);
                    }}
                    placeholder="Buscar aluno (opcional)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-9 py-2 text-sm"
                  />
                  {alunoResults.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow">
                      {alunoResults.map((aluno) => (
                        <button
                          key={aluno.id}
                          type="button"
                          onClick={() => {
                            setSelectedAluno(aluno);
                            setAlunoQuery(aluno.nome_completo || aluno.nome || "Aluno");
                            setAlunoResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                        >
                          <div className="font-semibold text-slate-900">
                            {aluno.nome_completo || aluno.nome || "Aluno"}
                          </div>
                          <div className="text-[11px] text-slate-500">BI: {aluno.bi_numero || "—"}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <textarea
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  rows={3}
                  placeholder="Motivo do atendimento"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !motivo.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-klasse-gold px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Registrar atendimento
                </button>

                <button
                  type="button"
                  onClick={() => setMotivo("")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                >
                  <XCircle className="h-4 w-4" />
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
