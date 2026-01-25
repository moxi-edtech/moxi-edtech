"use client";

import { useState, useEffect, use } from "react";
import { Loader2 } from "lucide-react";

// Importa os componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import SettingsHub from "@/components/escola/settings/SettingsHub";

// Definição de Props para Next.js 15
type Props = {
  params: Promise<{ id: string }>;
};

export default function ConfiguracoesPage({ params }: Props) {
  // 1. Desembrulha os params (Obrigatório no Next.js 15)
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [forceWizard, setForceWizard] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{
    has_ano_letivo_ativo: boolean;
    has_3_trimestres: boolean;
    has_curriculo_published: boolean;
    has_turmas_no_ano: boolean;
    percentage: number;
  } | null>(null);

  // 2. Verificar Estado da Escola no Cliente
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/setup/status`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.data) {
          setSetupStatus(json.data);
        } else {
          setSetupStatus(null);
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error);
        setSetupStatus(null);
      } finally {
        setLoading(false);
      }
    }

    if (escolaId) {
      checkStatus();
    }
  }, [escolaId]);

  // 3. Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-sm text-slate-500 font-medium">A carregar configurações...</p>
        </div>
      </div>
    );
  }

  const setupComplete = Boolean(setupStatus && setupStatus.percentage === 100);

  const checklistItems = [
    { label: "Ano letivo ativo", ok: setupStatus?.has_ano_letivo_ativo },
    { label: "3 trimestres configurados", ok: setupStatus?.has_3_trimestres },
    { label: "Currículo publicado", ok: setupStatus?.has_curriculo_published },
    { label: "Turmas geradas no ano", ok: setupStatus?.has_turmas_no_ano },
  ];

  // 4. MODO WIZARD (apenas quando forçado)
  if (forceWizard) {
    return (
      <div className="bg-slate-50 min-h-screen">
        {/* Botão de voltar (só aparece se for edição manual) */}
        {setupComplete && (
          <div className="max-w-6xl mx-auto pt-6 px-6">
            <button 
              onClick={() => setForceWizard(false)} 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors"
            >
              ← Voltar ao menu
            </button>
          </div>
        )}
        
        <AcademicSetupWizard 
          escolaId={escolaId} 
          onComplete={() => {
            setForceWizard(false);
          }}
        />
      </div>
    );
  }

  // 5. MODO HUB (Painel de Configurações)
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        {!setupComplete && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">Ação necessária</div>
                <div className="text-sm mt-0.5">
                  Complete o setup acadêmico para liberar o portal.
                </div>
                {setupStatus && (
                  <div className="text-xs text-amber-800 mt-1">
                    Progresso atual: {setupStatus.percentage}%
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setForceWizard(true)}
                  className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Iniciar Assistente
                </button>
                <button
                  type="button"
                  onClick={() => setShowChecklist((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  Ver o que falta
                </button>
              </div>
            </div>
            {showChecklist && (
              <div className="mt-4 space-y-1 text-sm">
                {checklistItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${item.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className={item.ok ? "text-emerald-700" : "text-amber-800"}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <SettingsHub 
        escolaId={escolaId} 
        onOpenWizard={() => setForceWizard(true)} 
      />
    </div>
  );
}
