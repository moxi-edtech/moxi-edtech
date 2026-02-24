"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";

type Campanha = {
  id: string;
  titulo: string;
  canal: string;
  template_id?: string | null;
  agendada_em?: string | null;
  status: "rascunho" | "ativa" | "pausada" | "finalizada";
  criado_por?: string;
};

type TemplateMensagem = {
  id: string;
  nome: string;
  canal: string;
  corpo: string;
};

type Aluno = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  turma?: string | null;
};

export default function SistemaCobrancas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [templates, setTemplates] = useState<TemplateMensagem[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);

  const [loadingCampanhas, setLoadingCampanhas] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingAlunos, setLoadingAlunos] = useState(true);

  const [mostrarCriarCampanha, setMostrarCriarCampanha] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  const [novaCampanha, setNovaCampanha] = useState<Partial<Campanha>>({
    titulo: "",
    canal: "whatsapp",
    template_id: undefined,
  });

  const getCanalNome = (canal: string) => {
    switch (canal) {
      case "whatsapp":
        return "WhatsApp";
      case "sms":
        return "SMS";
      case "email":
        return "Email";
      case "push":
        return "Push";
      default:
        return canal;
    }
  };

  const fetchCampanhas = useCallback(async () => {
    setLoadingCampanhas(true);
    try {
      const res = await fetch("/api/financeiro/cobrancas/campanhas");
      if (!res.ok) throw new Error("Falha ao buscar campanhas");
      const json = await res.json();
      setCampanhas(Array.isArray(json) ? json : json.data ?? []);
    } catch (err: any) {
      console.error("fetchCampanhas:", err);
      error(err?.message ?? "Erro ao carregar campanhas");
    } finally {
      setLoadingCampanhas(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/financeiro/cobrancas/templates");
      if (!res.ok) throw new Error("Falha ao buscar templates");
      const json = await res.json();
      setTemplates(Array.isArray(json) ? json : json.data ?? []);
    } catch (err: any) {
      console.error("fetchTemplates:", err);
      error(err?.message ?? "Erro ao carregar templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchAlunos = useCallback(async () => {
    setLoadingAlunos(true);
    try {
      const res = await fetch("/api/financeiro/cobrancas/alunos");
      if (!res.ok) throw new Error("Falha ao buscar alunos");
      const json = await res.json();
      setAlunos(Array.isArray(json) ? json : json.data ?? []);
    } catch (err: any) {
      console.error("fetchAlunos:", err);
      error(err?.message ?? "Erro ao carregar alunos");
    } finally {
      setLoadingAlunos(false);
    }
  }, []);

  useEffect(() => {
    fetchCampanhas();
    fetchTemplates();
    fetchAlunos();
  }, [fetchCampanhas, fetchTemplates, fetchAlunos]);

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!novaCampanha.titulo || !novaCampanha.canal) {
      error("Título e canal são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        nome: novaCampanha.titulo,
        canal: novaCampanha.canal,
        templateId: novaCampanha.template_id ?? null,
        // se houver, envie data de agendamento no formato ISO
        dataAgendamento: (novaCampanha as any).dataAgendamento
          ? new Date((novaCampanha as any).dataAgendamento).toISOString()
          : undefined,
        // destinatariosTipo / turmaId / diasAtrasoMinimo podem ser adicionados aqui quando suportados
      };
      const res = await fetch("/api/financeiro/cobrancas/campanhas/nova", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Erro ao criar campanha");
      }
      success("Campanha criada.");
      setMostrarCriarCampanha(false);
      // update local state with the created campaign returned by the API
      const created = (json as any).campaign ?? (json as any).data ?? null;
      if (created) {
        setCampanhas((prev) => [created, ...prev]);
      } else {
        // fallback: re-fetch list
        fetchCampanhas();
      }
      setNovaCampanha({ titulo: "", canal: "whatsapp", template_id: undefined });
    } catch (err: any) {
      console.error("criarNovaCampanha:", err);
      error(err?.message ?? "Erro ao criar campanha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="flex-1 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sistema de Cobranças</h1>
            <p className="text-slate-600">Automatize cobranças por WhatsApp, SMS e Email</p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center space-x-2">
            <button
              onClick={() => setMostrarCriarCampanha(true)}
              className="flex items-center space-x-2 bg-klasse-gold-400 hover:brightness-95 text-white px-4 py-2 rounded-xl"
            >
              <Plus className="h-5 w-5" />
              <span>Nova Campanha</span>
            </button>
          </div>
        </div>

        <section className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="font-medium text-lg mb-3">Campanhas</h2>

            {loadingCampanhas ? (
              <div className="text-slate-500">Carregando campanhas...</div>
            ) : campanhas.length === 0 ? (
              <div className="text-slate-500">Nenhuma campanha encontrada.</div>
            ) : (
              <ul className="space-y-2">
                {campanhas.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-3 rounded-md hover:bg-slate-50">
                    <div>
                      <div className="font-medium">{c.titulo}</div>
                      <div className="text-xs text-slate-500">
                        {getCanalNome(c.canal)} • {c.status}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">{c.agendada_em ? new Date(c.agendada_em).toLocaleString() : "-"}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h3 className="font-medium text-lg mb-3">Templates</h3>
              {loadingTemplates ? (
                <div className="text-slate-500">Carregando templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-slate-500">Nenhum template.</div>
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li key={t.id} className="p-2 rounded-md border">
                      <div className="font-medium">{t.nome}</div>
                      <div className="text-xs text-slate-500">{getCanalNome(t.canal)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h3 className="font-medium text-lg mb-3">Alunos</h3>
              {loadingAlunos ? (
                <div className="text-slate-500">Carregando alunos...</div>
              ) : alunos.length === 0 ? (
                <div className="text-slate-500">Nenhum aluno encontrado.</div>
              ) : (
                <ul className="space-y-2">
                  {alunos.map((a) => (
                    <li key={a.id} className="p-2 rounded-md border">
                      <div className="font-medium">{a.nome}</div>
                      <div className="text-xs text-slate-500">{a.telefone || a.email || "-"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {mostrarCriarCampanha && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full">
              <h2 className="text-lg font-medium mb-4">Nova Campanha</h2>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                  <input
                    type="text"
                    value={novaCampanha.titulo}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, titulo: e.target.value })}
                    className="w-full p-3 border rounded-md focus:ring-1 focus:ring-klasse-gold-400 focus:outline-none"
                    placeholder="Digite o título da campanha"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Canal</label>
                  <select
                    value={novaCampanha.canal}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, canal: e.target.value })}
                    className="w-full p-3 border rounded-md focus:ring-1 focus:ring-klasse-gold-400 focus:outline-none"
                    required
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="push">Push</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Template</label>
                  <select
                    value={novaCampanha.template_id ?? ""}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, template_id: e.target.value })}
                    className="w-full p-3 border rounded-md focus:ring-1 focus:ring-klasse-gold-400 focus:outline-none"
                  >
                    <option value="">Selecione um template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setMostrarCriarCampanha(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-klasse-gold-400 text-white rounded-md hover:bg-klasse-gold-500 transition-colors"
                  >
                    {submitting ? "Criando..." : "Criar Campanha"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
