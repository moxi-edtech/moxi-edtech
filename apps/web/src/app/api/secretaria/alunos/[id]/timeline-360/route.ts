import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";
import { carregarCicloVidaAluno } from "@/lib/matriculas/load-student-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ParamsSchema = z.object({
  id: z.string().uuid("alunoId inválido"),
});

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
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

    const requestedEscolaId = new URL(req.url).searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const roleCheck = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_ADMIN_SECRETARIA_ROLE_GROUP, "secretaria_financeiro"],
    });
    if (roleCheck.error) return roleCheck.error;

    // A RPC é SECURITY DEFINER: confirmar a identidade do aluno na escola autorizada
    // antes de a invocar, mesmo quando o operador pertence a várias escolas.
    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .select("id")
      .eq("id", params.data.id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (alunoError) return NextResponse.json({ ok: false, error: "Falha ao confirmar a escola do aluno." }, { status: 500 });
    if (!aluno) return NextResponse.json({ ok: false, error: "Aluno não encontrado nesta escola." }, { status: 404 });

    const { data, error } = await supabase.rpc("get_aluno_timeline_360", {
      p_escola_id: escolaId,
      p_aluno_id: params.data.id,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const cicloVida = await carregarCicloVidaAluno(supabase, escolaId, params.data.id).catch(() => null);
    return NextResponse.json({
      ok: true,
      cicloVida,
      cicloVidaIndisponivel: cicloVida === null,
      aluno_id: params.data.id,
      timeline: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
