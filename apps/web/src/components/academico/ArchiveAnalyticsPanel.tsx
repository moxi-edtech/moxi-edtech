"use client";

import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, Wallet } from "lucide-react";
import { formatKwanza } from "@/lib/formatters";

type Session = { id: string; nome: string; ano_letivo: number };
type FinanceRow = { ano: number; previsto: number; pago: number; em_atraso: number; competencias: number };
type FinanceData = {
  ok?: boolean; error?: string; ano_letivo_id?: string; mes?: number | null;
  selecionado?: FinanceRow; por_ano?: FinanceRow[];
  competencia_selecionada?: { mes: number; ano: number; previsto: number; pago: number; em_atraso: number; competencias: number } | null;
  total_em_atraso_todos_anos?: number; aviso?: string;
};
type Metrics = { ano: number; ano_letivo_id: string; turmas: number; matriculas_vinculadas: number; historicos_documentados: number };
type CompareData = {
  ok?: boolean; error?: string; atual?: Metrics; comparado?: Metrics;
  diferenca?: { turmas: number; matriculas_vinculadas: number; historicos_documentados: number };
  metodo?: string;
};

function difference(value: number) {
  return value === 0 ? "0" : (value > 0 ? "+" : "") + String(value);
}

export default function ArchiveAnalyticsPanel({
  academicYearId, years, escolaParam,
}: {
  academicYearId: string;
  years: Session[];
  escolaParam: string | null;
}) {
  const [compareId, setCompareId] = useState("");
  const [showFinance, setShowFinance] = useState(false);
  const [month, setMonth] = useState("");
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState("");
  const [financeRetry, setFinanceRetry] = useState(0);
  const [compare, setCompare] = useState<CompareData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareRetry, setCompareRetry] = useState(0);
  const others = years.filter((y) => y.id !== academicYearId);
  const chosen = others.find((y) => y.id === compareId)?.id ?? others[0]?.id ?? "";

  useEffect(() => {
    if (!showFinance) return;
    const controller = new AbortController();
    setFinance(null);
    setFinanceError("");
    setFinanceLoading(true);
    const params = new URLSearchParams({ ano_letivo_id: academicYearId });
    if (escolaParam) params.set("escola_id", escolaParam);
    if (month) params.set("mes", month);
    void fetch("/api/secretaria/operacoes-academicas/arquivo/financeiro?" + params.toString(), {
      signal: controller.signal, cache: "no-store",
    }).then(async (res) => {
      const json = await res.json().catch(() => ({})) as FinanceData;
      if (!res.ok || !json.ok || json.ano_letivo_id !== academicYearId) {
        throw new Error(res.status === 403 ? "Consulta reservada à gestão financeira autorizada." : (json.error || "Falha ao consultar competências."));
      }
      return json;
    }).then((json) => { if (!controller.signal.aborted) setFinance(json); })
      .catch((e) => { if (!controller.signal.aborted) setFinanceError(e instanceof Error ? e.message : "Consulta indisponível."); })
      .finally(() => { if (!controller.signal.aborted) setFinanceLoading(false); });
    return () => controller.abort();
  }, [academicYearId, escolaParam, showFinance, month, financeRetry]);

  useEffect(() => {
    if (!chosen) return;
    const controller = new AbortController();
    setCompare(null);
    setCompareError("");
    setCompareLoading(true);
    const params = new URLSearchParams({ ano_letivo_id: academicYearId, comparar_ano_letivo_id: chosen });
    if (escolaParam) params.set("escola_id", escolaParam);
    void fetch("/api/secretaria/operacoes-academicas/arquivo/comparacao?" + params.toString(), {
      signal: controller.signal, cache: "no-store",
    }).then(async (res) => {
      const json = await res.json().catch(() => ({})) as CompareData;
      if (!res.ok || !json.ok || json.atual?.ano_letivo_id !== academicYearId ||
          json.comparado?.ano_letivo_id !== chosen) {
        throw new Error(json.error || "Não foi possível comparar os anos.");
      }
      return json;
    }).then((json) => { if (!controller.signal.aborted) setCompare(json); })
      .catch((e) => { if (!controller.signal.aborted) setCompareError(e instanceof Error ? e.message : "Comparação indisponível."); })
      .finally(() => { if (!controller.signal.aborted) setCompareLoading(false); });
    return () => controller.abort();
  }, [academicYearId, chosen, escolaParam, compareRetry]);

  const financeIsCurrent = finance?.ano_letivo_id === academicYearId &&
    (finance?.mes ?? null) === (month ? Number(month) : null);
  const comparisonIsCurrent = compare?.atual?.ano_letivo_id === academicYearId && compare?.comparado?.ano_letivo_id === chosen;
  const rows = [
    { key: "turmas", label: "Turmas" },
    { key: "matriculas_vinculadas", label: "Registos de matrícula vinculados" },
    { key: "historicos_documentados", label: "Históricos documentados" },
  ] as const;

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Consultas de gestão por ano">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-sora text-base font-semibold text-klasse-green">
          <BarChart3 className="h-4 w-4" /> Comparar anos letivos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Indicadores por escola e ano, sem trocar o contexto dos módulos operacionais.</p>
        {others.length > 0 ? (
          <>
            <label htmlFor="archive-compare-year" className="mt-3 block text-xs font-medium text-foreground">Comparar com</label>
            <select id="archive-compare-year" value={chosen} onChange={(e) => setCompareId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
              {others.map((y) => <option key={y.id} value={y.id}>{y.nome || String(y.ano_letivo) + "/" + String(y.ano_letivo + 1)}</option>)}
            </select>
            {compareLoading && <p role="status" className="mt-3 text-sm text-muted-foreground">A comparar anos…</p>}
            {!compareLoading && compareError && <div role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
              {compareError}
              <button type="button" onClick={() => setCompareRetry((v) => v + 1)} aria-label="Repetir comparação"><RefreshCw className="h-4 w-4"/></button>
            </div>}
            {!compareLoading && !compareError && comparisonIsCurrent && compare?.atual && compare?.comparado && (
              <>
                <table className="mt-3 w-full text-sm">
                  <thead><tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 text-left font-medium">Indicador</th>
                    <th className="py-2 text-right font-medium">{compare.atual.ano}</th>
                    <th className="py-2 text-right font-medium">{compare.comparado.ano}</th>
                    <th className="py-2 text-right font-medium">Δ</th>
                  </tr></thead>
                  <tbody>{rows.map(({ key, label }) => (
                    <tr key={key} className="border-b border-border/60">
                      <th className="py-2 text-left text-xs font-medium text-foreground">{label}</th>
                      <td className="py-2 text-right tabular-nums">{compare.atual![key]}</td>
                      <td className="py-2 text-right tabular-nums">{compare.comparado![key]}</td>
                      <td className="py-2 text-right tabular-nums">{difference(compare.atual![key] - compare.comparado![key])}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">{compare.metodo}</p>
              </>
            )}
          </>
        ) : <p className="mt-3 text-sm text-muted-foreground">Não existe outro ano disponível para comparação.</p>}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-sora text-base font-semibold text-klasse-green">
          <Wallet className="h-4 w-4" /> Financeiro por competência
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O ano consultado é apenas um filtro de análise. Dívidas anteriores continuam visíveis e exigíveis.
        </p>
        {!showFinance ? (
          <button type="button" onClick={() => setShowFinance(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
            Consultar resumo financeiro
          </button>
        ) : (
          <>
            <label htmlFor="archive-finance-month" className="mt-3 block text-xs font-medium text-foreground">Competência mensal</label>
            <select id="archive-finance-month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
              <option value="">Todas as competências do ano</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{String(m).padStart(2, "0")}</option>)}
            </select>
            {financeLoading && <p role="status" className="mt-3 text-sm text-muted-foreground">A consultar competências…</p>}
            {!financeLoading && financeError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive">
              {financeError}
              <button type="button" onClick={() => setFinanceRetry((v) => v + 1)} aria-label="Repetir resumo financeiro"><RefreshCw className="h-4 w-4"/></button>
            </div>}
            {!financeLoading && !financeError && financeIsCurrent && finance?.selecionado && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Em atraso no ano selecionado</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{formatKwanza(finance.selecionado.em_atraso)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Em atraso em todos os anos</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{formatKwanza(finance.total_em_atraso_todos_anos ?? 0)}</p>
                  </div>
                  {finance.competencia_selecionada && (
                    <div className="rounded-xl bg-muted p-3 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Em atraso na competência {String(finance.competencia_selecionada.mes).padStart(2, "0")}/{finance.competencia_selecionada.ano}</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{formatKwanza(finance.competencia_selecionada.em_atraso)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 max-h-60 overflow-y-auto">
                  {finance.por_ano?.map((r) => (
                    <div key={r.ano} className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs">
                      <span className="font-medium text-foreground">{r.ano}/{r.ano + 1}</span>
                      <span className="text-muted-foreground">{r.competencias} competências</span>
                      <span className="font-semibold tabular-nums">{formatKwanza(r.em_atraso)} em atraso</span>
                    </div>
                  ))}
                  {!finance.por_ano?.length && <p className="text-sm text-muted-foreground">Sem competências no read model financeiro.</p>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{finance.aviso}</p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
