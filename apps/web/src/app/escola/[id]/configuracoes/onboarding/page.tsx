"use client";

import { useState, useEffect, use } from "react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";

// Importa os teus componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import SettingsHub from "@/components/escola/settings/SettingsHub";
import SettingsHubSkeleton from "@/components/escola/settings/SettingsHubSkeleton";

// Definição de Props para Next.js 15
type Props = {
  params: Promise<{ id: string }>;
};

export default function ConfiguracoesPage({ params }: Props) {
  // Desembrulha os params (obrigatório no Next 15)
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [forceWizard, setForceWizard] = useState(false); // Para edição manual
  const [schoolDisplayName, setSchoolDisplayName] = useState("");
  const [escolaParam, setEscolaParam] = useState(escolaId);

  // 1. Verificar Estado da Escola
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!escolaId) {
        setLoading(false); // If no escolaId, we can't fetch. Stop loading.
        return;
      }
      try {
        const [setupStatusRes, escolaNomeRes] = await Promise.all([
          fetch(`/api/escola/${escolaId}/admin/setup/status`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" }),
        ]);

        if (cancelled) return;

        const setupStatusJson = await setupStatusRes.json().catch(() => null);
        const nomeJson = await escolaNomeRes.json().catch(() => null);
        const nomePayload = nomeJson?.data ?? nomeJson ?? {};

        const setupData = setupStatusJson?.data ?? {};
        const hasSetupByStatus = Boolean(
          setupData.turmas_ok ?? setupData.has_turmas_no_ano
        );
        setSetupComplete(setupStatusRes.ok && hasSetupByStatus);

        const nome = (nomePayload?.nome as string | undefined) ?? "";
        const slug = (nomePayload?.slug as string | undefined) ?? "";
        if (nome) setSchoolDisplayName(nome);
        if (slug) setEscolaParam(String(slug));
      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true); // Start loading when effect runs
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [escolaId]);



  // 2. Loading State
  if (loading) {
    if (setupComplete) { // If setup was complete in the last render, we are loading new data for SettingsHub
      return <SettingsHubSkeleton />;
    } else { // If setup was not complete, or its initial load, show generic loader for the wizard flow
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      );
    }
  }

  // 3. MODO WIZARD (Se não tem turmas OU o utilizador pediu para reconfigurar)
  // AQUI ESTÁ A CORREÇÃO: Renderizamos o componente, não redirecionamos.
  if (!setupComplete || forceWizard) {
    return (
      <div className="bg-slate-50 min-h-screen">
        {/* Botão de voltar (só aparece se ele já tiver o setup feito e estiver a editar) */}
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
          initialSchoolName={schoolDisplayName}
          onComplete={() => {
             // Quando terminar, atualizamos o estado local
             setSetupComplete(true);
             setForceWizard(false);
             
             // Se era a primeira vez, mandamos para o Dashboard para ver o "Hero"
             if (!setupComplete) {
                window.location.href = `/escola/${escolaParam}/admin/dashboard`;
             }
          }}
        />
      </div>
    );
  }

  // 4. MODO HUB (Painel de Configurações)
  // Se já tem tudo pronto, mostra o menu bonito
  return (
    <div className="bg-slate-50 min-h-screen">
      <SettingsHub 
        escolaId={escolaParam} 
        onOpenWizard={() => setForceWizard(true)} 
      />
    </div>
  );
}
