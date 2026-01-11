import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { applyKf2ListInvariants } from "@/lib/kf2";

const querySchema = z
  .object({
    anoLetivoId: z.string().min(1, "anoLetivoId é obrigatório"),
    classeId: z.string().min(1).optional(),
    courseId: z.string().min(1).optional(),
    turmaId: z.string().min(1).optional(),
    scope: z.enum(["all", "pending", "turma"]).default("all"),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "turma" && !value.turmaId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "turmaId é obrigatório quando scope=turma" });
    }
  });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;

  try {
    const searchParams = req.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      anoLetivoId: searchParams.get("anoLetivoId"),
      classeId: searchParams.get("classeId") || undefined,
      courseId: searchParams.get("courseId") || undefined,
      turmaId: searchParams.get("turmaId") || undefined,
      scope: (searchParams.get("scope") as "all" | "pending" | "turma" | null) ?? undefined,
    });

    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Parâmetros inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const { anoLetivoId, classeId, courseId, turmaId, scope } = parsed.data;

    const supabase = await supabaseServerTyped<Database>();

    let query = supabase
      .from('vw_matriculas_validas')
      .select(
        `
        id,
        escola_id,
        aluno_id,
        aluno_nome,
        numero_matricula,
        numero_chamada,
        ano_letivo,
        ano_letivo_id,
        turma_id,
        turma_nome,
        turno,
        sala,
        classe_id,
        classe_nome,
        curso_id,
        curso_nome,
        curso_tipo,
        status,
        created_at
      `
      )
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoLetivoId)
      .order("created_at", { ascending: false });

    query = applyKf2ListInvariants(query, { defaultLimit: 200 });

    if (scope === "pending") {
      return NextResponse.json({ ok: true, filters: { anoLetivoId, classeId, courseId, scope, turmaId: turmaId ?? null }, meta: { total: 0, pendentes: 0 }, matriculas: [] });
    } else if (scope === "turma" && turmaId) {
      query = query.eq("turma_id", turmaId);
    }

    if (classeId) query = query.eq('classe_id', classeId);
    if (courseId) query = query.eq('curso_id', courseId);

    const { data, error } = await query;

    if (error) {
      console.error("[matriculas:list]", error.message);
      return NextResponse.json({ ok: false, error: "Falha ao carregar matrículas" }, { status: 500 });
    }

    const rows = data || [];
    const total = rows.length;
    const pendentes = 0;

    const matriculas = rows.map((row: any) => ({
      id: row.id,
      escola_id: row.escola_id,
      ano_letivo_id: row.ano_letivo_id,
      turma_id: row.turma_id,
      aluno_id: row.aluno_id,
      status: row.status ?? 'ativa',
      created_at: row.created_at,
      numero_matricula: row.numero_matricula,
      numero_chamada: row.numero_chamada,
      aluno: row.aluno_id
        ? { id: row.aluno_id, nome: row.aluno_nome, email: null }
        : null,
      turma: row.turma_id
        ? {
            id: row.turma_id,
            nome: row.turma_nome,
            turno: row.turno,
            sala: row.sala,
            ano_letivo: row.ano_letivo,
            curso: row.curso_id ? { id: row.curso_id, nome: row.curso_nome, tipo: row.curso_tipo } : null,
            classe: row.classe_id ? { id: row.classe_id, nome: row.classe_nome } : null,
          }
        : null,
    }));

    return NextResponse.json({
      ok: true,
      filters: { escolaId, anoLetivoId, classeId, courseId: courseId ?? null, scope, turmaId: turmaId ?? null },
      meta: { total, pendentes },
      matriculas,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[matriculas:list] fatal", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
