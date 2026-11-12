"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

type Turma = {
  id: string;
  nome: string;
  classe_num: number | null;
  classe_id: string | null;
  curso_id: string | null;
  turno: string | null;
};
type Options = {
  ok: true;
  matricula_id: string;
  aluno_id: string;
  turma_atual_id: string;
  ano_letivo_id: string;
  ano_letivo: number;
  items: Turma[];
};
type Impact = {
  allow: boolean;
  blockers: string[];
  avisos: string[];
  requer_confirmacao_historico: boolean;
  requer_conciliacao_academica: boolean;
  vagas_restantes: number;
};

const endpoint = (id: string) =>
  "/api/secretaria/matriculas/" + encodeURIComponent(id) + "/rectify-class";

/** Corrige a matrícula REAL. Não cria aprovações, novos anos, notas ou dívidas. */
export function BalcaoEnrollmentCorrection({
  matriculaId, alunoId, turmaId, anoLetivoId, onSaved,
}: {
  matriculaId: string;
  alunoId: string;
  turmaId: string;
  anoLetivoId: string;
  onSaved: () => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [selected, setSelected] = useState("");
  const [motivo, setMotivo] = useState("Classe incorreta no registo da matrícula");
  const [impact, setImpact] = useState<Impact | null>(null);
  const [confirmHistory, setConfirmHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setOptions(null);
    setImpact(null);
    setSelected("");
    setError(null);
  }, [matriculaId, alunoId, turmaId, anoLetivoId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setOptions(null);
    setSelected("");
    setError(null);
    void fetch(endpoint(matriculaId), { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.ok !== true || body.matricula_id !== matriculaId ||
            body.aluno_id !== alunoId || body.ano_letivo_id !== anoLetivoId ||
            body.turma_atual_id !== turmaId) {
          throw new Error(body.error || "A matrícula mudou. Atualize antes de corrigir.");
        }
        return body as Options;
      })
      .then((data) => { if (!controller.signal.aborted) setOptions(data); })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Não foi possível consultar turmas.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, matriculaId, alunoId, turmaId, anoLetivoId]);

  useEffect(() => {
    setImpact(null);
    setConfirmHistory(false);
    if (!open || !selected || !options || selected === options.turma_atual_id) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    const url = endpoint(matriculaId) + "?target_turma_id=" + encodeURIComponent(selected);
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || typeof body.allow !== "boolean")
          throw new Error(body.error || "Não foi possível verificar a alteração.");
        return body as Impact;
      })
      .then((data) => { if (!controller.signal.aborted) setImpact(data); })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Falha na verificação.");
      })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [open, selected, options, matriculaId]);

  const current = options?.items.find((item) => item.id === options.turma_atual_id);
  const target = options?.items.find((item) => item.id === selected);
  const possibleTargets = (options?.items ?? []).filter((item) =>
    item.id !== options?.turma_atual_id &&
    (!current?.classe_id || item.classe_id !== current.classe_id)
  );
  const ready = Boolean(impact?.allow && target && !loading && !checking && !saving &&
    motivo.trim().length >= 10 && motivo.trim().length <= 300 &&
    (!impact.requer_confirmacao_historico || confirmHistory));

  async function save() {
    if (!ready || !options || !target || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(endpoint(matriculaId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: target.id,
          ano_letivo_id: anoLetivoId,
          motivo: motivo.trim(),
          confirmar_historico: confirmHistory,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true || body.matricula_id !== matriculaId)
        throw new Error(body.error || "Não foi possível corrigir esta matrícula.");
      setOpen(false);
      setOptions(null);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao guardar a correção.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
          <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Corrigir classe da matrícula
        </button>
      ) : (
        <section aria-label="Corrigir erro de classe da matrícula"
          className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Corrigir matrícula · {options?.ano_letivo ?? ""}</p>
            <button type="button" onClick={() => setOpen(false)} disabled={saving}
              aria-label="Cancelar correção" className="rounded-xl p-2 hover:bg-muted">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {loading ? "A consultar turmas…" : "Corrige o registo, sem promover o aluno ou gerar cobranças."}
          </p>
          {options && (
            <label className="block text-xs font-semibold text-foreground">
              Classe e turma corretas
              <select value={selected} onChange={(event) => {
                setSelected(event.target.value); setImpact(null); setError(null);
              }} disabled={loading || saving}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-4 focus:ring-amber/20">
                <option value="">Selecione a turma correta</option>
                {possibleTargets.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.classe_num != null ? item.classe_num + ".ª classe · " : ""}{item.nome}
                    {item.turno ? " · " + item.turno : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {target && (
            <p className="text-xs text-foreground">
              <span className="font-semibold">De:</span> {current?.nome ?? "Turma atual"}
              {" → "}<span className="font-semibold">Para:</span> {target.nome}
            </p>
          )}
          {checking && <p role="status" className="text-xs text-muted-foreground">A verificar impacto…</p>}
          {impact && !impact.allow && (
            <div role="status" className="space-y-1 text-xs text-foreground">
              {impact.blockers.map((item) => <p key={item}>{item}</p>)}
            </div>
          )}
          {impact?.avisos?.map((item) => (
            <p key={item} className="text-xs text-muted-foreground">{item}</p>
          ))}
          {impact?.requer_confirmacao_historico && (
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input type="checkbox" checked={confirmHistory}
                onChange={(event) => setConfirmHistory(event.target.checked)}
                disabled={saving} className="mt-0.5 accent-amber" />
              Preservar os pagamentos e documentos já registados
            </label>
          )}
          {target && (
            <label className="block text-xs font-semibold text-foreground">
              Motivo da correção
              <input type="text" value={motivo} maxLength={300}
                onChange={(event) => setMotivo(event.target.value)} disabled={saving}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-4 focus:ring-amber/20" />
            </label>
          )}
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
          <button type="button" onClick={() => void save()} disabled={!ready}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50">
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? "A guardar…" : "Confirmar correção"}
          </button>
        </section>
      )}
    </div>
  );
}
