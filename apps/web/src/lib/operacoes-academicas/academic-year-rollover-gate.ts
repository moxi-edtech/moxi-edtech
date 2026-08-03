import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePapel } from "@/lib/permissions";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

export type AcademicYearRolloverState = {
  shouldOpenWizard: boolean;
  activeYear: {
    id: string;
    ano: number;
    dataInicio: string;
    dataFim: string;
  } | null;
  today: string;
};

const ROLLOVER_ROLES = new Set([
  "admin",
  "admin_escola",
  "staff_admin",
  "admin_financeiro",
  "super_admin",
  "global_admin",
]);

export function getLuandaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function canManageAcademicYearRollover(role: string | null | undefined): boolean {
  const rawRole = String(role ?? "").trim().toLowerCase();
  const normalizedRole = normalizePapel(rawRole);
  return ROLLOVER_ROLES.has(normalizedRole ?? rawRole);
}

export function isAcademicYearExpired(dataFim: string, today: string): boolean {
  return dataFim < today;
}

export async function getAcademicYearRolloverState(
  supabase: Client,
  escolaId: string,
  role: string | null | undefined,
  now = new Date()
): Promise<AcademicYearRolloverState> {
  const today = getLuandaDate(now);

  if (!canManageAcademicYearRollover(role)) {
    return { shouldOpenWizard: false, activeYear: null, today };
  }

  const { data, error } = await supabase
    .from("anos_letivos")
    .select("id, ano, data_inicio, data_fim")
    .eq("escola_id", escolaId)
    .eq("ativo", true)
    .order("data_inicio", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { shouldOpenWizard: false, activeYear: null, today };
  }

  const activeYear = {
    id: data.id,
    ano: data.ano,
    dataInicio: data.data_inicio,
    dataFim: data.data_fim,
  };

  return {
    shouldOpenWizard: isAcademicYearExpired(activeYear.dataFim, today),
    activeYear,
    today,
  };
}
