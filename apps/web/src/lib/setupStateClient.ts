"use client";

import { buildPortalHref } from "@/lib/navigation";

export type SetupBadges = {
  ano_letivo_ok?: boolean;
  periodos_ok?: boolean;
  avaliacao_ok?: boolean;
  curriculo_draft_ok?: boolean;
  curriculo_published_ok?: boolean;
  turmas_ok?: boolean;
};

export type OperationalReadiness = {
  ok?: boolean;
  ano_letivo?: number | null;
  summary?: {
    school_status_ok?: boolean;
    onboarding_setup_ok?: boolean;
    academico_ok?: boolean;
    financeiro_ok?: boolean;
    equipe_ok?: boolean;
    horarios_ok?: boolean;
    portais_ok?: boolean;
    operational_ok?: boolean;
  };
  badges?: Record<string, boolean | undefined>;
  metrics?: Record<string, number | null | undefined>;
  blockers?: Array<{
    code?: string;
    area?: string;
    severity?: string;
    title?: string;
    detail?: string;
    fix_cta?: { label?: string; href?: string };
  }>;
};

export type OperationalBlockerAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "auto"; label: string; action: "teachers" | "horarios" };

type SetupStateResponse = {
  ok: boolean;
  data?: {
    stage?: string;
    next_action?: { key?: string; label?: string; href?: string };
    blockers?: Array<{ title?: string; detail?: string; severity?: string }>;
    badges?: SetupBadges;
    completion_percent?: number;
    onboarding_finalizado?: boolean;
    needs_academic_setup?: boolean;
    operational_readiness?: OperationalReadiness;
  };
  error?: string;
};

const inFlight = new Map<string, Promise<SetupStateResponse>>();
const cache = new Map<string, { expiresAt: number; value: SetupStateResponse }>();
const SETUP_STATE_TTL_MS = 10_000;

export async function fetchSetupState(escolaIdOrSlug: string): Promise<SetupStateResponse> {
  const key = String(escolaIdOrSlug ?? "").trim();
  if (!key) return { ok: false, error: "Missing escola id" };

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const current = inFlight.get(key);
  if (current) return current;

  const request = fetch(`/api/escola/${encodeURIComponent(key)}/admin/setup/state`, { cache: "no-store" })
    .then(async (res) => {
      const json = (await res.json().catch(() => null)) as SetupStateResponse | null;
      if (res.status === 401) return { ok: false, error: "UNAUTHORIZED" };
      if (!res.ok) {
        const result = { ok: false, error: json?.error ?? "Erro ao carregar setup" } as SetupStateResponse;
        cache.set(key, { value: result, expiresAt: Date.now() + 1_000 });
        return result;
      }
      const result = { ok: true, data: json?.data } as SetupStateResponse;
      cache.set(key, { value: result, expiresAt: Date.now() + SETUP_STATE_TTL_MS });
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export function invalidateSetupStateCache(escolaIdOrSlug?: string) {
  const key = String(escolaIdOrSlug ?? "").trim();
  if (!key) {
    cache.clear();
    inFlight.clear();
    return;
  }
  cache.delete(key);
  inFlight.delete(key);
}

export function setupProgressFromBadges(badges?: SetupBadges) {
  const steps = [
    Boolean(badges?.ano_letivo_ok),
    Boolean(badges?.periodos_ok),
    Boolean(badges?.avaliacao_ok),
    Boolean(badges?.curriculo_published_ok),
    Boolean(badges?.turmas_ok),
  ];
  return Math.round((steps.filter(Boolean).length / steps.length) * 100);
}

export function getOperationalBlockerAction(
  escolaParam: string | null | undefined,
  blocker?: NonNullable<OperationalReadiness["blockers"]>[number]
): OperationalBlockerAction | null {
  if (!blocker || !escolaParam) return null;

  if (blocker.fix_cta?.href) {
    return {
      kind: "link",
      label: blocker.fix_cta.label || "Abrir correção",
      href: buildPortalHref(escolaParam, blocker.fix_cta.href),
    };
  }

  switch (blocker.code) {
    case "TEAM_TEACHERS_MISSING":
      return { kind: "link", label: "Cadastrar professores", href: buildPortalHref(escolaParam, "/admin/professores") };
    case "TEAM_TEACHER_CONSISTENCY":
    case "TEACHER_ASSIGNMENT_INCONSISTENCY":
    case "PORTAL_PROFESSOR_BLOCKED":
      return { kind: "auto", label: "Auto-atribuir professores", action: "teachers" };
    case "HORARIOS_SLOTS_MISSING":
    case "HORARIOS_PUBLISH_MISSING":
      return { kind: "auto", label: "Auto-gerar horários", action: "horarios" };
    case "FINANCE_IBAN_MISSING":
    case "FINANCE_PRICING_MISSING":
    case "FINANCE_CONFIG_MISSING":
      return { kind: "link", label: "Abrir financeiro", href: buildPortalHref(escolaParam, "/admin/configuracoes/financeiro") };
    case "PORTAL_ALUNO_DISABLED":
      return { kind: "link", label: "Revisar sistema", href: buildPortalHref(escolaParam, "/admin/configuracoes/sistema") };
    case "STUDENTS_MISSING":
      return { kind: "link", label: "Importar alunos", href: buildPortalHref(escolaParam, "/admin/migracao") };
    case "ACADEMIC_COURSES_MISSING":
    case "ACADEMIC_CURRICULUM_UNPUBLISHED":
    case "ACADEMIC_TURMAS_INVALID":
      return { kind: "link", label: "Abrir turmas e currículo", href: buildPortalHref(escolaParam, "/admin/configuracoes/turmas") };
    case "ACADEMIC_YEAR_MISSING":
    case "ACADEMIC_PERIODS_INVALID":
      return { kind: "link", label: "Abrir calendário", href: buildPortalHref(escolaParam, "/admin/configuracoes/calendario") };
    case "ACADEMIC_EVALUATION_MISSING":
      return { kind: "link", label: "Abrir avaliação", href: buildPortalHref(escolaParam, "/admin/configuracoes/avaliacao-frequencia") };
    default:
      return { kind: "link", label: "Ver painel do sistema", href: buildPortalHref(escolaParam, "/admin/configuracoes/sistema") };
  }
}
