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

    const { data: turma, error: turmaErr } = await supabase
      .from("turmas")
      .select("id, escola_id, curso_id, classe_id, ano_letivo, turno")
      .eq("id", turma_id)
      .eq("escola_id", candidatura.escola_id)
      .maybeSingle();

    if (turmaErr) {
      return NextResponse.json({ ok: false, error: turmaErr.message }, { status: 400 });
    }
    if (!turma) {
      return NextResponse.json(
        { ok: false, error: "Turma não pertence à escola" },
        { status: 400 }
      );
    }
    if (!turma.curso_id || !turma.ano_letivo) {
      return NextResponse.json(
        { ok: false, error: "Turma incompleta: curso ou ano letivo não configurado." },
        { status: 400 }
      );
    }

    const status = String(candidatura.status ?? "").toLowerCase();
    const rawDados = (candidatura as any)?.dados_candidato;
    const currentDados =
      rawDados && typeof rawDados === "object" && !Array.isArray(rawDados) ? rawDados : {};
    const mergedDados = {
      ...currentDados,
      curso_id: turma.curso_id,
      classe_id: turma.classe_id ?? null,
      turma_preferencial_id: turma.id,
      ano_letivo: turma.ano_letivo,
      turno: turma.turno ?? currentDados?.turno ?? null,
    };

    const { error: syncErr } = await supabase
      .from("candidaturas")
      .update({
        curso_id: turma.curso_id,
        classe_id: turma.classe_id ?? null,
        turma_preferencial_id: turma.id,
        ano_letivo: turma.ano_letivo,
        turno: turma.turno ?? null,
        dados_candidato: mergedDados,
      } as any)
      .eq("id", id)
      .eq("escola_id", candidatura.escola_id);

    if (syncErr) {
      return NextResponse.json({ ok: false, error: syncErr.message }, { status: 400 });
    }

    if (status === "rascunho") {
      const { error: submitErr } = await supabase.rpc("admissao_submit", {
        p_escola_id: candidatura.escola_id,
        p_candidatura_id: id,
        p_source: "walkin",
      });

      if (submitErr) {
        return NextResponse.json({ ok: false, error: submitErr.message }, { status: 400 });
      }
    }

    if (["pendente", "submetida", "em_analise"].includes(status)) {
      const { error: approveErr } = await supabase.rpc("admissao_approve", {
        p_escola_id: candidatura.escola_id,
        p_candidatura_id: id,
        p_observacao: "Aprovação automática via rota legada de confirmação",
      });

      if (approveErr) {
        return NextResponse.json({ ok: false, error: approveErr.message }, { status: 400 });
      }
    }

    if (status === "rascunho") {
      const { error: approveErr } = await supabase.rpc("admissao_approve", {
        p_escola_id: candidatura.escola_id,
        p_candidatura_id: id,
        p_observacao: "Aprovação automática via rota legada de confirmação",
      });

      if (approveErr) {
        return NextResponse.json({ ok: false, error: approveErr.message }, { status: 400 });
      }
    }

    const { data: matriculaId, error: convertErr } = await supabase.rpc(
      "admissao_convert_to_matricula",
      {
        p_escola_id: candidatura.escola_id,
        p_candidatura_id: id,
        p_metadata: {
          turma_id,
          origem: "legacy_confirmar_route",
        },
      }
    );

    if (convertErr) {
      return NextResponse.json({ ok: false, error: convertErr.message }, { status: 400 });
    }

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("id, numero_matricula")
      .eq("id", matriculaId)
      .eq("escola_id", candidatura.escola_id)
      .maybeSingle();

    return NextResponse.json(
      {
        ok: true,
        matricula_id: matriculaId,
        numero_matricula: matricula?.numero_matricula ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
