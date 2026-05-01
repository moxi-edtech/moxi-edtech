"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ArrowRight, Check, Eye, Filter, Plus, Settings, Shield, Users, Wallet, AlertCircle, Zap, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type RiskLevel = "low" | "medium" | "high";
type ActionGroup = "Operação" | "Governança" | "Debug";

interface QuickAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  description: string;
  group: ActionGroup;
  risk_level: RiskLevel;
  requires_confirm: boolean;
  audit_tag: string;
  disabledReason?: string;
  badge?: string;
}

const RISK_CONFIG: Record<RiskLevel, { dot: string; bg: string; text: string }> = {
  low: { dot: "bg-slate-400", bg: "bg-slate-50", text: "text-slate-600" },
  medium: { dot: "bg-klasse-gold", bg: "bg-klasse-gold/5", text: "text-klasse-gold" },
  high: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-600" },
};

const GROUP_ICONS: Record<ActionGroup, ComponentType<{ className?: string }>> = {
  "Operação": Zap,
  "Governança": ShieldCheck,
  "Debug": Settings,
};

const GROUP_ORDER: ActionGroup[] = ["Operação", "Governança", "Debug"];

function getRuntimeEnv(): "dev" | "staging" | "prod" {
  const publicEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "").toLowerCase();
  if (["dev", "development", "local"].includes(publicEnv)) return "dev";
  if (["stage", "staging", "preview", "homolog"].includes(publicEnv)) return "staging";
  if (process.env.NODE_ENV !== "production") return "dev";
  return "prod";
}

function getDebugPolicy(env: "dev" | "staging" | "prod"): "enabled" | "degraded" | "hidden" {
  const featureFlag = (process.env.NEXT_PUBLIC_ENABLE_SUPERADMIN_DEBUG ?? "").toLowerCase();
  const hideFlag = (process.env.NEXT_PUBLIC_SUPERADMIN_DEBUG_MODE ?? "").toLowerCase() === "hide";

  if (hideFlag || featureFlag === "off" || featureFlag === "false" || featureFlag === "0") {
    return "hidden";
  }

  if (env === "prod") return "degraded";
  return "enabled";
}

export default function QuickActionsSection() {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const env = getRuntimeEnv();
  const debugPolicy = getDebugPolicy(env);

  const actions = useMemo<QuickAction[]>(() => {
    const base: QuickAction[] = [
      {
        id: "op-cobrancas-risco",
        label: "Cobranças em Risco",
        icon: Wallet,
        href: "/super-admin/cobrancas?status=em_risco",
        description: "Recuperação de receita em risco imediato.",
        group: "Operação",
        risk_level: "high",
        requires_confirm: false,
        audit_tag: "super_admin.ops.cobrancas_risco",
        badge: "Crítico",
      },
      {
        id: "op-planos-precos",
        label: "Planos e Preços",
        icon: Wallet,
        href: "/super-admin/planos",
        description: "Preços, descontos, promoções e trial dos planos SaaS.",
        group: "Operação",
        risk_level: "medium",
        requires_confirm: false,
        audit_tag: "super_admin.ops.plan_pricing",
        badge: "Novo",
      },
      {
        id: "op-onboarding-pendente",
        label: "Onboarding Pendente",
        icon: Filter,
        href: "/super-admin/escolas?onboarding=in_progress",
        description: "Desbloqueio de escolas sem onboarding concluído.",
        group: "Operação",
        risk_level: "medium",
        requires_confirm: false,
        audit_tag: "super_admin.ops.onboarding_backlog",
      },
      {
        id: "op-admins-invalidos",
        label: "Admins sem Acesso",
        icon: Shield,
        href: "/super-admin/escolas?focus=admins_access",
        description: "Correção de acessos administrativos inválidos.",
        group: "Operação",
        risk_level: "high",
        requires_confirm: false,
        audit_tag: "super_admin.ops.admin_access_repair",
      },
      {
        id: "gov-criar-escola",
        label: "Criar Escola",
        icon: Plus,
        href: "/super-admin/escolas/nova",
        description: "Provisionar nova unidade no sistema.",
        group: "Governança",
        risk_level: "medium",
        requires_confirm: false,
        audit_tag: "super_admin.gov.create_school",
      },
      {
        id: "gov-criar-utilizador",
        label: "Novo Utilizador",
        icon: Users,
        href: "/super-admin/usuarios/novo",
        description: "Criar acesso institucional rastreável.",
        group: "Governança",
        risk_level: "low",
        requires_confirm: false,
        audit_tag: "super_admin.gov.create_user",
      },
      {
        id: "gov-auditoria",
        label: "Auditar Global",
        icon: Settings,
        href: "/super-admin/diagnostics",
        description: "Validar integridade de configuração global.",
        group: "Governança",
        risk_level: "medium",
        requires_confirm: true,
        audit_tag: "super_admin.gov.audit_configs",
      },
      {
        id: "dbg-email-preview",
        label: "Debug Email",
        icon: Eye,
        href: "/super-admin/debug/email-preview",
        description: "Revisar payload de e-mails automáticos.",
        group: "Debug",
        risk_level: "low",
        requires_confirm: false,
        audit_tag: "super_admin.debug.email_preview",
      },
      {
        id: "dbg-admin-seed",
        label: "Seed de Dados",
        icon: Check,
        href: "/admin-seed",
        description: "Executar carga de dados para QA.",
        group: "Debug",
        risk_level: "high",
        requires_confirm: true,
        audit_tag: "super_admin.debug.seed_data",
      },
    ];

    if (debugPolicy === "enabled") return base;

    if (debugPolicy === "hidden") {
      return base.filter((action) => action.group !== "Debug");
    }

    return base.map((action) => {
      if (action.group !== "Debug") return action;
      return { ...action, disabledReason: "Disponível apenas em dev/staging." };
    });
  }, [debugPolicy]);

  const groupedActions = GROUP_ORDER.map((group) => ({
    group,
    items: actions.filter((action) => action.group === group),
  })).filter((entry) => entry.items.length > 0);

  const executeAction = (action: QuickAction) => {
    if (action.disabledReason) return;
    window.dispatchEvent(
      new CustomEvent("super-admin:quick-action", {
        detail: { audit_tag: action.audit_tag, risk_level: action.risk_level, group: action.group },
      }),
    );

    if (action.requires_confirm) {
      setPendingAction(action);
      return;
    }

    if (action.href) {
      router.push(action.href);
      return;
    }

    action.onClick?.();
  };

  const confirmPending = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    if (action.href) {
      router.push(action.href);
      return;
    }

    action.onClick?.();
  };

  return (
    <section className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          <Zap className="h-3 w-3 fill-current" />
          <span>Central de Comando</span>
        </div>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Atalhos Prioritários</h2>
        <p className="mt-1 text-sm text-slate-500">Execução imediata baseada em domínios críticos.</p>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {groupedActions.map(({ group, items }, gIdx) => (
          <motion.div 
            key={group}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: gIdx * 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-900">
                {(() => {
                  const Icon = GROUP_ICONS[group];
                  return <Icon className="h-4 w-4" />;
                })()}
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{group}</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {items.map((action, idx) => (
                <motion.button
                  key={action.id}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => executeAction(action)}
                  disabled={Boolean(action.disabledReason)}
                  className="group relative flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-klasse-gold/30 hover:shadow-xl hover:shadow-klasse-gold/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {/* Background Accents */}
                  <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full transition-all group-hover:scale-150 ${RISK_CONFIG[action.risk_level].bg}`} />

                  <div className="relative z-10 flex w-full flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${RISK_CONFIG[action.risk_level].bg} ${RISK_CONFIG[action.risk_level].text}`}>
                          <action.icon className="h-5 w-5" />
                        </div>
                        {action.badge && (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                            {action.badge}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-slate-950 group-hover:text-klasse-green transition-colors">
                        {action.label}
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2">
                        {action.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${RISK_CONFIG[action.risk_level].dot}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${RISK_CONFIG[action.risk_level].text}`}>
                          Risco {action.risk_level}
                        </span>
                      </div>
                      <div className="rounded-full bg-slate-950 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {pendingAction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md rounded-[2.5rem] border border-white/20 bg-white p-8 shadow-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-6">
                <AlertCircle className="h-6 w-6" />
              </div>

              <h4 className="text-xl font-black text-slate-950">Confirmar ação sensível</h4>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Você está prestes a executar uma ação de <strong>risco {pendingAction.risk_level}</strong> no domínio de {pendingAction.group}.
              </p>
              
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-sm font-bold text-slate-900">{pendingAction.label}</p>
                <p className="mt-1 text-xs text-slate-500">{pendingAction.description}</p>
                <div className="mt-3 inline-flex rounded-lg bg-white px-2 py-1 text-[10px] font-mono text-slate-400 border border-slate-200">
                  TAG: {pendingAction.audit_tag}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={confirmPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  <Check className="h-4 w-4" />
                  Confirmar Execução
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
