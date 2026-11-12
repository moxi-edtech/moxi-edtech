"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatTurmaDisplayName, formatTurnoDisplay } from "@/utils/formatters";

interface TransferFormProps {
  matriculaId: string;
  canRectifyClass?: boolean;
  defaultRectifyClass?: boolean;
  currentTurmaId: string;
  anoLetivo?: number | null;
  anoLetivoId?: string | null;
  onSuccess: () => void;
  onResolveAcademic?: () => void;
}

interface Turma {
  id: string;
  nome?: string;
  turma_nome?: string;
  classe_nome?: string;
  turno?: string;
  curso_id?: string | null;
  classe_id?: string | null;
  ano_letivo?: number | string | null;
}

interface ImpactoTransferencia {
  allow: boolean;
  code?: string | null;
  requer_conciliacao_academica?: boolean;
  lotada: boolean;
  vagas_restantes: number;
  mudanca_turno: boolean;
  blockers?: string[];
  avisos?: string[];
  requer_confirmacao_historico?: boolean;
  financeiro: {
    altera_valor: boolean;
    valor_antigo: number;
    valor_novo: number;
    diferenca: number;
    mensagem: string;
  };
}

export default function TransferForm({ matriculaId, currentTurmaId, anoLetivo, anoLetivoId, onSuccess, onResolveAcademic, canRectifyClass = true, defaultRectifyClass = false }: TransferFormProps) {
  const [turmaId, setTurmaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academicConflict, setAcademicConflict] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [impacto, setImpacto] = useState<ImpactoTransferencia | null>(null);
  const [checking, setChecking] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [retificarClasse, setRetificarClasse] = useState(canRectifyClass && defaultRectifyClass);
  const [confirmarHistorico, setConfirmarHistorico] = useState(false);

  const turmaAtual = turmas.find((turma) => turma.id === currentTurmaId) ?? null;
  const turmasCompativeis = turmaAtual
    ? turmas.filter((turma) =>
        turma.id !== turmaAtual.id &&
        Number(turma.ano_letivo ?? 0) === Number(turmaAtual.ano_letivo ?? 0) &&
        turma.curso_id === turmaAtual.curso_id &&
        (retificarClasse ? turma.classe_id !== turmaAtual.classe_id : turma.classe_id === turmaAtual.classe_id)
      )
    : [];

  useEffect(() => {
    // Switching enrolments must invalidate both the destination list and any
    // previous preview; an old response cannot authorize the new selection.
    const controller = new AbortController();
    setTurmaId("");
    setImpacto(null);
    setTurmas([]);
    setConfirming(false);
    setAcademicConflict(false);
    setError(null);
    if (!anoLetivo || !anoLetivoId) return () => controller.abort();
    const params = new URLSearchParams({ ano: String(anoLetivo), session_id: anoLetivoId });
    void fetch(`/api/secretaria/turmas-simples?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.ok !== true || !Array.isArray(json.items)) {
          throw new Error(json.error || "Não foi possível consultar as turmas.");
        }
        return json.items as Turma[];
      })
      .then((items) => { if (!controller.signal.aborted) setTurmas(items); })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar as turmas. Volte a tentar."); });
    return () => controller.abort();
  }, [anoLetivo, anoLetivoId, matriculaId]);

  useEffect(() => {
    const controller = new AbortController();
    setImpacto(null);
    setAcademicConflict(false);
    if (!turmaId) {
      setChecking(false);
      return () => controller.abort();
    }
    setChecking(true);
    setError(null);
    void fetch(`/api/secretaria/admissoes/matriculas/${encodeURIComponent(matriculaId)}/${retificarClasse ? "rectify-class" : "check-transfer"}?target_turma_id=${encodeURIComponent(turmaId)}`, {
      signal: controller.signal, cache: "no-store",
    })
      .then((r) => r.json().catch(() => ({})).then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (controller.signal.aborted) return;
        if (!ok || typeof body.allow !== "boolean") throw new Error(body?.error || "Não foi possível verificar esta transferência.");
        setImpacto(body as ImpactoTransferencia);
        setAcademicConflict(body.requer_conciliacao_academica === true);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setImpacto(null);
        setError(e instanceof Error ? e.message : "Não foi possível verificar esta transferência.");
      })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [turmaId, matriculaId, retificarClasse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaId || loading || !impacto?.allow) return;
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/secretaria/admissoes/matriculas/${matriculaId}/${retificarClasse ? "rectify-class" : "transfer"}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma_id: turmaId, ano_letivo_id: anoLetivoId, motivo: motivo.trim(), confirmar_historico: retificarClasse && confirmarHistorico }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAcademicConflict(json.code === "TRANSFER_ACADEMIC_RECONCILIATION_REQUIRED" || json.code === "P1050");
        setConfirming(false);
        throw new Error(json.error || "Não foi possível concluir esta transferência.");
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const disableConfirm = (retificarClasse && impacto?.requer_confirmacao_historico && !confirmarHistorico) || !anoLetivoId || !turmaId || motivo.trim().length < 10 || !impacto?.allow || checking || loading || (impacto && impacto.lotada && !impacto.allow);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset className="flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-sm"><legend className="sr-only">Tipo de alteração</legend><label><input type="radio" checked={!retificarClasse} onChange={() => { setRetificarClasse(false); setTurmaId(""); setImpacto(null); setConfirming(false); setConfirmarHistorico(false); }} /> Trocar turma</label>{canRectifyClass && <label><input type="radio" checked={retificarClasse} onChange={() => { setRetificarClasse(true); setTurmaId(""); setImpacto(null); setConfirming(false); setConfirmarHistorico(false); }} /> Corrigir classe</label>}</fieldset>
      {retificarClasse && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Retificação administrativa, não progressão. Notas, pautas e movimentos financeiros anteriores serão preservados. Reveja os avisos e confirme para avançar.</p>}
      <div>
        <label htmlFor="turma" className="block text-sm font-medium text-gray-700">
          Nova Turma
        </label>
        <select
          id="turma"
          value={turmaId}
          onChange={(e) => { setTurmaId(e.target.value); setImpacto(null); setAcademicConflict(false); setConfirming(false); }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
          required
          disabled={!anoLetivo}
        >
          <option value="">Selecione uma turma</option>
          {turmasCompativeis.map((turma) => {
            const displayName = formatTurmaDisplayName(turma);
            const details = [formatTurnoDisplay(turma.turno), turma.classe_nome].filter(Boolean).join(" • ");
            return (
              <option key={turma.id} value={turma.id}>
                {details ? `${displayName} (${details})` : displayName}
              </option>
            );
          })}
        </select>
      </div>

      {checking && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando impacto...
        </div>
      )}

      {!anoLetivo && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          Selecione um ano letivo para listar as turmas disponíveis.
        </p>
      )}

      {anoLetivo && turmaAtual && turmasCompativeis.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          Não há turma de destino compatível para esta operação.
        </p>
      )}

      {anoLetivo && !turmaAtual && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
          Não foi possível identificar a turma actual da matrícula para filtrar destinos compatíveis.
        </p>
      )}

      {retificarClasse && impacto?.avisos?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Histórico existente</strong>{impacto.avisos.map(item=><p key={item} className="mt-1">{item}</p>)}<label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={confirmarHistorico} onChange={e=>{setConfirmarHistorico(e.target.checked);setConfirming(false);}} className="mt-1"/><span>Compreendo que o histórico será preservado e confirmo a retificação da classe.</span></label></div> : null}
      {impacto?.blockers?.length ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{impacto.blockers.map((item) => <p key={item}>{item}</p>)}</div> : null}
      {impacto && !checking && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {impacto.lotada && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>Turma sem vagas. Selecione um destino com capacidade disponível.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">Vagas restantes: {impacto.vagas_restantes ?? 0}</span>
            {impacto.mudanca_turno && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 ring-1 ring-amber-200">Mudança de turno</span>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold mb-1">Impacto financeiro</div>
            <div className="text-xs text-amber-800">{impacto.financeiro.mensagem}</div>
            <div className="mt-2 text-xs text-amber-900">
              {!retificarClasse && <>Atual: {impacto.financeiro.valor_antigo.toLocaleString('pt-AO')} Kz → Novo: {impacto.financeiro.valor_novo.toLocaleString('pt-AO')} Kz ({impacto.financeiro.diferenca >= 0 ? '+' : ''}{impacto.financeiro.diferenca.toLocaleString('pt-AO')} Kz)</>}
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="motivo-transferencia" className="block text-sm font-medium text-slate-700">Motivo da correcção ou transferência</label>
        <textarea id="motivo-transferencia" value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirming(false); }} minLength={10} maxLength={300} required placeholder="Explique o motivo (mínimo 10 caracteres)" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20" rows={3} />
        <p className="mt-1 text-xs text-muted-foreground">A matrícula e os pagamentos mantêm os identificadores. Se existirem notas, exames ou frequência, a operação será bloqueada até à conciliação académica.</p>
      </div>
      {!anoLetivoId && <p className="text-sm text-amber-700">Não foi possível identificar o ano letivo académico. Selecione o ano letivo antes de continuar.</p>}
      {(impacto?.requer_conciliacao_academica || academicConflict) && (
        <div role="status" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Histórico académico por conciliar</p>
          <p>Existem notas, exames ou frequência vinculados à turma de origem. Pode rever o processo no Balcão, mas a transferência exige conciliação formal do histórico; não basta confirmar a pendência. Nenhuma matrícula foi modificada.</p>
          {onResolveAcademic && (
            <button type="button" onClick={onResolveAcademic}
              className="inline-flex min-h-10 items-center rounded-xl bg-amber px-4 py-2 font-semibold text-foreground hover:brightness-95">
              Abrir situação académica do aluno
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {confirming && <section role="status" aria-live="polite" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"><strong>Reveja antes de aplicar</strong><p>Matrícula: {matriculaId}</p><p>Turma atual: {turmaAtual ? formatTurmaDisplayName(turmaAtual) : currentTurmaId}</p><p>Nova turma: {turmas.find(t => t.id === turmaId) ? formatTurmaDisplayName(turmas.find(t => t.id === turmaId)!) : turmaId}</p><p>Motivo: {motivo.trim()}</p></section>}

      <div className="flex justify-end gap-4 pt-2">
        <button
          type="button"
          onClick={() => { if (confirming) setConfirming(false); else onSuccess(); }}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!!disableConfirm}
          className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Transferindo..." : confirming ? retificarClasse ? "Confirmar retificação" : "Aplicar transferência" : retificarClasse ? "Rever retificação" : "Rever transferência"}
        </button>
      </div>
    </form>
  );
}
