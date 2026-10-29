import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearScope } from "@/lib/academic-year/context";
import { recordAuditServer } from "@/lib/audit";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const BodySchema = z.object({
  aluno_id: uuid,
  ano_letivo_id: z.union([uuid, z.string().regex(/^\d{4}$/)]),
  classe_id: uuid,
  course_id: uuid.optional(),
  turma_id: uuid,
  status: z.string().trim().toLowerCase().default("ativa"),
  permitir_sem_curso: z.boolean().optional(),
});

function rpcErrorCode(message: string, code?: string | null) {
  if (code === "42501" || message.includes("ENROLLMENT_AUTH_")) return 403;
  if (code === "23514" || code === "23505" || message.includes("ENROLLMENT_")) return 409;
  return 500;
}

/**
 * New enrollment only. Existing pending reservations and all academic-year
 * transitions must use the canonical admission/rematriculation flows.
 *
 * Atomic DB RPC creates the official matrícula, number, session and
 * student login. This endpoint must never follow it with an UPDATE.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: requestedSchool } = await params;
    const db = await supabaseServerTyped<Database>();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    const escolaId = await resolveEscolaIdForUser(db as any, auth.user.id, requestedSchool);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão nesta escola." }, { status: 403 });
    }
    const { error: forbidden } = await requireRoleInSchool({
      supabase: db as any,
      escolaId,
      roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (forbidden) return forbidden;

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({
        ok: false, error: "Verifique aluno, turma, classe e ano letivo.",
        issues: parsed.error.issues,
      }, { status: 400 });
    }
    const input = parsed.data;
    if (!["ativa", "ativo", "active"].includes(input.status) || input.permitir_sem_curso) {
      return NextResponse.json({
        ok: false, code: "ENROLLMENT_OFFICIAL_FLOW_REQUIRED",
        error: "Reservas, rematrículas e exceções académicas exigem o fluxo oficial do Balcão.",
      }, { status: 409 });
    }

    // Support legacy YYYY values only after resolving the school's actual
    // academic year. Never use the server's calendar year as a fallback.
    let yearId = input.ano_letivo_id;
    if (/^\d{4}$/.test(yearId)) {
      const { data: row, error } = await db.from("anos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ano", Number(yearId))
        .maybeSingle();
      if (error) throw error;
      if (!row?.id) {
        return NextResponse.json({
          ok: false, code: "ACADEMIC_YEAR_NOT_FOUND",
          error: "Ano letivo não encontrado na escola.",
        }, { status: 404 });
      }
      yearId = row.id;
    }
    const year = await resolveAcademicYearScope(db as any, {
      escolaId,
      requestedAcademicYearId: yearId,
      operation: "WRITE",
    });
    await assertAcademicYearEntity(db as any, {
      table: "turmas",
      entityId: input.turma_id,
      escolaId,
      anoLetivoId: year.id,
    });

    const { data, error } = await (db as any).rpc("matricula_criar_confirmar_por_turma_v1", {
      p_escola_id: escolaId,
      p_aluno_id: input.aluno_id,
      p_turma_id: input.turma_id,
      p_ano_letivo_id: year.id,
      p_expected_classe_id: input.classe_id,
      p_expected_curso_id: input.course_id ?? null,
    });
    if (error || data?.ok !== true || !data?.matricula?.id) {
      const message = String(error?.message ?? data?.error ?? "Falha ao criar matrícula.");
      return NextResponse.json({
        ok: false, code: message.split(":")[0], error: message,
      }, { status: rpcErrorCode(message, error?.code) });
    }

    // Best-effort audit, not a second enrollment mutation.
    if (!data.idempotent) {
      recordAuditServer({
        escolaId,
        portal: "secretaria",
        acao: "MATRICULA_CRIADA",
        entity: "matricula",
        entityId: String(data.matricula.id),
        details: {
          aluno_id: input.aluno_id,
          turma_id: input.turma_id,
          curso_id: input.course_id ?? null,
          classe_id: input.classe_id,
          ano_letivo_id: year.id,
          numero: data.matricula.numero_matricula,
          origem: "matricula_criar_confirmar_por_turma_v1",
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      idempotent: Boolean(data.idempotent),
      matricula: data.matricula,
      numero: data.matricula.numero_matricula,
    });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({
        ok: false, code: cause.code, error: cause.message,
      }, { status: cause.status });
    }
    console.error("[matriculas/novo] enrollment context failure", cause);
    return NextResponse.json({
      ok: false, error: "Não foi possível concluir a matrícula. Atualize os dados e tente novamente.",
    }, { status: 500 });
  }
}
