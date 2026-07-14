import { NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase/route-client";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";

type SupabaseClient = Awaited<ReturnType<typeof createRouteClient>>;
type AlunoRow = Pick<
  DBWithRPC["public"]["Tables"]["alunos"]["Row"],
  "id" | "escola_id" | "nome" | "nome_completo" | "numero_processo" | "encarregado_telefone"
>;
type MatriculaRow = Pick<
  DBWithRPC["public"]["Tables"]["matriculas"]["Row"],
  "id" | "aluno_id" | "escola_id" | "turma_id" | "ano_letivo" | "status" | "created_at"
>;
type TurmaRow = Pick<
  DBWithRPC["public"]["Tables"]["turmas"]["Row"],
  "id" | "nome" | "turno" | "capacidade_maxima" | "curso_id" | "classe_id" | "ano_letivo" | "escola_id"
>;
type EscolaRow = Pick<DBWithRPC["public"]["Tables"]["escolas"]["Row"], "id" | "nome">;
type ReclassificarAlunoBody = {
  matriculaId?: unknown;
  turmaDestinoId?: unknown;
  reprecificarAbertas?: unknown;
  reprecificarPagas?: unknown;
  motivo?: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function cleanSearchTerm(value: string | null) {
  return (value ?? "").trim().replace(/[%_]/g, "").slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseReclassificarAlunoBody(value: unknown): ReclassificarAlunoBody {
  return isRecord(value) ? value : {};
}

async function requireSuperAdmin(supabase: SupabaseClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  const { data: isSuperAdmin, error } = await supabase.rpc("check_super_admin_role");
  if (error || !isSuperAdmin) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }) };
  }

  return { ok: true as const, user };
}

async function listTurmas(supabase: SupabaseClient, escolaId: string | null, anoLetivo: string | null) {
  if (!isUuid(escolaId)) return [];

  let query = supabase
    .from("turmas")
    .select("id,nome,turno,capacidade_maxima,curso_id,classe_id,ano_letivo,escola_id")
    .eq("escola_id", escolaId)
    .order("nome", { ascending: true })
    .order("id", { ascending: false })
    .limit(200);

  const parsedAno = Number(anoLetivo);
  if (Number.isInteger(parsedAno) && parsedAno > 1900) {
    query = query.eq("ano_letivo", parsedAno);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as TurmaRow[];

  return rows.map((row) => ({
    id: String(row.id),
    nome: row.nome ?? "Turma sem nome",
    turno: row.turno ?? null,
    capacidade_maxima: row.capacidade_maxima ?? null,
    curso_id: row.curso_id ?? null,
    classe_id: row.classe_id ?? null,
    ano_letivo: row.ano_letivo ?? null,
    escola_id: row.escola_id ?? null,
  }));
}

async function searchStudents(supabase: SupabaseClient, term: string) {
  if (term.length < 2) return [];

  const like = `%${term}%`;
  const { data: alunos, error: alunosError } = await supabase
    .from("alunos")
    .select("id,escola_id,nome,nome_completo,numero_processo,encarregado_telefone")
    .or(`nome.ilike.${like},nome_completo.ilike.${like},numero_processo.ilike.${like}`)
    .order("nome", { ascending: true })
    .order("id", { ascending: false })
    .limit(20);

  if (alunosError) throw alunosError;
  if (!alunos?.length) return [];

  const alunoRows = alunos as AlunoRow[];
  const alunoIds = alunoRows.map((aluno) => aluno.id).filter(isNonEmptyString);
  const escolaIds = Array.from(new Set(alunoRows.map((aluno) => aluno.escola_id).filter(isNonEmptyString)));

  const { data: matriculas, error: matriculasError } = await supabase
    .from("matriculas")
    .select("id,aluno_id,escola_id,turma_id,ano_letivo,status,created_at")
    .in("aluno_id", alunoIds)
    .order("created_at", { ascending: false })
    .limit(80);

  if (matriculasError) throw matriculasError;

  const matriculaRows = (matriculas ?? []) as MatriculaRow[];
  const turmaIds = Array.from(new Set(matriculaRows.map((row) => row.turma_id).filter(isNonEmptyString)));
  const [turmasResult, escolasResult] = await Promise.all([
    turmaIds.length
      ? supabase.from("turmas").select("id,nome,turno,ano_letivo,escola_id,curso_id,classe_id").in("id", turmaIds)
      : Promise.resolve({ data: [], error: null }),
    escolaIds.length ? supabase.from("escolas").select("id,nome").in("id", escolaIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (turmasResult.error) throw turmasResult.error;
  if (escolasResult.error) throw escolasResult.error;

  const turmaRows = (turmasResult.data ?? []) as TurmaRow[];
  const escolaRows = (escolasResult.data ?? []) as EscolaRow[];
  const alunosById = new Map(alunoRows.map((aluno) => [String(aluno.id), aluno] as const));
  const turmasById = new Map(turmaRows.map((turma) => [String(turma.id), turma] as const));
  const escolasById = new Map(escolaRows.map((escola) => [String(escola.id), escola] as const));

  return matriculaRows.map((matricula) => {
    const aluno = alunosById.get(String(matricula.aluno_id));
    const turma = matricula.turma_id ? turmasById.get(String(matricula.turma_id)) : null;
    const escola = matricula.escola_id ? escolasById.get(String(matricula.escola_id)) : null;

    return {
      matricula_id: String(matricula.id),
      aluno_id: String(matricula.aluno_id),
      nome: aluno?.nome_completo ?? aluno?.nome ?? "Aluno sem nome",
      numero_processo: aluno?.numero_processo ?? null,
      encarregado_telefone: aluno?.encarregado_telefone ?? null,
      escola_id: matricula.escola_id ?? aluno?.escola_id ?? null,
      escola_nome: escola?.nome ?? "Escola sem nome",
      turma_id: matricula.turma_id ?? null,
      turma_nome: turma?.nome ?? "Sem turma",
      ano_letivo: matricula.ano_letivo ?? turma?.ano_letivo ?? null,
      status: matricula.status ?? null,
    };
  });
}

export async function GET(request: Request) {
  try {
    const supabase = await createRouteClient();
    const access = await requireSuperAdmin(supabase);
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const q = cleanSearchTerm(searchParams.get("q"));
    const escolaId = searchParams.get("escolaId");
    const anoLetivo = searchParams.get("anoLetivo");

    const [students, turmas] = await Promise.all([
      q.length >= 2 ? searchStudents(supabase, q) : Promise.resolve([]),
      isUuid(escolaId) ? listTurmas(supabase, escolaId, anoLetivo) : Promise.resolve([]),
    ]);

    return NextResponse.json({ ok: true, students, turmas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar dados";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createRouteClient();
    const access = await requireSuperAdmin(supabase);
    if (!access.ok) return access.response;

    const body = parseReclassificarAlunoBody(await request.json().catch(() => null));
    const matriculaId = body?.matriculaId;
    const turmaDestinoId = body?.turmaDestinoId;

    if (!isUuid(matriculaId) || !isUuid(turmaDestinoId)) {
      return NextResponse.json({ ok: false, error: "Matrícula e turma destino são obrigatórias." }, { status: 400 });
    }

    const reprecificarAbertas = body?.reprecificarAbertas !== false;
    const reprecificarPagas = body?.reprecificarPagas === true;
    const motivo = typeof body?.motivo === "string" && body.motivo.trim() ? body.motivo.trim().slice(0, 500) : null;

    const { data, error } = await supabase.rpc("super_admin_reclassificar_aluno_turma", {
      p_matricula_id: matriculaId,
      p_turma_destino_id: turmaDestinoId,
      p_reprecificar_abertas: reprecificarAbertas,
      p_reprecificar_pagas: reprecificarPagas,
      p_motivo: motivo,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao reclassificar aluno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
