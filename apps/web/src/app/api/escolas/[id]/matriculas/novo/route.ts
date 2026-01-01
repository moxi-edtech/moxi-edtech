import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditServer } from "@/lib/audit";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { hasPermission, type Papel } from "@/lib/permissions";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

// Schema validation
const BodySchema = z.object({
  aluno_id: z.string().uuid("aluno_id inválido"),
  ano_letivo_id: z.string().uuid("ano_letivo_id é obrigatório"),
  turma_id: z.string().uuid("turma_id inválido"),
  status: z.string().trim().default("ativa"),
});

type MatriculaInsert = Database["public"]["Tables"]["matriculas"]["Insert"];
type EscolaUserRow = Database["public"]["Tables"]["escola_users"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type EscolaRow = Database["public"]["Tables"]["escolas"]["Row"];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const supabase = await supabaseServerTyped<Database>();

    // 1. Authentication
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // 2. Parse Body
    const json = await req.json();
    const parse = BodySchema.safeParse(json);
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const body = parse.data;

    // 3. Authorization (Permissions)
    const authz = await authorizeEscolaAction(supabase as any, escolaId, userId, ['criar_matricula']);
    if (!authz.allowed)
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    // 4. Validate School Status
    const { data: profCheck } = await supabase
      .from("profiles")
      .select("escola_id")
      .eq("user_id", userId)
      .maybeSingle()
      .returns<Pick<ProfileRow, "escola_id"> | null>();
    if (!profCheck || String(profCheck.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Usuário não pertence à escola" }, { status: 403 });
    }

    const { data: esc } = await supabase
      .from("escolas")
      .select("status")
      .eq("id", escolaId)
      .limit(1)
      .maybeSingle();
    if (esc?.status === "excluida")
      return NextResponse.json({ ok: false, error: "Escola excluída não permite criar matrículas." }, { status: 400 });
    if (esc?.status === "suspensa")
      return NextResponse.json({ ok: false, error: "Escola suspensa. Regularize pagamentos." }, { status: 400 });

    // 4.1 Validar ano_letivo_id pertence à escola
    const { data: anoRow, error: anoErr } = await supabase
      .from("anos_letivos")
      .select("id, escola_id, ano")
      .eq("id", body.ano_letivo_id)
      .maybeSingle();
    if (anoErr || !anoRow || String(anoRow.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Ano letivo inválido para esta escola" }, { status: 400 });
    }

    // 4.2 Validar turma pertence à escola (e opcionalmente ao mesmo ano)
    const { data: turmaRow, error: turmaErr } = await supabase
      .from("turmas")
      .select("id, escola_id, ano_letivo")
      .eq("id", body.turma_id)
      .maybeSingle();
    if (turmaErr || !turmaRow || String(turmaRow.escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Turma inválida para esta escola" }, { status: 400 });
    }

    const insertPayload: MatriculaInsert = {
      escola_id: escolaId,
      aluno_id: body.aluno_id,
      ano_letivo_id: body.ano_letivo_id,
      turma_id: body.turma_id,
      status: body.status ?? "ativa",
    } as any;

    // Preenche ano_letivo numérico se a coluna existir no schema
    const anoLetivoInt = Number(anoRow.ano);
    if (Number.isFinite(anoLetivoInt)) (insertPayload as any).ano_letivo = anoLetivoInt;

    const { data: created, error: insertError } = await supabase
      .from("matriculas")
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (insertError || !created) {
      return NextResponse.json({ ok: false, error: "Falha ao criar matrícula" }, { status: 400 });
    }

    await recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "criar_matricula",
      entity: "matriculas",
      entityId: created.id,
      details: {
        anoLetivo: anoLetivoInt,
        turmaId: body.turma_id,
      },
    });

    return NextResponse.json({ ok: true, matricula: created });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[matriculas:novo]", error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
