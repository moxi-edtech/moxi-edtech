"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  FlaskConical, 
  Play, 
  CheckCircle2, 
  AlertOctagon, 
  AlertTriangle,
  Users,
  ArrowRight
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";
import { buildConfigMenuItems } from "../_shared/menuItems";
import { OperationProgress, useToast } from "@/components/feedback/FeedbackSystem";

// --- TYPES ---
type ValidationItem = {
  regra: string;
  severidade: "P0" | "P1" | "WARN";
  entidade: string;
  mensagem: string;
  bloqueante: boolean;
};

type DiffItem = {
  entidade: string;
  campo: string;
  antes?: string | null;
  depois?: string | null;
};

type Impact = {
  alunos_impactados: number;
  turmas_afetadas: number;
  professores_envolvidos: number;
  disciplinas_afetadas: number;
};

type SimulationResult = {
  ok: boolean;
  can_commit: boolean;
  blockers: number;
  warnings: number;
  validations: ValidationItem[];
  diff: DiffItem[];
  impact: Impact;
  error?: string;
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
  const [activeTab, setActiveTab] = useState<"validations" | "diff">("validations");
  const [applying, setApplying] = useState(false);
  const { success, error } = useToast();
  const canPublish = result?.can_commit ?? false;

  const impactSummary = useMemo(() => {
    if (!result?.impact) return null;
    return {
      alunos: result.impact.alunos_impactados,
      turmas: result.impact.turmas_afetadas,
      professores: result.impact.professores_envolvidos,
      disciplinas: result.impact.disciplinas_afetadas,
    };
  }, [result]);

  // --- HANDLERS ---
  const runSimulation = async () => {
    setSimulating(true);
    setProgress(0);
    setResult(null);
    setActiveTab("validations");

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
        body: JSON.stringify({ changes: {} }),
      });
      
      const json = await res.json();
      
      clearInterval(interval);
      setProgress(100);

      // Pequeno delay para usuário ver o 100%
      setTimeout(() => {
        if (!res.ok) {
          error(json?.error || "Erro ao rodar simulação.");
          setSimulating(false);
          return;
        }

        const data = json?.data as SimulationResult | undefined;
        if (!data?.ok) {
          error(data?.error || "Simulação devolveu erros.");
          setSimulating(false);
          return;
        }

        setResult({
          ok: true,
          can_commit: Boolean(data.can_commit),
          blockers: Number(data.blockers ?? 0),
          warnings: Number(data.warnings ?? 0),
          validations: Array.isArray(data.validations) ? data.validations : [],
          diff: Array.isArray(data.diff) ? data.diff : [],
          impact: data.impact ?? {
            alunos_impactados: 0,
            turmas_afetadas: 0,
            professores_envolvidos: 0,
            disciplinas_afetadas: 0,
          },
        });
        success("Simulação concluída.");
        setSimulating(false);
      }, 600);

    } catch (err) {
      clearInterval(interval);
      setSimulating(false);
      error("Erro de conexão.");
    }
  };

  const handleApplyToProduction = async () => {
    if (!escolaId) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ changes: {} }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        error(json?.error || "Erro ao aplicar configurações.");
        return;
      }
      success("Configurações publicadas com sucesso.");
      router.push(`/escola/${escolaId}/dashboard`);
    } catch (err) {
      error("Erro ao aplicar configurações.");
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
      onSave={canPublish ? handleApplyToProduction : undefined}
      saveDisabled={applying}
      customSaveLabel="Publicar Configuração"
      impact={impactSummary ?? undefined}
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
          <div className="py-12">
            <OperationProgress
              label="Processando regras acadêmicas..."
              current={progress}
              total={100}
              status={progress >= 100 ? "done" : "running"}
            />
            <p className="text-xs text-slate-400 mt-2 text-center">Isso não afeta o banco de dados real.</p>
          </div>
        )}

        {/* RESULTS DASHBOARD */}
        {result && !simulating && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
              {canPublish ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Configuração pronta para publicar.
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">
                  <AlertOctagon className="h-4 w-4" />
                  Existem bloqueios a resolver antes de publicar.
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-slate-600">
                <Users className="h-3.5 w-3.5" />
                {result.impact.alunos_impactados} alunos
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-slate-600">
                <ArrowRight className="h-3.5 w-3.5" />
                {result.impact.turmas_afetadas} turmas
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-slate-600">
                <ArrowRight className="h-3.5 w-3.5" />
                {result.impact.professores_envolvidos} professores
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-slate-600">
                <ArrowRight className="h-3.5 w-3.5" />
                {result.impact.disciplinas_afetadas} disciplinas
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("validations")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeTab === "validations"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                Validações ({result.validations.length})
              </button>
              <button
                onClick={() => setActiveTab("diff")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeTab === "diff"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                Diferenças ({result.diff.length})
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="text-sm font-bold text-slate-900">
                  {activeTab === "validations" ? "Relatório de Validação" : "Diff de Configuração"}
                </h3>
              </div>

              {activeTab === "validations" ? (
                <div className="divide-y divide-slate-100">
                  {result.validations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 mb-3">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-slate-900">Nenhuma validação encontrada.</p>
                      <p className="text-sm text-slate-500">Tudo pronto para publicar.</p>
                    </div>
                  ) : (
                    result.validations.map((validation, idx) => {
                      const isBlocker = validation.bloqueante || validation.severidade !== "WARN";
                      return (
                        <div key={`${validation.regra}-${idx}`} className="flex items-start gap-3 px-6 py-4">
                          {isBlocker ? (
                            <AlertOctagon className="h-5 w-5 shrink-0 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                          )}
                          <div>
                            <p className={`text-sm font-medium ${isBlocker ? "text-red-700" : "text-slate-700"}`}>
                              {validation.mensagem}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {validation.entidade} · {validation.severidade}
                            </p>
                          </div>
                          {isBlocker && (
                            <div className="ml-auto">
                              <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 uppercase">
                                Bloqueante
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {result.diff.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <div className="rounded-full bg-slate-100 p-3 text-slate-500 mb-3">
                        <ArrowRight className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-slate-900">Nenhuma diferença detectada.</p>
                      <p className="text-sm text-slate-500">As configurações permanecem iguais.</p>
                    </div>
                  ) : (
                    result.diff.map((item, idx) => (
                      <div key={`${item.entidade}-${item.campo}-${idx}`} className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.entidade}
                          </p>
                          <span className="text-[11px] uppercase text-slate-400">
                            {item.campo}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
                          <span>
                            Antes: <span className="font-semibold text-slate-800">{item.antes ?? "-"}</span>
                          </span>
                          <span>
                            Depois: <span className="font-semibold text-slate-900">{item.depois ?? "-"}</span>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

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
