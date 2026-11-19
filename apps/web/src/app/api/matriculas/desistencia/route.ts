import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const escolaRoles = [
  "diretor", "admin", "admin_escola", "staff_admin",
  "admin_secretaria", "secretaria", "secretaria_financeiro", "admin_financeiro",
] as const;

const querySchema = z.object({
  escola_id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid().optional(),
  estado: z.enum(["ativo", "desistente"]).default("ativo"),
});
const payloadSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("confirmar"),
    matricula_id: z.string().uuid(),
    motivo: z.string().trim().min(10).max(500),
  }).strict(),
  z.object({
    acao: z.literal("reativar"),
    matricula_id: z.string().uuid(),
    motivo: z.string().trim().min(10).max(500),
  }).strict(),
  z.object({
    acao: z.literal("sinalizar"),
    matricula_id: z.string().uuid(),
    motivo: z.string().trim().min(10).max(500),
  }).strict(),
  z.object({
    acao: z.literal("descartar"),
    sinalizacao_id: z.string().uuid(),
  }).strict(),
]);

const noStore = { "Cache-Control": "private, no-store" };
function fail(error: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error, code }, { status, headers: noStore });
}
function mapDbError(error: { code?: string; message?: string }) {
  const code = error.code;
  const detail = String(error.message || "");
  if (code === "42501") return fail("Não tem permissão para esta operação.", 403, "FORBIDDEN");
  if (code === "23514") return fail(
    "A matrícula já não está ativa, o ano foi encerrado ou existe histórico fechado. Atualize a lista.",
    409, "ESTADO_INCOMPATIVEL",
  );
  if (code === "23505") return fail("Já existe uma matrícula que impede a reativação. Reveja a situação académica.", 409, "CONFLITO_MATRICULA");
  if (code === "22023") return fail("A matrícula, a sinalização ou o motivo é inválido.", 400, "VALIDACAO");
  if (code === "PGRST202" || code === "42883") return fail(
    "O procedimento de desistência ainda não está disponível nesta instalação.",
    503, "MIGRACAO_PENDENTE",
  );
  // Nenhum SQL interno deve ser devolvido ao navegador.
  console.error("[matriculas/desistencia] Falha RPC", { code, detail: detail.slice(0, 150) });
  return fail("Não foi possível concluir a operação.", 500, "ERRO_INTERNO");
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return fail("Identificação da turma ou do aluno inválida.", 400);

  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Não autenticado.", 401);

  const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escola_id);
  if (!escolaId) return fail("Sem acesso à escola.", 403);
  const guard = await requireRoleInSchool({ supabase, escolaId, roles: [...escolaRoles] });
  if (guard.error) return guard.error;

  const { aluno_id, turma_id, ano_letivo_id, estado } = parsed.data;
  let query = supabase.from("matriculas")
    .select("id,aluno_id,turma_id,status,ativo,session_id,motivo_fecho,data_fecho")
    .eq("escola_id", escolaId).eq("aluno_id", aluno_id).eq("turma_id", turma_id)
    .eq("status", estado).eq("ativo", estado === "ativo")
    .limit(2);
  if (ano_letivo_id) query = query.eq("session_id", ano_letivo_id);
  const { data: items, error } = await query;
  if (error) return fail("Não foi possível consultar a matrícula.", 503);
  if (!items?.length) return fail("Não existe matrícula com o estado solicitado nesta turma.", 404, "SEM_MATRICULA_ELEGIVEL");
  if (items.length > 1) return fail("Há mais de uma matrícula ativa neste contexto. Revise antes de alterar.", 409);

  const matricula = items[0];
  const { data: sinalizacoes, error: signalError } = await supabase
    .from("matricula_desistencia_sinalizacoes")
    .select("id,motivo,criado_em")
    .eq("escola_id", escolaId).eq("matricula_id", matricula.id).eq("status", "pendente")
    .order("criado_em", { ascending: false }).limit(20);
  if (signalError) return fail("Sinalizações indisponíveis. Verifique a migração.", 503);
  return NextResponse.json({
    ok: true,
    matricula_id: matricula.id,
    status: matricula.status,
    motivo_fecho: matricula.motivo_fecho,
    data_fecho: matricula.data_fecho,
    sinalizacoes: sinalizacoes ?? [],
  }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Dados inválidos. Informe uma justificativa de 10 a 500 caracteres.", 400);
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Não autenticado.", 401);

  const action = parsed.data;
  if (action.acao !== "sinalizar") {
    const { data: matricula } = action.acao === "confirmar" || action.acao === "reativar"
      ? await supabase.from("matriculas").select("escola_id").eq("id", action.matricula_id).maybeSingle()
      : await supabase.from("matricula_desistencia_sinalizacoes")
        .select("escola_id").eq("id", action.sinalizacao_id).maybeSingle();
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, matricula?.escola_id ?? null);
    if (!escolaId) return fail("Sem permissão.", 403);
    const guard = await requireRoleInSchool({ supabase, escolaId, roles: [...escolaRoles] });
    if (guard.error) return guard.error;
  }

  const rpc = action.acao === "confirmar"
    ? ["registar_desistencia_matricula", { p_matricula_id: action.matricula_id, p_motivo: action.motivo }]
    : action.acao === "reativar"
      ? ["reativar_matricula_desistente", { p_matricula_id: action.matricula_id, p_motivo: action.motivo }]
      : action.acao === "sinalizar"
      ? ["sinalizar_desistencia_matricula", { p_matricula_id: action.matricula_id, p_motivo: action.motivo }]
      : ["descartar_sinalizacao_desistencia", { p_sinalizacao_id: action.sinalizacao_id }];
  const { data, error } = await supabase.rpc(rpc[0] as string, rpc[1]);
  if (error) return mapDbError(error);
  if (!data?.ok) return fail("A operação não foi confirmada.", 503);
  return NextResponse.json(data, { headers: noStore });
}
