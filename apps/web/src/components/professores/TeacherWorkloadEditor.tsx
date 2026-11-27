"use client";

import { useEffect, useState } from "react";
import { Pencil, Check, Loader2 } from "lucide-react";

export type TeacherWorkloadConfig = {
  unidade: "tempos" | "minutos";
  limite: number | null;
  contratual_minutos: number | null;
  tempos_atribuidos: number | null;
  minutos_atribuidos: number | null;
};

const inputClass = "min-w-0 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20";
const hours = (value: number | null) => value == null ? "" : String(Number((value / 60).toFixed(3)));
const format = (value: number, unit: TeacherWorkloadConfig["unidade"]) => unit === "tempos" ? value + " tempos" : Math.floor(value / 60) + "h" + (value % 60 ? String(value % 60).padStart(2, "0") : "");

export default function TeacherWorkloadEditor({ escolaId, profileId, name, disabled, onSaved }: {
  escolaId: string;
  profileId: string;
  name?: string;
  disabled?: boolean;
  onSaved?: (config: TeacherWorkloadConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<TeacherWorkloadConfig | null>(null);
  const [unit, setUnit] = useState<TeacherWorkloadConfig["unidade"]>("tempos");
  const [limit, setLimit] = useState("");
  const [contract, setContract] = useState("");
  const endpoint = "/api/escolas/" + encodeURIComponent(escolaId) + "/professores/" + encodeURIComponent(profileId) + "/carga-lectiva";

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setConfig(null); setLoading(true); setError(""); setSaved(false);
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async res => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !json.item) throw new Error(json?.error || "Não foi possível consultar a carga.");
        if (controller.signal.aborted) return;
        const item = json.item as TeacherWorkloadConfig;
        setConfig(item); setUnit(item.unidade);
        setLimit(item.unidade === "minutos" ? hours(item.limite) : String(item.limite ?? ""));
        setContract(hours(item.contratual_minutos));
      }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Falha ao consultar a carga."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, endpoint]);

  async function save() {
    if (!config || saving || disabled) return;
    const parsed = Number(limit);
    const value = unit === "minutos" ? Math.round(parsed * 60) : parsed;
    const contractual = contract.trim() === "" ? null : Math.round(Number(contract) * 60);
    if (!limit.trim() || !Number.isInteger(value) || value <= 0 || value > (unit === "tempos" ? 100 : 10080)
      || (contractual !== null && (!Number.isInteger(contractual) || contractual <= 0 || contractual > 10080 || (unit === "minutos" && value > contractual)))) {
      setError("Informe um limite válido e compatível com a carga contratual."); return;
    }
    setSaving(true); setError("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidade: unit, limite: value, contratual_minutos: contractual }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Não foi possível guardar a carga.");
      const next = { ...config, unidade: unit, limite: value, contratual_minutos: contractual };
      setConfig(next); setOpen(false); setSaved(true);
      onSaved?.(next);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao guardar a carga."); }
    finally { setSaving(false); }
  }

  const actual = config ? (config.unidade === "minutos" ? config.minutos_atribuidos : config.tempos_atribuidos) : null;
  return <div className="space-y-2">
    <button type="button" disabled={disabled || saving} aria-expanded={open} onClick={() => setOpen(prev => !prev)}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-klasse-green hover:bg-muted disabled:opacity-50">
      <Pencil size={16}/> {open ? "Fechar edição da carga" : "Editar carga lectiva"}
    </button>
    {!open && saved && <p role="status" className="text-xs text-klasse-green">Carga actualizada. Pode continuar.</p>}
    {open && <section className="space-y-3 rounded-xl border border-border bg-card p-3 text-foreground">
      {name && <p className="text-sm font-semibold">{name}</p>}
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin"/> A consultar carga…</p> : config && <>
        <p className="text-sm text-muted-foreground">Carga atribuída: <strong className="text-foreground">{actual == null ? "A confirmar" : format(actual, config.unidade)}</strong></p>
        <fieldset disabled={disabled || saving} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-xs font-semibold">Limite semanal
              <input className={inputClass} type="number" min={unit === "tempos" ? 1 : 0.01} step={unit === "tempos" ? 1 : "any"} value={limit} onChange={e => setLimit(e.target.value)}/>
            </label>
            <label className="block space-y-1 text-xs font-semibold">Unidade
              <select className={inputClass} value={unit} onChange={e => { setUnit(e.target.value as TeacherWorkloadConfig["unidade"]); setLimit(""); }}>
                <option value="tempos">Tempos</option><option value="minutos">Horas</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs font-semibold">Carga contratual (horas, opcional)
            <input className={inputClass} type="number" min={0.01} step="any" value={contract} onChange={e => setContract(e.target.value)}/>
          </label>
          <button type="button" onClick={() => void save()} disabled={saving || !limit.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-klasse-gold-900 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Guardar carga
          </button>
        </fieldset>
      </>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>}
  </div>;
}
