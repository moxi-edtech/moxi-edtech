"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { RetificarMatriculaAction } from "@/components/aluno/RetificarMatriculaAction";
import { buildBalcaoActionHref } from "@/lib/balcao/action-registry";

type CurrentEnrollmentState = {
  ok: boolean;
  error?: string;
  anoLetivo?: { id: string; ano: number; label: string };
  estado?: "ativa" | "pendente" | "encerrada" | "cancelada" | "sem_matricula" | "reconciliacao";
  reason?: string | null;
  canRectifyClass?: boolean;
  canConfirm?: boolean;
  pedidoId?: string | null;
  cicloVida?: {
    matriculas: Array<{
      anoLetivo: number | null;
      estadoOperacional: string;
      academico: { resultadoRegistrado: string; resultadoOficial: string | null };
      pendencias: Array<{ codigo: string; mensagem: string }>;
    }>;
    pendenciasGerais: Array<{ codigo: string; mensagem: string }>;
  };
  matricula?: {
    id: string;
    status: string;
    turmaId: string;
    turmaNome: string;
    classeNome: string | null;
    ano: number;
    anoLetivoId: string;
    origemId: string | null;
  } | null;
};

/**
 * Always resolves the school's ACTIVE academic year, not the dossier's
 * historically selected year. No inferred promotion or silent enrollment.
 */
export function CurrentYearEnrollmentPanel({
  alunoId,
  escolaId,
  onChanged,
}: {
  alunoId: string;
  escolaId: string;
  onChanged?: () => void;
}) {
  const [state, setState] = useState<CurrentEnrollmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    setLoading(true);
    setError(null);
    setReview(false);
    void fetch("/api/secretaria/alunos/" + encodeURIComponent(alunoId) + "/matricula-corrente?escolaId=" + encodeURIComponent(escolaId), {
      signal: controller.signal, cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as CurrentEnrollmentState;
        if (!response.ok || !body.ok) throw new Error(body.error || "Falha na consulta da matrícula.");
        return body;
      })
      .then((body) => { if (!controller.signal.aborted) setState(body); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha na consulta.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [alunoId, escolaId, revision]);

  const refresh = () => {
    setReview(false);
    setRevision((current) => current + 1);
    onChanged?.();
  };

  async function confirmCurrentEnrollment() {
    const matricula = state?.matricula;
    if (!matricula || !state?.canConfirm || !state.pedidoId || !state.anoLetivo || saving || !review) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/secretaria/alunos/" + encodeURIComponent(alunoId) + "/matricula-corrente",
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            escola_id: escolaId,
            matricula_id: matricula.id,
            turma_id: matricula.turmaId,
            ano_letivo_id: state.anoLetivo.id,
            pedido_id: state.pedidoId,
            confirmar: true,
          }),
        },
      );
      const result = await response.json().catch(() => ({})) as {
        ok?: boolean; error?: string;
      };
      if (!response.ok || !result.ok) throw new Error(result.error || "A confirmação foi recusada.");
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao confirmar.");
      // Avoid retrying an already committed operation without re-reading status.
      setReview(false);
    } finally {
      setSaving(false);
    }
  }

  // Histórico anterior nunca é corrigido silenciosamente para liberar o ano
  // corrente. A secretaria recebe uma ação explícita sem perder o aluno.
  const historicosARever = (state?.cicloVida?.matriculas ?? []).filter(
    (matricula) => state?.anoLetivo && matricula.anoLetivo != null
      && matricula.anoLetivo < state.anoLetivo.ano
      && matricula.pendencias.some((p) =>
        ["ORIGEM_PENDENTE_COM_DESTINO_ATIVO", "HISTORICO_EM_CONSTRUCAO", "RESULTADO_AINDA_NAO_OFICIAL"].includes(p.codigo),
      ),
  ).length;
  const semVinculo = state?.cicloVida?.pendenciasGerais.length ?? 0;
  const registroAno = state?.cicloVida?.matriculas.find((item) => item.anoLetivo === state.anoLetivo?.ano);

  return (
    <section aria-label="Matrícula do ano letivo corrente" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Matrícula do ano letivo corrente</h3>
          <p className="mt-1 text-xs text-slate-500">
            {state?.anoLetivo ? state.anoLetivo.label : "A verificar o ano ativo da escola"}
          </p>
        </div>
        <button
          type="button" onClick={refresh} disabled={loading || saving}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden /> Atualizar
        </button>
      </div>

      {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A confirmar matrícula…
      </p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      {!loading && (historicosARever > 0 || semVinculo > 0) && (
        <div role="status" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Histórico académico a conciliar</p>
          <p className="text-xs text-amber-900">
            {historicosARever > 0 ? `${historicosARever} matrícula(s) de anos anteriores exigem revisão.` : ""}
            {semVinculo > 0 ? " Há documentos históricos sem vínculo inequívoco." : ""}
            {" "}A matrícula do ano atual não é alterada por esta revisão.
          </p>
          <Link href="/secretaria/fechamento-academico" className="inline-block text-xs font-bold text-amber-900 underline underline-offset-2">
            Rever fechamento e resultados académicos
          </Link>
        </div>
      )}

      {!loading && state?.estado === "ativa" && state.matricula && (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} aria-hidden /> Matrícula confirmada
          </p>
          <p className="text-sm text-slate-700">
            <strong>Classe:</strong> {state.matricula.classeNome ?? "Não indicada"}
            {" · "}<strong>Turma:</strong> {state.matricula.turmaNome}
          </p>
          {state.canRectifyClass && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="max-w-md text-xs text-slate-500">
                Classe incorreta? O administrador pode retificar a matrícula deste ano,
                sem alterar notas, pagamentos ou documentos históricos.
              </p>
              <RetificarMatriculaAction
                matriculaId={state.matricula.id}
                turmaId={state.matricula.turmaId}
                anoLetivo={state.matricula.ano}
                anoLetivoId={state.matricula.anoLetivoId}
                canRectifyClass
                onChanged={refresh}
              />
            </div>
          )}
        </div>
      )}

      {!loading && state?.estado === "pendente" && state.matricula && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-amber-800">Matrícula preparada — ainda não confirmada</p>
          <p className="text-sm text-slate-700">
            {state.matricula.classeNome ?? "Classe por verificar"} · {state.matricula.turmaNome}
          </p>
          {state.canConfirm && state.pedidoId ? (
            <>
              <p className="text-xs text-slate-600">
                Existe um pedido associado. A confirmação só será concluída se o servidor
                verificar o pagamento, o recibo, as dívidas vencidas e a decisão académica.
              </p>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={review} disabled={saving}
                  onChange={(event) => setReview(event.target.checked)} className="mt-1" />
                <span>Revisei a turma e confirmo que devo concluir esta matrícula no ano letivo corrente.</span>
              </label>
              <button
                type="button" disabled={!review || saving} onClick={() => void confirmCurrentEnrollment()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" aria-hidden />}
                Confirmar matrícula
              </button>
            </>
          ) : (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {state.reason ?? "A confirmação precisa de conciliação académica e financeira no Balcão."}
            </p>
          )}
        </div>
      )}

      {!loading && state && (state.estado === "encerrada" || state.estado === "cancelada") && (
        <div role="status" className="space-y-1 rounded-lg border border-border bg-muted p-3">
          <p className="text-sm font-semibold text-foreground">
            {state.estado === "encerrada" ? "Matrícula encerrada neste ano" : "Matrícula cancelada neste ano"}
          </p>
          <p className="text-xs text-muted-foreground">
            {registroAno?.academico.resultadoOficial
              ? `Resultado académico oficial: ${registroAno.academico.resultadoOficial}.`
              : "Resultado académico ainda não oficializado no histórico; consulte o fechamento escolar."}
          </p>
          <Link href="/secretaria/fechamento-academico" className="text-xs font-bold text-foreground underline underline-offset-2">
            Consultar fechamento académico
          </Link>
        </div>
      )}
      {!loading && state && (state.estado === "reconciliacao" || state.estado === "sem_matricula") && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{state.reason}</span>
        </p>
      )}
      {!loading && state && (state.estado === "pendente" || state.estado === "sem_matricula" || state.estado === "reconciliacao") && (
        <Link href={buildBalcaoActionHref({
          escolaParam: escolaId,
          actionId: state.estado === "sem_matricula" ? "enrollment" : "reenrollment",
          alunoId,
        })}
          className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-700">
          {state.estado === "sem_matricula" ? "Iniciar matrícula no Balcão" : "Abrir rematrícula no Balcão"}
        </Link>
      )}
    </section>
  );
}
