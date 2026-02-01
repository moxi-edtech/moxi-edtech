"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Calculator, 
  Variable, 
  Pencil, 
  Save, 
  X, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  GraduationCap,
  CalendarClock
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import AcademicStep2Config from "@/components/escola/onboarding/AcademicStep2Config";

// --- TIPAGENS ---
type Componente = { code: string; peso: number; ativo: boolean };
type AvaliacaoConfigData = { componentes: Componente[] };

type ConfigData = {
  frequencia_modelo: 'POR_AULA' | 'POR_PERIODO';
  frequencia_min_percent: number;
  modelo_avaliacao: 'SIMPLIFICADO' | 'ANGOLANO_TRADICIONAL' | 'COMPETENCIAS' | 'DEPOIS';
  avaliacao_config: AvaliacaoConfigData;
};

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

type Props = {
  params: Promise<{ id: string }>;
};

export default function AvaliacaoUnificadaPage({ params }: Props) {
  const { id: escolaId } = use(params);
  const base = `/escola/${escolaId}/admin/configuracoes`;

  // --- ESTADOS ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dados do formulário
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState(75);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<keyof typeof DEFAULTS>('SIMPLIFICADO');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<AvaliacaoConfigData>(cloneConfig(DEFAULTS.SIMPLIFICADO));

  // --- FETCHING ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
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
      if (!res.ok) throw new Error("Falha ao salvar");
      return res.json();
    });

    toast.promise(promise, {
      loading: 'Aplicando novas regras...',
      success: 'Regras atualizadas com sucesso!',
      error: 'Erro ao salvar configurações.',
    });

    try {
      await promise;
      setIsEditing(false); // Volta para modo visualização após sucesso
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Helper para renderizar a fórmula visualmente
  const FormulaVisual = () => (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm text-slate-700">
      {avaliacaoConfig.componentes.map((c, idx) => (
        <div key={c.code} className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
            <Variable className="h-3 w-3 text-slate-400" />
            <span className="font-bold text-slate-800">{c.code}</span>
          </span>
          <span className="text-slate-400">×</span>
          <span className="font-bold text-klasse-gold">{c.peso / 100}</span>
          {idx < avaliacaoConfig.componentes.length - 1 && (
            <span className="font-bold text-slate-400">+</span>
          )}
        </div>
      ))}
      {avaliacaoConfig.componentes.length === 0 && (
        <span className="text-slate-400 italic">Nenhuma fórmula definida.</span>
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
      ]}
      prevHref={`${base}/calendario`}
      nextHref={`${base}/turmas`}
      // Escondemos o botão de save global do Shell para controlar localmente
      saveDisabled={true}
    >
      <div className="flex justify-end mb-4">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" /> Editar Regras
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#D4A32C] disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="space-y-6">
          
          {/* --- MODO VISUALIZAÇÃO (DASHBOARD) --- */}
          {!isEditing && (
            <div className="animate-in fade-in duration-300 space-y-6">
              
              {/* Card Fórmula Ativa */}
              <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-klasse-gold/50">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                      <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Modelo de Avaliação</p>
                      <p className="text-xs text-slate-500">{modeloAvaliacao.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Ativo
                  </span>
                </div>
                <FormulaVisual />
              </div>

              {/* Card Regras de Frequência */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Mínimo para Aprovação</p>
                      <p className="text-xl font-bold text-slate-900">{frequenciaMinPercent}% de Presença</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Modelo de Chamada</p>
                      <p className="text-xl font-bold text-slate-900">
                        {frequenciaModelo === 'POR_AULA' ? 'Por Tempo de Aula' : 'Dia Letivo Único'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- MODO EDIÇÃO (FORMULÁRIO) --- */}
          {isEditing && (
            <div className="animate-in slide-in-from-bottom-4 duration-300 rounded-xl border border-klasse-gold/30 bg-slate-50/50 p-6 ring-1 ring-klasse-gold/10">
              <AcademicStep2Config
                frequenciaModelo={frequenciaModelo}
                onFrequenciaModeloChange={setFrequenciaModelo}
                frequenciaMinPercent={frequenciaMinPercent}
                onFrequenciaMinPercentChange={(val) => setFrequenciaMinPercent(Math.max(0, Math.min(100, Number(val))))}
                modeloAvaliacao={modeloAvaliacao}
                onModeloAvaliacaoChange={handleModeloChange}
                avaliacaoConfig={avaliacaoConfig}
              />
              
              <div className="mt-6 flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-800">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-xs">
                  <p className="font-semibold">Cuidado ao alterar regras</p>
                  <p className="mt-1 opacity-90">
                    Mudar a fórmula ou pesos recalcula automaticamente as médias de todos os alunos. 
                    Certifique-se de que os professores estão cientes.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </ConfigSystemShell>
  );
}