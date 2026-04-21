"use client";

import { useState, useEffect, use } from "react";

// Importa os componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import AuthRequiredNotice from "@/components/escola/settings/AuthRequiredNotice";
import SettingsHub from "@/components/escola/settings/SettingsHub";
import { useEscolaId } from "@/hooks/useEscolaId";
import { fetchSetupState, setupProgressFromBadges } from "@/lib/setupStateClient";

// Definição de Props para Next.js 15
type Props = {
  params: Promise<{ id: string }>;
};

export default function ConfiguracoesPage({ params }: Props) {
  // 1. Desembrulha os params (Obrigatório no Next.js 15)
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  const [statusLoading, setStatusLoading] = useState(false);
  const [forceWizard, setForceWizard] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [pageSetupStatus, setPageSetupStatus] = useState<{ // Renamed to avoid conflict
    has_ano_letivo_ativo: boolean;
    has_3_trimestres: boolean;
    avaliacao_frequencia_ok?: boolean;
    has_curriculo_published: boolean;
    has_turmas_no_ano: boolean;
    percentage?: number;
    progress_percent?: number;
  } | null>(null);

  // 2. Verificar Estado da Escola no Cliente
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!escolaId) {
        return;
      }
      try {
        setStatusLoading(true);
        const setupRes = await fetchSetupState(escolaParam);
        if (cancelled) return;

        if (!setupRes.ok && setupRes.error === "UNAUTHORIZED") {
          setAuthRequired(true);
          setPageSetupStatus(null);
          return;
        }

        if (setupRes.ok && setupRes.data) {
          const badges = setupRes.data.badges ?? {};
          const progress_percent =
            typeof setupRes.data.completion_percent === "number"
              ? setupRes.data.completion_percent
              : setupProgressFromBadges(badges);

          setAuthRequired(false);
          setPageSetupStatus({
            has_ano_letivo_ativo: Boolean(badges.ano_letivo_ok),
            has_3_trimestres: Boolean(badges.periodos_ok),
            avaliacao_frequencia_ok: Boolean(badges.avaliacao_ok),
            has_curriculo_published: Boolean(badges.curriculo_published_ok),
            has_turmas_no_ano: Boolean(badges.turmas_ok),
            progress_percent,
          });
        } else {
          setPageSetupStatus(null);
        }

      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        if (!cancelled) {
          setPageSetupStatus(null); // Reset page status on error
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [escolaParam]);

  // 3. Estado de Carregamento
  if (authRequired) {
    const nextPath = `/escola/${escolaParam}/admin/configuracoes`;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <AuthRequiredNotice
          nextPath={nextPath}
          description="Não foi possível carregar as configurações porque você não está autenticado."
        />
      </div>
    );
  }

  const progressPercent = pageSetupStatus?.progress_percent ?? pageSetupStatus?.percentage ?? 0;
  const setupComplete = Boolean(pageSetupStatus && progressPercent === 100);

  const checklistItems = [
    { label: "Ano letivo ativo", ok: pageSetupStatus?.has_ano_letivo_ativo },
    { label: "3 trimestres configurados", ok: pageSetupStatus?.has_3_trimestres },
    { label: "Avaliação e frequência configuradas", ok: pageSetupStatus?.avaliacao_frequencia_ok },
    { label: "Currículo publicado", ok: pageSetupStatus?.has_curriculo_published },
    { label: "Turmas geradas no ano", ok: pageSetupStatus?.has_turmas_no_ano },
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
          escolaId={escolaParam} 
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
          <div className="rounded-md border border-klasse-gold-200 bg-klasse-gold-50 p-4 text-klasse-gold-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">Ação necessária</div>
                <div className="text-sm mt-0.5">
                  Complete o setup acadêmico para liberar o portal.
                </div>
                {pageSetupStatus && (
                  <div className="text-xs text-klasse-gold-800 mt-1">
                    Progresso atual: {statusLoading ? "..." : `${progressPercent}%`}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setForceWizard(true)}
                  className="inline-flex items-center justify-center rounded-md bg-klasse-gold-600 px-3 py-2 text-sm font-medium text-white hover:bg-klasse-gold-700"
                >
                  Iniciar Assistente
                </button>
                <button
                  type="button"
                  onClick={() => setShowChecklist((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-md border border-klasse-gold-400 px-3 py-2 text-sm font-medium text-klasse-gold-800 hover:bg-klasse-gold-100"
                >
                  Ver o que falta
                </button>
              </div>
            </div>
            {showChecklist && (
              <div className="mt-4 space-y-1 text-sm">
                {checklistItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${item.ok ? "bg-klasse-green-500" : "bg-klasse-gold-500"}`} />
                    <span className={item.ok ? "text-klasse-green-700" : "text-klasse-gold-800"}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <SettingsHub 
        escolaId={escolaParam} 
        onOpenWizard={() => setForceWizard(true)} 
      />
    </div>
  );
}
