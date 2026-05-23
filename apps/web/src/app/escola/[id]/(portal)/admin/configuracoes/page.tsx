"use client";

import { useState, useEffect, use } from "react";

// Importa os componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import AuthRequiredNotice from "@/components/escola/settings/AuthRequiredNotice";
import SettingsHub from "@/components/escola/settings/SettingsHub";
import { useEscolaId } from "@/hooks/useEscolaId";
import { fetchSetupState, invalidateSetupStateCache, setupProgressFromBadges } from "@/lib/setupStateClient";
import { buildPortalHref } from "@/lib/navigation";

// Definição de Props para Next.js 15
type Props = {
  params: Promise<{ id: string }>;
};

export default function ConfiguracoesPage({ params }: Props) {
  // 1. Desembrulha os params (Obrigatório no Next.js 15)
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaId && escolaId !== "null" ? escolaId : (escolaSlug ?? escolaId);

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
    next_action?: { label?: string; href?: string };
    blockers?: Array<{ title?: string; detail?: string; severity?: string }>;
  } | null>(null);

  async function refreshSetupStatus() {
    if (!escolaParam) {
      return;
    }

    try {
      setStatusLoading(true);
      const setupRes = await fetchSetupState(escolaParam);

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
          next_action: setupRes.data.next_action,
          blockers: setupRes.data.blockers,
        });
      } else {
        setPageSetupStatus(null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      setPageSetupStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }

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
            next_action: setupRes.data.next_action,
            blockers: setupRes.data.blockers,
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
    const nextPath = buildPortalHref(escolaParam, "/admin/configuracoes");
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
  const primaryBlocker = pageSetupStatus?.blockers?.[0];
  const nextActionLabel = pageSetupStatus?.next_action?.label ?? "Continuar configuração";

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
          onComplete={async () => {
            invalidateSetupStateCache(escolaParam);
            setForceWizard(false);
            await refreshSetupStatus();
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Configuração académica
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {primaryBlocker?.title || "O assistente continua disponível para completar o setup."}
                </div>
                <div className="text-sm mt-1 text-slate-500">
                  {primaryBlocker?.detail || "Pode retomar de onde parou ou rever o checklist antes de continuar."}
                </div>
                {pageSetupStatus && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                      Progresso: {statusLoading ? "..." : `${progressPercent}%`}
                    </span>
                    {pageSetupStatus.next_action?.label && (
                      <span className="rounded-full bg-[#1F6B3B]/8 px-2.5 py-1 font-medium text-[#1F6B3B]">
                        Próximo passo: {pageSetupStatus.next_action.label}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setForceWizard(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-[#1F6B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17532e]"
                >
                  {nextActionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setShowChecklist((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {showChecklist ? "Ocultar checklist" : "Ver checklist"}
                </button>
              </div>
            </div>
            {showChecklist && (
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {checklistItems.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      item.ok
                        ? "border-[#1F6B3B]/15 bg-[#1F6B3B]/5 text-[#1F6B3B]"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${item.ok ? "bg-[#1F6B3B]" : "bg-slate-300"}`} />
                    <span>{item.label}</span>
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
