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

    const { error: authError, resolvedEscolaId } = await requireRoleInSchool({
      supabase,
      escolaIdFrom: { table: 'matriculas', column: 'escola_id', id: matriculaId },
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    if (matricula.turma_id === parsed.data.turma_id) {
      return NextResponse.json({ ok: false, error: "A turma destino deve ser diferente" }, { status: 400 });
    }
    
    const { data: result, error: rpcError } = await supabase
      .rpc('transferir_matricula', {
        p_escola_id: resolvedEscolaId,
        p_matricula_id: matriculaId,
        p_target_turma_id: parsed.data.turma_id,
      })
      .single();

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
