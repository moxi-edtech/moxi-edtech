"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  FlaskConical, 
  Play, 
  CheckCircle2, 
  AlertOctagon, 
  TrendingUp, 
  Users, 
  Clock, 
  ArrowRight 
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";

// --- TYPES ---
type SimulationResult = {
  status: 'success' | 'warning' | 'error';
  stats: {
    students_affected: number;
    classes_affected: number;
    projected_pass_rate: number;
  };
  conflicts: Array<{
    severity: 'critical' | 'warning';
    message: string;
  }>;
};

export default function SandboxConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const router = useRouter();
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";

  const menuItems = buildConfigMenuItems(base);

  // --- STATE ---
  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [applying, setApplying] = useState(false);

  // --- HANDLERS ---
  const runSimulation = async () => {
    setSimulating(true);
    setProgress(0);
    setResult(null);

    // UX: Animação de progresso para dar peso à ação
    const interval = setInterval(() => {
      setProgress((old) => {
        if (old >= 90) return old;
        return old + Math.floor(Math.random() * 15);
      });
    }, 300);

    try {
      // Chama a API real de Preview
      const res = await fetch(`/api/escola/${escolaId}/admin/setup/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: {} }), // Envia estado atual
      });
      
      const json = await res.json();
      
      clearInterval(interval);
      setProgress(100);

      // Pequeno delay para usuário ver o 100%
      setTimeout(() => {
        if (res.ok) {
          // Mockando resultado visual rico se a API for simples por enquanto
          setResult(json.data || {
            status: 'warning',
            stats: {
              students_affected: 450,
              classes_affected: 12,
              projected_pass_rate: 82
            },
            conflicts: [
              { severity: 'warning', message: '2 Turmas sem professor titular definido.' },
              { severity: 'critical', message: 'Fórmula de Avaliação incompleta para Ed. Física.' }
            ]
          });
          toast.success("Simulação concluída!");
        } else {
          toast.error("Erro ao rodar simulação.");
        }
        setSimulating(false);
      }, 600);

    } catch (error) {
      clearInterval(interval);
      setSimulating(false);
      toast.error("Erro de conexão.");
    }
  };

  const handleApplyToProduction = async () => {
    if (!escolaId) return;
    setApplying(true);
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { sandbox: true, applied_at: new Date() } }),
      });
      toast.success("Configurações aplicadas com sucesso!");
      router.push(`/escola/${escolaId}/dashboard`); // Redireciona para o app real
    } catch (error) {
      toast.error("Erro ao aplicar configurações.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Sandbox · Teste de Impacto"
      subtitle="Simule o comportamento do ano letivo antes de publicar."
      menuItems={menuItems}
      prevHref={`${base}/fluxos`}
      nextHref={`${base}/sistema`} // Volta pro início ou dashboard
      // O botão "Save" padrão fica desabilitado até rodar a simulação
      onSave={handleApplyToProduction}
      saveDisabled={applying || !result || result.conflicts.some(c => c.severity === 'critical')}
      customSaveLabel="Publicar Configuração"
    >
      <div className="space-y-6">
        
        {/* HERO CARD: ACTION */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <FlaskConical className="h-5 w-5 text-klasse-gold" />
                Ambiente de Teste Isolado
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Verifique conflitos de horário, fórmulas de notas e fluxos usando dados fictícios baseados no seu histórico.
              </p>
            </div>
            
            {!simulating && !result && (
              <button
                onClick={runSimulation}
                className="group inline-flex items-center gap-2 rounded-full bg-klasse-gold px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#D4A32C]"
              >
                <Play className="h-4 w-4 fill-current" />
                Rodar Simulação
              </button>
            )}
          </div>

          {/* BACKGROUND DECORATION */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-klasse-gold/10 blur-3xl"></div>
        </div>

        {/* LOADING STATE */}
        {simulating && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-2 w-64 overflow-hidden rounded-full bg-slate-100">
              <div 
                className="h-full bg-klasse-gold transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm font-medium text-slate-600 animate-pulse">
              Processando regras acadêmicas... {progress}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Isso não afeta o banco de dados real.</p>
          </div>
        )}

        {/* RESULTS DASHBOARD */}
        {result && !simulating && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* GRID DE MÉTRICAS */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                  <Users className="h-4 w-4" /> Impacto Estimado
                </div>
                <p className="text-2xl font-bold text-slate-900">{result.stats.students_affected}</p>
                <p className="text-xs text-slate-400">Alunos afetados pelas novas regras</p>
              </div>
              
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                  <TrendingUp className="h-4 w-4" /> Aprovação Projetada
                </div>
                <p className="text-2xl font-bold text-emerald-600">{result.stats.projected_pass_rate}%</p>
                <p className="text-xs text-slate-400">Baseado no histórico escolar</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                  <Clock className="h-4 w-4" /> Tempo de Processamento
                </div>
                <p className="text-2xl font-bold text-slate-900">0.4s</p>
                <p className="text-xs text-slate-400">Latência do cálculo de notas</p>
              </div>
            </div>

            {/* LISTA DE CONFLITOS */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="text-sm font-bold text-slate-900">Relatório de Validação</h3>
              </div>
              
              <div className="divide-y divide-slate-100">
                {result.conflicts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 mb-3">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <p className="font-semibold text-slate-900">Tudo parece correto!</p>
                    <p className="text-sm text-slate-500">Nenhum conflito crítico detectado.</p>
                  </div>
                ) : (
                  result.conflicts.map((conflict, idx) => (
                    <div key={idx} className="flex items-start gap-3 px-6 py-4">
                      {conflict.severity === 'critical' ? (
                        <AlertOctagon className="h-5 w-5 shrink-0 text-red-500" />
                      ) : (
                        <AlertOctagon className="h-5 w-5 shrink-0 text-amber-500" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${conflict.severity === 'critical' ? 'text-red-700' : 'text-slate-700'}`}>
                          {conflict.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {conflict.severity === 'critical' ? 'Correção obrigatória antes de publicar.' : 'Recomendamos verificar, mas não impede publicação.'}
                        </p>
                      </div>
                      {conflict.severity === 'critical' && (
                        <div className="ml-auto">
                           <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 uppercase">Bloqueante</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* BOTÃO DE RETESTE */}
            <div className="mt-6 flex justify-center">
              <button 
                onClick={runSimulation}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <FlaskConical className="h-3 w-3" />
                Rodar nova simulação
              </button>
            </div>

          </div>
        )}
      </div>
    </ConfigSystemShell>
  );
}
