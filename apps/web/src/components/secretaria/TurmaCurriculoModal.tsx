"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback/FeedbackSystem";
import { DisciplinaModal, type DisciplinaForm } from "@/components/escola/settings/_components/DisciplinaModal";
import type { TurmaItem } from "~/types/turmas";

type CurriculumItem = {
  id: string;
  curso_matriz_id: string;
  disciplina_id?: string | null;
  nome: string;
  carga_horaria?: number | null;
  obrigatoria?: boolean;
};

type Props = {
  turma: TurmaItem;
  escolaId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

export default function TurmaCurriculoModal({ turma, escolaId, isOpen, onClose, onUpdated }: Props) {
  const { success, error: toastError } = useToast();
  const toastErrorRef = useRef(toastError);
  const confirm = useConfirm();
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [available, setAvailable] = useState<CurriculumItem[]>([]);
  const [isDraft, setIsDraft] = useState(false);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"load" | "action">("load");
  const [editingDiscipline, setEditingDiscipline] = useState<DisciplinaForm | null>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const confirmOpenRef = useRef(false);

  useEffect(() => {
    toastErrorRef.current = toastError;
  }, [toastError]);

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/escolas/${escolaId}/turmas/${turma.id}/curriculo/classe`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível carregar o currículo.");
      setItems(json.items ?? []);
      setAvailable(json.available ?? []);
      setIsDraft(Boolean(json.is_draft));
      setSelected("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar o currículo.";
      setErrorKind("load");
      setLoadError(message);
      toastErrorRef.current("Currículo", message);
    } finally {
      setLoading(false);
    }
  }, [escolaId, isOpen, turma.id]);

  useEffect(() => { void load(); }, [load]);

  const openDisciplineEditor = async (item: CurriculumItem) => {
    if (!turma.curso_id || !turma.classe_id) {
      toastError("Currículo", "Esta turma não tem curso e classe suficientes para editar a disciplina.");
      return;
    }
    setEditingLoading(true);
    try {
      const response = await fetch(`/api/escolas/${escolaId}/disciplinas?curso_id=${turma.curso_id}&classe_id=${turma.classe_id}&limit=200`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      const source = (json?.data ?? []).find((entry: any) => entry.id === item.curso_matriz_id);
      if (!response.ok || !source) throw new Error(json?.error || "Não foi possível carregar a configuração da disciplina.");
      setEditingDiscipline({
        id: source.id,
        nome: source.nome,
        codigo: source.sigla ?? source.codigo ?? source.nome.slice(0, 6).toUpperCase(),
        area: source.area ?? null,
        periodos_ativos: source.periodos_ativos?.length ? source.periodos_ativos : [1, 2, 3],
        periodo_mode: source.periodos_ativos?.length ? "custom" : "ano",
        carga_horaria_semanal: Number(source.carga_horaria_semanal ?? source.carga_horaria ?? 0),
        classificacao: source.classificacao ?? (source.tipo === "core" ? "core" : "complementar"),
        entra_no_horario: source.entra_no_horario ?? true,
        is_avaliavel: source.is_avaliavel ?? true,
        conta_para_media_med: source.conta_para_media_med ?? true,
        avaliacao: { mode: source.avaliacao_mode ?? "inherit_school", base_id: source.avaliacao_disciplina_id ?? null },
        modelo_excecao_id: source.modelo_excecao_id ?? null,
        class_ids: [turma.classe_id],
        apply_scope: "selected",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar a configuração da disciplina.";
      setLoadError(message);
      setErrorKind("action");
      toastError("Currículo", message);
    } finally {
      setEditingLoading(false);
    }
  };

  const saveDisciplineDefinition = async (payload: DisciplinaForm) => {
    if (!payload.id) return;
    const response = await fetch(`/api/escolas/${escolaId}/disciplinas/${payload.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: payload.nome,
        sigla: payload.codigo,
        carga_horaria_semanal: payload.carga_horaria_semanal,
        carga_horaria: payload.carga_horaria_semanal,
        classificacao: payload.classificacao,
        is_avaliavel: payload.is_avaliavel,
        conta_para_media_med: payload.conta_para_media_med,
        area: payload.area ?? null,
        periodos_ativos: payload.periodos_ativos,
        entra_no_horario: payload.entra_no_horario,
        avaliacao_mode: payload.avaliacao.mode,
        avaliacao_modelo_id: payload.avaliacao.mode === "custom" ? payload.modelo_excecao_id ?? null : null,
        avaliacao_disciplina_id: payload.avaliacao.mode === "inherit_disciplina" ? payload.avaliacao.base_id ?? null : null,
        modelo_excecao_id: payload.avaliacao.mode === "custom" ? payload.modelo_excecao_id ?? null : null,
      }),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível atualizar a disciplina.");
    setEditingDiscipline(null);
    await load();
    onUpdated?.();
    success("Disciplina atualizada", "A configuração do currículo base foi atualizada.");
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !confirmOpenRef.current) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, saving]);

  const filteredAvailable = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return available;
    return available.filter((item) => item.nome.toLowerCase().includes(query));
  }, [available, search]);

  const mutate = async (method: "POST" | "DELETE", body: Record<string, string>) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/escolas/${escolaId}/turmas/${turma.id}/curriculo/classe`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível atualizar o currículo.");
      await load();
      setLoadError(null);
      onUpdated?.();
      success("Rascunho atualizado", method === "POST" ? "Disciplina adicionada ao currículo da classe." : "Disciplina removida do currículo da classe.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível atualizar o currículo.";
      setErrorKind("action");
      setLoadError(message);
      toastError("Currículo", message);
    } finally {
      setSaving(false);
    }
  };

  const applyToAllTurmas = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/escolas/${escolaId}/turmas/${turma.id}/curriculo/classe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply" }) });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "O currículo não passou na validação.");
      await load();
      onUpdated?.();
      success("Currículo aplicado", "A mesma matriz foi sincronizada em todas as turmas desta classe.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível aplicar o currículo.";
      setLoadError(message);
      setErrorKind("action");
      toastError("Aplicação do currículo", message);
    } finally { setSaving(false); }
  };

  const handleRemove = async (item: CurriculumItem) => {
    confirmOpenRef.current = true;
    try {
      const confirmed = await confirm({
        title: "Remover disciplina da turma?",
        message: `A disciplina “${item.nome}” será removida somente desta turma. Esta ação não altera o currículo base da escola.`,
        confirmLabel: "Remover disciplina",
        cancelLabel: "Manter disciplina",
        variant: "danger",
      });
      if (confirmed) await mutate("DELETE", { curso_matriz_id: item.curso_matriz_id });
    } finally {
      confirmOpenRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="curriculo-turma-title">
        <header className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 p-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <BookOpen size={14} className="text-[#1F6B3B]" /> Currículo da classe
            </div>
            <h2 id="curriculo-turma-title" className="text-lg font-bold text-slate-900">{turma.nome || turma.turma_codigo}</h2>
            <p className="mt-1 text-xs text-slate-500">{turma.curso_nome || "Ensino Geral"} {turma.classe_nome ? `· ${turma.classe_nome}` : ""} · usado por todas as turmas desta classe</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="grid grid-cols-2 border-b border-slate-100 bg-white text-center text-xs">
          <div className="border-r border-slate-100 p-3"><strong className="block text-lg text-slate-900">{items.length}</strong><span className="text-slate-500">disciplinas ativas</span></div>
          <div className="p-3"><strong className="block text-lg text-[#1F6B3B]">{available.length}</strong><span className="text-slate-500">opções no catálogo</span></div>
        </div>

        <main className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {loadError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center"><p className="text-sm font-semibold text-rose-800">{errorKind === "load" ? "Não foi possível carregar o currículo." : "Não foi possível atualizar o currículo."}</p><p className="mt-1 text-xs text-rose-700">{loadError}</p><button type="button" onClick={() => void load()} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"><Loader2 size={13} className={loading ? "animate-spin" : "hidden"} />Tentar novamente</button></div> : loading ? <div className="flex h-48 items-center justify-center text-slate-400"><Loader2 className="animate-spin text-[#E3B23C]" /></div> : (
            <>
              <section>
                <div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-800">Disciplinas da classe</h3><p className="text-[11px] text-slate-400">A mesma composição será usada por todas as turmas desta classe.</p></div>{isDraft && <span className="rounded-full bg-klasse-gold-50 px-2 py-1 text-[10px] font-bold text-klasse-gold-700">Rascunho</span>}</div>
                {items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">Nenhuma disciplina configurada para esta turma.</p> : <div className="space-y-2">
                  {items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-green-50 p-2 text-[#1F6B3B]"><BookOpen size={15} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.nome}</p><p className="text-[11px] text-slate-400">{item.carga_horaria ? `${item.carga_horaria}h` : "Carga horária não definida"} · {item.obrigatoria === false ? "Optativa" : "Obrigatória"}</p></div></div>
                    <div className="ml-3 flex items-center gap-1"><button type="button" disabled={saving || editingLoading} onClick={() => void openDisciplineEditor(item)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1F6B3B] hover:bg-green-50 disabled:opacity-50">Configurar</button><button type="button" disabled={saving || editingLoading} onClick={() => void handleRemove(item)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Remover disciplina" aria-label={`Remover ${item.nome}`}><Trash2 size={15} /></button></div>
                  </div>)}
                </div>}
              </section>

              {editingDiscipline && <section className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-800">Configurar disciplina</h3><p className="text-[11px] text-slate-500">Esta edição altera a definição no currículo base, não apenas a composição desta turma.</p></div><button type="button" onClick={() => setEditingDiscipline(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Voltar à lista</button></div><DisciplinaModal embedded open mode="edit" initial={editingDiscipline} existingCodes={[]} existingNames={[]} classOptions={[]} onClose={() => setEditingDiscipline(null)} onSave={saveDisciplineDefinition} /></section>}

              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-800">Adicionar ao currículo da classe</h3>
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search size={14} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar disciplina…" className="w-full bg-transparent py-2 text-xs outline-none" /></div>
                <div className="flex gap-2"><select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={saving || !filteredAvailable.length} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#E3B23C]"><option value="">Selecione uma disciplina</option>{filteredAvailable.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.obrigatoria === false ? " · Optativa" : ""}</option>)}</select><button type="button" disabled={saving || !selected} onClick={() => void mutate("POST", { action: "add", disciplina_id: selected })} className="inline-flex items-center gap-2 rounded-lg bg-[#1F6B3B] px-4 py-2 text-sm font-bold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} /> Adicionar</button></div>
                {!available.length && <p className="mt-2 text-[11px] text-slate-500">{items.length === 0 ? "O catálogo da escola ainda não tem disciplinas para adicionar." : <><Check size={12} className="mr-1 inline text-[#1F6B3B]" />Todas as disciplinas do catálogo já estão nesta composição.</>}</p>}
              </section>
            </>
          )}
        </main>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4"><p className="max-w-md text-[11px] text-slate-500">{isDraft ? "As alterações ainda não foram aplicadas às turmas." : "Currículo publicado e partilhado pelas turmas da classe."}</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fechar</button>{isDraft && <button type="button" onClick={() => void applyToAllTurmas()} disabled={saving} className="rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50">Aplicar a todas as turmas</button>}</div></footer>
      </div>
    </div>
  );
}
