"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { 
  Calculator, 
  Variable, 
  Pencil, 
  Save, 
  Loader2, 
  AlertCircle, 
  GraduationCap,
  CalendarClock,
  Check
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import AcademicStep2Config from "@/components/escola/onboarding/AcademicStep2Config";

// --- TIPAGENS (Mantidas) ---
type Componente = { code: string; peso: number; ativo: boolean };
type AvaliacaoConfigData = { componentes: Componente[] };

// --- CONSTANTES ---
const DEFAULTS = {
  SIMPLIFICADO: { componentes: [{ code: 'MAC', peso: 50, ativo: true }, { code: 'PT', peso: 50, ativo: true }] },
  ANGOLANO_TRADICIONAL: { componentes: [{ code: 'MAC', peso: 30, ativo: true }, { code: 'NPP', peso: 30, ativo: true }, { code: 'PT', peso: 40, ativo: true }] },
  COMPETENCIAS: { componentes: [{ code: 'COMP', peso: 100, ativo: true }] },
  DEPOIS: { componentes: [] },
} as const;

const cloneConfig = (config?: { componentes?: ReadonlyArray<Componente> }): AvaliacaoConfigData => ({
  componentes: config?.componentes ? config.componentes.map((item) => ({ ...item })) : [],
});

export default function AvaliacaoUnificadaClient() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";

  // --- ESTADOS ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dados do formulário
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState(75);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<keyof typeof DEFAULTS>('SIMPLIFICADO');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<AvaliacaoConfigData>(cloneConfig(DEFAULTS.SIMPLIFICADO));

  if (!escolaId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  // --- FETCHING ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        
        if (cancelled) return;
        
        if (res.ok && json?.data) {
          const data = json.data;
          setFrequenciaModelo(data.frequencia_modelo ?? 'POR_AULA');
          setFrequenciaMinPercent(data.frequencia_min_percent ?? 75);
          setModeloAvaliacao(data.modelo_avaliacao ?? 'SIMPLIFICADO');
          
          if (data.avaliacao_config?.componentes?.length) {
            setAvaliacaoConfig(data.avaliacao_config);
          } else if (data.modelo_avaliacao) {
            setAvaliacaoConfig(cloneConfig(DEFAULTS[data.modelo_avaliacao as keyof typeof DEFAULTS]));
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [escolaId]);

  // --- HANDLERS ---
  const handleModeloChange = (novoModelo: keyof typeof DEFAULTS) => {
    setModeloAvaliacao(novoModelo);
    setAvaliacaoConfig(cloneConfig(DEFAULTS[novoModelo]));
  };

  const handleSave = async () => {
    if (!escolaId) {
      toast.error("Escola não identificada.");
      return;
    }
    setSaving(true);
    const promise = fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frequencia_modelo: frequenciaModelo,
        frequencia_min_percent: frequenciaMinPercent,
        modelo_avaliacao: modeloAvaliacao,
        avaliacao_config: avaliacaoConfig,
      }),
    }).then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const issues = Array.isArray(json?.issues)
          ? json.issues.map((issue: any) => issue.message).join(", ")
          : null;
        const detail = issues || json?.error || "Falha ao salvar";
        throw new Error(detail);
      }
      return json;
    });

    toast.promise(promise, {
      loading: 'Aplicando regras...',
      success: 'Regras atualizadas!',
      error: 'Erro ao salvar.',
    });

    try {
      await promise;
      setIsEditing(false);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  // Helper Visual KLASSE
  const FormulaVisual = () => (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-5 font-mono text-sm text-slate-600 border border-slate-100">
      {avaliacaoConfig.componentes.map((c, idx) => (
        <div key={c.code} className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200">
            <Variable className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold text-slate-900">{c.code}</span>
          </span>
          <span className="text-slate-400 font-medium">×</span>
          {/* TOKEN: Gold apenas para destaque de valor */}
          <span className="font-bold text-[#E3B23C]">{c.peso / 100}</span>
          {idx < avaliacaoConfig.componentes.length - 1 && (
            <span className="font-bold text-slate-400 ml-1">+</span>
          )}
        </div>
      ))}
      {avaliacaoConfig.componentes.length === 0 && (
        <span className="text-slate-400 italic text-xs">Nenhuma fórmula definida.</span>
      )}
    </div>
  );

  return (
    <ConfigSystemShell
      escolaId={escolaId}
      title="Avaliação & Frequência"
      subtitle="Defina as regras do jogo: como os alunos são aprovados."
      menuItems={[
        { label: "📅 Calendário", href: `${base}/calendario` },
        { label: "📊 Avaliação", href: `${base}/avaliacao` },
        { label: "👥 Turmas", href: `${base}/turmas` },
        { label: "💰 Financeiro", href: `${base}/financeiro` },
        { label: "🔄 Fluxos", href: `${base}/fluxos` },
      ]}
      prevHref={`${base}/calendario`}
      nextHref={`${base}/turmas`}
      saveDisabled={true} // Controle local
    >
      {/* custom action moved inside because ConfigSystemShell doesn't accept customAction prop */}
      <div className="flex justify-end">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            // TOKEN: Botão Secundário (Bg-white) ou Primário dependendo da ênfase. 
            // Aqui usei Slate-950 para "Admin Action" neutra, mas Gold se fosse CTA principal.
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-900 transition-all"
          >
            <Pencil className="h-4 w-4" /> Editar Regras
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              // TOKEN: Gold (#E3B23C) para Ação de Salvar (CTA)
              className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-95 transition-all disabled:opacity-70 disabled:grayscale"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-24 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : (
        <div className="space-y-6">
          
          {/* --- DASHBOARD (VIEW MODE) --- */}
          {!isEditing && (
            <div className="animate-in fade-in duration-500 space-y-6">
              
              {/* Card Principal: Fórmula */}
              <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#E3B23C]/50">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* TOKEN: Icon Brand Green (#1F6B3B) */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F6B3B]/10 text-[#1F6B3B]">
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Modelo de Avaliação</p>
                      <p className="text-xs text-slate-500 font-medium">{modeloAvaliacao.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  {/* TOKEN: Badge Status */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F6B3B] px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide shadow-sm">
                    <Check className="h-3 w-3" strokeWidth={3} /> Ativo
                  </span>
                </div>
                <FormulaVisual />
              </div>

              {/* Grid Secundário */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Frequência */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aprovação por Frequência</p>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">{frequenciaMinPercent}%</span>
                        <span className="text-xs text-slate-500">mínimo exigido</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Modelo Chamada */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registro de Presença</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-900">
                        {frequenciaModelo === 'POR_AULA' ? 'Por Tempo de Aula' : 'Dia Letivo Único'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- EDIT MODE --- */}
          {isEditing && (
            <div className="animate-in slide-in-from-bottom-2 duration-300">
              {/* TOKEN: Edição Ativa ganha Ring Gold Suave */}
              <div className="rounded-xl border border-[#E3B23C]/30 bg-slate-50/50 p-6 ring-4 ring-[#E3B23C]/5">
                <AcademicStep2Config
                  frequenciaModelo={frequenciaModelo}
                  onFrequenciaModeloChange={setFrequenciaModelo}
                  frequenciaMinPercent={frequenciaMinPercent}
                  onFrequenciaMinPercentChange={(val) => setFrequenciaMinPercent(Math.max(0, Math.min(100, Number(val))))}
                  modeloAvaliacao={modeloAvaliacao}
                  onModeloAvaliacaoChange={handleModeloChange}
                  avaliacaoConfig={avaliacaoConfig}
                />
                
                <div className="mt-8 flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100 text-amber-800">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-amber-900">Impacto da Alteração</p>
                    <p className="mt-1 opacity-90">
                      Ao salvar, o sistema recalculará automaticamente as médias de todos os alunos vinculados a este modelo.
                      Certifique-se de notificar a coordenação pedagógica.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </ConfigSystemShell>
  );
}
