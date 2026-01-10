"use client";

import { useEffect, useState, useMemo } from "react";

type Mensal = {
  anoLetivo: number;
  ano: number;
  mes: number;
  labelMes: string;
  competenciaMes: string;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  totalPrevisto: number;
  totalPago: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

type PorTurma = {
  turmaId: string;
  turmaNome: string;
  classe: string | null;
  turno: string | null;
  anoLetivo: number;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  totalPrevisto: number;
  totalPago: number;
  totalEmAtraso: number;
  inadimplenciaPct: number;
};

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensal, setMensal] = useState<Mensal[]>([]);
  const [porTurma, setPorTurma] = useState<PorTurma[]>([]);

  // --- Alinhamento com Sessão Acadêmica ---
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");

  const sessionSelecionada = useMemo(() => sessions.find((s) => s.id === selectedSession), [sessions, selectedSession]);

  const extrairAnoLetivo = (valor?: string | number | null) => {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const texto = String(valor);
    const match = texto.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  const anoLetivoAtivo = useMemo(() => {
    const candidatos = [
      (sessionSelecionada as any)?.ano_letivo,
      (sessionSelecionada as any)?.nome,
      (sessionSelecionada as any)?.data_inicio,
      (sessionSelecionada as any)?.data_fim,
    ];

    for (const candidato of candidatos) {
      const ano = extrairAnoLetivo(candidato);
      if (ano) return ano;
    }
    return new Date().getFullYear();
  }, [sessionSelecionada]);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/secretaria/school-sessions");
        const json = await res.json();
        if (json.ok) {
          const sessionItems = Array.isArray(json.data) ? json.data : Array.isArray(json.items) ? json.items : [];
          setSessions(sessionItems);
          const activeSession = sessionItems.find((s: any) => s.status === "ativa");
          if (activeSession) setSelectedSession(activeSession.id);
          else if (sessionItems.length > 0) setSelectedSession(sessionItems[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      }
    }
    fetchSessions();
  }, []);
  // --- Fim do alinhamento ---

  useEffect(() => {
    if (!selectedSession) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/financeiro/relatorios/propinas?ano=${encodeURIComponent(anoLetivoAtivo)}`, { cache: 'force-cache' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Erro ${res.status}`);
        }
        const j = await res.json();
        if (!cancelled) {
          setMensal(j.mensal || []);
          setPorTurma(j.porTurma || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; }
  }, [selectedSession, anoLetivoAtivo]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy">Relatório de Propinas</h1>
          <p className="text-sm text-gray-600">Resumo mensal e ranking por turma</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600">Sessão Acadêmica</label>
          <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-48 border rounded px-2 py-1 bg-white"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
        </div>
      </div>

      {loading && (
        <div className="p-4 bg-white rounded-xl shadow border text-gray-600">Carregando…</div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
            <h2 className="text-base font-semibold mb-3">Série mensal ({anoLetivoAtivo})</h2>
            <table className="min-w-full text-sm align-middle">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Competência</th>
                  <th className="py-2 pr-4 text-right">Previsto</th>
                  <th className="py-2 pr-4 text-right">Pago</th>
                  <th className="py-2 pr-4 text-right">Em atraso</th>
                  <th className="py-2 pr-4 text-right">Inadimplência %</th>
                </tr>
              </thead>
              <tbody>
                {mensal.map((m) => (
                  <tr key={`${m.ano}-${m.mes}`} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{m.labelMes}</td>
                    <td className="py-2 pr-4 text-right">{m.totalPrevisto.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{m.totalPago.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{m.totalEmAtraso.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{m.inadimplenciaPct.toFixed(1)}%</td>
                  </tr>
                ))}
                {mensal.length === 0 && (
                  <tr><td className="py-4 text-gray-500" colSpan={5}>Sem dados para o ano letivo de {anoLetivoAtivo}.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
            <h2 className="text-base font-semibold mb-3">Ranking por turma ({anoLetivoAtivo})</h2>
            <table className="min-w-full text-sm align-middle">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Turma</th>
                  <th className="py-2 pr-4">Classe</th>
                  <th className="py-2 pr-4">Turno</th>
                  <th className="py-2 pr-4 text-right">Mensalidades</th>
                  <th className="py-2 pr-4 text-right">Em atraso</th>
                  <th className="py-2 pr-4 text-right">Total atraso</th>
                  <th className="py-2 pr-4 text-right">Inadimplência %</th>
                </tr>
              </thead>
              <tbody>
                {porTurma.map((t) => (
                  <tr key={t.turmaId} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{t.turmaNome}</td>
                    <td className="py-2 pr-4">{t.classe || '—'}</td>
                    <td className="py-2 pr-4">{t.turno || '—'}</td>
                    <td className="py-2 pr-4 text-right">{t.qtdMensalidades}</td>
                    <td className="py-2 pr-4 text-right">{t.qtdEmAtraso}</td>
                    <td className="py-2 pr-4 text-right">{t.totalEmAtraso.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{t.inadimplenciaPct.toFixed(1)}%</td>
                  </tr>
                ))}
                {porTurma.length === 0 && (
                  <tr><td className="py-4 text-gray-500" colSpan={7}>Sem dados para o ano letivo de {anoLetivoAtivo}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
