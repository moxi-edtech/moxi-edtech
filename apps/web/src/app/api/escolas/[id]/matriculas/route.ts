import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

type MatriculaRow = Database["public"]["Tables"]["matriculas"]["Row"];
type MatriculaWithRelations = MatriculaRow & {
  aluno: { id: string; nome: string; email: string | null } | null;
  turma: (Database["public"]["Tables"]["turmas"]["Row"] & {
    curso: Pick<Database["public"]["Tables"]["cursos"]["Row"], "id" | "nome" | "tipo"> | null;
    classe: Pick<Database["public"]["Tables"]["classes"]["Row"], "id" | "nome"> | null;
  }) | null;
};

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
      .from("matriculas")
      .select(
        `
        id,
        escola_id,
        ano_letivo_id,
        turma_id,
        aluno_id,
        status,
        created_at,
        aluno:alunos(id, nome, email),
        turma:turmas(id, nome, turno, ano_letivo, curso_id, classe_id,
          curso:cursos(id, nome, tipo),
          classe:classes(id, nome)
        )
      `
      )
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoLetivoId)
      .order("created_at", { ascending: false });

    if (scope === "pending") {
      query = query.is("turma_id", null);
    } else if (scope === "turma" && turmaId) {
      query = query.eq("turma_id", turmaId);
    }

    const { data, error } = await query.returns<MatriculaWithRelations[]>();

    if (error) {
      console.error("[matriculas:list]", error.message);
      return NextResponse.json({ ok: false, error: "Falha ao carregar matrículas" }, { status: 500 });
    }

    let rows = data || [];
    if (classeId) rows = rows.filter((row) => row.turma?.classe_id === classeId);
    if (courseId) rows = rows.filter((row) => row.turma?.curso_id === courseId);

    const total = rows.length;
    const pendentes = rows.filter((row) => row.turma_id === null).length;

    return NextResponse.json({
      ok: true,
      filters: { escolaId, anoLetivoId, classeId, courseId: courseId ?? null, scope, turmaId: turmaId ?? null },
      meta: { total, pendentes },
      matriculas: rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[matriculas:list] fatal", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
