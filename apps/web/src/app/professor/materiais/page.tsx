"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
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

export default function ProfessorMateriaisPage() {
  const searchParams = useSearchParams();
  const requestedTurmaId = searchParams?.get("turma_id") ?? "";
  const requestedDisciplinaId = searchParams?.get("disciplina_id") ?? "";
  const { success, error: toastError } = useToast();
  const [materiais, setMateriais] = useState<MaterialPedagogico[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    conteudo: "",
    arquivo_url: "",
    turma_id: "",
    disciplina_id: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [mRes, agendaRes] = await Promise.all([
        fetch("/api/professor/materiais-pedagogicos", { cache: "no-store" }),
        fetch("/api/professor/agenda", { cache: "no-store" }),
      ]);

      const mJson = await mRes.json();
      const agendaJson = await agendaRes.json();

      if (mRes.ok && mJson.ok) setMateriais(mJson.items || []);

      if (agendaRes.ok && agendaJson.items) {
        const pairsMap = new Map<string, Assignment>();
        for (const item of agendaJson.items) {
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
        const nextAssignments = Array.from(pairsMap.values());
        setAssignments(nextAssignments);
        const requestedAssignment = nextAssignments.find((item) => item.turma_id === requestedTurmaId && (!requestedDisciplinaId || item.disciplina_id === requestedDisciplinaId));
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
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

      success("Sucesso", "Material pedagógico guardado em rascunho com sucesso.");
      setShowModal(false);
      setForm({ titulo: "", descricao: "", conteudo: "", arquivo_url: "", turma_id: "", disciplina_id: "" });
      loadData();
    } catch (err) {
      toastError("Erro", err instanceof Error ? err.message : String(err));
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

      success("Estado Alterado", `Material marcado como ${newStatus}.`);
      loadData();
    } catch (err) {
      toastError("Erro", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* HEADER DA PÁGINA */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <DashboardHeader
            title="Materiais Pedagógicos & Apoio ao Estudo"
            description="Publique resumos, manuais e materiais de consulta para os seus alunos."
            breadcrumbs={[
              { label: "Início", href: "/professor" },
              { label: "Professor", href: "/professor" },
              { label: "Materiais" },
            ]}
          />
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-500 transition cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Material</span>
          </button>
        </header>

        {/* CARDS DE MATERIAIS */}
        {loadError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"><p className="font-black">Não foi possível carregar os materiais.</p><p className="mt-1">{loadError}</p><button type="button" onClick={() => void loadData()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></div>
        ) : loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-3xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : materiais.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Nenhum material publicado</h3>
            <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
              Carregue manuais, PDFs ou resumos para auxiliar a aprendizagem dos seus alunos.
            </p>
            <button type="button" onClick={() => setShowModal(true)} className="text-xs font-black text-emerald-700 hover:underline">Adicionar primeiro material</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {materiais.map((m) => {
              const isPublicado = m.status === "publicado";

              return (
                <div
                  key={m.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between"
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
                      <h3 className="font-black text-slate-900 text-base">{m.titulo}</h3>
                      {m.descricao && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-medium">
                          {m.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-2">
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
                      <span className="text-xs font-bold text-slate-400">Texto Incorporado</span>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleStatus(m.id, m.status)}
                      disabled={updatingId === m.id}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        isPublicado
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
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

        {/* MODAL NOVO MATERIAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">Novo Material Pedagógico</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400">Título do Material</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex: Manual de Anatomia Humana — Cap. 3"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400">Descrição / Resumo</label>
                  <textarea
                    rows={2}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Breve resumo sobre o conteúdo abordado..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400">Link do Arquivo (PDF / Google Drive / OneDrive)</label>
                  <input
                    type="url"
                    value={form.arquivo_url}
                    onChange={(e) => setForm({ ...form, arquivo_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400">Ou Conteúdo em Texto</label>
                  <textarea
                    rows={3}
                    value={form.conteudo}
                    onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                    placeholder="Digite o texto de apoio aqui..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-md"
                  >
                    {saving ? "A Guardar..." : "Guardar Rascunho"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
