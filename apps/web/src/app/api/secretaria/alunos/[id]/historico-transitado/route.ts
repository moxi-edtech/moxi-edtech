import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ParamsSchema = z.object({
  id: z.string().uuid("alunoId inválido"),
});

const QuerySchema = z.object({
  classe_id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid().optional(),
});

const BodySchema = z.object({
  classe_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
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
    roles: [...K12_ADMIN_SECRETARIA_ROLE_GROUP, "secretaria_financeiro"],
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

function uniqueDisciplinasById(rows: any[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const disciplinaId = typeof row?.disciplina_id === "string" ? row.disciplina_id : null;
    if (!disciplinaId || seen.has(disciplinaId)) return false;
    seen.add(disciplinaId);
    return true;
  });
}

async function resolveAlunoClasseIds({
  supabase,
  escolaId,
  alunoId,
  historicalClasseIds = [],
}: {
  supabase: any;
  escolaId: string;
  alunoId: string;
  historicalClasseIds?: string[];
}) {
  const { data: matriculas, error } = await supabase
    .from("matriculas")
    .select("turmas!inner(classe_id)")
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .not("turma_id", "is", null);

  if (error) return { classeIds: [] as string[], error };

  const classeIds = new Set<string>(historicalClasseIds.filter(Boolean));
  for (const matricula of matriculas ?? []) {
    const classeId = matricula?.turmas?.classe_id;
    if (typeof classeId === "string") classeIds.add(classeId);
  }

  return { classeIds: [...classeIds], error: null };
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
    const { classe_id: classeId, ano_letivo_id: anoLetivoId } = parsedQuery.data;

    const [sessionsRes, recordsRes] = await Promise.all([
      supabase
        .from("anos_letivos")
        .select("id, ano, ativo, data_inicio, data_fim")
        .eq("escola_id", escolaId)
        .order("data_inicio", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true }),
      supabase
        .from("historico_transitado_anos")
        .select(
          `
            id,
            classe_id,
            classe_nome,
            curso_id,
            curso_nome,
            ano_letivo_id,
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
        .order("ano_letivo_id", { ascending: false })
        .order("updated_at", { ascending: false }),
    ]);

    if (recordsRes.error) {
      return NextResponse.json({ ok: false, error: recordsRes.error.message }, { status: 400 });
    }

    if (sessionsRes.error) {
      return NextResponse.json({ ok: false, error: sessionsRes.error.message }, { status: 400 });
    }

    const academicYears = (sessionsRes.data ?? []).map((row: any) => {
      const startYear = row.data_inicio ? new Date(row.data_inicio).getUTCFullYear() : Number(row.ano);
      const endYear = row.data_fim ? new Date(row.data_fim).getUTCFullYear() : startYear + 1;
      return {
        id: row.id as string,
        ano: Number(row.ano),
        label: `${startYear}/${endYear}`,
        ativo: Boolean(row.ativo),
        data_inicio: row.data_inicio as string | null,
        data_fim: row.data_fim as string | null,
      };
    });

    const records = (recordsRes.data ?? []).map((row: any) => ({
      id: row.id as string,
      classe_id: row.classe_id as string,
      classe_nome: row.classe_nome as string,
      curso_id: (row.curso_id as string | null) ?? null,
      curso_nome: (row.curso_nome as string | null) ?? null,
      ano_letivo_id: row.ano_letivo_id as string,
      ano_letivo: Number(row.ano_letivo),
      ano_letivo_label:
        academicYears.find((item) => item.id === row.ano_letivo_id)?.label ?? `Ano letivo ${row.ano_letivo}`,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      notas: sortNotas(uniqueDisciplinasById(Array.isArray(row.notas) ? row.notas : [])).map((nota: any) => ({
        id: nota.id as string,
        disciplina_id: nota.disciplina_id as string,
        disciplina_nome: nota.disciplina_nome as string,
        ordem: typeof nota.ordem === "number" ? nota.ordem : null,
        nota_final: typeof nota.nota_final === "number" ? nota.nota_final : Number(nota.nota_final),
      })),
    }));

    const classeResolution = await resolveAlunoClasseIds({
      supabase,
      escolaId,
      alunoId: params.data.id,
      historicalClasseIds: records.map((record) => record.classe_id),
    });
    if (classeResolution.error) {
      return NextResponse.json({ ok: false, error: classeResolution.error.message }, { status: 400 });
    }

    const classesRes = classeResolution.classeIds.length
      ? await supabase
          .from("classes")
          .select("id, nome, numero, curso_id")
          .eq("escola_id", escolaId)
          .in("id", classeResolution.classeIds)
          .order("numero", { ascending: true, nullsFirst: false })
          .order("nome", { ascending: true })
      : { data: [], error: null };

    if (classesRes.error) {
      return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 400 });
    }

    const classes = (classesRes.data ?? []).map((row: any) => ({
      id: row.id as string,
      nome: row.nome as string,
      numero: typeof row.numero === "number" ? row.numero : null,
      curso_id: (row.curso_id as string | null) ?? null,
    }));

    let editor: null | {
      classe_id: string;
      classe_nome: string;
      ano_letivo_id: string;
      ano_letivo_label: string;
      disciplinas: Array<{
        disciplina_id: string;
        disciplina_nome: string;
        ordem: number | null;
        nota_final: number | null;
      }>;
    } = null;

    if (classeId && anoLetivoId) {
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
      const sourceRows = uniqueDisciplinasById(obrigatorias.length > 0 ? obrigatorias : matrizRows ?? []);
      const academicYear = academicYears.find((item) => item.id === anoLetivoId);
      if (!academicYear) {
        return NextResponse.json({ ok: false, error: "Ano letivo inválido para esta escola." }, { status: 404 });
      }
      const existingRecord = records.find((item) => item.classe_id === classeId && item.ano_letivo_id === anoLetivoId) ?? null;
      const existingMap = new Map(
        (existingRecord?.notas ?? []).map((nota) => [nota.disciplina_id, nota]),
      );

      editor = {
        classe_id: classeId,
        classe_nome: classeSelecionada.nome,
        ano_letivo_id: academicYear.id,
        ano_letivo_label: academicYear.label,
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
      academic_years: academicYears,
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
    const notaIds = parsedBody.data.notas.map((nota) => nota.disciplina_id);
    if (new Set(notaIds).size !== notaIds.length) {
      return NextResponse.json(
        { ok: false, error: "Não é permitido guardar a mesma disciplina mais de uma vez." },
        { status: 400 },
      );
    }

    const routeContext = await resolveRouteContext(params.data.id);
    if (!routeContext.ok) return routeContext.response;

    const { supabase, escolaId } = routeContext;
    const { classe_id, ano_letivo_id, notas } = parsedBody.data;

    const { data: historicalRecords, error: historicalRecordsError } = await supabase
      .from("historico_transitado_anos")
      .select("classe_id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", params.data.id);
    if (historicalRecordsError) {
      return NextResponse.json({ ok: false, error: historicalRecordsError.message }, { status: 400 });
    }

    const classeResolution = await resolveAlunoClasseIds({
      supabase,
      escolaId,
      alunoId: params.data.id,
      historicalClasseIds: (historicalRecords ?? []).map((record: any) => record.classe_id),
    });
    if (classeResolution.error) {
      return NextResponse.json({ ok: false, error: classeResolution.error.message }, { status: 400 });
    }
    if (!classeResolution.classeIds.includes(classe_id)) {
      return NextResponse.json(
        { ok: false, error: "A classe selecionada não está vinculada ao histórico deste aluno." },
        { status: 400 },
      );
    }

    const { data: academicYear, error: academicYearError } = await supabase
      .from("anos_letivos")
      .select("id, ano")
      .eq("id", ano_letivo_id)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (academicYearError || !academicYear) {
      return NextResponse.json({ ok: false, error: "Ano letivo inválido para esta escola." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("upsert_historico_transitado", {
      p_escola_id: escolaId,
      p_aluno_id: params.data.id,
      p_classe_id: classe_id,
      p_ano_letivo: Number(academicYear.ano),
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
