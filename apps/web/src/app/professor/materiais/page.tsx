"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useEscolaId } from "@/hooks/useEscolaId";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { BookOpenIcon, PlusIcon, DocumentIcon, LinkIcon } from "@heroicons/react/24/outline";

type Material = {
  id: string;
  nome: string;
  arquivo_url: string;
  criado_em: string;
  curso_oferta_id: string;
};

type Atrib = {
  turma: { id: string; nome: string | null };
  disciplina: { id: string; nome: string | null };
  curso_id?: string; // We might need to resolve this
};

type Curso = {
  id: string;
  nome: string;
};

export default function ProfessorMateriaisPage() {
  const { escolaId } = useEscolaId();
  const { success, error } = useToast();
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    curso_id: "",
    nome: "",
    arquivo_url: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, cRes] = await Promise.all([
        fetch("/api/professor/materiais", { cache: "no-store" }),
        fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
      ]);
      
      const mJson = await mRes.json();
      const cJson = await cRes.json();

      if (mRes.ok && mJson.ok) setMateriais(mJson.items || []);
      if (cRes.ok && cJson.ok) setCursos(cJson.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (escolaId) loadData();
  }, [escolaId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/professor/materiais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao salvar");
      
      success("Sucesso", "Material adicionado com sucesso.");
      setShowModal(false);
      setForm({ curso_id: "", nome: "", arquivo_url: "" });
      loadData();
    } catch (err) {
      error("Erro", String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <DashboardHeader
            title="Materiais de Estudo"
            description="Gestão de manuais, guias e conteúdos para os alunos."
            breadcrumbs={[
              { label: "Início", href: "/professor" },
              { label: "Professor", href: "/professor" },
              { label: "Materiais" },
            ]}
          />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 transition"
          >
            <PlusIcon className="w-5 h-5" />
            Novo Material
          </button>
        </header>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : materiais.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <BookOpenIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Nenhum material encontrado</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">
              Comece a carregar manuais ou guias de estudo para os seus alunos.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {materiais.map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <DocumentIcon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {new Date(m.criado_em).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{m.nome}</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Curso: {cursos.find(c => c.id === m.curso_oferta_id)?.nome || "Carregando..."}
                </p>
                <a
                  href={m.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-klasse-gold hover:underline"
                >
                  <LinkIcon className="w-4 h-4" />
                  Aceder ao material
                </a>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Novo Material</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Curso</label>
                  <select
                    value={form.curso_id}
                    onChange={(e) => setForm({ ...form, curso_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    required
                  >
                    <option value="">Selecione o curso</option>
                    {cursos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Título do Material</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Guia de Anatomia I"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Link do Arquivo (PDF/Doc)</label>
                  <input
                    value={form.arquivo_url}
                    onChange={(e) => setForm({ ...form, arquivo_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : "Salvar Material"}
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
