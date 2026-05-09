"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

type BlockedItem = { aluno_id?: string; aluno_nome?: string | null; matricula_id?: string; motivos?: string[] }

type SuggestaoTurma = {
  tipo: 'promocao' | 'conclusao'
  origem: { id: string; nome: string }
  destino?: { id: string; nome: string } | null
  bloqueios?: {
    inadimplencia: number
    reprovacao: number
    detalhes: BlockedItem[]
  }
}

export default function ConfirmarRematriculaPage() {
  const router = useRouter();
  const { escolaSlug } = useEscolaId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total_inserted: number;
    total_skipped: number;
    items: Array<{ origem: string; destino: string; inserted: number; skipped: number; blocked: BlockedItem[] }>;
  } | null>(null);
  const [gerarMensalidades, setGerarMensalidades] = useState(false);
  const [gerarTodas, setGerarTodas] = useState(true);

  // In a real implementation, the suggestions would be passed as props or fetched from a shared state
  const [sugestoes, setSugestoes] = useState<SuggestaoTurma[]>([]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    const promocoes = sugestoes
      .filter(
        (s): s is SuggestaoTurma & { destino: { id: string; nome: string } } =>
          s.tipo === 'promocao' && Boolean(s.destino)
      )
      .map((s) => ({
        origem_turma_id: s.origem.id,
        destino_turma_id: s.destino.id,
      }));

    const concluir_turmas = sugestoes
      .filter((s) => s.tipo === 'conclusao')
      .map((s) => ({
        origem_turma_id: s.origem.id,
      }));

    try {
      const res = await fetch("/api/secretaria/rematricula/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promocoes,
          concluir_turmas,
          gerar_mensalidades: gerarMensalidades,
          gerar_todas: gerarTodas,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao confirmar rematrícula em massa");
      }
      const items = (json.results?.promocoes || []).map((r: { origem_turma_id: string; destino_turma_id: string; inserted?: number; skipped?: number; blocked?: BlockedItem[] }) => ({
        origem: sugestoes.find((s) => s.origem.id === r.origem_turma_id)?.origem?.nome || r.origem_turma_id,
        destino: sugestoes.find((s) => s.destino?.id === r.destino_turma_id)?.destino?.nome || r.destino_turma_id,
        inserted: r.inserted ?? 0,
        skipped: r.skipped ?? 0,
        blocked: Array.isArray(r.blocked) ? r.blocked : [],
      }))
      setSummary({ total_inserted: json.results?.total_inserted ?? 0, total_skipped: json.results?.total_skipped ?? 0, items })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Fetch suggestions on mount for demonstration purposes
  useEffect(() => {
    const fetchSugestoes = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/secretaria/rematricula/sugestoes");
        const json = await res.json();
        if (json.ok) {
          setSugestoes(json.sugestoes);
        }
      } catch {
        setError("Falha ao carregar sugestões.");
      } finally {
        setLoading(false);
      }
    };
    fetchSugestoes();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <h1 className="text-lg font-semibold mb-4">Confirmar Rematrícula em Massa</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {summary && (
        <div className="mb-4 rounded-md border border-klasse-green-200 bg-klasse-green-50 p-3 text-sm text-klasse-green-900">
          <div className="font-medium mb-2">Resultado</div>
          <div>Total inseridos: {summary.total_inserted} • Ignorados: {summary.total_skipped}</div>
          {summary.items.length > 0 && (
            <ul className="mt-2 list-disc list-inside">
              {summary.items.map((it, idx) => (
                <li key={idx}>
                  Origem {it.origem} → Destino {it.destino}: {it.inserted} inseridos, {it.skipped} ignorados
                  {it.blocked.length > 0 && (
                    <span className="text-xs text-slate-600 ml-2">• bloqueios: {it.blocked.length}</span>
                  )}
                  {it.blocked.length > 0 && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      <div className="font-medium">Bloqueios (até 5)</div>
                      <ul className="list-disc list-inside">
                        {it.blocked.slice(0, 5).map((item, bidx) => (
                          <li key={bidx}>
                            {(item.aluno_nome || item.aluno_id || "aluno")} • motivos: {(item.motivos || []).join(', ')}
                          </li>
                        ))}
                      </ul>
                      {it.blocked.length > 5 && (
                        <div className="mt-1 text-[11px] text-amber-800">
                          +{it.blocked.length - 5} alunos bloqueados
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      <div className="mb-4">
        <p>As seguintes ações serão executadas:</p>
        <ul className="list-disc list-inside">
          {sugestoes.map((s, i) => (
            <li key={i}>
              {s.tipo === 'promocao' ? `Promover alunos de ${s.origem.nome} para ${s.destino?.nome}` : `Concluir turma ${s.origem.nome}`}
              {s.bloqueios && (s.bloqueios.inadimplencia > 0 || s.bloqueios.reprovacao > 0) && (
                <span className="ml-2 text-xs text-amber-700">
                  bloqueios: {s.bloqueios.inadimplencia} inadimplência, {s.bloqueios.reprovacao} reprovação
                </span>
              )}
              {s.bloqueios && s.bloqueios.detalhes?.length > 0 && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  <div className="font-medium">Alunos bloqueados (até 5)</div>
                  <ul className="list-disc list-inside">
                    {s.bloqueios.detalhes.slice(0, 5).map((item, idx) => (
                      <li key={idx}>
                        {(item.aluno_nome || item.aluno_id || "aluno")} • motivos: {(item.motivos || []).join(', ')}
                      </li>
                    ))}
                  </ul>
                  {s.bloqueios.detalhes.length > 5 && (
                    <div className="mt-1 text-[11px] text-amber-800">
                      +{s.bloqueios.detalhes.length - 5} alunos bloqueados
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={gerarMensalidades} onChange={(e)=>setGerarMensalidades(e.target.checked)} />
            Gerar mensalidades
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={gerarTodas} onChange={(e)=>setGerarTodas(e.target.checked)} disabled={!gerarMensalidades} />
            Para todo o ano letivo
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(buildPortalHref(escolaSlug, '/secretaria/rematricula'))}
            className="inline-flex justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || sugestoes.length === 0}
            className="inline-flex justify-center rounded-md border border-transparent bg-klasse-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-klasse-green-700 focus:outline-none focus:ring-2 focus:ring-klasse-green-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Confirmando..." : "Confirmar Rematrícula"}
          </button>
        </div>
      </div>
    </div>
  );
}
