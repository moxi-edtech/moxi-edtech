import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ActionSchema = z.object({
  action: z.enum(["archive", "enroll"]),
  reclassificacao_ids: z.array(z.string().uuid()).min(1).max(500),
  turma_destino_id: z.string().uuid().optional(),
  motivo: z.string().trim().max(500).optional().nullable(),
});

async function getContext() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 }) };
  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) return { error: NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 }) };
  return { supabase, escolaId };
}

export async function GET(request: Request) {
  const context = await getContext();
  if ("error" in context) return context.error;
  const { supabase, escolaId } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "aguardando_destino";
  const tipo = url.searchParams.get("tipo");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 200), 1), 500);

  const db = supabase as any;
  let query = db
    .from("matricula_reclassificacoes")
    .select("id,matricula_id,aluno_id,origem_session_id,destino_session_id,origem_turma_id,destino_turma_id,tipo,status,motivo,created_at,updated_at")
    .eq("escola_id", escolaId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (status !== "all") query = query.eq("status", status);
  if (tipo) query = query.eq("tipo", tipo);

  const { data: records, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (records ?? []) as Array<Record<string, any>>;
  const matriculaIds = rows.map((row) => row.matricula_id);
  const alunoIds = [...new Set(rows.map((row) => row.aluno_id))];
  const turmaIds = [...new Set(rows.flatMap((row) => [row.origem_turma_id, row.destino_turma_id]).filter(Boolean))];

  const [{ data: matriculas }, { data: alunos }, { data: turmas }] = await Promise.all([
    matriculaIds.length
      ? db.from("matriculas").select("id,status,ativo,numero_matricula,turma_id,session_id,ano_letivo").eq("escola_id", escolaId).in("id", matriculaIds)
      : { data: [] },
    alunoIds.length
      ? db.from("alunos").select("id,nome,nome_completo,bi_numero").eq("escola_id", escolaId).in("id", alunoIds)
      : { data: [] },
    turmaIds.length
      ? db.from("turmas").select("id,nome,turno,curso_id,classe_id,capacidade_maxima,session_id").eq("escola_id", escolaId).in("id", turmaIds)
      : { data: [] },
  ]);

  const matriculaById = new Map((matriculas ?? []).map((row: any) => [row.id, row]));
  const alunoById = new Map((alunos ?? []).map((row: any) => [row.id, row]));
  const turmaById = new Map((turmas ?? []).map((row: any) => [row.id, row]));

  return NextResponse.json({
    ok: true,
    records: rows.map((row) => ({
      ...row,
      matricula: matriculaById.get(row.matricula_id) ?? null,
      aluno: alunoById.get(row.aluno_id) ?? null,
      origem_turma: turmaById.get(row.origem_turma_id) ?? null,
      destino_turma: turmaById.get(row.destino_turma_id) ?? null,
    })),
    count: rows.length,
  });
}

export async function POST(request: Request) {
  const context = await getContext();
  if ("error" in context) return context.error;
  const { supabase, escolaId } = context;
  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ação de reclassificação inválida" }, { status: 400 });

  const { action, reclassificacao_ids, turma_destino_id, motivo } = parsed.data;
  if (action === "enroll" && !turma_destino_id) {
    return NextResponse.json({ ok: false, error: "Turma destino é obrigatória" }, { status: 400 });
  }

  const fn = action === "archive" ? "finalistas_concluir_arquivar" : "finalistas_matricular_novo_ciclo";
  const args = action === "archive"
    ? { p_escola_id: escolaId, p_reclassificacao_ids: reclassificacao_ids, p_motivo: motivo ?? null }
    : { p_escola_id: escolaId, p_reclassificacao_ids: reclassificacao_ids, p_turma_destino_id: turma_destino_id, p_motivo: motivo ?? null };
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  return NextResponse.json(data ?? { ok: true });
}
