"use client";

import { loadAgendaAssignments, type AgendaAssignment } from "./agendaAssignments";
import React, { useEffect, useState, useMemo } from "react";
import { usePortalDrawerGuard, usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { matchesProfessorResourceQuery } from "@/lib/professor/resource-search";
import { ProfessorResourceEmptyState, ProfessorResourceErrorState, ProfessorResourceGridSkeleton } from "@/components/professor/ProfessorResourceStates";
import { useToast } from "@/components/feedback/FeedbackSystem";
import {
  BookOpen,
  Plus,
  FileText,
  ExternalLink,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  Trash2,
  AlertCircle
} from "lucide-react";

type MaterialPedagogico = {
  id: string;
  titulo: string;
  descricao?: string | null;
  conteudo?: string | null;
  arquivo_url?: string | null;
  turma_id?: string | null;
  disciplina_id?: string | null;
  status: "rascunho" | "publicado" | "arquivado";
  published_at?: string | null;
  created_at: string;
};

type Assignment = {
  turma_id: string;
  disciplina_id: string;
  turma_nome?: string;
  disciplina_nome?: string;
};

export function ProfessorMateriaisWorkspace({ embedded = false, requestedTurmaId = "", requestedDisciplinaId = "", initialAgenda }: { embedded?: boolean; requestedTurmaId?: string; requestedDisciplinaId?: string; initialAgenda?: readonly AgendaAssignment[] }) {
  const { success, error: toastError } = useToast();
  const [materiais, setMateriais] = useState<MaterialPedagogico[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const navigation = usePortalDrawerNavigation();
  usePortalDrawerGuard(dirty, saving || updatingId !== null);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    conteudo: "",
    arquivo_url: "",
    turma_id: "",
    disciplina_id: "",
  });

  const closeForm = () => {
    if (saving || (dirty && !window.confirm("Descartar alterações do material?"))) return;
    setShowModal(false);
    setDirty(false);
    setForm(current => ({ ...current, titulo: "", descricao: "", conteudo: "", arquivo_url: "" }));
  };
  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [mRes, agendaItems] = await Promise.all([
        fetch("/api/professor/materiais-pedagogicos", { cache: "no-store" }),
        loadAgendaAssignments(initialAgenda),
      ]);

      const mJson = await mRes.json();

      if (!mRes.ok || !mJson?.ok) throw new Error(mJson?.error || "Não foi possível carregar os materiais.");
      setMateriais(Array.isArray(mJson.items) ? mJson.items : []);

      {
        const pairsMap = new Map<string, Assignment>();
        for (const item of agendaItems) {
          if (item.turma_id && item.disciplina_id) {
            const key = `${item.turma_id}:${item.disciplina_id}`;
            if (!pairsMap.has(key)) {
              pairsMap.set(key, {
                turma_id: item.turma_id,
                disciplina_id: item.disciplina_id,
                turma_nome: item.turma_nome || "Turma",
                disciplina_nome: item.disciplina_nome || "Disciplina",
              });
            }
          }
        }
        const nextAssignments = Array.from(pairsMap.values()).filter(item => !embedded || ((!requestedTurmaId || item.turma_id === requestedTurmaId) && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId)));
        setAssignments(nextAssignments);
        const matching = nextAssignments.filter((item) => item.turma_id === requestedTurmaId && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId));
        const requestedAssignment = matching.length === 1 ? matching[0] : undefined;
        if (requestedAssignment) setForm((current) => current.turma_id ? current : { ...current, turma_id: requestedAssignment.turma_id, disciplina_id: requestedAssignment.disciplina_id });
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar os materiais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredMateriais = useMemo(() => {
    return materiais.filter((item) => (!embedded || ((!requestedTurmaId || item.turma_id === requestedTurmaId) && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId))) && matchesProfessorResourceQuery(searchTerm, item.titulo, item.descricao));
  }, [materiais, searchTerm, embedded, requestedTurmaId, requestedDisciplinaId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (embedded && requestedTurmaId && (!form.turma_id || !form.disciplina_id || !assignments.some(item => item.turma_id === form.turma_id && item.disciplina_id === form.disciplina_id))) throw new Error("Seleccione a turma e disciplina atribuídas.");
      if (!form.titulo.trim()) throw new Error("Informe o título do material");
      if (!form.conteudo && !form.arquivo_url) {
        throw new Error("Informe o conteúdo em texto ou o link do arquivo");
      }

      const res = await fetch("/api/professor/materiais-pedagogicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo,
          descricao: form.descricao || null,
          conteudo: form.conteudo || null,
          arquivo_url: form.arquivo_url || null,
          turma_id: form.turma_id || null,
          disciplina_id: form.disciplina_id || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao guardar material");

      navigation?.notifyChanged();
      success("Material guardado", "O material ficou em rascunho.");
      setShowModal(false);
      setDirty(false);
      setForm({ titulo: "", descricao: "", conteudo: "", arquivo_url: "", turma_id: "", disciplina_id: "" });
      loadData();
    } catch (err) {
      toastError("Não foi possível guardar o material", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    setUpdatingId(id);
    try {
      const newStatus = currentStatus === "publicado" ? "rascunho" : "publicado";
      const res = await fetch(`/api/professor/materiais-pedagogicos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao alterar estado");

      navigation?.notifyChanged();
      success(newStatus === "publicado" ? "Material publicado" : "Material despublicado");
      loadData();
    } catch (err) {
      toastError("Não foi possível alterar a publicação", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className={embedded ? "min-w-0 text-foreground" : "min-h-screen bg-background pb-24 text-foreground"}>
      <div className={embedded ? "space-y-4" : `${PORTAL_PAGE_INSET} max-md:px-0 max-md:py-0 space-y-6`}>
        {/* HEADER DA PÁGINA */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {!embedded && <DashboardHeader
            title="Materiais Pedagógicos & Apoio ao Estudo"
            description="Publique resumos, manuais e materiais de consulta para os seus alunos."
            breadcrumbs={[
              { label: "Início", href: "/professor" },
              { label: "Professor", href: "/professor" },
              { label: "Materiais" },
            ]}
          />}
          <button
            type="button"
            disabled={showModal || saving || updatingId !== null} onClick={() => setShowModal(true)}
            className="klasse-portal-cta inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Material</span>
          </button>
        </header>

        {(!embedded || !showModal) && <>
        <div className="rounded-xl border border-border bg-card p-4">
          <label htmlFor="pesquisa-materiais" className="sr-only">Pesquisar materiais</label>
          <input
            id="pesquisa-materiais"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Pesquisar por título ou descrição"
            className="min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
          />
          <p aria-live="polite" className="mt-2 px-1 text-xs text-muted-foreground">
            {loading ? "A carregar materiais..." : `${filteredMateriais.length} ${filteredMateriais.length === 1 ? "material" : "materiais"}`}
          </p>
        </div>

        {/* Cards operacionais: erro e lista vazia são estados distintos. */}
        {loadError ? (
          <ProfessorResourceErrorState
            title="Não foi possível carregar os materiais."
            description={loadError}
            onRetry={() => void loadData()}
          />
        ) : loading ? (
          <ProfessorResourceGridSkeleton label="A carregar materiais pedagógicos" />
        ) : filteredMateriais.length === 0 ? (
          <ProfessorResourceEmptyState
            icon={BookOpen}
            title={materiais.length === 0 ? "Ainda não existem materiais" : "Nenhum material encontrado"}
            description={materiais.length === 0
              ? "Crie um material em rascunho para partilhar recursos com os seus alunos."
              : "Experimente outro termo ou limpe a pesquisa."}
            actionLabel={materiais.length === 0 ? "Adicionar primeiro material" : "Limpar pesquisa"}
            onAction={materiais.length === 0 ? () => setShowModal(true) : () => setSearchTerm("")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMateriais.map((m) => {
              const isPublicado = m.status === "publicado";

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                        <FileText size={18} />
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isPublicado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-foreground text-base">{m.titulo}</h3>
                      {m.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 font-medium">
                          {m.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 mt-4 flex items-center justify-between gap-2">
                    {m.arquivo_url ? (
                      <a
                        href={m.arquivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline"
                      >
                        <ExternalLink size={14} />
                        <span>Aceder Ficheiro</span>
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">Texto Incorporado</span>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleStatus(m.id, m.status)}
                      disabled={updatingId !== null || saving}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        isPublicado
                          ? "bg-muted text-muted-foreground hover:bg-accent"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {updatingId === m.id ? "A guardar..." : isPublicado ? "Despublicar" : "Publicar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </>}
        {/* MODAL NOVO MATERIAL */}
        {showModal && (
          <div className={embedded ? "min-w-0" : "fixed inset-0 z-50 flex items-center justify-center bg-muted-foreground/60 backdrop-blur-xs p-4"}>
            <div className={embedded ? "rounded-xl bg-card p-4 space-y-4 border border-border" : "max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-xl bg-card p-4 shadow-xl space-y-4 border border-border sm:p-6"}>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-black text-foreground">Novo Material Pedagógico</h3>
                <button
                  onClick={closeForm} disabled={saving}
                  className="text-muted-foreground hover:text-muted-foreground font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-3" onChange={() => setDirty(true)}>
                <fieldset disabled={saving} className="space-y-3">
                <label className="block text-sm font-medium">Turma e disciplina<select value={form.turma_id + ":" + form.disciplina_id} onChange={event => { const [turma_id, disciplina_id] = event.target.value.split(":"); setForm(current => ({ ...current, turma_id: turma_id ?? "", disciplina_id: disciplina_id ?? "" })); }} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"><option value=":" disabled={embedded && Boolean(requestedTurmaId)}>{embedded && requestedTurmaId ? "Seleccione a disciplina" : "Material geral"}</option>{assignments.map(item => <option key={item.turma_id + ":" + item.disciplina_id} value={item.turma_id + ":" + item.disciplina_id}>{item.turma_nome} · {item.disciplina_nome}</option>)}</select></label>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-muted-foreground">Título do Material</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex: Manual de Anatomia Humana — Cap. 3"
                    className="w-full rounded-xl border border-border p-2.5 text-xs font-bold text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-muted-foreground">Descrição / Resumo</label>
                  <textarea
                    rows={2}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Breve resumo sobre o conteúdo abordado..."
                    className="w-full rounded-xl border border-border p-2.5 text-xs font-medium text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-muted-foreground">Link do Arquivo (PDF / Google Drive / OneDrive)</label>
                  <input
                    type="url"
                    value={form.arquivo_url}
                    onChange={(e) => setForm({ ...form, arquivo_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-border p-2.5 text-xs font-mono text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-muted-foreground">Ou Conteúdo em Texto</label>
                  <textarea
                    rows={3}
                    value={form.conteudo}
                    onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                    placeholder="Digite o texto de apoio aqui..."
                    className="w-full rounded-xl border border-border p-2.5 text-xs font-medium text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={closeForm} disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground bg-muted hover:bg-accent"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="klasse-portal-cta min-h-11 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm"
                  >
                    {saving ? "A Guardar..." : "Guardar Rascunho"}
                  </button>
                </div>
                </fieldset>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
