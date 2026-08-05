import { NextResponse } from "next/server";
import { recordAuditServer } from "@/lib/audit";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ importacaoId: string }> },
) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  const authz = await authorizeEscolaAction(supabase, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

  const { importacaoId } = await params;
  const { data: importacao, error: importacaoError } = await supabase
    .from("virada_importacoes")
    .select("id,escola_id,status,ano_letivo_origem")
    .eq("id", importacaoId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (importacaoError) return NextResponse.json({ ok: false, error: importacaoError.message }, { status: 500 });
  if (!importacao) return NextResponse.json({ ok: false, error: "Importação não encontrada" }, { status: 404 });
  if (importacao.status !== "APLICADO") {
    return NextResponse.json({ ok: false, error: "A importação precisa estar APLICADA antes de reconstruir o histórico." }, { status: 409 });
  }

  const { data: lines, error: linesError } = await supabase
    .from("virada_importacao_linhas")
    .select("matricula_id,aluno_id,status")
    .eq("importacao_id", importacaoId)
    .eq("escola_id", escolaId)
    .eq("status", "APLICADA");
  if (linesError) return NextResponse.json({ ok: false, error: linesError.message }, { status: 500 });

  const matriculaIds = [...new Set((lines ?? []).map((line: any) => line.matricula_id).filter(Boolean))] as string[];
  const results: Array<{ matricula_id: string; historico_ano_id?: string; error?: string }> = [];
  for (const matriculaId of matriculaIds) {
    const { data, error } = await supabase.rpc("gerar_historico_anual", { p_matricula_id: matriculaId });
    results.push(error
      ? { matricula_id: matriculaId, error: error.message }
      : { matricula_id: matriculaId, historico_ano_id: data });
  }

  const failed = results.filter((result) => result.error);
  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "VIRADA_NOTAS_RECONSTRUIR_HISTORICO",
    entity: "virada_importacoes",
    entityId: importacaoId,
    details: { ano_letivo: importacao.ano_letivo_origem, total_matriculas: matriculaIds.length, processadas: matriculaIds.length - failed.length, falhas: failed.length },
  }).catch(() => null);

  return NextResponse.json({
    ok: failed.length === 0,
    importacao_id: importacaoId,
    ano_letivo: importacao.ano_letivo_origem,
    total_matriculas: matriculaIds.length,
    processadas: matriculaIds.length - failed.length,
    falhas: failed.length,
    resultados: results,
    snapshot: "permanece_aberto",
  }, { status: failed.length === 0 ? 200 : 207 });
}
