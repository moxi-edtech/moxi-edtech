"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileText, Send, Save, Pencil } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Assignment = { turma_id: string; disciplina_id: string; turma_nome: string; disciplina_nome: string };
type Plan = { id: string; data: string; status: string; tema: string; subtema: string | null; objetivos: string | null; competencias: string | null; conteudos: string | null; metodologia: string | null; recursos: string | null; atividades: string | null; avaliacao: string | null; tarefa_casa: string | null; observacoes: string | null; arquivo_url: string | null; turma_disciplina_id: string; turma_id: string | null; disciplina_id: string | null };

const emptyForm = { turma_id: "", disciplina_id: "", data: new Date().toISOString().slice(0, 10), tema: "", subtema: "", objetivos: "", competencias: "", conteudos: "", metodologia: "", recursos: "", atividades: "", avaliacao: "", tarefa_casa: "", observacoes: "", arquivo_url: "" };

export default function PlanosAulaPage() {
  const searchParams = useSearchParams();
  const requestedTurmaId = searchParams?.get("turma_id") ?? "";
  const requestedDisciplinaId = searchParams?.get("disciplina_id") ?? "";
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setLoadError(null);
    try {
      const [agendaRes, plansRes] = await Promise.all([fetch("/api/professor/agenda", { cache: "no-store" }), fetch("/api/professor/planos-aula", { cache: "no-store" })]);
      const agenda = await agendaRes.json().catch(() => null);
      const planData = await plansRes.json().catch(() => null);
      if (!agendaRes.ok || !plansRes.ok || !planData?.ok) throw new Error(planData?.error ?? "Não foi possível carregar os planos.");
      const map = new Map<string, Assignment>();
      for (const item of agenda?.items ?? []) {
        if (!item.turma_id || !item.disciplina_id) continue;
        const key = `${item.turma_id}:${item.disciplina_id}`;
        if (!map.has(key)) map.set(key, { turma_id: item.turma_id, disciplina_id: item.disciplina_id, turma_nome: item.turma_nome ?? "Turma", disciplina_nome: item.disciplina_nome ?? "Disciplina" });
      }
      const nextAssignments = Array.from(map.values());
      setAssignments(nextAssignments);
      setPlans(planData.items ?? []);
      const requestedAssignment = nextAssignments.find((item) => item.turma_id === requestedTurmaId && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId));
      if (requestedAssignment) setForm((current) => current.turma_id ? current : { ...current, turma_id: requestedAssignment.turma_id, disciplina_id: requestedAssignment.disciplina_id });
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar os planos."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const selectedAssignment = useMemo(() => assignments.find((item) => item.turma_id === form.turma_id && item.disciplina_id === form.disciplina_id), [assignments, form.disciplina_id, form.turma_id]);
  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (status: "rascunho" | "enviado") => {
    setSaving(true); setMessage(null);
    try {
      if (!form.turma_id || !form.disciplina_id) throw new Error("Selecione a turma e a disciplina.");
      if (!form.tema.trim()) throw new Error("Informe o tema do plano.");
      const response = await fetch("/api/professor/planos-aula", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editingPlanId ?? undefined, status }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível guardar o plano.");
      setMessage(status === "enviado" ? "Plano enviado para revisão." : "Rascunho guardado.");
      setForm(emptyForm); setEditingPlanId(null); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível guardar o plano."); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-slate-50 pb-24"><div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <DashboardHeader title="Planos de aula" description="Prepare, envie e acompanhe os seus planos por turma e disciplina." breadcrumbs={[{ label: "Início", href: "/professor" }, { label: "Planos de aula" }]} />
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3"><FileText className="h-5 w-5 text-emerald-600" /><div><h2 className="font-black text-slate-900">Novo plano</h2><p className="text-xs text-slate-500">Campos pedagógicos adaptáveis à realidade da escola.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">Turma<select value={form.turma_id + ":" + form.disciplina_id} onChange={(event) => { const [turma_id, disciplina_id] = event.target.value.split(":"); setForm((current) => ({ ...current, turma_id: turma_id ?? "", disciplina_id: disciplina_id ?? "" })); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value=":" disabled>Selecione a turma e disciplina</option>{assignments.map((item) => <option key={`${item.turma_id}:${item.disciplina_id}`} value={`${item.turma_id}:${item.disciplina_id}`}>{item.turma_nome} · {item.disciplina_nome}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">Data<input type="date" value={form.data} onChange={(event) => update("data", event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" /></label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Tema *" value={form.tema} onChange={(value) => update("tema", value)} />
          <Field label="Subtema" value={form.subtema} onChange={(value) => update("subtema", value)} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{(["objetivos", "competencias", "conteudos", "metodologia", "recursos", "atividades", "avaliacao", "tarefa_casa"] as const).map((key) => <TextArea key={key} label={key.replace("_", " ")} value={form[key]} onChange={(value) => update(key, value)} />)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><TextArea label="Observações" value={form.observacoes} onChange={(value) => update("observacoes", value)} /><Field label="Link do material/anexo" value={form.arquivo_url} onChange={(value) => update("arquivo_url", value)} /></div>
        {selectedAssignment && <p className="mt-4 text-xs text-slate-400">Plano para {selectedAssignment.turma_nome} · {selectedAssignment.disciplina_nome}</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void save("rascunho")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"><Save className="h-4 w-4" /> Guardar rascunho</button><button type="button" disabled={saving} onClick={() => void save("enviado")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white"><Send className="h-4 w-4" /> Enviar para revisão</button></div>
        {message && <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p>}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-black text-slate-900">Os meus planos</h2><p className="mb-4 mt-1 text-xs text-slate-500">Acompanhe o estado de cada preparação.</p>{loadError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p>{loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></div> : loading ? <div className="space-y-3 animate-pulse"><div className="h-16 rounded-xl bg-slate-100" /><div className="h-16 rounded-xl bg-slate-100" /></div> : <div className="space-y-3">{plans.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center"><p className="text-sm font-bold text-slate-700">Ainda não há planos.</p><button type="button" onClick={() => document.querySelector("input")?.focus()} className="mt-2 text-xs font-black text-emerald-700 hover:underline">Criar o primeiro plano</button></div> : plans.map((plan) => <div key={plan.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{plan.tema}</p><p className="text-xs text-slate-500">{plan.data}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{plan.status}</span>{plan.status !== "aprovado" && plan.status !== "arquivado" && <button type="button" onClick={() => { setEditingPlanId(plan.id); setForm({ turma_id: plan.turma_id ?? "", disciplina_id: plan.disciplina_id ?? "", data: plan.data, tema: plan.tema, subtema: plan.subtema ?? "", objetivos: plan.objetivos ?? "", competencias: plan.competencias ?? "", conteudos: plan.conteudos ?? "", metodologia: plan.metodologia ?? "", recursos: plan.recursos ?? "", atividades: plan.atividades ?? "", avaliacao: plan.avaliacao ?? "", tarefa_casa: plan.tarefa_casa ?? "", observacoes: plan.observacoes ?? "", arquivo_url: plan.arquivo_url ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Editar plano"><Pencil className="h-3.5 w-3.5" /></button>}</div></div>{plan.objetivos && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{plan.objetivos}</p>}</div>)}</div>}</section>
    </div>
  </div></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-bold capitalize text-slate-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-bold capitalize text-slate-600">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm" /></label>; }
