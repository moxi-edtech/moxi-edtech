"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, History, List, Pencil, Plus, RefreshCw, X, AlertTriangle, Search } from "lucide-react";
import { assessmentPlanOverlaps, type AssessmentScheduleSlot } from "@/lib/academico/assessment-plan-overlaps";

type Period = { id: string; numero: number; data_inicio: string; data_fim: string; offering_id: string | null };
type Class = { id: string; nome: string; curso_id: string };
type Subject = { id: string; turma_id: string; nome: string };
type Entry = { id: string; turma_id: string; turma_disciplina_id: string; periodo_letivo_id: string; data: string; inicio: string; fim: string | null; descricao: string | null; tipo: string; estado: string };
type ScheduledAssessment = { data: string; inicio: string; fim: string; descricao: string };
const blankSchedule = (): ScheduledAssessment => ({ data: "", inicio: "", fim: "", descricao: "" });

type Audit = { id: number; acao: string; actor_id: string; actor_nome?: string | null; ocorrido_em: string; antes: Entry | null; depois: Entry | null };
type Data = {
  ok: boolean; error?: string; ano: { ano: number } | null; periodos: Period[];
  turmas: Class[]; disciplinas: Subject[]; ofertas: Array<{ id: string; course_id: string }>;
  items: Entry[]; historico: Audit[];
};
const types = ["Teste", "Prova trimestral", "Trabalho", "Outra"];
const control = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-ring/20";
const action = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50";
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fmt = (v: string) => v ? v.slice(0, 10).split("-").reverse().join("/") : "—";
const stepDay = (s:string,n:number) => { const d=new Date(s+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const startWeek = (s:string) => stepDay(s,-((new Date(s+"T12:00:00Z").getUTCDay()+6)%7));

export default function CalendarioAvaliacoesClient() {
  const params = useParams<{ id: string }>();
  const endpoint = "/api/escola/" + encodeURIComponent(params?.id ?? "") + "/calendario-avaliacoes";
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [num, setNum] = useState(1);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Record<string, ScheduledAssessment>>({});
  const [classSearch, setClassSearch] = useState("");
  const [sharedDate, setSharedDate] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("Teste");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [details, setDetails] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode,setMode] = useState<"semana"|"lista">("semana");
  const [week,setWeek] = useState(() => startWeek(today()));
  const [classFilter,setClassFilter] = useState("");
  const [agendaSearch,setAgendaSearch] = useState("");

  const reload = useCallback(async () => {
    const result = await fetch(endpoint, { cache: "no-store" });
    const body = await result.json() as Data;
    if (!result.ok || !body.ok) throw Error(body.error || "Falha ao consultar calendário.");
    setData(body);
    return body;
  }, [endpoint]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reload().then((body) => {
      if (!alive) return;
      const p = body.periodos.find((v) => v.data_inicio <= today() && v.data_fim >= today())
        || body.periodos.find((v) => v.numero === 1) || body.periodos[0];
      if (p) { const d = today() >= p.data_inicio && today() <= p.data_fim ? today() : p.data_inicio; setNum(p.numero); setDate(d); setWeek(startWeek(d)); }
      if (body.turmas[0]) setClassIds([body.turmas[0].id]);
    }).catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const numbers = useMemo(() => [...new Set((data?.periodos || []).map((p) => p.numero))].sort(), [data]);
  const periods = (data?.periodos || []).filter((p) => p.numero === num);
  const classMap = new Map((data?.turmas || []).map((t) => [t.id, t]));
  const subjectMap = new Map((data?.disciplinas || []).map((s) => [s.id, s]));
  const periodMap = new Map((data?.periodos || []).map((p) => [p.id, p]));
  const items = (data?.items || []).filter((i) => periodMap.get(i.periodo_letivo_id)?.numero === num);
  const draft = items.filter((i) => i.estado === "rascunho");
  const days = Array.from({length:7},(_,n)=>stepDay(week,n));
  const visible = items.filter(i => (!classFilter || i.turma_id === classFilter) &&
    (mode === "lista" || days.includes(i.data)) &&
    ((subjectMap.get(i.turma_disciplina_id)?.nome || "") + " " + (classMap.get(i.turma_id)?.nome || "") + " " + i.tipo).toLowerCase().includes(agendaSearch.toLowerCase().trim()));
  const visibleDrafts = visible.filter(i => i.estado === "rascunho");
  const selectedDrafts = visibleDrafts.filter((i) => selectedIds.includes(i.id));
  const subjects = (data?.disciplinas || []).filter((s) => classIds.includes(s.turma_id)
    && (s.nome + " " + (classMap.get(s.turma_id)?.nome || "")).toLocaleLowerCase("pt").includes(search.trim().toLocaleLowerCase("pt")));
  const selectedSubjects = (data?.disciplinas || []).filter((s) => chosen.includes(s.id) && classIds.includes(s.turma_id));
  const updateSchedule = (id: string, key: keyof ScheduledAssessment, value: string) =>
    setSchedule((current) => ({ ...current, [id]: { ...(current[id] ?? blankSchedule()), [key]: value } }));
  const periodFor = (s: Subject) => {
    const courseId = classMap.get(s.turma_id)?.curso_id;
    const offeringId = data?.ofertas?.find((o) => o.course_id === courseId)?.id;
    return periods.find((p) => offeringId && p.offering_id === offeringId)
      || periods.find((p) => p.offering_id === null)
      || (periods.length === 1 ? periods[0] : undefined);
  };

  const rows = selectedSubjects.map((s) => ({
    id: s.id, turma_id: s.turma_id, turma_disciplina_id: s.id, periodo_letivo_id: periodFor(s)?.id,
    tipo: kind, data: schedule[s.id]?.data ?? "", inicio: schedule[s.id]?.inicio ?? "",
    fim: schedule[s.id]?.fim || null, descricao: schedule[s.id]?.descricao?.trim() || null,
  }));
  const overlaps = assessmentPlanOverlaps(rows as AssessmentScheduleSlot[], data?.items ?? []);
  const issues: Record<string, string[]> = {};
  for (const row of rows) {
    const errors: string[] = [];
    const p = periodMap.get(row.periodo_letivo_id ?? "");
    if (!p) errors.push("Período lectivo não configurado para a turma.");
    else if (!row.data) errors.push("Defina a data.");
    else if (row.data < p.data_inicio || row.data > p.data_fim) errors.push("A data deve pertencer ao trimestre desta turma.");
    if (!row.inicio) errors.push("Defina a hora de início.");
    if (row.fim && row.fim <= row.inicio) errors.push("O fim deve ser posterior ao início.");
    for (const collision of overlaps[row.id] ?? []) {
      const other = collision.source === "existing"
        ? data?.items.find((item) => item.id === collision.withId)
        : rows.find((item) => item.id === collision.withId);
      const otherName = other ? subjectMap.get(other.turma_disciplina_id)?.nome : null;
      errors.push("Conflito com " + (otherName ?? "outra avaliação") + " · " +
        fmt(other?.data ?? "") + " às " + (other?.inicio?.slice(0, 5) ?? "—"));
    }
    if (errors.length) issues[row.id] = errors;
  }
  const ready = rows.length > 0 && rows.every((r) => !issues[r.id]?.length);
  const pendingCount = rows.filter((r) => issues[r.id]?.length).length;

  const mutate = async (body: unknown, msg: string) => {
    setSaving(true); setErr(""); setNotice("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await r.json();
      if (!r.ok || !result.ok) throw Error(result.error || "Falha ao guardar.");
      await reload();
      setNotice(msg);
      setAuditId(null);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao guardar.");
      return false;
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (saving) return;
    if (editing) {
      if (!date || !start || (end && end <= start)) {
        setErr("Confirme a data e as horas da avaliação."); return;
      }
      const current = data?.items.find((i) => i.id === editing);
      if (!current) { setErr("Avaliação não encontrada. Atualize a agenda."); return; }
      const updated: AssessmentScheduleSlot = { id: editing, turma_id: current.turma_id, data: date, inicio: start, fim: end || null };
      if (assessmentPlanOverlaps([updated], data?.items ?? [])[editing]?.length) {
        setErr("O novo horário coincide com outra avaliação desta turma. Ajuste a data ou as horas."); return;
      }
      if (await mutate({ action: "edit", id: editing, tipo: kind, data: date, inicio: start, fim: end || null, descricao: details || null },
        "Alteração guardada e auditada.")) { setEditing(null); setDetails(""); }
      return;
    }
    if (!rows.length) { setErr("Selecione pelo menos uma disciplina."); return; }
    if (!ready) { setErr("Corrija os campos ou conflitos assinalados antes de guardar."); return; }
    if (await mutate({ action: "create", items: rows.map(({ id: _localId, ...row }) => row) },
      "Avaliações guardadas como rascunho.")) {
      setChosen([]); setSchedule({}); setSharedDate("");
      setMode("lista"); setClassFilter(rows[0]?.turma_id ?? ""); setAgendaSearch(""); setSelectedIds([]);
    }
  };

  const publish = () => {
    if (!selectedDrafts.length || saving || !window.confirm("Publicar apenas as " + selectedDrafts.length + " avaliações selecionadas? Os alunos e professores poderão consultá-las.")) return;
    void mutate({ action: "publish", ids: selectedDrafts.map((i) => i.id) }, "Avaliações selecionadas publicadas com sucesso.").then((ok) => { if (ok) setSelectedIds([]); });
  };

  const showHistory = async (id: string) => {
    if (auditId === id) { setAuditId(null); return; }
    try {
      const r = await fetch(endpoint + "?historico=" + encodeURIComponent(id), { cache: "no-store" });
      const v = await r.json() as Data;
      if (!r.ok || !v.ok) throw Error(v.error || "Não foi possível abrir o histórico.");
      setAudits(v.historico || []); setAuditId(id);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha no histórico."); }
  };

  if (loading) return (
    <main role="status" aria-label="A carregar calendário de avaliações" className={`${PORTAL_PAGE_INSET} space-y-4` }>
      <span className="sr-only">A carregar calendário de avaliações</span>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="space-y-2"><div className="h-5 w-40 rounded-lg bg-muted" /><div className="h-8 w-64 max-w-full rounded-lg bg-muted" /></div>
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <div className="space-y-2"><div className="h-3 w-28 rounded-lg bg-muted" /><div className="h-10 w-40 rounded-xl bg-muted" /></div>
          <div className="h-8 w-44 rounded-xl bg-muted sm:self-center" />
          <div className="h-10 w-28 rounded-xl bg-muted sm:justify-self-end" />
        </div>
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="h-5 w-48 rounded-lg bg-muted" />
          <div className="h-10 w-full rounded-xl bg-muted" />
          <div className="h-4 w-36 rounded-lg bg-muted" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((n) => <div key={n} className="h-12 rounded-xl border border-border bg-muted/50" />)}
          </div>
          <div className="h-5 w-44 rounded-lg bg-muted" />
          <div className="h-32 rounded-xl border border-border bg-muted/50" />
        </div>
      </div>
    </main>
  );
  return <main className={`${PORTAL_PAGE_INSET} space-y-5`}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Operações Académicas / Avaliações</p>
        <h1 className="text-2xl font-bold text-primary">Calendário de avaliações</h1>
        <p className="text-sm text-muted-foreground">Planear por turma e disciplina, publicar em lote e consultar alterações.</p>
      </div>
      <button type="button" className={action + " border border-border"} onClick={() => void reload().catch((e) => setErr(e.message))}>
        <RefreshCw size={16} /> Atualizar
      </button>
    </header>
    {err && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
    {notice && <p role="status" className="rounded-xl border border-border p-3 text-sm text-primary">{notice}</p>}
    {!data?.ano ? <p className="rounded-xl border p-6 text-sm">Configure um ano letivo ativo antes de planear avaliações.</p> : <>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:grid-cols-[minmax(180px,1fr)_auto_auto] sm:items-end sm:p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Ano letivo {data.ano.ano}/{data.ano.ano + 1}</p>
          <label htmlFor="ava-period" className="mt-1 block text-xs font-semibold text-foreground">Trimestre</label>
          <select id="ava-period" className={control + " mt-1"} value={num} onChange={(e) => {
            const n = Number(e.target.value);
            setNum(n); setChosen([]); setSchedule({}); setSelectedIds([]); setSharedDate(""); setEditing(null);
            const p = data.periodos.find((v) => v.numero === n);
            if (p) { const d = today() >= p.data_inicio && today() <= p.data_fim ? today() : p.data_inicio; setDate(d); setWeek(startWeek(d)); }
          }}>{numbers.map((n) => <option key={n} value={n}>{n}.º Trimestre</option>)}</select>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground sm:pb-2">
          <span><strong className="text-lg font-semibold text-foreground">{draft.length}</strong> rascunhos</span>
          <span><strong className="text-lg font-semibold text-foreground">{items.filter((i) => i.estado === "publicado").length}</strong> publicados</span>
        </div>
        <a href="#avaliacoes-agenda" className={action + " min-h-10 border border-border bg-card text-foreground hover:bg-muted"}>Ver agenda</a>
      </section>

      {editing ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-primary"><Pencil size={17} /> Editar avaliação</h2>
              <p className="mt-1 text-xs text-muted-foreground">A alteração fica auditada. A turma e disciplina permanecem vinculadas ao registo.</p>
            </div>
            <button type="button" className={action + " border border-border"} onClick={() => setEditing(null)}><X size={16} /> Sair da edição</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold">Tipo<select className={control + " mt-1"} value={kind} onChange={(e) => setKind(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="text-xs font-semibold">Data<input type="date" className={control + " mt-1"} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="text-xs font-semibold">Início<input type="time" className={control + " mt-1"} value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="text-xs font-semibold">Fim (opcional)<input type="time" className={control + " mt-1"} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <label className="block text-xs font-semibold">Observação (opcional)
            <input className={control + " mt-1"} maxLength={500} value={details} placeholder="Conteúdo, sala ou instruções…" onChange={(e) => setDetails(e.target.value)} />
          </label>
          <div className="flex justify-end">
            <button type="button" disabled={saving} onClick={() => void save()} className={action + " min-h-11 bg-klasse-gold px-4 text-klasse-gold-900"}>
              <Check size={16} /> Guardar alteração
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-5 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
          <div className="flex items-start gap-2">
            <Plus size={20} className="mt-0.5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-primary">Planear avaliações</h2>
              <p className="text-xs text-muted-foreground">Várias disciplinas numa operação, cada uma com a sua data e horário.</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">1 · Selecionar turma</h3>
            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)]">
              <label className="relative block">
                <span className="sr-only">Pesquisar turma por classe ou turno</span>
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input className={control + " pl-9"} type="search" value={classSearch}
                  placeholder="Pesquisar classe ou turno…" onChange={(e) => setClassSearch(e.target.value)} />
              </label>
              <label>
                <span className="sr-only">Turma do ano letivo</span>
                <select className={control} value={classIds[0] ?? ""} onChange={(e) => {
                  setClassIds(e.target.value ? [e.target.value] : []);
                  setChosen([]); setSchedule({}); setSearch(""); setSharedDate("");
                }}>
                  <option value="">Selecionar turma</option>
                  {data.turmas.map((t) => ({ turma: t, match: t.nome.toLocaleLowerCase("pt").includes(classSearch.trim().toLocaleLowerCase("pt")) }))
                    .filter(({ turma, match }) => match || turma.id === classIds[0])
                    .map(({ turma }) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Apenas turmas ativas do ano letivo {data.ano.ano}/{data.ano.ano + 1}, conforme os vínculos curriculares.</p>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">2 · Escolher disciplinas</h3>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={!subjects.length} className="text-xs font-semibold text-primary disabled:opacity-50"
                  onClick={() => setChosen((current) => [...new Set([...current, ...subjects.map((subject) => subject.id)])])}>Selecionar visíveis</button>
                <button type="button" disabled={!subjects.length} className="text-xs font-semibold text-muted-foreground disabled:opacity-50"
                  onClick={() => setChosen((current) => current.filter((id) => !subjects.some((subject) => subject.id === id)))}>Limpar visíveis</button>
              </div>
            </div>
            <label htmlFor="ava-search" className="sr-only">Filtrar disciplinas</label>
            <input id="ava-search" className={control} placeholder="Pesquisar disciplinas…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
              {subjects.map((subject) => (
                <label key={subject.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-border p-2 text-sm hover:bg-muted/30">
                  <input type="checkbox" checked={chosen.includes(subject.id)}
                    onChange={(e) => setChosen((current) => e.target.checked ? [...new Set([...current, subject.id])] : current.filter((id) => id !== subject.id))} className="h-4 w-4 accent-primary" />
                  <span className="min-w-0"><span className="block font-medium text-foreground">{subject.nome}</span><small className="text-xs text-muted-foreground">{classMap.get(subject.turma_id)?.nome}</small></span>
                </label>
              ))}
              {!classIds.length && <p className="text-sm text-muted-foreground">Selecione uma turma para ver as disciplinas.</p>}
              {classIds.length > 0 && subjects.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma disciplina encontrada para esta turma ou pesquisa.</p>}
            </div>
            <p className="text-xs font-medium text-muted-foreground">{selectedSubjects.length} disciplina(s) selecionada(s).</p>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">3 · Agendar por disciplina</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Sem hora de fim, considera-se uma duração de 60 minutos.</p>
              </div>
              <label className="text-xs font-semibold text-foreground">Tipo de avaliação
                <select className={control + " mt-1"} value={kind} onChange={(e) => setKind(e.target.value)}>
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>
            {selectedSubjects.length > 1 && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                <label className="min-w-40 flex-1 text-xs font-semibold text-foreground">Data comum (opcional)
                  <input type="date" className={control + " mt-1"} value={sharedDate} onChange={(e) => setSharedDate(e.target.value)} />
                </label>
                <button type="button" disabled={!sharedDate || saving} className={action + " min-h-10 border border-border bg-card text-foreground"}
                  onClick={() => setSchedule((current) => Object.fromEntries(selectedSubjects.map((subject) => [
                    subject.id, { ...(current[subject.id] ?? blankSchedule()), data: sharedDate },
                  ])))}>
                  Aplicar data a todas
                </button>
              </div>
            )}
            {selectedSubjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">Selecione uma ou mais disciplinas acima para definir a agenda.</p>
            ) : (
              <div className="space-y-2">
                {selectedSubjects.map((subject) => {
                  const current = schedule[subject.id] ?? blankSchedule();
                  const period = periodFor(subject);
                  const warnings = issues[subject.id] ?? [];
                  const conflicts = warnings.filter((value) => value.startsWith("Conflito") || value.startsWith("A data deve") || value.startsWith("O fim deve") || value.startsWith("Período"));
                  const missing = warnings.filter((value) => value.startsWith("Defina"));
                  const isScheduled = Boolean(current.data && current.inicio && !warnings.length);
                  return (
                    <div key={subject.id} className={"space-y-2 rounded-xl border p-3 " + (conflicts.length ? "border-destructive/50 bg-destructive/5" : "border-border bg-card")}>
                      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(180px,1fr)_minmax(150px,190px)_minmax(105px,135px)_minmax(105px,135px)]">
                        <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 sm:col-span-3 lg:col-span-1 lg:flex-wrap">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold leading-snug text-foreground">{subject.nome}</h4>
                            <p className="text-xs text-muted-foreground">{classMap.get(subject.turma_id)?.nome}</p>
                          </div>
                          <span className={"shrink-0 rounded-full px-2 py-1 text-[11px] font-medium " + (conflicts.length ? "bg-destructive/10 text-destructive" : isScheduled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            {conflicts.length ? "Conflito" : isScheduled ? "Pronta" : "Por agendar"}
                          </span>
                        </div>
                        <label className="col-span-2 text-xs font-semibold text-foreground sm:col-span-1">Data
                          <input type="date" className={control + " mt-1"} value={current.data}
                            min={period?.data_inicio} max={period?.data_fim}
                            onChange={(e) => updateSchedule(subject.id, "data", e.target.value)} />
                        </label>
                        <label className="min-w-0 text-xs font-semibold text-foreground">Início
                          <input type="time" className={control + " mt-1"} value={current.inicio}
                            onChange={(e) => updateSchedule(subject.id, "inicio", e.target.value)} />
                        </label>
                        <label className="min-w-0 text-xs font-semibold text-foreground">Fim (opcional)
                          <input type="time" className={control + " mt-1"} value={current.fim}
                            onChange={(e) => updateSchedule(subject.id, "fim", e.target.value)} />
                        </label>
                      </div>
                      <details className="text-xs text-muted-foreground">
                        <summary className="w-fit cursor-pointer py-1 font-medium text-primary">
                          {current.descricao ? "Ver ou editar observação" : "Adicionar observação (opcional)"}
                        </summary>
                        <label className="mt-1 block text-xs font-semibold text-foreground">
                          Conteúdo, sala ou instruções
                          <input className={control + " mt-1"} value={current.descricao} maxLength={500}
                            placeholder="Observação desta disciplina…" onChange={(e) => updateSchedule(subject.id, "descricao", e.target.value)} />
                        </label>
                      </details>
                      {missing.length > 0 && (
                        <p className="text-xs text-muted-foreground" role="status">{missing.join(" ")}</p>
                      )}
                      {conflicts.length > 0 && (
                        <div role="alert" className="space-y-1 text-xs font-semibold text-destructive">
                          {conflicts.map((warning) => <p key={warning} className="flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{warning}</p>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div aria-live="polite">
              <h3 className="text-sm font-semibold text-foreground">4 · Rever e guardar</h3>
              <p className="text-xs text-muted-foreground">
                {rows.length - pendingCount} pronta(s) · {pendingCount} por corrigir · {rows.length} selecionada(s)
              </p>
            </div>
            <button type="button" disabled={saving || !ready} onClick={() => void save()}
              className={action + " min-h-11 bg-klasse-gold px-4 text-klasse-gold-900"}>
              <Check size={16} /> Guardar rascunhos ({rows.length})
            </button>
          </div>
          {rows.length > 0 && !ready && <p className="text-xs text-muted-foreground">Preencha as datas e horas de todas as disciplinas e resolva os conflitos antes de guardar.</p>}
        </section>
      )}
      <section id="avaliacoes-agenda" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex justify-between gap-2 border-b border-border p-4">
          <div><h2 className="font-semibold text-primary">Avaliações do trimestre</h2>
          <p className="text-xs text-muted-foreground">Só avaliações publicadas aparecem nos portais.</p></div>
          <span className="text-xs text-muted-foreground">{items.length} registo(s)</span>
        </div>
        <div className="space-y-3 border-b border-border p-4">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h3 className="font-semibold text-primary">Agenda por turma</h3>
    <div className="flex gap-1" role="group" aria-label="Vista da agenda">
      <button type="button" aria-pressed={mode==="semana"} onClick={()=>setMode("semana")} className={action+(mode==="semana"?" bg-muted":" border border-border")}><CalendarDays size={16}/> Semana</button>
      <button type="button" aria-pressed={mode==="lista"} onClick={()=>setMode("lista")} className={action+(mode==="lista"?" bg-muted":" border border-border")}><List size={16}/> Lista</button>
    </div>
  </div>
  <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-xs font-semibold">Turma<select className={control+" mt-1"} value={classFilter} onChange={e=>setClassFilter(e.target.value)}>
      <option value="">Todas as turmas</option>{data.turmas.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
    </select></label>
    <label className="text-xs font-semibold">Pesquisar<input className={control+" mt-1"} placeholder="Disciplina, turma ou tipo…" value={agendaSearch} onChange={e=>setAgendaSearch(e.target.value)}/></label>
  </div>
  {mode==="semana" && <div className="flex flex-wrap items-center justify-between gap-2">
    <strong className="text-sm">{fmt(days[0])} — {fmt(days[6])}</strong>
    <div className="flex gap-2">
      <button type="button" className={action+" border border-border"} onClick={()=>setWeek(startWeek(today()))}>Hoje</button>
      <button type="button" aria-label="Semana anterior" className={action+" border border-border"} onClick={()=>setWeek(stepDay(week,-7))}><ChevronLeft size={16}/></button>
      <button type="button" aria-label="Semana seguinte" className={action+" border border-border"} onClick={()=>setWeek(stepDay(week,7))}><ChevronRight size={16}/></button>
    </div>
  </div>}
</div>
{mode==="semana" && <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-7">
  {days.map(day=><div key={day} className="space-y-2 rounded-xl border border-border bg-muted/30 p-2">
    <h4 className="text-xs font-semibold text-primary">{fmt(day).slice(0,5)}</h4>
    {visible.filter(i=>i.data===day).map(i=><div key={i.id} className="rounded-xl border border-border bg-card p-2 text-xs">
      <p className="break-words font-semibold">{subjectMap.get(i.turma_disciplina_id)?.nome || "Disciplina"}</p>
      <p className="text-muted-foreground">{classMap.get(i.turma_id)?.nome} · {i.inicio.slice(0,5)} · {i.estado}</p>
      {i.estado==="rascunho" && <label className="mt-2 flex items-center gap-1"><input type="checkbox" className="accent-primary" checked={selectedIds.includes(i.id)} onChange={e=>setSelectedIds(p=>e.target.checked?[...new Set([...p,i.id])]:p.filter(id=>id!==i.id))}/> Selecionar</label>}
    </div>)}
    {!visible.some(i=>i.data===day) && <p className="py-3 text-xs text-muted-foreground">Sem avaliações</p>}
  </div>)}
</div>}
<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
           <button type="button" className={action + " border border-border"} disabled={!visibleDrafts.length} onClick={() =>
             setSelectedIds((prev) => visibleDrafts.every(i=>prev.includes(i.id)) ? prev.filter(id=>!visibleDrafts.some(i=>i.id===id)) : [...new Set([...prev,...visibleDrafts.map(i=>i.id)])])}>
             <Check size={16}/> {visibleDrafts.length && selectedDrafts.length === visibleDrafts.length ? "Desmarcar visíveis" : "Selecionar rascunhos visíveis"}
           </button>
           <div className="flex flex-wrap items-center gap-2">
             <span className="text-xs text-muted-foreground">{selectedDrafts.length} selecionada(s) para publicar</span>
             <button type="button" disabled={saving || !selectedDrafts.length} onClick={publish}
               className={action + " min-h-10 bg-klasse-gold px-4 text-klasse-gold-900"}>
               <Check size={16} /> Publicar selecionadas ({selectedDrafts.length})
             </button>
           </div>
         </div>
         <div className={mode==="lista"?"divide-y divide-border":"hidden"}>{visible.map((item) => <div key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">{item.estado === "rascunho" && <input type="checkbox" aria-label={"Selecionar " + (subjectMap.get(item.turma_disciplina_id)?.nome || "avaliação") + " para publicação"} className="mt-1 accent-primary" checked={selectedIds.includes(item.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id))}/>}
             <div><p className="font-semibold">{subjectMap.get(item.turma_disciplina_id)?.nome || "Disciplina"} · {item.tipo}</p>
              <p className="text-sm text-muted-foreground">{classMap.get(item.turma_id)?.nome} · {fmt(item.data)} às {item.inicio.slice(0,5)}</p>
              {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}</div></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-1 text-xs">{item.estado}</span>
              {item.estado !== "cancelado" && <button type="button" className={action + " border border-border"} onClick={() => {
                setEditing(item.id); setDate(item.data); setKind(item.tipo); setStart(item.inicio.slice(0,5)); setEnd(item.fim?.slice(0,5) || ""); setDetails(item.descricao || "");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}><Pencil size={16} /> Editar</button>}
              <button type="button" className={action + " border border-border"} onClick={() => void showHistory(item.id)}><History size={16} /> Histórico</button>
              {item.estado !== "cancelado" && <button type="button" className={action + " border border-border"} onClick={() => {
                if (window.confirm("Cancelar avaliação? O histórico será preservado.")) void mutate({ action: "cancel", id: item.id }, "Avaliação cancelada e auditada.");
              }}><X size={16} /> Cancelar</button>}
            </div>
          </div>
          {auditId === item.id && <div className="space-y-2 border-t border-border bg-muted p-4">
            <h3 className="text-sm font-semibold">Histórico de alterações</h3>
            {audits.map((h) => <div key={h.id} className="rounded-xl border bg-card p-2 text-xs text-muted-foreground">
              <p><strong>{h.acao}</strong> · {new Date(h.ocorrido_em).toLocaleString("pt-PT", { timeZone: "Africa/Luanda" })} · {h.actor_nome || "Utilizador da escola"}</p>
              {h.antes && <p>Antes: {fmt(h.antes.data)} · {h.antes.inicio} · {h.antes.estado}</p>}
              {h.depois && <p>Depois: {fmt(h.depois.data)} · {h.depois.inicio} · {h.depois.estado}</p>}
            </div>)}
          </div>}
        </div>)}
        {!items.length && <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
          <CalendarCheck size={26} /><strong className="text-foreground">Nenhuma avaliação planeada</strong>
          Selecione a turma e a disciplina acima para criar a primeira data.
        </div>}</div>
      </section>
    </>}
  </main>;
}
