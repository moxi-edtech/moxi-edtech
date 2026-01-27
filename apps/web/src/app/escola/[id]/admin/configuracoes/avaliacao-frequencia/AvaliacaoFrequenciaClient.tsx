"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import AcademicStep2Config from "@/components/escola/onboarding/AcademicStep2Config";

type Props = {
  escolaId: string;
};

const DEFAULT_AVALIACAO_CONFIG = {
  SIMPLIFICADO: {
    componentes: [
      { code: 'MAC', peso: 50, ativo: true },
      { code: 'PT', peso: 50, ativo: true },
    ],
  },
  ANGOLANO_TRADICIONAL: {
    componentes: [
      { code: 'MAC', peso: 30, ativo: true },
      { code: 'NPP', peso: 30, ativo: true },
      { code: 'PT', peso: 40, ativo: true },
    ],
  },
  COMPETENCIAS: {
    componentes: [
      { code: 'COMP', peso: 100, ativo: true },
    ],
  },
  DEPOIS: {
    componentes: [],
  },
} as const;

const hasComponentes = (config?: { componentes?: { code: string }[] }) => (
  Array.isArray(config?.componentes) && config.componentes.length > 0
);

const cloneConfig = (config?: { componentes?: ReadonlyArray<{ code: string; peso: number; ativo: boolean }> }) => ({
  componentes: config?.componentes ? config.componentes.map((item) => ({ ...item })) : undefined,
});

export default function AvaliacaoFrequenciaClient({ escolaId }: Props) {
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState(75);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<'SIMPLIFICADO' | 'ANGOLANO_TRADICIONAL' | 'COMPETENCIAS' | 'DEPOIS'>('SIMPLIFICADO');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<{ componentes?: { code: string; peso: number; ativo: boolean }[] }>(
    () => cloneConfig(DEFAULT_AVALIACAO_CONFIG.SIMPLIFICADO)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchConfig() {
      if (!escolaId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Erro ao carregar configurações.");
        if (cancelled) return;

        const data = json?.data ?? {};
        const modelo = data?.modelo_avaliacao || 'SIMPLIFICADO';
        setFrequenciaModelo(data?.frequencia_modelo || 'POR_AULA');
        setFrequenciaMinPercent(Number.isFinite(data?.frequencia_min_percent) ? data.frequencia_min_percent : 75);
        setModeloAvaliacao(modelo);
        setAvaliacaoConfig(
          cloneConfig(
            hasComponentes(data?.avaliacao_config)
              ? data.avaliacao_config
              : DEFAULT_AVALIACAO_CONFIG[modelo as keyof typeof DEFAULT_AVALIACAO_CONFIG]
          )
        );
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Salvando configuração...");
    try {
      const payload = {
        frequencia_modelo: frequenciaModelo,
        frequencia_min_percent: frequenciaMinPercent,
        modelo_avaliacao: modeloAvaliacao,
        avaliacao_config: avaliacaoConfig,
      };
      const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Erro ao salvar configuração.");
      if (json?.data?.avaliacao_config) {
        setAvaliacaoConfig(json.data.avaliacao_config);
      }
      toast.success("Configuração salva.", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar configuração.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/escola/${escolaId}/admin/configuracoes`}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Voltar às configurações
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">Frequência & Avaliação</h1>
            <p className="text-sm text-slate-500">
              Defina regras globais de frequência e modelo de avaliação.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Carregando configurações...
          </div>
        ) : (
          <AcademicStep2Config
            frequenciaModelo={frequenciaModelo}
            onFrequenciaModeloChange={setFrequenciaModelo}
            frequenciaMinPercent={frequenciaMinPercent}
            onFrequenciaMinPercentChange={(value) => {
              const sanitized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
              setFrequenciaMinPercent(sanitized);
            }}
            modeloAvaliacao={modeloAvaliacao}
            onModeloAvaliacaoChange={(value) => {
              setModeloAvaliacao(value);
              setAvaliacaoConfig(cloneConfig(DEFAULT_AVALIACAO_CONFIG[value]));
            }}
            avaliacaoConfig={avaliacaoConfig}
          />
        )}
      </div>
    </div>
  );
}
