"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, UserRoundX } from "lucide-react";

type Signal = { id: string; motivo: string; criado_em: string };
type Lookup = { ok?: boolean; error?: string; matricula_id?: string; sinalizacoes?: Signal[] };
type Props = {
  alunoId: string;
  escolaId?: string;
  alunoNome: string;
  turmaId: string;
  anoLetivoId?: string | null;
  matriculaId?: string | null;
  tipo: "confirmar" | "sinalizar" | "reativar";
  variant?: "button" | "menu";
  onTriggerClick?: () => void;
  onChanged?: () => void;
};

/** Uma operação administrativa por matrícula, utilizada em todos os portais. */
export function DesistenciaMatriculaAction({
  alunoId, escolaId, alunoNome, turmaId, anoLetivoId, matriculaId, tipo, variant = "button", onTriggerClick, onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [done, setDone] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const staff = tipo !== "sinalizar";
  const reativar = tipo === "reativar";

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) {
      el.close();
      opener.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => () => {
    if (dialog.current?.open) dialog.current.close();
  }, []);

  async function loadCurrent() {
    if (!staff) return;
    if (!escolaId) { setError("Escola não identificada."); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ escola_id: escolaId, aluno_id: alunoId, turma_id: turmaId });
      if (anoLetivoId) params.set("ano_letivo_id", anoLetivoId);
      params.set("estado", reativar ? "desistente" : "ativo");
      const res = await fetch(`/api/matriculas/desistencia?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => null) as Lookup | null;
      if (!res.ok || !body?.ok || !body.matricula_id) {
        throw new Error(body?.error ?? "Não foi possível identificar a matrícula ativa.");
      }
      if (matriculaId && body.matricula_id !== matriculaId) {
        throw new Error("A matrícula mudou de turma ou ano. Atualize a lista.");
      }
      setLookup(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na verificação.");
      setLookup(null);
    } finally {
      setLoading(false);
    }
  }

  function showDialog() {
    setOpen(true);
    setDone(false);
    setMotivo("");
    setReviewed(false);
    setLookup(null);
    setError(null);
    if (staff) void loadCurrent();
  }

  async function submit() {
    if (saving || loading || motivo.trim().length < 10 || motivo.trim().length > 500) return;
    if (staff && !reviewed) return;
    const target = staff ? lookup?.matricula_id : matriculaId;
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/matriculas/desistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ acao: tipo, matricula_id: target, motivo: motivo.trim() }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "A operação não foi concluída.");
      setDone(true);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
      if (staff) void loadCurrent();
    } finally {
      setSaving(false);
    }
  }

  async function discard(signalId: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/matriculas/desistencia", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "descartar", sinalizacao_id: signalId }),
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Não foi possível descartar.");
      await loadCurrent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível descartar.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = (staff ? Boolean(lookup?.matricula_id) && reviewed : Boolean(matriculaId))
    && motivo.trim().length >= 10 && motivo.trim().length <= 500 && !saving && !loading;

  return (
    <>
      <button type="button" ref={opener} onClick={() => { onTriggerClick?.(); showDialog(); }}
        className={variant === "menu"
          ? "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-klasse-gold"
          : "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-gold hover:text-klasse-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold"}>
        {reativar ? <RotateCcw size={16} className="text-klasse-green" aria-hidden />
          : <UserRoundX size={16} className="text-muted-foreground" aria-hidden />}
        {reativar ? "Reativar matrícula" : tipo === "confirmar" ? "Marcar desistente" : "Sinalizar desistência"}
      </button>
      <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); setOpen(false); }}
        className="w-[min(94vw,500px)] max-h-[85dvh] overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-foreground/40"
        aria-label={`${reativar ? "Reativar matrícula" : staff ? "Registar desistência" : "Sinalizar possível desistência"} de ${alunoNome}`}>
        <h3 className="text-base font-semibold text-klasse-green">
          {reativar ? "Reativar matrícula" : staff ? "Registar desistência" : "Sinalizar possível desistência"}
        </h3>
        <p className="mt-1 text-sm font-semibold">{alunoNome}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {reativar
            ? "Reativa a mesma matrícula deste ano, se houver vaga e o histórico ainda estiver aberto. O motivo da desistência anterior fica auditado; não cria outra matrícula, cobrança ou resultado académico."
            : staff
              ? "Encerra apenas a matrícula deste ano. As notas, presenças, documentos e valores financeiros anteriores serão preservados. Não atribui aprovação ou reprovação."
              : "A Secretaria verificará a situação. O aluno permanece matriculado até uma decisão autorizada."}
        </p>
        {loading && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={16} className="animate-spin" /> A verificar matrícula…</p>}
        {tipo === "confirmar" && !loading && (lookup?.sinalizacoes?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-foreground">Sinalizações dos professores</p>
            {lookup?.sinalizacoes?.map((signal) => (
              <div key={signal.id} className="flex items-start justify-between gap-3 border-t border-amber-200 pt-2">
                <p className="break-words text-xs text-foreground">{signal.motivo}</p>
                <button type="button" onClick={() => void discard(signal.id)} disabled={saving}
                  className="shrink-0 text-xs font-semibold text-foreground underline disabled:opacity-50">
                  Descartar
                </button>
              </div>
            ))}
          </div>
        )}
        {!done && (
          <>
            <label htmlFor={`desistencia-motivo-${alunoId}-${tipo}`} className="mt-4 block text-sm font-semibold">
              {reativar ? "Justificativa da reativação" : staff ? "Motivo da desistência" : "Indício observado"}
            </label>
            <textarea id={`desistencia-motivo-${alunoId}-${tipo}`}
              value={motivo} onChange={(event) => setMotivo(event.target.value)}
              maxLength={500} rows={3} required
              placeholder={reativar ? "Explique por que a matrícula deve voltar a ficar ativa…" : staff ? "Descreva o motivo administrativo confirmado pela escola…" : "Descreva a situação que precisa de verificação…"}
              className="mt-1 w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" />
            <p className="text-right text-xs text-muted-foreground">{motivo.trim().length}/500 · mínimo 10</p>
            {staff && (
              <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)}
                  className="mt-1 accent-klasse-green" />
                <span>{reativar ? "Confirmei a identidade, a turma e o ano letivo. Esta reativação não regulariza automaticamente dívidas." : "Confirmei a desistência, a matrícula e o ano letivo. Os acertos financeiros são tratados separadamente."}</span>
              </label>
            )}
          </>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        {done && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm font-semibold text-klasse-green">
            <Check size={16} /> {reativar ? "Matrícula reativada." : staff ? "Desistência registada." : "Sinalização enviada à Secretaria."}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={saving}
            className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold text-foreground disabled:opacity-50">
            {done ? "Fechar" : "Cancelar"}
          </button>
          {!done && (
            <button type="button" onClick={() => void submit()} disabled={!canSubmit}
              className="min-h-10 rounded-xl bg-klasse-gold px-4 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">
              {saving ? "A guardar…" : reativar ? "Confirmar reativação" : staff ? "Confirmar desistência" : "Enviar sinalização"}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
