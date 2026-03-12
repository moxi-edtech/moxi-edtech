import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ParamsSchema = z.object({
  id: z.string().uuid("alunoId inválido"),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = ParamsSchema.safeParse(await context.params);
    if (!params.success) {
      return NextResponse.json({ ok: false, error: params.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const roleCheck = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["admin", "admin_escola", "secretaria", "staff_admin"],
    });
    if (roleCheck.error) return roleCheck.error;

    const { data, error } = await supabase.rpc("get_aluno_timeline_360", {
      p_escola_id: escolaId,
      p_aluno_id: params.data.id,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      aluno_id: params.data.id,
      timeline: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
