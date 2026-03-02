import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  turma_origem_id: z.string().uuid(),
  turma_destino_id: z.string().uuid(),
  ano_letivo_origem: z.number().int(),
  ano_letivo_destino: z.number().int(),
  aluno_ids: z.array(z.string().uuid()).min(1),
});

const ALLOWED_ROLES = ["secretaria", "admin", "admin_escola", "staff_admin"] as const;

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: turmaOrigem, error: turmaError } = await supabase
      .from("turmas")
      .select("escola_id")
      .eq("id", parsed.data.turma_origem_id)
      .single();

    if (turmaError || !turmaOrigem?.escola_id) {
      return NextResponse.json({ ok: false, error: "Turma de origem não encontrada." }, { status: 404 });
    }

    const escolaId = turmaOrigem.escola_id as string;
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...ALLOWED_ROLES],
    });
    if (authError) return authError;

    const { data: result, error: rpcError } = await supabase.rpc("fn_transitar_alunos", {
      p_escola_id: escolaId,
      p_turma_origem_id: parsed.data.turma_origem_id,
      p_turma_destino_id: parsed.data.turma_destino_id,
      p_ano_letivo_origem: parsed.data.ano_letivo_origem,
      p_ano_letivo_dest: parsed.data.ano_letivo_destino,
      p_aluno_ids: parsed.data.aluno_ids,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    const rows = Array.isArray(result) ? result : [];
    const sucesso = rows.filter((row: any) => row?.sucesso === true).length;
    const falhas = rows.length - sucesso;

    return NextResponse.json({
      ok: true,
      total: rows.length,
      sucesso,
      falhas,
      resultados: rows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
