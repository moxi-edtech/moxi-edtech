import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  motivo: z.string().trim().min(10).max(300),
  ano_letivo_id: z.string().uuid(),
});

// Must exactly match the role contract enforced by the SECURITY DEFINER RPC.
const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;

export async function PUT(request: Request, { params }: { params: Promise<{ matriculaId: string }> }) {
  try {
    const { matriculaId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // 1. Get escola_id from matricula
    const { data: matriculaData, error: matriculaError } = await supabase
      .from('matriculas')
      .select('escola_id, turma_id')
      .eq('id', matriculaId)
      .single();

    if (matriculaError || !matriculaData) {
      return NextResponse.json({ ok: false, error: 'Matrícula não encontrada.' }, { status: 404 });
    }

    const escolaId = matriculaData.escola_id;

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: "WRITE",
    });
    if (academicContext.escolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }
    await assertAcademicYearEntity(supabase, {
      table: "matriculas",
      entityId: matriculaId,
      escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });
    await assertAcademicYearEntity(supabase, {
      table: "turmas",
      entityId: parsed.data.turma_id,
      escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });

    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId
    );
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    // 2. Authorization (check role in that school)
    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId, // Pass the already resolved escolaId
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    if (matriculaData.turma_id === parsed.data.turma_id) {
      return NextResponse.json({ ok: false, error: "A turma destino deve ser diferente" }, { status: 400 });
    }
    
    const { data: newMatriculaId, error: rpcError } = await supabase
      .rpc('transferir_aluno_turma', {
        p_matricula_origem_id: matriculaId,
        p_turma_destino_id: parsed.data.turma_id,
        p_motivo: parsed.data.motivo,
      });

    if (rpcError) {
      const academicEvidence = rpcError.code === "P1050";
      return NextResponse.json({
        ok: false,
        code: academicEvidence ? "TRANSFER_ACADEMIC_RECONCILIATION_REQUIRED" : rpcError.code,
        error: academicEvidence
          ? "Há histórico académico, pautas ou decisões da turma de origem. A transferência exige conciliação temporal; os registos não foram alterados."
          : rpcError.message,
      }, { status: academicEvidence ? 409 : 400 });
    }

    if (typeof newMatriculaId !== "string" || !z.string().uuid().safeParse(newMatriculaId).success) {
      return NextResponse.json({ ok: false, error: 'Formato de resposta inesperado do RPC.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, matricula_id: newMatriculaId });
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
