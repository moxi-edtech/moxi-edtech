"use client";

import { useEffect, useState } from "react";
import { Check, Pencil } from "lucide-react";

type Turma = { id: string; nome: string; classe_num: number | null; turno: string | null };
type Options = {
  ok: true;
  matricula_id: string;
  turma_atual_id: string;
  turma_atual_nome: string;
  ano_letivo: number;
  items: Turma[];
};

const endpoint = "/api/secretaria/balcao/pauta-turma-origem";

export function BalcaoPautaSourceClassPicker({
  alunoId, matriculaId, onSaved,
}: {
  alunoId: string;
  matriculaId: string;
  onSaved: (turmaId: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setOptions(null);
    setSelected("");
    setError(null);
  }, [alunoId, matriculaId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ aluno_id: alunoId, matricula_id: matriculaId });
        const res = await fetch(endpoint + "?" + params.toString(), {
          cache: "no-store", signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok !== true || data.matricula_id !== matriculaId) {
          throw new Error(data.error ?? "Não foi possível abrir as turmas.");
        }
        if (!controller.signal.aborted) {
          setOptions(data as Options);
          setSelected(data.turma_atual_id);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Não foi possível abrir as turmas.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [open, alunoId, matriculaId]);

  const save = async () => {
    if (!selected || saving || loading || !options ||
        selected === options.turma_atual_id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aluno_id: alunoId, matricula_id: matriculaId, turma_id: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok !== true || data.matricula_id !== matriculaId ||
          data.turma_id !== selected) {
        throw new Error(data.error ?? "Não foi possível guardar a turma.");
      }
      setOpen(false);
      setOptions(null);
      await onSaved(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a turma.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
          <Pencil className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Corrigir turma da pauta
        </button>
      ) : (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/20 p-3">
          <label className="min-w-52 flex-1 text-xs font-semibold text-foreground">
            Turma de {options?.ano_letivo ?? "origem"}
            <select aria-label="Turma da pauta física" value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={loading || saving}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-background px-3 py-2 text-sm focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20">
              <option value="">{loading ? "A carregar…" : "Escolher turma"}</option>
              {options?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void save()}
            disabled={loading || saving || !options || !selected || selected === options.turma_atual_id}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber px-3 py-2 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50">
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? "A guardar…" : "Guardar e abrir pauta"}
          </button>
          <button type="button" onClick={() => setOpen(false)} disabled={saving}
            className="min-h-10 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
            Cancelar
          </button>
          {error && <p role="alert" className="w-full text-xs text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
