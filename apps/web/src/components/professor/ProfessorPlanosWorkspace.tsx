"use client";

import { usePortalDrawerGuard, usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Send, Save, Pencil } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { fieldControlClass, fieldFocusClass, fieldLabelClass } from "@/components/ui/fieldStyles";
import { ProfessorPlanosAulaSkeleton, ProfessorPlanosListSkeleton } from "@/components/professor/ProfessorLoadingSkeletons";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

type Assignment = { turma_id: string; disciplina_id: string; turma_nome: string; disciplina_nome: string };
type Plan = { id: string; data: string; status: string; tema: string; subtema: string | null; objetivos: string | null; competencias: string | null; conteudos: string | null; metodologia: string | null; recursos: string | null; atividades: string | null; avaliacao: string | null; tarefa_casa: string | null; anotacoes_alunos_avaliados: string | null; observacoes: string | null; arquivo_url: string | null; turma_disciplina_id: string; turma_id: string | null; disciplina_id: string | null };

const emptyForm = { turma_id: "", disciplina_id: "", data: new Date().toISOString().slice(0, 10), tema: "", subtema: "", objetivos: "", competencias: "", conteudos: "", metodologia: "", recursos: "", atividades: "", avaliacao: "", tarefa_casa: "", anotacoes_alunos_avaliados: "", observacoes: "", arquivo_url: "" };
const planFields = [
  ["objetivos", "Sumário"],
  ["competencias", "Objetivo"],
  ["conteudos", "Conteúdo e palavras-chave"],
  ["metodologia", "Objetivo (metodologia)"],
  ["recursos", "Procedimento"],
  ["atividades", "Meio de ensino"],
  ["avaliacao", "Motivação"],
  ["tarefa_casa", "Conteúdo e palavras-chave (tarefa para casa)"],
  ["anotacoes_alunos_avaliados", "Anotações de alunos avaliados"],
] as const;

export function ProfessorPlanosWorkspace({ embedded = false, requestedTurmaId = "", requestedDisciplinaId = "" }: { embedded?: boolean; requestedTurmaId?: string; requestedDisciplinaId?: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const navigation = usePortalDrawerNavigation();
  usePortalDrawerGuard(dirty, saving);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      const nextAssignments = Array.from(map.values()).filter(item => !embedded || ((!requestedTurmaId || item.turma_id === requestedTurmaId) && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId)));
      setAssignments(nextAssignments);
      setPlans((planData.items as Plan[] ?? []).filter(item => !embedded || ((!requestedTurmaId || item.turma_id === requestedTurmaId) && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId))));
      const matching = nextAssignments.filter((item) => item.turma_id === requestedTurmaId && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId));
      const requestedAssignment = matching.length === 1 ? matching[0] : undefined;
      if (requestedAssignment) setForm((current) => current.turma_id ? current : { ...current, turma_id: requestedAssignment.turma_id, disciplina_id: requestedAssignment.disciplina_id });
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar os planos."); }
    finally { setLoading(false); }
  }, [embedded, requestedTurmaId, requestedDisciplinaId]);

  useEffect(() => { void load(); }, [load]);

  const selectedAssignment = useMemo(() => assignments.find((item) => item.turma_id === form.turma_id && item.disciplina_id === form.disciplina_id), [assignments, form.disciplina_id, form.turma_id]);
  const update = (key: keyof typeof emptyForm, value: string) => { setDirty(true); setForm((current) => ({ ...current, [key]: value })); };

  const save = async (status: "rascunho" | "enviado") => {
    setSaving(true); setMessage(null);
    try {
      if (!form.turma_id || !form.disciplina_id) throw new Error("Selecione a turma e a disciplina.");
      if (!form.tema.trim()) throw new Error("Informe o tema do plano.");
      const response = await fetch("/api/professor/planos-aula", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editingPlanId ?? undefined, status }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível guardar o plano.");
      navigation?.notifyChanged();
      setMessage(status === "enviado" ? "Plano enviado para revisão." : "Rascunho guardado.");
      setForm(emptyForm); setEditingPlanId(null); setDirty(false); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível guardar o plano."); }
    finally { setSaving(false); }
  };

  return <div className={embedded ? "min-w-0" : "min-h-screen bg-background pb-20"}><div className={embedded ? "space-y-4" : `${PORTAL_PAGE_INSET} max-md:px-0 max-md:py-0 space-y-6`}>

    {!embedded && <DashboardHeader title="Planos de aula" description="Prepare, envie e acompanhe os seus planos por turma e disciplina." breadcrumbs={[{ label: "Início", href: "/professor" }, { label: "Planos de aula" }]} />}
    {loading && assignments.length === 0 && plans.length === 0 && !loadError ? <ProfessorPlanosAulaSkeleton /> : <div className={embedded ? "grid gap-4" : "grid gap-4 lg:grid-cols-[1.4fr_0.8fr] lg:gap-6"}>
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <fieldset disabled={saving}>
        <div className="mb-5 flex items-center gap-3"><FileText className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-foreground">Novo plano</h2><p className="text-xs text-muted-foreground">Preenche o plano para esta turma.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={fieldLabelClass}>Turma<select value={form.turma_id + ":" + form.disciplina_id} onChange={(event) => { const [turma_id, disciplina_id] = event.target.value.split(":"); setDirty(true); setForm((current) => ({ ...current, turma_id: turma_id ?? "", disciplina_id: disciplina_id ?? "" })); }} disabled={loading || saving} className={`mt-1 ${fieldControlClass} ${fieldFocusClass}`}><option value=":" disabled>Selecione a turma e disciplina</option>{assignments.map((item) => <option key={`${item.turma_id}:${item.disciplina_id}`} value={`${item.turma_id}:${item.disciplina_id}`}>{item.turma_nome} · {item.disciplina_nome}</option>)}</select></label>
          <label className={fieldLabelClass}>Data<input type="date" value={form.data} onChange={(event) => update("data", event.target.value)} disabled={loading || saving} className={`mt-1 ${fieldControlClass} ${fieldFocusClass}`} /></label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="plan-tema" label="Tema *" value={form.tema} onChange={(value) => update("tema", value)} />
          <Field label="Subtema" value={form.subtema} onChange={(value) => update("subtema", value)} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{planFields.map(([key, label]) => <TextArea key={key} label={label} value={form[key]} onChange={(value) => update(key, value)} />)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><TextArea label="Observações" value={form.observacoes} onChange={(value) => update("observacoes", value)} /><Field label="Link do material/anexo" value={form.arquivo_url} onChange={(value) => update("arquivo_url", value)} /></div>
        {selectedAssignment && <p className="mt-4 text-xs text-muted-foreground">Plano para {selectedAssignment.turma_nome} · {selectedAssignment.disciplina_nome}</p>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button type="button" variant="outline" disabled={loading || saving} loading={saving} onClick={() => void save("rascunho")} className="min-h-11"><Save className="h-4 w-4" /> Guardar rascunho</Button><Button type="button" tone="gold" disabled={loading || saving} loading={saving} onClick={() => void save("enviado")} className="min-h-11"><Send className="h-4 w-4" /> Enviar para revisão</Button></div>
        {message && <p className="mt-3 text-sm font-semibold text-muted-foreground">{message}</p>}
        </fieldset>
      </section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 className="font-black text-foreground">Os meus planos</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Acompanhe o estado de cada preparação.</p>{loadError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p>{loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></div> : loading ? <ProfessorPlanosListSkeleton /> : <div className="space-y-3">{plans.length === 0 ? <div className="rounded-xl border border-dashed border-border p-5 text-center"><p className="text-sm font-bold text-foreground">Ainda não há planos.</p><button type="button" onClick={() => document.getElementById("plan-tema")?.focus()} className="mt-2 text-xs font-black text-emerald-700 hover:underline">Criar o primeiro plano</button></div> : plans.map((plan) => <div key={plan.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-foreground">{plan.tema}</p><p className="text-xs text-muted-foreground">{plan.data}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">{plan.status}</span>{plan.status !== "aprovado" && plan.status !== "arquivado" && <button type="button" disabled={saving} onClick={() => { if (dirty && !window.confirm("Descartar alterações do plano actual?")) return; setEditingPlanId(plan.id); setDirty(false); setForm({ turma_id: plan.turma_id ?? "", disciplina_id: plan.disciplina_id ?? "", data: plan.data, tema: plan.tema, subtema: plan.subtema ?? "", objetivos: plan.objetivos ?? "", competencias: plan.competencias ?? "", conteudos: plan.conteudos ?? "", metodologia: plan.metodologia ?? "", recursos: plan.recursos ?? "", atividades: plan.atividades ?? "", avaliacao: plan.avaliacao ?? "", tarefa_casa: plan.tarefa_casa ?? "", anotacoes_alunos_avaliados: plan.anotacoes_alunos_avaliados ?? "", observacoes: plan.observacoes ?? "", arquivo_url: plan.arquivo_url ?? "" }); if (embedded) document.getElementById("plan-tema")?.focus(); else window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Editar plano"><Pencil className="h-3.5 w-3.5" /></button>}</div></div>{plan.objetivos && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{plan.objetivos}</p>}</div>)}</div>}</section>
    </div>}
  </div></div>;
}

function Field({ id, label, value, onChange }: { id?: string; label: string; value: string; onChange: (value: string) => void }) { return <label className={fieldLabelClass}>{label}<input id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 ${fieldControlClass} ${fieldFocusClass}`} /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className={fieldLabelClass}>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className={`mt-1 resize-y ${fieldControlClass} ${fieldFocusClass}`} /></label>; }
