"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function IndisciplinaRaaPage() {
  const [matriculaId, setMatriculaId] = useState("");
  const [gravidade, setGravidade] = useState<"grave" | "muito_grave">("grave");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [medida, setMedida] = useState("");
  const [impactaResultado, setImpactaResultado] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/academico/raa/indisciplina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula_id: matriculaId.trim(), gravidade, categoria, descricao, medida_aplicada: medida || null, impacta_resultado: impactaResultado }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível registar a ocorrência.");
      setMessage({ type: "ok", text: "Ocorrência registada e vinculada ao contexto académico." });
      setMatriculaId(""); setCategoria(""); setDescricao(""); setMedida("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao registar ocorrência." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-5">
      <DashboardHeader title="Indisciplina grave — RAA" description="Registe a ocorrência dentro da escola, ano letivo e matrícula corretos." breadcrumbs={[{ label: "Início", href: "/" }, { label: "Secretaria", href: "/secretaria" }, { label: "Indisciplina RAA" }]} />
      <section className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>O evento fica auditável e pode influenciar a análise RAA. Registe apenas factos verificáveis.</p></div>
        {message && <div className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-sm ${message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.type === "ok" && <CheckCircle2 className="h-4 w-4" />}{message.text}</div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><label className="text-sm font-medium text-slate-700">ID da matrícula</label><input required value={matriculaId} onChange={(event) => setMatriculaId(event.target.value)} placeholder="UUID da matrícula no ano letivo ativo" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-medium text-slate-700">Gravidade</label><select value={gravidade} onChange={(event) => setGravidade(event.target.value as typeof gravidade)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="grave">Grave</option><option value="muito_grave">Muito grave</option></select></div><div><label className="text-sm font-medium text-slate-700">Categoria</label><input required value={categoria} onChange={(event) => setCategoria(event.target.value)} placeholder="Ex.: agressão, ameaça, dano" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div></div>
          <div><label className="text-sm font-medium text-slate-700">Descrição factual</label><textarea required minLength={10} value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          <div><label className="text-sm font-medium text-slate-700">Medida aplicada <span className="font-normal text-slate-400">(opcional)</span></label><textarea value={medida} onChange={(event) => setMedida(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={impactaResultado} onChange={(event) => setImpactaResultado(event.target.checked)} /> Considerar na análise de resultado RAA</label>
          <button disabled={saving} className="rounded-lg bg-klasse-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "A guardar..." : "Registar ocorrência"}</button>
        </form>
      </section>
    </main>
  );
}
