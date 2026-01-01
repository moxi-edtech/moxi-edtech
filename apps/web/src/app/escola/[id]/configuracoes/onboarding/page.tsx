"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabaseClient"; 
import { Loader2 } from "lucide-react";

// Importa os teus componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import SettingsHub from "@/components/escola/settings/SettingsHub";

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

  // 1. Verificar Estado da Escola
  useEffect(() => {
    async function checkStatus() {
      try {
        const supabase = createClient();
        const [turmasResult, escolaNomeResult] = await Promise.all([
          supabase
            .from('turmas')
            .select('*', { count: 'exact', head: true })
            .eq('escola_id', escolaId),
          supabase
            .from('escolas')
            .select('nome')
            .eq('id', escolaId)
            .maybeSingle(),
        ]);

        if (!turmasResult.error && turmasResult.count && turmasResult.count > 0) {
          setSetupComplete(true);
        } else {
          setSetupComplete(false);
        }

        const nome = (escolaNomeResult.data as any)?.nome as string | undefined;
        if (nome) setSchoolDisplayName(nome);
      } catch (error) {
        console.error("Erro ao verificar status:", error);
        // Em caso de erro, assumimos incompleto para não bloquear
        setSetupComplete(false);
      } finally {
        setLoading(false);
      }
    }

    if (escolaId) {
      checkStatus();
    }
  }, [escolaId]);

  // 2. Loading State
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
          escolaId={escolaId} 
          initialSchoolName={schoolDisplayName}
          onComplete={() => {
             // Quando terminar, atualizamos o estado local
             setSetupComplete(true);
             setForceWizard(false);
             
             // Se era a primeira vez, mandamos para o Dashboard para ver o "Hero"
             if (!setupComplete) {
                window.location.href = `/escola/${escolaId}/admin/dashboard`;
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
        escolaId={escolaId} 
        onOpenWizard={() => setForceWizard(true)} 
      />
    </div>
  );
}
