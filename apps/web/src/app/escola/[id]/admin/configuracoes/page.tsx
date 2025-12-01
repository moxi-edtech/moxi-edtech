"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabaseClient"; 
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
  const [setupComplete, setSetupComplete] = useState(false);
  const [forceWizard, setForceWizard] = useState(false); // Permite abrir o wizard mesmo se já estiver completo

  // 2. Verificar Estado da Escola no Cliente
  useEffect(() => {
    async function checkStatus() {
      try {
        const supabase = createClient();
        
        // Verifica se a escola já tem o onboarding marcado como finalizado
        // OU verifica se existem turmas criadas
        const { data, error } = await supabase
          .from('escolas')
          .select('onboarding_finalizado')
          .eq('id', escolaId)
          .maybeSingle();

        if (!error && data?.onboarding_finalizado) {
          setSetupComplete(true);
        } else {
          // Fallback: verifica se há turmas (caso o flag tenha falhado)
          const { count } = await supabase
            .from('turmas')
            .select('*', { count: 'exact', head: true })
            .eq('escola_id', escolaId);
            
          setSetupComplete(!!count && count > 0);
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error);
        setSetupComplete(false);
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

  // 4. MODO WIZARD (Se incompleto OU se forçado pelo utilizador)
  // Aqui renderizamos o componente diretamente, sem redirect()
  if (!setupComplete || forceWizard) {
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
             setSetupComplete(true);
             setForceWizard(false);
             
             // Se era a primeira vez, redireciona para o Dashboard via window.location (mais seguro aqui)
             if (!setupComplete) {
                window.location.href = `/escola/${escolaId}/admin/dashboard`;
             }
          }}
        />
      </div>
    );
  }

  // 5. MODO HUB (Painel de Configurações)
  return (
    <div className="bg-slate-50 min-h-screen">
      <SettingsHub 
        escolaId={escolaId} 
        onOpenWizard={() => setForceWizard(true)} 
      />
    </div>
  );
}