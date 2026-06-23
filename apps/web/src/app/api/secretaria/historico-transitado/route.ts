import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { ACTIVE_MATRICULA_STATUSES } from "@/lib/matriculas/status";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const QuerySchema = z.object({
  turma_id: z.string().uuid().optional(),
  classe_id: z.string().uuid().optional(),
  ano_letivo: z.coerce.number().int().min(1900).max(2100).optional(),
});

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  classe_id: z.string().uuid(),
  ano_letivo: z.number().int().min(1900).max(2100),
  registros: z
    .array(
      z.object({
        aluno_id: z.string().uuid(),
        notas: z
          .array(
            z.object({
              disciplina_id: z.string().uuid(),
              disciplina_nome: z.string().min(1),
              ordem: z.number().int().nullable().optional(),
              nota_final: z.number().min(0).max(20),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

async function resolveRouteContext() {
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

  return {
    ok: true as const,
    supabase,
    escolaId,
  };
}

function sortDisciplinas(rows: any[]) {
  return [...rows].sort((left, right) => {
    const leftOrdem = typeof left?.ordem === "number" ? left.ordem : Number.MAX_SAFE_INTEGER;
    const rightOrdem = typeof right?.ordem === "number" ? right.ordem : Number.MAX_SAFE_INTEGER;
    if (leftOrdem !== rightOrdem) return leftOrdem - rightOrdem;
    return String(left?.disciplina?.nome ?? "").localeCompare(String(right?.disciplina?.nome ?? ""), "pt");
  });
}

export async function GET(request: Request) {
  try {
    const routeContext = await resolveRouteContext();
    if (!routeContext.ok) return routeContext.response;

    const { supabase, escolaId } = routeContext;
    const query = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!query.success) {
      return NextResponse.json({ ok: false, error: query.error.issues[0]?.message ?? "Query inválida" }, { status: 400 });
    }

    const [turmasRes, classesRes] = await Promise.all([
      supabase
        .from("turmas")
        .select(
          `
            id,
            nome,
            turno,
            ano_letivo,
            curso_id,
            classe_id,
            classes!inner (
              id,
              nome,
              numero
            )
          `,
        )
        .eq("escola_id", escolaId)
        .order("ano_letivo", { ascending: false, nullsFirst: false })
        .order("nome", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("classes")
        .select("id, nome, numero, curso_id")
        .eq("escola_id", escolaId)
        .order("numero", { ascending: true, nullsFirst: false })
        .order("nome", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (turmasRes.error) {
      return NextResponse.json({ ok: false, error: turmasRes.error.message }, { status: 400 });
    }

    if (classesRes.error) {
      return NextResponse.json({ ok: false, error: classesRes.error.message }, { status: 400 });
    }

    const turmas = (turmasRes.data ?? []).map((row: any) => ({
      id: row.id as string,
      nome: row.nome as string,
      turno: (row.turno as string | null) ?? null,
      ano_letivo: typeof row.ano_letivo === "number" ? row.ano_letivo : Number(row.ano_letivo),
      curso_id: (row.curso_id as string | null) ?? null,
      classe_id: (row.classe_id as string | null) ?? null,
      classe_nome: (row.classes?.nome as string | null) ?? null,
      classe_numero: typeof row.classes?.numero === "number" ? row.classes.numero : null,
    }));

    const classes = (classesRes.data ?? []).map((row: any) => ({
      id: row.id as string,
      nome: row.nome as string,
      numero: typeof row.numero === "number" ? row.numero : null,
      curso_id: (row.curso_id as string | null) ?? null,
    }));

    const hasAnySelection =
      Boolean(query.data.turma_id) || Boolean(query.data.classe_id) || typeof query.data.ano_letivo === "number";
    const hasFullSelection =
      Boolean(query.data.turma_id) && Boolean(query.data.classe_id) && typeof query.data.ano_letivo === "number";

    if (hasAnySelection && !hasFullSelection) {
      return NextResponse.json(
        { ok: false, error: "turma_id, classe_id e ano_letivo devem ser enviados em conjunto." },
        { status: 400 },
      );
    }

    if (!hasFullSelection) {
      return NextResponse.json({
        ok: true,
        turmas,
        classes,
        preview: null,
      });
    }

    const turmaSelecionada = turmas.find((item) => item.id === query.data.turma_id) ?? null;
    if (!turmaSelecionada) {
      return NextResponse.json({ ok: false, error: "Turma actual não encontrada." }, { status: 404 });
    }

    const classeSelecionada = classes.find((item) => item.id === query.data.classe_id) ?? null;
    if (!classeSelecionada) {
      return NextResponse.json({ ok: false, error: "Classe passada não encontrada." }, { status: 404 });
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
      .eq("classe_id", classeSelecionada.id)
      .order("ordem", { ascending: true, nullsFirst: false })
      .order("disciplina_id", { ascending: true });

    if (classeSelecionada.curso_id) {
      matrizQuery = matrizQuery.eq("curso_id", classeSelecionada.curso_id);
    }

    const [alunosRes, matrizRes] = await Promise.all([
      supabase
        .from("matriculas")
        .select(
          `
            id,
            aluno_id,
            numero_chamada,
            alunos!inner (
              id,
              nome
            )
          `,
        )
        .eq("escola_id", escolaId)
        .eq("turma_id", turmaSelecionada.id)
        .in("status", ACTIVE_MATRICULA_STATUSES)
        .order("numero_chamada", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true }),
      matrizQuery,
    ]);

    if (alunosRes.error) {
      return NextResponse.json({ ok: false, error: alunosRes.error.message }, { status: 400 });
    }

    if (matrizRes.error) {
      return NextResponse.json({ ok: false, error: matrizRes.error.message }, { status: 400 });
    }

    const alunos = (alunosRes.data ?? []).map((row: any, index: number) => ({
      aluno_id: row.aluno_id as string,
      nome: row.alunos?.nome ?? "Sem nome",
      numero_chamada: typeof row.numero_chamada === "number" ? row.numero_chamada : index + 1,
    }));

    const obrigatorias = (matrizRes.data ?? []).filter((row: any) => row.obrigatoria !== false);
    const disciplinasFonte = obrigatorias.length > 0 ? obrigatorias : matrizRes.data ?? [];
    const disciplinas = sortDisciplinas(disciplinasFonte).map((row: any) => ({
      disciplina_id: row.disciplina_id as string,
      disciplina_nome: row.disciplina?.nome ?? "Disciplina",
      ordem: typeof row.ordem === "number" ? row.ordem : null,
    }));

    const alunoIds = alunos.map((item) => item.aluno_id);
    let existingRows: any[] = [];

    if (alunoIds.length > 0) {
      const existingRes = await supabase
        .from("historico_transitado_anos")
        .select(
          `
            id,
            aluno_id,
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
        .eq("classe_id", classeSelecionada.id)
        .eq("ano_letivo", query.data.ano_letivo)
        .in("aluno_id", alunoIds)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false });

      if (existingRes.error) {
        return NextResponse.json({ ok: false, error: existingRes.error.message }, { status: 400 });
      }

      existingRows = existingRes.data ?? [];
    }

    const existingMap = new Map<string, Map<string, { nota_final: number | null; ordem: number | null; disciplina_nome: string }>>();
    for (const row of existingRows) {
      const notas = Array.isArray(row.notas) ? row.notas : [];
      const notasMap = new Map<string, { nota_final: number | null; ordem: number | null; disciplina_nome: string }>();
      for (const nota of notas) {
        notasMap.set(nota.disciplina_id as string, {
          nota_final: typeof nota.nota_final === "number" ? nota.nota_final : Number(nota.nota_final),
          ordem: typeof nota.ordem === "number" ? nota.ordem : null,
          disciplina_nome: (nota.disciplina_nome as string | null) ?? "Disciplina",
        });
      }
      existingMap.set(row.aluno_id as string, notasMap);
    }

    const linhas = alunos.map((aluno) => ({
      aluno_id: aluno.aluno_id,
      nome: aluno.nome,
      numero_chamada: aluno.numero_chamada,
      notas: disciplinas.map((disciplina) => {
        const existing = existingMap.get(aluno.aluno_id)?.get(disciplina.disciplina_id) ?? null;
        return {
          disciplina_id: disciplina.disciplina_id,
          disciplina_nome: existing?.disciplina_nome ?? disciplina.disciplina_nome,
          ordem: existing?.ordem ?? disciplina.ordem,
          nota_final: existing?.nota_final ?? null,
        };
      }),
    }));

    const totalCelulas = linhas.length * disciplinas.length;
    const preenchidas = linhas.reduce(
      (total, linha) => total + linha.notas.filter((nota) => typeof nota.nota_final === "number").length,
      0,
    );

    return NextResponse.json({
      ok: true,
      turmas,
      classes,
      preview: {
        turma: turmaSelecionada,
        classe: classeSelecionada,
        ano_letivo: query.data.ano_letivo,
        disciplinas,
        linhas,
        stats: {
          total_alunos: linhas.length,
          total_disciplinas: disciplinas.length,
          total_celulas: totalCelulas,
          preenchidas,
          pendentes: Math.max(totalCelulas - preenchidas, 0),
          registros_existentes: existingRows.length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const routeContext = await resolveRouteContext();
    if (!routeContext.ok) return routeContext.response;

    const body = BodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: body.error.flatten() }, { status: 400 });
    }

    const { supabase, escolaId } = routeContext;
    const { data, error } = await supabase.rpc("upsert_historico_transitado_lote", {
      p_escola_id: escolaId,
      p_turma_id: body.data.turma_id,
      p_classe_id: body.data.classe_id,
      p_ano_letivo: body.data.ano_letivo,
      p_registos: body.data.registros,
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
