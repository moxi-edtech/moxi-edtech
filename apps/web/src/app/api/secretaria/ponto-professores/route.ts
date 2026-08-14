import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin", "admin_escola", "staff_admin", "diretor"] as const;

type AulaRow = {
  id: string;
  professor_id: string | null;
  data: string;
  inicio_previsto: string | null;
  fim_previsto: string | null;
  inicio_real: string | null;
  fim_real: string | null;
  status: string;
};

function monthRange(month: string | null) {
  const value = /^\d{4}-\d{2}$/.test(month ?? "") ? month as string : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = value.split("-").map(Number);
  const from = `${value}-01`;
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { month: value, from, until: next };
}

function plannedMinutes(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.slice(0, 5).split(":").map(Number);
  const [endHour, endMinute] = end.slice(0, 5).split(":").map(Number);
  const value = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  return value > 0 ? value : 0;
}

function actualMinutes(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function formatMinutes(minutes: number) {
  return { minutos: minutes, horas: Number((minutes / 60).toFixed(2)) };
}

export async function GET(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: true, month: new Date().toISOString().slice(0, 7), items: [] });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return authz.error;

  const { month, from, until } = monthRange(new URL(req.url).searchParams.get("month"));
  const [{ data: professors, error: professorsError }, { data: aulas, error: aulasError }] = await Promise.all([
    supabase.from("professores").select("id, nome, nome_completo, profile_id").eq("escola_id", escolaId).order("nome", { ascending: true }).limit(500),
    supabase.from("aulas").select("id, professor_id, data, inicio_previsto, fim_previsto, inicio_real, fim_real, status").eq("escola_id", escolaId).gte("data", from).lt("data", until).not("professor_id", "is", null).order("data", { ascending: true }).limit(5000),
  ]);
  if (professorsError || aulasError) return NextResponse.json({ ok: false, error: professorsError?.message ?? aulasError?.message ?? "Não foi possível carregar o ponto docente." }, { status: 500 });

  const aulaRows = (aulas ?? []) as AulaRow[];
  const byProfessor = new Map<string, { aulas: number; finalizadas: number; pendentes: number; atrasos: number; saidas_antecipadas: number; horas_previstas: number; horas_realizadas: number; minutos_atraso: number; minutos_saida_antecipada: number }>();
  for (const aula of aulaRows) {
    if (!aula.professor_id) continue;
    const current = byProfessor.get(aula.professor_id) ?? { aulas: 0, finalizadas: 0, pendentes: 0, atrasos: 0, saidas_antecipadas: 0, horas_previstas: 0, horas_realizadas: 0, minutos_atraso: 0, minutos_saida_antecipada: 0 };
    const expected = plannedMinutes(aula.inicio_previsto, aula.fim_previsto);
    const actual = actualMinutes(aula.inicio_real, aula.fim_real);
    current.aulas += 1;
    current.finalizadas += aula.status === "finalizada" ? 1 : 0;
    current.pendentes += ["agendada", "aguardando_confirmacao", "em_andamento"].includes(aula.status) ? 1 : 0;
    current.horas_previstas += expected;
    current.horas_realizadas += actual;
    if (aula.inicio_real && aula.inicio_previsto) {
      const expectedStart = new Date(`${aula.data}T${aula.inicio_previsto.slice(0, 5)}:00`);
      const delay = Math.max(0, Math.round((new Date(aula.inicio_real).getTime() - expectedStart.getTime()) / 60000));
      current.minutos_atraso += delay;
      current.atrasos += delay > 0 ? 1 : 0;
    }
    if (aula.fim_real && aula.fim_previsto) {
      const expectedEnd = new Date(`${aula.data}T${aula.fim_previsto.slice(0, 5)}:00`);
      const early = Math.max(0, Math.round((expectedEnd.getTime() - new Date(aula.fim_real).getTime()) / 60000));
      current.minutos_saida_antecipada += early;
      current.saidas_antecipadas += early > 0 ? 1 : 0;
    }
    byProfessor.set(aula.professor_id, current);
  }

  const items = ((professors ?? []) as Array<{ id: string; nome: string | null; nome_completo: string | null }>).map((professor) => {
    const stats = byProfessor.get(professor.id) ?? { aulas: 0, finalizadas: 0, pendentes: 0, atrasos: 0, saidas_antecipadas: 0, horas_previstas: 0, horas_realizadas: 0, minutos_atraso: 0, minutos_saida_antecipada: 0 };
    return { professor_id: professor.id, professor_nome: professor.nome_completo ?? professor.nome ?? "Professor sem nome", ...stats, previstas: formatMinutes(stats.horas_previstas), realizadas: formatMinutes(stats.horas_realizadas) };
  });
  const totals = items.reduce((acc, item) => {
    for (const key of ["aulas", "finalizadas", "pendentes", "atrasos", "saidas_antecipadas", "horas_previstas", "horas_realizadas", "minutos_atraso", "minutos_saida_antecipada"] as const) acc[key] += item[key];
    return acc;
  }, { aulas: 0, finalizadas: 0, pendentes: 0, atrasos: 0, saidas_antecipadas: 0, horas_previstas: 0, horas_realizadas: 0, minutos_atraso: 0, minutos_saida_antecipada: 0 });
  return NextResponse.json({ ok: true, month, from, until, items, aulas: aulaRows, totals: { ...totals, previstas: formatMinutes(totals.horas_previstas), realizadas: formatMinutes(totals.horas_realizadas) } });
}
