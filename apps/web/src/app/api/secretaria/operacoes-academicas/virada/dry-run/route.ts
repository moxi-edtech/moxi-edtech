import { NextResponse } from "next/server";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { buildCutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  }
  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const report = await buildCutoverHealthReport(supabase, escolaId);
  const activeYear = report.active_year?.ano ?? null;
  const readinessClient = supabase as any;
  const [targetsResult, templatesResult, pendingImportsResult] = await Promise.all([
    activeYear == null
      ? Promise.resolve({ data: [], error: null })
      : readinessClient
        .from("anos_letivos")
        .select("id,ano,ativo,data_inicio,data_fim")
        .eq("escola_id", escolaId)
        .gt("ano", activeYear)
        .order("ano", { ascending: true })
        .order("id", { ascending: true }),
    activeYear == null
      ? Promise.resolve({ data: [], error: null })
      : readinessClient
        .from("calendario_templates")
        .select("id,nome,ano_base,subsistema,versao_documento")
        .eq("is_oficial", true)
        .eq("estado", "PUBLICADO")
        .gt("ano_base", activeYear)
        .order("ano_base", { ascending: true })
        .order("id", { ascending: true }),
    readinessClient
      .from("virada_importacoes")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("status", "APROVADO"),
  ]);

  const readinessErrors = [targetsResult.error, templatesResult.error, pendingImportsResult.error]
    .filter(Boolean)
    .map((error) => error?.message || "Falha na verificação operacional");
  const blockers = [...report.blockers];
  if (activeYear == null) blockers.push("Nenhum ano letivo ativo foi encontrado.");
  if ((targetsResult.data ?? []).length === 0) {
    blockers.push("Crie e confirme o ano letivo de destino antes de executar a virada.");
  }
  if (readinessErrors.length > 0) {
    blockers.push("Não foi possível concluir todas as verificações do dry-run.");
  }
  const warnings = [...report.warnings];
  const pendingImports = pendingImportsResult.count ?? 0;
  if (pendingImports > 0) {
    warnings.push(`${pendingImports} lote(s) de notas aprovado(s) aguardam aplicação.`);
  }
  const canExecute = report.can_cutover && blockers.length === 0;

  return NextResponse.json({
    ok: true,
    dry_run: true,
    can_execute: canExecute,
    status: canExecute ? report.status : "BLOCKED",
    blockers,
    warnings,
    readiness: {
      target_sessions: targetsResult.data ?? [],
      official_templates: templatesResult.data ?? [],
      approved_note_batches_pending_apply: pendingImports,
      errors: readinessErrors,
    },
    report,
  });
}
