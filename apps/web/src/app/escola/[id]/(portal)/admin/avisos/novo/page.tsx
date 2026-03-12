"use client";

import { useState } from "react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { useToast } from "@/components/feedback/FeedbackSystem";

const PUBLICOS = [
  { value: "todos", label: "Todos" },
  { value: "professores", label: "Professores" },
  { value: "alunos", label: "Alunos" },
  { value: "responsaveis", label: "Responsáveis" },
] as const;

export default function AvisosNovoPage() {
  const { escolaId } = useEscolaId();
  const { success, error } = useToast();
  const [form, setForm] = useState({
    titulo: "",
    conteudo: "",
    publico_alvo: "todos",
  });
  const [saving, setSaving] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escolaId) {
      error("Escola não identificada.");
      return;
    }
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      error("Preencha título e conteúdo.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/admin/avisos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao criar aviso");
      }
      success("Aviso criado com sucesso.");
      setForm({ titulo: "", conteudo: "", publico_alvo: "todos" });
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao criar aviso");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Criar aviso</h1>
          <p className="text-sm text-slate-500">Comunique algo importante para a comunidade escolar.</p>
        </header>

        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Título</label>
            <input
              name="titulo"
              value={form.titulo}
              onChange={onChange}
              placeholder="Ex: Reunião geral sexta-feira"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Público-alvo</label>
            <select
              name="publico_alvo"
              value={form.publico_alvo}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            >
              {PUBLICOS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Mensagem</label>
            <textarea
              name="conteudo"
              value={form.conteudo}
              onChange={onChange}
              placeholder="Descreva o aviso com detalhes."
              rows={6}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {saving ? "Publicando..." : "Publicar aviso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
