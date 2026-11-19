"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, Check, History, Pencil, Plus, RefreshCw, X } from "lucide-react";

type Period = { id: string; numero: number; data_inicio: string; data_fim: string; offering_id: string | null };
type Class = { id: string; nome: string; curso_id: string };
type Subject = { id: string; turma_id: string; nome: string };
type Entry = { id: string; turma_id: string; turma_disciplina_id: string; periodo_letivo_id: string; data: string; inicio: string; fim: string | null; descricao: string | null; tipo: string; estado: string };
type Audit = { id: number; acao: string; actor_id: string; ocorrido_em: string; antes: Entry | null; depois: Entry | null };
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
      if (p) { setNum(p.numero); setDate(today() >= p.data_inicio && today() <= p.data_fim ? today() : p.data_inicio); }
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
  const selectedDrafts = draft.filter((i) => selectedIds.includes(i.id));
  const subjects = (data?.disciplinas || []).filter((s) => classIds.includes(s.turma_id)
    && (s.nome + " " + (classMap.get(s.turma_id)?.nome || "")).toLowerCase().includes(search.toLowerCase()));
  const periodFor = (s: Subject) => {
    const courseId = classMap.get(s.turma_id)?.curso_id;
    const offeringId = data?.ofertas?.find((o) => o.course_id === courseId)?.id;
    return periods.find((p) => offeringId && p.offering_id === offeringId)
      || periods.find((p) => p.offering_id === null)
      || (periods.length === 1 ? periods[0] : undefined);
  };

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
    if (!date || !start || (end && end <= start)) { setErr("Confirme a data e as horas da avaliação."); return; }
    if (editing) {
      if (await mutate({ action: "edit", id: editing, tipo: kind, data: date, inicio: start, fim: end || null, descricao: details || null }, "Alteração guardada e auditada.")) {
        setEditing(null); setDetails("");
      }
      return;
    }
    const selected = (data?.disciplinas || []).filter((s) => chosen.includes(s.id));
    if (!selected.length) { setErr("Selecione pelo menos uma disciplina."); return; }
    const rows = selected.map((s) => ({
      turma_id: s.turma_id, turma_disciplina_id: s.id, periodo_letivo_id: periodFor(s)?.id,
      tipo: kind, data: date, inicio: start, fim: end || null, descricao: details || null,
    }));
    if (rows.some((r) => {
      const p = periodMap.get(r.periodo_letivo_id || "");
      return !p || date < p.data_inicio || date > p.data_fim;
    })) { setErr("Escolha uma data pertencente ao trimestre de todas as turmas selecionadas."); return; }
    if (await mutate({ action: "create", items: rows }, "Avaliações guardadas como rascunho.")) {
      setChosen([]); setDetails("");
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

  if (loading) return <p className="p-6 text-sm text-muted-foreground">A carregar calendário de avaliações…</p>;
  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
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
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">Ano letivo {data.ano.ano}/{data.ano.ano + 1}</p>
          <label htmlFor="ava-period" className="mb-1 block text-sm font-medium">Trimestre</label>
          <select id="ava-period" className={control} value={num} onChange={(e) => {
            const n = Number(e.target.value); setNum(n); setChosen([]); setSelectedIds([]);
            const p = data.periodos.find((v) => v.numero === n);
            if (p) setDate(today() >= p.data_inicio && today() <= p.data_fim ? today() : p.data_inicio);
          }}>{numbers.map((n) => <option key={n} value={n}>{n}.º Trimestre</option>)}</select>
        </div>
        <p className="text-sm text-muted-foreground"><strong className="text-lg text-foreground">{draft.length}</strong> rascunhos · <strong className="text-lg text-foreground">{items.filter((i) => i.estado === "publicado").length}</strong> publicados</p>
        <button type="button" disabled={saving || !selectedDrafts.length} onClick={publish}
          className={action + " bg-amber px-4 text-white"}>
          <Check size={16} /> Publicar selecionadas ({selectedDrafts.length})
        </button>
      </section>
      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-primary">{editing ? <Pencil size={17} /> : <Plus size={17} />} {editing ? "Editar avaliação" : "Planear avaliações"}</h2>
            <p className="text-xs text-muted-foreground">Datas e horas por turma e disciplina; sem repetir configurações curriculares.</p>
          </div>
          {editing && <button type="button" className={action + " border border-border"} onClick={() => setEditing(null)}><X size={16} /> Sair da edição</button>}
        </div>
        {!editing && <>
          <label className="block text-sm font-semibold">Turmas</label>
          <div role="group" aria-label="Turmas" className="flex max-h-32 flex-wrap gap-2 overflow-auto">
            {data.turmas.map((t) => <button type="button" key={t.id} aria-pressed={classIds.includes(t.id)} onClick={() => {
              setClassIds((v) => v.includes(t.id) ? v.filter((x) => x !== t.id) : [...v, t.id]);
              if (classIds.includes(t.id)) setChosen((v) => v.filter((x) => subjectMap.get(x)?.turma_id !== t.id));
            }} className={action + " rounded-full border px-3 py-1 text-xs " + (classIds.includes(t.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{t.nome}</button>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="ava-search" className="text-sm font-semibold">Disciplinas</label>
            <button type="button" className="text-xs font-semibold text-primary" onClick={() => setChosen((v) => {
              const all = subjects.map((s) => s.id);
              return all.every((id) => v.includes(id)) ? v.filter((id) => !all.includes(id)) : [...new Set([...v, ...all])];
            })}>Selecionar / limpar visíveis</button>
          </div>
          <input id="ava-search" className={control} placeholder="Filtrar disciplina ou turma…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="grid max-h-52 gap-2 overflow-auto sm:grid-cols-2">
            {subjects.map((s) => <label key={s.id} className="flex gap-2 rounded-xl border border-border p-2 text-sm">
              <input type="checkbox" checked={chosen.includes(s.id)} onChange={(e) => setChosen((v) => e.target.checked ? [...v, s.id] : v.filter((id) => id !== s.id))} className="accent-primary" />
              <span>{s.nome}<small className="block text-xs text-muted-foreground">{classMap.get(s.turma_id)?.nome}</small></span>
            </label>)}
            {!subjects.length && <p className="text-sm text-muted-foreground">Selecione uma turma com disciplinas associadas.</p>}
          </div>
          <p className="text-xs text-muted-foreground">{chosen.length} disciplina(s) selecionada(s).</p>
        </>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold">Tipo<select className={control + " mt-1"} value={kind} onChange={(e) => setKind(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs font-semibold">Data<input type="date" className={control + " mt-1"} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="text-xs font-semibold">Início<input type="time" className={control + " mt-1"} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="text-xs font-semibold">Fim (opcional)<input type="time" className={control + " mt-1"} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <label className="block text-xs font-semibold">Observação (opcional)
          <input className={control + " mt-1"} maxLength={500} value={details} placeholder="Conteúdo, sala ou instruções…" onChange={(e) => setDetails(e.target.value)} />
        </label>
        <div className="flex justify-end"><button type="button" disabled={saving || (!editing && !chosen.length)} onClick={() => void save()}
          className={action + " bg-amber px-4 text-white"}><Check size={16} /> {editing ? "Guardar alteração" : "Guardar rascunho"}</button></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex justify-between gap-2 border-b border-border p-4">
          <div><h2 className="font-semibold text-primary">Avaliações do trimestre</h2>
          <p className="text-xs text-muted-foreground">Só avaliações publicadas aparecem nos portais.</p></div>
          <span className="text-xs text-muted-foreground">{items.length} registo(s)</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
           <button type="button" className={action + " border border-border"} disabled={!draft.length} onClick={() =>
             setSelectedIds((prev) => draft.every((i) => prev.includes(i.id)) ? [] : draft.map((i) => i.id))}>
             <Check size={16}/> {draft.length && selectedDrafts.length === draft.length ? "Desmarcar todos" : "Selecionar rascunhos"}
           </button>
           <span className="text-xs text-muted-foreground">{selectedDrafts.length} selecionadas para publicar</span>
         </div>
         <div className="divide-y divide-border">{items.map((item) => <div key={item.id}>
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
              <p><strong>{h.acao}</strong> · {new Date(h.ocorrido_em).toLocaleString("pt-PT", { timeZone: "Africa/Luanda" })} · Utilizador {h.actor_id}</p>
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
