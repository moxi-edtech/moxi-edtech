"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  Calculator, 
  Variable, 
  Pencil, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  GraduationCap,
  CalendarClock,
  Check
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import AcademicStep2Config from "@/components/escola/onboarding/AcademicStep2Config";
import { Skeleton, useToast } from "@/components/feedback/FeedbackSystem";

type Componente = { code: string; peso: number; ativo: boolean };
type AvaliacaoConfigData = { componentes: Componente[] };

type ModeloAvaliacao = {
  id: string;
  nome: string;
  componentes: Componente[] | { componentes?: Componente[] } | null;
  is_default?: boolean;
};

const extractComponentes = (config?: { componentes?: ReadonlyArray<Componente> } | Componente[] | null) => {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  return config.componentes ?? [];
};

const cloneConfig = (config?: { componentes?: ReadonlyArray<Componente> } | Componente[] | null): AvaliacaoConfigData => ({
  componentes: extractComponentes(config).map((item) => ({ ...item })),
});

export default function AvaliacaoUnificadaClient() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const { toast, dismiss, success, error } = useToast();

  // --- ESTADOS ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dados do formulário
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState(75);
  const [modelos, setModelos] = useState<ModeloAvaliacao[]>([]);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<string>('');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<AvaliacaoConfigData>(cloneConfig());

  if (!escolaId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  // --- FETCHING ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!escolaId) return;
      try {
        const [configRes, modelosRes] = await Promise.all([
          fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaId}/modelos-avaliacao?limit=50`, { cache: "no-store" }),
        ]);
        const json = await configRes.json().catch(() => null);
        const modelosJson = await modelosRes.json().catch(() => null);
        
        if (cancelled) return;
        
        const listaModelos = Array.isArray(modelosJson?.data) ? modelosJson.data : [];
        if (!cancelled) setModelos(listaModelos);
        const defaultModelo = listaModelos.find((m: ModeloAvaliacao) => m.is_default) ?? listaModelos[0];

        if (configRes.ok && json?.data) {
          const data = json.data;
          setFrequenciaModelo(data.frequencia_modelo ?? 'POR_AULA');
          setFrequenciaMinPercent(data.frequencia_min_percent ?? 75);
          const modelId = listaModelos.find((m: ModeloAvaliacao) => m.id === data.modelo_avaliacao)?.id
            ?? listaModelos.find((m: ModeloAvaliacao) => m.nome === data.modelo_avaliacao)?.id
            ?? defaultModelo?.id
            ?? '';
          setModeloAvaliacao(modelId);

          if (data.avaliacao_config?.componentes?.length) {
            setAvaliacaoConfig(data.avaliacao_config);
          } else if (defaultModelo) {
            setAvaliacaoConfig(cloneConfig(defaultModelo.componentes));
          }
        } else if (defaultModelo) {
          setModeloAvaliacao(defaultModelo.id);
          setAvaliacaoConfig(cloneConfig(defaultModelo.componentes));
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
  const handleModeloChange = (novoModelo: string) => {
    setModeloAvaliacao(novoModelo);
    const selected = modelos.find((m) => m.id === novoModelo);
    if (selected) {
      setAvaliacaoConfig(cloneConfig(selected.componentes));
    }
  };

  const handleSave = async () => {
    if (!escolaId) {
      error("Escola não identificada.");
      return;
    }
    setSaving(true);
    const tid = toast({ variant: "syncing", title: "Aplicando regras...", duration: 0 });
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

    try {
      await promise;
      dismiss(tid);
      success("Regras atualizadas.");
      setIsEditing(false);
    } catch (e) {
      dismiss(tid);
      error("Erro ao salvar.");
      console.error(e);
    } finally {
      setSaving(false);
    }
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

  const PreviewPauta = () => (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Preview de pauta</h4>
          <p className="text-xs text-slate-500">Simulação baseada no modelo atual.</p>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase">Exemplo</span>
      </div>

      {previewComponentes.length === 0 ? (
        <div className="mt-4 text-xs text-slate-500">Nenhum componente ativo para simular.</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Aluno</th>
                {previewComponentes.map((comp) => (
                  <th key={comp.code} className="py-2 pr-3">
                    {comp.code} ({comp.peso}%)
                  </th>
                ))}
                <th className="py-2">Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.map((row) => (
                <tr key={row.id} className="text-slate-700">
                  <td className="py-2 pr-3 font-medium">{row.nome}</td>
                  {row.notas.map((nota, index) => (
                    <td key={`${row.id}-${index}`} className="py-2 pr-3">
                      {nota}
                    </td>
                  ))}
                  <td className="py-2 font-semibold text-slate-900">{row.media}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const previewComponentes = useMemo(
    () => avaliacaoConfig.componentes.filter((c) => c.ativo),
    [avaliacaoConfig.componentes]
  );

  const selectedModelo = useMemo(
    () => modelos.find((modelo) => modelo.id === modeloAvaliacao),
    [modelos, modeloAvaliacao]
  );

  const previewRows = useMemo(() => {
    if (previewComponentes.length === 0) return [];
    const alunos = [
      { id: "A01", nome: "Ana Paulo" },
      { id: "A02", nome: "Bruno Silva" },
      { id: "A03", nome: "Carla Nzinga" },
    ];
    return alunos.map((aluno, idx) => {
      const notas = previewComponentes.map((comp, compIndex) => {
        const base = 10 + idx * 2 + compIndex;
        return Math.min(20, Math.max(8, base));
      });
      const media = Math.round(
        notas.reduce((acc, nota, index) => acc + nota * (previewComponentes[index].peso / 100), 0) * 10
      ) / 10;
      return { ...aluno, notas, media };
    });
  }, [previewComponentes]);

  return (
    <ConfigSystemShell
      escolaId={escolaId}
      title="Avaliação & Frequência"
      subtitle="Defina as regras do jogo: como os alunos são aprovados."
      menuItems={buildConfigMenuItems(base)}
      embedded
      backHref={`${base}?tab=avaliacoes`}
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
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-24 flex justify-center"><Skeleton className="h-4 w-40" /></div>
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
                      <p className="text-xs text-slate-500 font-medium">
                        {selectedModelo?.nome ?? (modeloAvaliacao || 'Sem modelo')}
                      </p>
                    </div>
                  </div>
                  {/* TOKEN: Badge Status */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F6B3B] px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide shadow-sm">
                    <Check className="h-3 w-3" strokeWidth={3} /> Ativo
                  </span>
                </div>
                <FormulaVisual />
              </div>

              <PreviewPauta />

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
                  modelosAvaliacao={modelos.map((modelo) => ({ id: modelo.id, nome: modelo.nome }))}
                  avaliacaoConfig={avaliacaoConfig}
                />

                <div className="mt-6">
                  <PreviewPauta />
                </div>
                
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
