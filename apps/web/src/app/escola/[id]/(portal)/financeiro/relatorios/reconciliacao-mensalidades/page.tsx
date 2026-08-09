"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type SummaryRow = { problema: string; total: number; saldo: number };
type Item = {
  mensalidade_id: string;
  aluno_nome: string;
  matricula_id: string | null;
  ano_letivo: number | null;
  mensalidade_ano_letivo: string | null;
  turma_nome: string | null;
  mensalidade_turma_id?: string | null;
  matricula_turma_id?: string | null;
  data_vencimento: string | null;
  status: string | null;
  saldo: number;
  problemas: string[];
};
type Candidate = { id: string; ano_letivo: number; turma_nome: string | null; turno: string | null; ativo: boolean; status: string | null };

const LABELS: Record<string, string> = {
  SEM_MATRICULA: "Sem matrícula válida",
  ANO_DIVERGENTE: "Ano divergente",
  TURMA_DIVERGENTE: "Turma divergente",
  SEM_DATA_VENCIMENTO: "Sem vencimento",
  SEM_CALENDARIO: "Sem calendário",
  FORA_CALENDARIO: "Fora do calendário",
};

const HELP: Record<string, string> = {
  SEM_MATRICULA: "Escolha a matrícula do mesmo aluno, ano e turma. O sistema só cria o vínculo; não apaga a cobrança.",
  ANO_DIVERGENTE: "O ano da mensalidade será alinhado ao ano da matrícula vinculada.",
  TURMA_DIVERGENTE: "A turma da mensalidade será alinhada à turma da matrícula vinculada.",
  SEM_DATA_VENCIMENTO: "Não invente uma data. Marque como justificado apenas se a secretaria/financeiro tiver evidência documental.",
  SEM_CALENDARIO: "A matrícula não tem calendário letivo identificável. Justifique ou corrija primeiro o contexto académico.",
  FORA_CALENDARIO: "A cobrança está fora das datas oficiais. Justifique somente com autorização/documento da escola.",
};

function actionFor(problem: string) {
  if (problem === "SEM_MATRICULA") return "corrigir_vinculo";
  if (problem === "ANO_DIVERGENTE") return "corrigir_ano";
  if (problem === "TURMA_DIVERGENTE") return "corrigir_turma";
  return "justificar";
}

export default function ReconciliacaoMensalidadesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const escolaId = params?.id as string;
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewing, setReviewing] = useState<Item | null>(null);
  const [reviewProblem, setReviewProblem] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!escolaId) return;
    let cancelled = false;
    const query = new URLSearchParams({ escolaId, limit: "50" });
    const academicYear = searchParams.get("ano_letivo_id");
    if (academicYear) query.set("ano_letivo_id", academicYear);

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/financeiro/relatorios/reconciliacao-mensalidades?${query.toString()}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error || `Erro ${response.status}`);
        if (!cancelled) {
          setSummary(body.summary ?? []);
          setItems(body.items ?? []);
          setTotal(Number(body.total ?? 0));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [escolaId, searchParams, reloadKey]);

  async function loadCandidates(item: Item) {
    setCandidateLoading(true);
    setCandidateError(null);
    setCandidates([]);
    try {
      const response = await fetch(`/api/financeiro/relatorios/reconciliacao-mensalidades/candidatos?escolaId=${encodeURIComponent(escolaId)}&mensalidade_id=${encodeURIComponent(item.mensalidade_id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || `Erro ${response.status}`);
      setCandidates(body.candidates ?? []);
      if ((body.candidates ?? []).length === 1) setSelectedCandidate(body.candidates[0].id);
    } catch (err) {
      setCandidateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCandidateLoading(false);
    }
  }

  function openReview(item: Item) {
    const problem = item.problemas[0] ?? "";
    setReviewing(item);
    setReviewProblem(problem);
    setSelectedCandidate("");
    setJustification("");
    setActionMessage(null);
    if (problem === "SEM_MATRICULA") void loadCandidates(item);
  }

  async function resolveReview() {
    if (!reviewing || !reviewProblem) return;
    const action = actionFor(reviewProblem);
    if (justification.trim().length < 10) {
      setActionMessage("Explique a decisão com pelo menos 10 caracteres.");
      return;
    }
    if (action === "corrigir_vinculo" && !selectedCandidate) {
      setActionMessage("Selecione a matrícula correta antes de continuar.");
      return;
    }
    setSubmitting(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/financeiro/relatorios/reconciliacao-mensalidades/resolver?escolaId=${encodeURIComponent(escolaId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensalidade_id: reviewing.mensalidade_id,
          problema: reviewProblem,
          acao: action,
          target_matricula_id: selectedCandidate || null,
          justificativa: justification.trim(),
          confirmacao: true,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || `Erro ${response.status}`);
      setActionMessage("Registado com sucesso. A linha será removida quando o relatório for actualizado.");
      setReviewing(null);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Reconciliação de Mensalidades</h1>
        <p className="mt-1 text-sm text-slate-600">
          Relatório somente leitura. Nenhuma linha é corrigida automaticamente.
        </p>
      </div>

      {loading && <div className="rounded-xl border bg-white p-5 text-slate-600">A verificar mensalidades…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>}
      {actionMessage && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{actionMessage}</div>}

      {!loading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-slate-500">Itens com problema</div><div className="mt-1 text-2xl font-bold">{total}</div></div>
            {summary.slice(0, 3).map((row) => (
              <div key={row.problema} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="text-xs uppercase text-amber-800">{LABELS[row.problema] ?? row.problema}</div>
                <div className="mt-1 text-2xl font-bold text-amber-950">{row.total}</div>
                <div className="text-xs text-amber-800">Saldo associado: {row.saldo.toLocaleString("pt-AO")} Kz</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Competência</th>
                  <th className="px-4 py-3">Ano / turma</th>
                  <th className="px-4 py-3">Problema</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Acção</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Fragment key={item.mensalidade_id}>
                  <tr className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.aluno_nome}</td>
                    <td className="px-4 py-3 text-slate-600">{item.data_vencimento ?? "Sem data"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.ano_letivo ?? item.mensalidade_ano_letivo ?? "—"} · {item.turma_nome ?? "Sem turma"}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{item.problemas.map((problem) => <span key={problem} className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">{LABELS[problem] ?? problem}</span>)}</div></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(item.saldo ?? 0).toLocaleString("pt-AO")} Kz</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => openReview(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-klasse-green hover:text-klasse-green">Rever</button></td>
                  </tr>
                  {reviewing?.mensalidade_id === item.mensalidade_id && (
                    <tr className="border-b bg-slate-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="max-w-3xl space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div><div className="font-semibold text-slate-900">Revisar {item.aluno_nome}</div><div className="mt-1 text-xs text-slate-500">{HELP[reviewProblem] ?? "Confirme a decisão com evidência."}</div></div>
                            <button type="button" onClick={() => setReviewing(null)} className="text-xs text-slate-500 hover:text-slate-900">Fechar</button>
                          </div>
                          <label className="block text-xs font-semibold text-slate-700">Problema a tratar
                            <select value={reviewProblem} onChange={(event) => { const value = event.target.value; setReviewProblem(value); setSelectedCandidate(""); if (value === "SEM_MATRICULA") void loadCandidates(item); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal">
                              {item.problemas.map((problem) => <option key={problem} value={problem}>{LABELS[problem] ?? problem}</option>)}
                            </select>
                          </label>
                          {actionFor(reviewProblem) === "corrigir_vinculo" && (
                            <label className="block text-xs font-semibold text-slate-700">Matrícula correcta
                              <select value={selectedCandidate} onChange={(event) => setSelectedCandidate(event.target.value)} disabled={candidateLoading || candidates.length === 0} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal">
                                <option value="">{candidateLoading ? "A procurar candidatos…" : candidates.length ? "Seleccione uma matrícula" : "Nenhuma matrícula inequívoca encontrada"}</option>
                                {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.ano_letivo} · {candidate.turma_nome ?? "Sem turma"} · {candidate.status ?? "sem status"}</option>)}
                              </select>
                            </label>
                          )}
                          {candidateError && <p className="text-xs text-rose-700">{candidateError}</p>}
                          <label className="block text-xs font-semibold text-slate-700">Justificativa obrigatória
                            <textarea value={justification} onChange={(event) => setJustification(event.target.value)} rows={3} placeholder="Ex.: confirmado pela pauta/recibo da secretaria…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                          </label>
                          <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">A ação ficará registada no histórico de auditoria.</p><button type="button" onClick={() => void resolveReview()} disabled={submitting || (actionFor(reviewProblem) === "corrigir_vinculo" && !selectedCandidate)} className="rounded-lg bg-klasse-green px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "A guardar…" : actionFor(reviewProblem) === "justificar" ? "Justificar e fechar" : "Confirmar correcção"}</button></div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma inconsistência encontrada no ano selecionado.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
