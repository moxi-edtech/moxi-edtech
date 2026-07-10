"use client";

import { useState, useEffect, use } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

// Importa os componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import AuthRequiredNotice from "@/components/escola/settings/AuthRequiredNotice";
import SettingsHub from "@/components/escola/settings/SettingsHub";
import { useEscolaId } from "@/hooks/useEscolaId";
import {
  fetchSetupState,
  getOperationalBlockerAction,
  invalidateSetupStateCache,
  setupProgressFromBadges,
} from "@/lib/setupStateClient";
import { buildContextualPortalHref } from "@/lib/navigation";

// Definição de Props para Next.js 15
type Props = {
  params: Promise<{ id: string }>;
};

function mapSetupActionKeyToWizardStep(actionKey?: string | null) {
  switch (actionKey) {
    case "CONFIGURE_ANO_LETIVO":
    case "CONFIGURE_PERIODOS":
      return 1;
    case "CONFIGURE_AVALIACAO":
      return 2;
    case "APPLY_PRESET":
    case "PUBLISH_CURRICULO":
      return 3;
    case "GENERATE_TURMAS":
      return 5;
    default:
      return 1;
  }
}

export default function ConfiguracoesPage({ params }: Props) {
  // 1. Desembrulha os params (Obrigatório no Next.js 15)
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;
  const searchParams = useSearchParams();
  const pathname = usePathname();
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
    onboarding_finalizado?: boolean;
    needs_academic_setup?: boolean;
    percentage?: number;
    progress_percent?: number;
    next_action?: { key?: string; label?: string; href?: string };
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
          onboarding_finalizado: Boolean(setupRes.data.onboarding_finalizado),
          needs_academic_setup:
            typeof setupRes.data.needs_academic_setup === "boolean"
              ? setupRes.data.needs_academic_setup
              : undefined,
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
            onboarding_finalizado: Boolean(setupRes.data.onboarding_finalizado),
            needs_academic_setup:
              typeof setupRes.data.needs_academic_setup === "boolean"
                ? setupRes.data.needs_academic_setup
                : undefined,
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
    const nextPath = buildContextualPortalHref(escolaParam, "/admin/configuracoes", pathname);
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
  const cameFromPublicOnboarding = searchParams?.get("source") === "public-onboarding";
  const requestedWizardView = searchParams?.get("setup") === "wizard";
  const requestedStep = Number(searchParams?.get("step") || "");
  const setupComplete = Boolean(
    pageSetupStatus &&
      (pageSetupStatus.onboarding_finalizado || pageSetupStatus.needs_academic_setup === false)
  );
  const primaryBlocker = pageSetupStatus?.blockers?.[0];
  const nextActionLabel = pageSetupStatus?.next_action?.label ?? "Continuar configuração";
  const nextActionHref = pageSetupStatus?.next_action?.href
    ? buildContextualPortalHref(escolaParam, pageSetupStatus.next_action.href, pathname)
    : null;
  const suggestedWizardStep =
    Number.isFinite(requestedStep) && requestedStep >= 1 && requestedStep <= 5
      ? requestedStep
      : mapSetupActionKeyToWizardStep(pageSetupStatus?.next_action?.key);
  const primaryBlockerAction = getOperationalBlockerAction(
    escolaParam,
    primaryBlocker
      ? {
          code: undefined,
          area: undefined,
          severity: primaryBlocker.severity,
          title: primaryBlocker.title,
          detail: primaryBlocker.detail,
        }
      : undefined,
    pathname
  );

  const checklistItems = [
    { label: "Ano letivo ativo", ok: pageSetupStatus?.has_ano_letivo_ativo },
    { label: "3 trimestres configurados", ok: pageSetupStatus?.has_3_trimestres },
    { label: "Avaliação e frequência configuradas", ok: pageSetupStatus?.avaliacao_frequencia_ok },
    { label: "Currículo publicado", ok: pageSetupStatus?.has_curriculo_published },
    { label: "Turmas geradas no ano", ok: pageSetupStatus?.has_turmas_no_ano },
  ];

  useEffect(() => {
    if ((cameFromPublicOnboarding || requestedWizardView) && !setupComplete) {
      setForceWizard(true);
    }
  }, [cameFromPublicOnboarding, requestedWizardView, setupComplete]);

  // 4. MODO WIZARD (apenas quando forçado)
  if (forceWizard) {
    return (
      <div className="bg-slate-50 min-h-screen">
        {cameFromPublicOnboarding && (
          <div className="max-w-6xl mx-auto pt-6 px-6">
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-slate-900 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                    Continuação do onboarding
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    Você já caiu no passo certo do setup interno.
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Siga o assistente abaixo para concluir o próximo passo real da escola sem voltar ao portal público.
                  </div>
                </div>
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
                  {statusLoading ? "A carregar progresso..." : `Setup interno: ${progressPercent}%`}
                </div>
              </div>
            </div>
          </div>
        )}
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
          initialStep={suggestedWizardStep}
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
        {cameFromPublicOnboarding && (
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-slate-900 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Continuação do onboarding
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  Você saiu do portal público e entrou no hub interno da escola.
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  A partir daqui, conclua o setup académico e operacional usando o próximo passo guiado abaixo.
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
                {statusLoading ? "A carregar progresso..." : `Setup interno: ${progressPercent}%`}
              </div>
            </div>
          </div>
        )}
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
                {nextActionHref ? (
                  <Link
                    href={nextActionHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 px-4 py-2.5 text-sm font-semibold text-[#1F6B3B] hover:bg-[#1F6B3B]/10"
                  >
                    Abrir módulo recomendado
                  </Link>
                ) : null}
                {!nextActionHref && primaryBlockerAction?.kind === "link" ? (
                  <Link
                    href={primaryBlockerAction.href}
                    className="inline-flex items-center justify-center rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 px-4 py-2.5 text-sm font-semibold text-[#1F6B3B] hover:bg-[#1F6B3B]/10"
                  >
                    {primaryBlockerAction.label}
                  </Link>
                ) : null}
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
