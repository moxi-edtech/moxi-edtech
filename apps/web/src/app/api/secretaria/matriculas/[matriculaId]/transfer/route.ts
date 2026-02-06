import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  turma_id: z.string().uuid(),
});

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
    
    const { data: result, error: rpcError } = await supabase
      .rpc('transferir_matricula', {
        p_escola_id: escolaId,
        p_matricula_id: matriculaId,
        p_target_turma_id: parsed.data.turma_id,
      })
      .single();

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    if (!result || typeof result !== 'object') {
      return NextResponse.json({ ok: false, error: 'Formato de resposta inesperado do RPC.' }, { status: 500 });
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "MATRICULA_TRANSFERIDA",
      entity: "matriculas",
      entityId: matriculaId,
      details: { turma_origem: matriculaData.turma_id, turma_destino: parsed.data.turma_id },
    }).catch(() => null);

    return NextResponse.json({ ok: true, ...(result as object) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
