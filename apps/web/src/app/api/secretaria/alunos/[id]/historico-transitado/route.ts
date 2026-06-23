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

const QuerySchema = z.object({
  classe_id: z.string().uuid().optional(),
  ano_letivo: z.coerce.number().int().min(1900).max(2100).optional(),
});

const BodySchema = z.object({
  classe_id: z.string().uuid(),
  ano_letivo: z.number().int().min(1900).max(2100),
  notas: z
    .array(
      z.object({
        disciplina_id: z.string().uuid(),
        disciplina_nome: z.string().min(1),
        ordem: z.number().int().nullable().optional(),
        nota_final: z.number().min(0).max(20),
      }),
    )
    .min(1, "Pelo menos uma nota é obrigatória."),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function resolveRouteContext(alunoId: string) {
  const supabase = await supabaseServerTyped<any>();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
    };
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 }),
    };
  }

  const roleCheck = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["admin", "admin_escola", "secretaria", "secretaria_financeiro", "staff_admin", "admin_financeiro"],
  });
  if (roleCheck.error) {
    return {
      ok: false as const,
      response: roleCheck.error,
    };
  }

  const { data: alunoRow, error: alunoError } = await supabase
    .from("alunos")
    .select("id")
    .eq("id", alunoId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (alunoError || !alunoRow?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Aluno não encontrado" }, { status: 404 }),
    };
  }

  return {
    ok: true as const,
    supabase,
    escolaId,
  };
}

function sortNotas(rows: any[]) {
  return [...rows].sort((left, right) => {
    const leftOrdem = typeof left?.ordem === "number" ? left.ordem : Number.MAX_SAFE_INTEGER;
    const rightOrdem = typeof right?.ordem === "number" ? right.ordem : Number.MAX_SAFE_INTEGER;
    if (leftOrdem !== rightOrdem) return leftOrdem - rightOrdem;
    return String(left?.disciplina_nome ?? "").localeCompare(String(right?.disciplina_nome ?? ""), "pt");
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = ParamsSchema.safeParse(await context.params);
    if (!params.success) {
      return NextResponse.json({ ok: false, error: params.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
    }

    const parsedQuery = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsedQuery.success) {
      return NextResponse.json({ ok: false, error: parsedQuery.error.issues[0]?.message ?? "Query inválida" }, { status: 400 });
    }

    const routeContext = await resolveRouteContext(params.data.id);
    if (!routeContext.ok) return routeContext.response;

    const { supabase, escolaId } = routeContext;
    const { classe_id: classeId, ano_letivo: anoLetivo } = parsedQuery.data;

    const [classesRes, recordsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id, nome, numero, curso_id")
        .eq("escola_id", escolaId)
        .order("numero", { ascending: true, nullsFirst: false })
        .order("nome", { ascending: true }),
      supabase
        .from("historico_transitado_anos")
        .select(
          `
            id,
            classe_id,
            classe_nome,
            curso_id,
            curso_nome,
            ano_letivo,
            created_at,
            updated_at,
            notas:historico_transitado_notas (
              id,
              disciplina_id,
              disciplina_nome,
              ordem,
              nota_final
            )
          `,
        )
        .eq("escola_id", escolaId)
        .eq("aluno_id", params.data.id)
        .order("ano_letivo", { ascending: false })
        .order("updated_at", { ascending: false }),
    ]);

    if (classesRes.error) {
      return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 400 });
    }

    if (recordsRes.error) {
      return NextResponse.json({ ok: false, error: recordsRes.error.message }, { status: 400 });
    }

    const classes = (classesRes.data ?? []).map((row: any) => ({
      id: row.id as string,
      nome: row.nome as string,
      numero: typeof row.numero === "number" ? row.numero : null,
      curso_id: (row.curso_id as string | null) ?? null,
    }));

    const records = (recordsRes.data ?? []).map((row: any) => ({
      id: row.id as string,
      classe_id: row.classe_id as string,
      classe_nome: row.classe_nome as string,
      curso_id: (row.curso_id as string | null) ?? null,
      curso_nome: (row.curso_nome as string | null) ?? null,
      ano_letivo: Number(row.ano_letivo),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      notas: sortNotas(Array.isArray(row.notas) ? row.notas : []).map((nota: any) => ({
        id: nota.id as string,
        disciplina_id: nota.disciplina_id as string,
        disciplina_nome: nota.disciplina_nome as string,
        ordem: typeof nota.ordem === "number" ? nota.ordem : null,
        nota_final: typeof nota.nota_final === "number" ? nota.nota_final : Number(nota.nota_final),
      })),
    }));

    let editor: null | {
      classe_id: string;
      classe_nome: string;
      ano_letivo: number;
      disciplinas: Array<{
        disciplina_id: string;
        disciplina_nome: string;
        ordem: number | null;
        nota_final: number | null;
      }>;
    } = null;

    if (classeId && typeof anoLetivo === "number") {
      const classeSelecionada = classes.find((item) => item.id === classeId);
      if (!classeSelecionada) {
        return NextResponse.json({ ok: false, error: "Classe inválida para esta escola." }, { status: 404 });
      }

      let matrizQuery = supabase
        .from("curso_matriz")
        .select(
          `
            disciplina_id,
            ordem,
            obrigatoria,
            disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey (
              id,
              nome
            )
          `,
        )
        .eq("escola_id", escolaId)
        .eq("classe_id", classeId)
        .order("ordem", { ascending: true, nullsFirst: false });

      if (classeSelecionada.curso_id) {
        matrizQuery = matrizQuery.eq("curso_id", classeSelecionada.curso_id);
      }

      const { data: matrizRows, error: matrizError } = await matrizQuery;
      if (matrizError) {
        return NextResponse.json({ ok: false, error: matrizError.message }, { status: 400 });
      }

      const obrigatorias = (matrizRows ?? []).filter((row: any) => row.obrigatoria !== false);
      const sourceRows = obrigatorias.length > 0 ? obrigatorias : matrizRows ?? [];
      const existingRecord = records.find((item) => item.classe_id === classeId && item.ano_letivo === anoLetivo) ?? null;
      const existingMap = new Map(
        (existingRecord?.notas ?? []).map((nota) => [nota.disciplina_id, nota]),
      );

      editor = {
        classe_id: classeId,
        classe_nome: classeSelecionada.nome,
        ano_letivo: anoLetivo,
        disciplinas: sourceRows.map((row: any) => {
          const disciplinaId = row.disciplina_id as string;
          const existing = existingMap.get(disciplinaId);
          return {
            disciplina_id: disciplinaId,
            disciplina_nome: row.disciplina?.nome ?? existing?.disciplina_nome ?? "Disciplina",
            ordem: typeof row.ordem === "number" ? row.ordem : existing?.ordem ?? null,
            nota_final: existing?.nota_final ?? null,
          };
        }),
      };
    }

    return NextResponse.json({
      ok: true,
      aluno_id: params.data.id,
      classes,
      records,
      editor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = ParamsSchema.safeParse(await context.params);
    if (!params.success) {
      return NextResponse.json({ ok: false, error: params.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
    }

    const parsedBody = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: parsedBody.error.flatten() }, { status: 400 });
    }

    const routeContext = await resolveRouteContext(params.data.id);
    if (!routeContext.ok) return routeContext.response;

    const { supabase, escolaId } = routeContext;
    const { classe_id, ano_letivo, notas } = parsedBody.data;

    const { data, error } = await supabase.rpc("upsert_historico_transitado", {
      p_escola_id: escolaId,
      p_aluno_id: params.data.id,
      p_classe_id: classe_id,
      p_ano_letivo: ano_letivo,
      p_notas: notas,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
