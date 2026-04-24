"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ArrowRight, Check, Eye, Filter, Plus, Settings, Shield, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

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
}

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-klasse-gold/10 text-klasse-gold",
  high: "bg-red-50 text-red-600",
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
        description: "Priorizar recuperação de receita em risco imediato.",
        group: "Operação",
        risk_level: "high",
        requires_confirm: false,
        audit_tag: "super_admin.ops.cobrancas_risco",
      },
      {
        id: "op-onboarding-pendente",
        label: "Onboarding Pendente",
        icon: Filter,
        href: "/super-admin/escolas?onboarding=in_progress",
        description: "Atacar bloqueios de escolas sem onboarding concluído.",
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
        description: "Corrigir admins inválidos e reduzir risco operacional.",
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
        description: "Provisionar nova unidade no ecossistema.",
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
        description: "Criar acesso institucional com rastreabilidade.",
        group: "Governança",
        risk_level: "low",
        requires_confirm: false,
        audit_tag: "super_admin.gov.create_user",
      },
      {
        id: "gov-auditoria",
        label: "Auditar Configurações",
        icon: Settings,
        href: "/super-admin/diagnostics",
        description: "Validar políticas e integridade de configuração global.",
        group: "Governança",
        risk_level: "medium",
        requires_confirm: true,
        audit_tag: "super_admin.gov.audit_configs",
      },
      {
        id: "dbg-email-preview",
        label: "Debug Email Preview",
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
        label: "Debug Seed Dados",
        icon: Check,
        href: "/admin-seed",
        description: "Executar seed de QA para cenários de carga.",
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Atalhos Prioritários</p>
        <h2 className="text-2xl font-bold text-slate-950">Execução por domínio</h2>
        <p className="mt-1 text-sm text-slate-500">Foco em impacto operacional imediato, governança e debug controlado.</p>
      </div>

      <div className="space-y-6">
        {groupedActions.map(({ group, items }) => (
          <div key={group} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">{group}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((action) => (
                <button
                  key={action.id}
                  onClick={() => executeAction(action)}
                  disabled={Boolean(action.disabledReason)}
                  className="flex w-full flex-col items-start rounded-xl border border-slate-200 p-4 text-left transition hover:ring-1 hover:ring-klasse-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="mb-3 flex w-full items-start justify-between gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                      <action.icon className="h-4 w-4" />
                      {action.label}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${RISK_STYLES[action.risk_level]}`}>
                      {action.risk_level}
                    </span>
                  </div>

                  <p className="mb-3 text-sm text-slate-500">{action.description}</p>
                  <p className="text-sm text-slate-600">audit: {action.audit_tag}</p>

                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    {action.disabledReason ? action.disabledReason : "Abrir ação"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-lg font-bold text-slate-950">Confirmar ação sensível</h4>
            <p className="mt-2 text-sm text-slate-600">
              Esta ação possui risco <strong>{pendingAction.risk_level}</strong>.
            </p>
            <p className="mt-1 text-sm text-slate-500">{pendingAction.description}</p>
            <p className="mt-1 text-sm text-slate-500">audit: {pendingAction.audit_tag}</p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPending}
                className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                <Check className="h-4 w-4" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
