"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackSystem";
import RadarInadimplenciaActive, {
  type RadarEntry,
} from "@/app/financeiro/_components/RadarInadimplenciaActive";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useParams } from "next/navigation";

// --- TIPAGENS ---
type Campanha = {
  id: string;
  nome: string;
  canal: "whatsapp" | "sms" | "email" | "push";
  template_id?: string | null;
  agendada_em?: string | null;
  status: "rascunho" | "agendada" | "enviando" | "concluida" | "pausada";
  criado_por?: string;
  created_at?: string | null;
};

type TemplateMensagem = {
  id: string;
  nome: string;
  canal: string;
  corpo: string;
};

// --- HELPERS ESTÁTICOS (Fora do render) ---
const getCanalNome = (canal: string) => {
  const canais: Record<string, string> = {
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    push: "Push",
  };
  return canais[canal] || canal;
};

export default function SistemaCobrancas() {
  const params = useParams();
  const escolaId = params?.id as string;
  const hasFetched = useRef(false);
  const { success, error } = useToast();

  // --- ESTADOS ---
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [templates, setTemplates] = useState<TemplateMensagem[]>([]);
  const [selecionadosRadar, setSelecionadosRadar] = useState<RadarEntry[]>([]);
  
  const [loadingCampanhas, setLoadingCampanhas] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mostrarCriarCampanha, setMostrarCriarCampanha] = useState(false);

  const [novaCampanha, setNovaCampanha] = useState<Partial<Campanha>>({
    nome: "",
    canal: "whatsapp",
    template_id: undefined,
  });

  // --- FETCHING ---
  const fetchCampanhas = useCallback(async () => {
    if (!escolaId) return;
    setLoadingCampanhas(true);
    try {
      const res = await fetch(`/api/financeiro/cobrancas/campanhas?escolaId=${escolaId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao buscar campanhas.");
      const json = await res.json();
      setCampanhas(Array.isArray(json) ? json : json.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      error(message);
    } finally {
      setLoadingCampanhas(false);
    }
  }, [escolaId, error]);

  const fetchTemplates = useCallback(async () => {
    if (!escolaId) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/financeiro/cobrancas/templates?escolaId=${escolaId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao buscar templates.");
      const json = await res.json();
      setTemplates(Array.isArray(json) ? json : json.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      error(message);
    } finally {
      setLoadingTemplates(false);
    }
  }, [escolaId, error]);

  useEffect(() => {
    if (hasFetched.current || !escolaId) return;
    hasFetched.current = true;
    fetchCampanhas();
    fetchTemplates();
  }, [escolaId, fetchCampanhas, fetchTemplates]);

  // --- ACTIONS ---
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!novaCampanha.nome || !novaCampanha.canal) {
      error("Título e canal são obrigatórios.");
      return;
    }
    
    if (selecionadosRadar.length === 0) {
      error("Selecione pelo menos um aluno no radar para criar a campanha.");
      return;
    }

    setSubmitting(true);
    try {
      const alunosSelecionados = Array.from(
        new Set(selecionadosRadar.map((entry) => entry.aluno_id))
      );
      
      const payload = {
        escolaId,
        nome: novaCampanha.nome,
        canal: novaCampanha.canal,
        templateId: novaCampanha.template_id ?? null,
        destinatariosTipo: "selecionados",
        destinatariosIds: alunosSelecionados,
        dataAgendamento: new Date().toISOString(),
      };

      const res = await fetch("/api/financeiro/cobrancas/campanhas/nova", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Erro ao criar campanha.");
      }

      success("Campanha criada com sucesso.");
      setMostrarCriarCampanha(false);
      
      const created = json.campaign ?? json.data;
      if (created) {
        setCampanhas((prev) => [created, ...prev]);
      } else {
        fetchCampanhas(); // Fallback
      }
      
      // Reset form
      setNovaCampanha({ nome: "", canal: "whatsapp", template_id: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="font-sora text-slate-900">
      <main className="flex-1 space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <DashboardHeader
              title="Sistema de Cobranças"
              description="Automatize cobranças por WhatsApp, SMS e email."
              breadcrumbs={[
                { label: "Início", href: `/escola/${escolaId}` },
                { label: "Financeiro", href: `/escola/${escolaId}/financeiro` },
                { label: "Radar" },
              ]}
            />
          </div>
          <button
            onClick={() => setMostrarCriarCampanha(true)}
            className="flex items-center gap-2 bg-[#E3B23C] hover:brightness-95 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nova Campanha
          </button>
        </div>

        {/* CONTEÚDO */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUNA ESQUERDA - Radar (Ocupa 2/3 em telas grandes) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h2 className="font-semibold text-lg text-slate-900">Radar de Inadimplência</h2>
                <p className="text-sm text-slate-500">
                  Selecione alunos em atraso para criar campanhas de cobrança.
                </p>
              </div>
            <RadarInadimplenciaActive
              onSelectionChange={setSelecionadosRadar}
            />
            </div>
          </div>

          {/* COLUNA DIREITA - Sidebar de Status */}
          <div className="space-y-6">
            
            {/* Box de Seleção Atual */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-sm text-slate-900 mb-2 uppercase tracking-wide">
                Público Alvo
              </h3>
              <p className="text-sm text-slate-600">
                {selecionadosRadar.length > 0 ? (
                  <span className="font-medium text-[#1F6B3B]">
                    {selecionadosRadar.length} aluno(s) selecionado(s)
                  </span>
                ) : (
                  "Nenhum aluno selecionado."
                )}
              </p>
            </div>

            {/* Lista de Campanhas */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-sm text-slate-900 mb-4 uppercase tracking-wide">
                Últimas Campanhas
              </h3>
              {loadingCampanhas ? (
                <p className="text-sm text-slate-400">A carregar...</p>
              ) : campanhas.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma campanha encontrada.</p>
              ) : (
                <ul className="space-y-3">
                  {campanhas.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex flex-col p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm truncate">{c.nome}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          {c.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>{getCanalNome(c.canal)}</span>
                        <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* MODAL NOVA CAMPANHA */}
        {mostrarCriarCampanha && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 shadow-xl">
              <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900">Nova Campanha</h2>
                <button 
                  onClick={() => setMostrarCriarCampanha(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-5 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Título da Campanha</label>
                  <input
                    type="text"
                    value={novaCampanha.nome}
                    onChange={(e) => setNovaCampanha({ ...novaCampanha, nome: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 transition-all"
                    placeholder="Ex: Cobrança Mensalidade Março"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Canal</label>
                    <select
                      value={novaCampanha.canal}
                      onChange={(e) => setNovaCampanha({ ...novaCampanha, canal: e.target.value as Campanha['canal'] })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 transition-all"
                      required
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="push">Push</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Template</label>
                    <select
                      value={novaCampanha.template_id ?? ""}
                      onChange={(e) => setNovaCampanha({ ...novaCampanha, template_id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 transition-all"
                    >
                      <option value="">Selecione...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#E3B23C] text-white text-sm font-bold rounded-xl hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting ? "A criar campanha..." : "Disparar Campanha"}
                  </button>
                  {selecionadosRadar.length === 0 && (
                    <p className="text-center text-xs text-rose-600 mt-2 font-medium">
                      Aviso: Selecione alunos no radar antes de disparar.
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
