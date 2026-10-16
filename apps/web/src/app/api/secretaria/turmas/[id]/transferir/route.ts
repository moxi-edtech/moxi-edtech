import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  target_turma_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
  motivo: z.string().trim().min(10).max(300),
});

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;
const ACTIVE_STATUSES = ["ativo", "ativa", "matriculado"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceTurmaId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    if (sourceTurmaId === parsed.data.target_turma_id) {
      return NextResponse.json(
        { ok: false, error: "A turma destino deve ser diferente da turma de origem." },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: sourceTurma, error: sourceError } = await supabase
      .from("turmas")
      .select("id, escola_id, nome, ano_letivo")
      .eq("id", sourceTurmaId)
      .maybeSingle();

    if (sourceError || !sourceTurma) {
      return NextResponse.json({ ok: false, error: "Turma de origem não encontrada." }, { status: 404 });
    }

    const escolaId = sourceTurma.escola_id;
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: "WRITE",
    });
    if (academicContext.escolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }
    await assertAcademicYearEntity(supabase, {
      table: "turmas",
      entityId: sourceTurmaId,
      escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });
    await assertAcademicYearEntity(supabase, {
      table: "turmas",
      entityId: parsed.data.target_turma_id,
      escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const [{ data: targetTurma, error: targetError }, { data: sourceRows, error: matriculasError }] =
      await Promise.all([
        supabase
          .from("vw_turmas_para_matricula")
          .select("id, escola_id, turma_nome, ano_letivo, capacidade_maxima, ocupacao_atual")
          .eq("escola_id", escolaId)
          .eq("id", parsed.data.target_turma_id)
          .maybeSingle(),
        supabase
          .from("matriculas")
          .select("id, status")
          .eq("escola_id", escolaId)
          .eq("turma_id", sourceTurmaId)
          .in("status", [...ACTIVE_STATUSES]),
      ]);

    if (targetError || !targetTurma) {
      return NextResponse.json({ ok: false, error: "Turma destino não encontrada." }, { status: 404 });
    }

    if (Number(targetTurma.ano_letivo ?? sourceTurma.ano_letivo) !== Number(sourceTurma.ano_letivo)) {
      return NextResponse.json(
        { ok: false, error: "A transferência em massa exige turmas do mesmo ano letivo." },
        { status: 400 }
      );
    }

    if (matriculasError) {
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 400 });
    }

    const matriculasAtivas = sourceRows ?? [];
    // A sequência de RPCs não é uma transacção única. Bloquear a operação
    // antes de qualquer escrita até existir RPC de lote atómica e testada.
    return NextResponse.json({ ok: false, error: "Transferência em massa temporariamente indisponível: use a transferência individual para evitar alterações parciais." }, { status: 409 });


  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
