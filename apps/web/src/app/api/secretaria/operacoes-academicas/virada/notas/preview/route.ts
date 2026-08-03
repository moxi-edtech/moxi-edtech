import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { previewNotaImport } from "@/lib/virada/notas-import";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  ano_letivo: z.number().int().min(2000).max(2200),
  rows: z.array(z.unknown()).min(1).max(5_000),
});

function chunks<T>(values: T[], size = 200) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Dados inválidos" }, { status: 400 });
  }

  const preview = previewNotaImport(parsed.data.rows);
  const matriculaIds = [...new Set(preview.validas.map((row) => row.matricula_id).filter(Boolean))] as string[];
  const processos = [...new Set(preview.validas.map((row) => row.numero_processo).filter(Boolean))] as string[];

  const [matriculasResults, alunosResults] = await Promise.all([
    Promise.all(chunks(matriculaIds).map((ids) =>
      supabase.from("matriculas").select("id, aluno_id, turma_id, ano_letivo").eq("escola_id", escolaId).eq("ano_letivo", parsed.data.ano_letivo).in("id", ids),
    )),
    Promise.all(chunks(processos).map((values) =>
      supabase.from("alunos").select("id, numero_processo").eq("escola_id", escolaId).in("numero_processo", values),
    )),
  ]);

  if (matriculasResults.some((result) => result.error) || alunosResults.some((result) => result.error)) {
    return NextResponse.json({ ok: false, error: "Falha ao validar alunos e matrículas" }, { status: 500 });
  }

  const matriculas = matriculasResults.flatMap((result) => result.data || []) as Array<{
    id: string;
    aluno_id: string;
    turma_id: string | null;
    ano_letivo: number | null;
  }>;
  const alunos = alunosResults.flatMap((result) => result.data || []) as Array<{
    id: string;
    numero_processo: string | null;
  }>;
  const matriculasById = new Map(matriculas.map((row) => [row.id, row] as const));
  const alunosByProcesso = new Map(
    alunos.filter((row) => row.numero_processo).map((row) => [row.numero_processo as string, row] as const),
  );
  const alunoIds = [...new Set(alunos.map((row) => row.id))];
  const matriculasByAlunoResults = await Promise.all(chunks(alunoIds).map((ids) =>
    supabase
      .from("matriculas")
      .select("id, aluno_id, turma_id, ano_letivo")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", parsed.data.ano_letivo)
      .in("aluno_id", ids),
  ));
  if (matriculasByAlunoResults.some((result) => result.error)) {
    return NextResponse.json({ ok: false, error: "Falha ao validar matrículas dos alunos" }, { status: 500 });
  }
  const matriculasByAluno = new Map<string, typeof matriculas>();
  for (const matricula of matriculasByAlunoResults.flatMap((result) => result.data || [])) {
    const current = matriculasByAluno.get(matricula.aluno_id) ?? [];
    current.push(matricula);
    matriculasByAluno.set(matricula.aluno_id, current);
  }
  const correspondencias = preview.validas.map((row) => {
    const direct = row.matricula_id ? matriculasById.get(row.matricula_id) : undefined;
    const aluno = row.numero_processo ? alunosByProcesso.get(row.numero_processo) : undefined;
    const candidates = direct ? [direct] : aluno ? (matriculasByAluno.get(aluno.id) ?? []) : [];
    const matricula = candidates.length === 1 ? candidates[0] : undefined;
    return {
      linha: row.linha,
      chave: row.chave,
      encontrado: Boolean(matricula),
      matricula_id: matricula?.id ?? null,
      aluno_id: matricula?.aluno_id ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    dry_run: true,
    can_import: preview.rejeitadas.length === 0
      && preview.duplicadas.length === 0
      && correspondencias.every((row) => row.encontrado),
    summary: {
      total: preview.total,
      validas: preview.validas.length,
      rejeitadas: preview.rejeitadas.length,
      duplicadas: preview.duplicadas.length,
      sem_correspondencia: correspondencias.filter((row) => !row.encontrado).length,
    },
    rejeitadas: preview.rejeitadas,
    duplicadas: preview.duplicadas,
    correspondencias,
  });
}
