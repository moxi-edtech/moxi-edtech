import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  novo_status: z.string().min(3),
  motivo: z.string().optional(),
});

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola"] as const;

export async function POST(
  request: Request,
  { params }: { params: { matriculaId: string } }
) {
  try {
    const { matriculaId } = params;
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();

    // Authorization
    const { error: authError, resolvedEscolaId } = await requireRoleInSchool({
      supabase,
      escolaIdFrom: { table: 'matriculas', column: 'escola_id', id: matriculaId },
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    // Call RPC
    const { error: rpcError } = await supabase.rpc("finalizar_matricula_anual", {
      p_escola_id: resolvedEscolaId,
      p_matricula_id: matriculaId,
      p_novo_status: parsed.data.novo_status,
      p_motivo: parsed.data.motivo,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
