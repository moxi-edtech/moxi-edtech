"use client";

import { useState } from "react";

type Pendencia = {
  id: string;
  regra: string;
  severidade: "CRITICAL" | "WARN";
  turma_id?: string;
  matricula_id?: string;
  mensagem: string;
};

export default function SanidadeFechamentoPage() {
  const [acao, setAcao] = useState<"fechar_trimestre" | "fechar_ano">("fechar_trimestre");
  const [anoLetivoId, setAnoLetivoId] = useState("");
  const [periodoLetivoId, setPeriodoLetivoId] = useState("");
  const [turmaIds, setTurmaIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);

  const params = new URLSearchParams({
    acao,
    ano_letivo_id: anoLetivoId,
    ...(periodoLetivoId ? { periodo_letivo_id: periodoLetivoId } : {}),
    ...(turmaIds ? { turma_ids: turmaIds } : {}),
  });

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/secretaria/fechamento-academico/sanidade?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao gerar relatório.");
      setPendencias(json.relatorio?.pendencias ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    const url = `/api/secretaria/fechamento-academico/sanidade?${params.toString()}&format=csv`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Sanidade pré-fechamento acadêmico</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={acao} onChange={(e) => setAcao(e.target.value as "fechar_trimestre" | "fechar_ano")} className="rounded border p-2">
          <option value="fechar_trimestre">Fechar trimestre</option>
          <option value="fechar_ano">Fechar ano</option>
        </select>
        <input value={anoLetivoId} onChange={(e) => setAnoLetivoId(e.target.value)} placeholder="ano_letivo_id" className="rounded border p-2" />
        <input value={periodoLetivoId} onChange={(e) => setPeriodoLetivoId(e.target.value)} placeholder="periodo_letivo_id (opcional)" className="rounded border p-2" />
        <input value={turmaIds} onChange={(e) => setTurmaIds(e.target.value)} placeholder="turma_ids separados por vírgula" className="rounded border p-2" />
      </div>
      <div className="flex gap-2">
        <button onClick={run} disabled={loading || !anoLetivoId} className="rounded bg-slate-900 px-3 py-2 text-white">{loading ? "Validando..." : "Validar"}</button>
        <button onClick={downloadCsv} disabled={!anoLetivoId} className="rounded border px-3 py-2">Exportar pendências (CSV)</button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="space-y-2">
        {pendencias.map((p) => (
          <div key={p.id} className="rounded border p-3 text-sm">
            <p className="font-semibold">[{p.severidade}] {p.regra}</p>
            <p>{p.mensagem}</p>
            <p className="text-xs text-slate-500">Turma: {p.turma_id ?? "-"} · Matrícula: {p.matricula_id ?? "-"}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
