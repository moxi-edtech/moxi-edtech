import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { requireCommandCenterSchoolWideAccess } from "@/lib/command-center/school-wide-scope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";
import { sortPublishedLessons, type PublishedLesson } from "@/lib/command-center/published-horario";

export const dynamic = "force-dynamic";

/** Read-only Command Center projection of the canonical published timetable.
 * No drafts are created, no scheduler tables are duplicated or modified.
 */
const requestSchema = z.object({
  escolaId: z.string().uuid(),
  turmaId: z.string().uuid(),
  anoLetivoId: z.string().uuid().nullable(),
});

const MAX_LESSONS = 150;

type Joined<T> = T | T[] | null;
type QuadroReadRow = {
  id: string;
  professor_id: string | null;
  disciplina_id: string;
  sala_id: string | null;
  slot: Joined<{
    id: string; dia_semana: number; inicio: string; fim: string;
    ordem: number; is_intervalo: boolean | null;
  }>;
  disciplina: Joined<{ nome: string | null }>;
  professor: Joined<{
    apelido: string | null;
    profiles: Joined<{ nome: string | null; deleted_at: string | null }>;
  }>;
  sala: Joined<{ nome: string | null }>;
};
function one<T>(value: Joined<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function readPublishedHorario(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; turmaId: string }> },
) {
  const { id, turmaId } = await params;
  const parsed = requestSchema.safeParse({
    escolaId: id,
    turmaId,
    anoLetivoId: new URL(req.url).searchParams.get("ano_letivo_id"),
  });
  if (!parsed.success) return NextResponse.json(
    { ok: false, error: "Parâmetros inválidos." }, { status: 400 },
  );

  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(
      { ok: false, error: "Não autenticado." }, { status: 401 },
    );

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
    if (!escolaId) return NextResponse.json(
      { ok: false, error: "Sem acesso à escola." }, { status: 403 },
    );

    const authz = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (authz.error) return authz.error;

    const schoolScopeError = await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req);
    if (schoolScopeError) return schoolScopeError;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.anoLetivoId, operation: "READ",
    });

    const { data: turma, error: turmaError } = await supabase.from("turmas")
      .select("id,ano_letivo_id")
      .eq("escola_id", escolaId).eq("id", turmaId).maybeSingle();
    if (turmaError) throw turmaError;
    if (!turma || turma.ano_letivo_id !== year.id) return NextResponse.json(
      { ok: false, error: "Turma não encontrada neste ano letivo." }, { status: 404 },
    );

    // The published version is the only source of an official timetable.
    const { data: version, error: versionError } = await supabase.from("horario_versoes")
      .select("id,publicado_em")
      .eq("escola_id", escolaId).eq("turma_id", turmaId)
      .eq("status", "publicada")
      .order("publicado_em", { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle();
    if (versionError) throw versionError;
    if (!version) return NextResponse.json({ ok: true, data: {
      turmaId, anoLetivoId: year.id, estado: "sem-publicacao",
      publicadoEm: null, versaoId: null, aulas: [], parcial: false,
    } }, { headers: { "Cache-Control": "private, no-store" } });

    // One scoped PostgREST projection avoids extra client-side round trips.
    // Missing professor/sala remain unknown; never infer them from assignments.
    const { data: rows, count, error: quadroError } = await supabase
      .from("quadro_horarios")
      .select(
        "id,professor_id,disciplina_id,sala_id,slot:horario_slots!inner(id,dia_semana,ordem,inicio,fim,is_intervalo),disciplina:disciplinas_catalogo(nome),professor:professores(apelido,profiles(nome,deleted_at)),sala:salas(nome)",
        { count: "exact" },
      )
      .eq("escola_id", escolaId).eq("turma_id", turmaId).eq("versao_id", version.id)
      .order("id", { ascending: true })
      .limit(MAX_LESSONS + 1);
    if (quadroError) throw quadroError;

    const parcial = (count ?? 0) > MAX_LESSONS || (rows?.length ?? 0) > MAX_LESSONS;
    const aulas: PublishedLesson[] = [];
    for (const raw of ((rows ?? []).slice(0, MAX_LESSONS) as unknown as QuadroReadRow[])) {
      const slot = one(raw.slot);
      if (!slot || slot.is_intervalo || slot.dia_semana < 1 || slot.dia_semana > 7) continue;
      const professor = one(raw.professor);
      const profile = one(professor?.profiles ?? null);
      aulas.push({
        id: raw.id,
        diaSemana: slot.dia_semana,
        inicio: slot.inicio,
        fim: slot.fim,
        disciplinaNome: one(raw.disciplina)?.nome?.trim() || "Disciplina sem identificação",
        disciplinaId: raw.disciplina_id,
        professorNome: raw.professor_id && !profile?.deleted_at
          ? profile?.nome?.trim() || professor?.apelido?.trim() || null
          : null,
        professorVinculoRegistrado: Boolean(raw.professor_id),
        salaNome: raw.sala_id ? one(raw.sala)?.nome?.trim() || null : null,
      });
    }
    return NextResponse.json({ ok: true, data: {
      turmaId, anoLetivoId: year.id, estado: "publicado",
      publicadoEm: version.publicado_em, versaoId: version.id,
      aulas: sortPublishedLessons(aulas), parcial,
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: "Não foi possível consultar o horário publicado." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; turmaId: string }> },
) {
  return readPublishedHorario(req, context);
}
