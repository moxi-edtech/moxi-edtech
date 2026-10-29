import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { normalizarEstadoMatricula } from "@/lib/matriculas/student-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const StatusSchema = z.object({
  status: z.enum(["ativo", "trancado", "concluido", "transferido", "desistente"]),
});

/**
 * Entrada LEGADA apenas para idempotência e diagnóstico.
 *
 * Uma troca manual de status não representa a decisão RAA, a quitação, a
 * transferência ou um fecho legal. Todas as operações devem usar as RPCs
 * canónicas e os seus fluxos específicos, evitando atualização sem auditoria
 * e sem alinhar matriculas.ativo/resultado académico.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ matriculaId: string }> },
) {
  const { matriculaId } = await params;
  if (!z.string().uuid().safeParse(matriculaId).success) {
    return NextResponse.json({ ok: false, error: "Matrícula inválida." }, { status: 400 });
  }
  const parsed = StatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
  }

  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: sessionError } = await db.auth.getUser();
  if (!user || sessionError) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }
  const { data: matricula, error: lookupError } = await db.from("matriculas")
    .select("id, escola_id, aluno_id, status, ativo")
    .eq("id", matriculaId).maybeSingle();
  if (lookupError || !matricula) {
    return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });
  }
  const escolaId = await resolveEscolaIdForUser(db, user.id, matricula.escola_id);
  if (!escolaId || escolaId !== matricula.escola_id) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }
  const authorization = await requireRoleInSchool({
    supabase: db, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
  });
  if (authorization.error) return authorization.error;

  if (matricula.status === parsed.data.status && normalizarEstadoMatricula(matricula.status, matricula.ativo) !== "revisao") {
    return NextResponse.json({ ok: true, idempotent: true, status: matricula.status });
  }

  return NextResponse.json({
    ok: false,
    code: "LIFECYCLE_CANONICAL_FLOW_REQUIRED",
    error: "O estado académico não pode ser alterado diretamente. Utilize o fluxo oficial da matrícula.",
    matricula_id: matriculaId,
    aluno_id: matricula.aluno_id,
    proxima_acao: parsed.data.status === "concluido"
      ? "fechamento_academico"
      : parsed.data.status === "transferido"
        ? "transferencia_formal"
        : parsed.data.status === "ativo"
          ? "confirmacao_matricula"
          : "revisao_administrativa",
  }, { status: 409, headers: { "Cache-Control": "no-store" } });
}
