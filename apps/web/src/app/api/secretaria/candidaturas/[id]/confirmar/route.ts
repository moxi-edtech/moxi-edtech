import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

const BodySchema = z.object({
  turma_id: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  try {
    const { id } = await params;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { turma_id } = parsed.data;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: candidatura, error: candErr } = await supabase
      .from("candidaturas")
      .select("id, escola_id, status, dados_candidato")
      .eq("id", id)
      .maybeSingle();

    if (candErr) {
      return NextResponse.json({ ok: false, error: candErr.message }, { status: 400 });
    }
    if (!candidatura) {
      return NextResponse.json({ ok: false, error: "Candidatura não encontrada" }, { status: 404 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, candidatura.escola_id);
    if (!escolaId || escolaId !== candidatura.escola_id) {
      return NextResponse.json({ ok: false, error: "Sem vínculo com a escola" }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: candidatura.escola_id,
      roles: ["secretaria", "admin", "admin_escola", "staff_admin", "financeiro"],
    });
    if (authError) return authError;

    const { data: result, error: finalizarErr } = await (supabase as any).rpc(
      "admissao_finalizar_matricula",
      {
        p_escola_id: candidatura.escola_id,
        p_candidatura_id: id,
        p_turma_id: turma_id,
        p_pagamento: { origem: "legacy_confirmar_route" },
        p_idempotency_key: `legacy-confirmar:${id}:${turma_id}`,
        p_observacao: "Finalização via rota legada de confirmação",
      }
    );

    if (finalizarErr) {
      return NextResponse.json({ ok: false, error: finalizarErr.message }, { status: 400 });
    }

    const data = (result && typeof result === "object" ? result : {}) as {
      matricula_id?: string | null;
      numero_matricula?: string | null;
    };
    const matriculaId = data.matricula_id ?? null;

    const { data: matricula } = matriculaId
      ? await supabase
          .from("matriculas")
          .select("id, numero_matricula")
          .eq("id", matriculaId)
          .eq("escola_id", candidatura.escola_id)
          .maybeSingle()
      : { data: null };

    return NextResponse.json(
      {
        ok: true,
        matricula_id: matriculaId,
        numero_matricula: matricula?.numero_matricula ?? data.numero_matricula ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
