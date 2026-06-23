import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DBWithRPC } from "@/types/supabase-augment";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  turmaId: z.string().uuid("O campo turmaId deve ser um UUID válido"),
  trimestre: z.preprocess((val) => Number(val), z.number().int().min(1).max(3)),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = {
      turmaId: url.searchParams.get("turmaId"),
      trimestre: url.searchParams.get("trimestre"),
    };

    const parsed = QuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Parâmetros inválidos" },
        { status: 400 }
      );
    }

    const { turmaId, trimestre } = parsed.data;

    const supabase = await supabaseServerTyped<DBWithRPC>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    // Permitir acesso apenas para gestores escolares (admin, secretaria, etc.)
    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [
        "admin",
        "admin_escola",
        "staff_admin",
        "secretaria",
        "financeiro",
        "admin_financeiro",
        "secretaria_financeiro",
      ],
    });
    if (roleError) return roleError;

    // 1. Obter a Prontidão de Lançamento de Notas por Turma
    const { data: prontidao, error: prontidaoError } = await supabase.rpc(
      "get_pedagogico_prontidao_lancamentos",
      {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_trimestre: trimestre,
      }
    );

    if (prontidaoError) throw prontidaoError;

    // 2. Detetor de Notas em Falta (Missing Flags)
    const { data: pendentes, error: pendentesError } = await supabase.rpc(
      "get_turma_notas_pendentes_detalhe",
      {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_trimestre: trimestre,
      }
    );

    if (pendentesError) throw pendentesError;

    // 3. Simulador de Conselho de Turma (Alunos em Risco - Média < 10)
    const { data: alunosRisco, error: alunosRiscoError } = await supabase.rpc(
      "get_conselho_turma_risco",
      {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_trimestre: trimestre,
      }
    );

    if (alunosRiscoError) throw alunosRiscoError;

    return NextResponse.json({
      ok: true,
      data: {
        prontidao: prontidao || [],
        pendentes: pendentes || [],
        alunosRisco: alunosRisco || [],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro no fetch do cockpit pedagógico:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
