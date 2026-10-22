import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";
import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope } from "@/lib/academic-year/context";
import {
  resolveRosterExportPolicy, rosterExportAudit, serializeRosterCsv, type MinimalExportRow,
} from "@/lib/command-center/roster-export-policy";

export const dynamic = "force-dynamic";
const inputSchema = z.object({
  schoolId: z.string().uuid(),
  type: z.enum(["turma", "classe"]),
  entityId: z.string().uuid(),
  yearId: z.string().uuid().nullable(),
  poloId: z.string().uuid().nullable(),
  query: z.string().max(90),
  filter: z.enum(["todos", "documentos_sinalizados", "propinas_vencidas", "ambos"]),
  sort: z.enum(["nome_asc", "nome_desc", "pendencias_primeiro"]),
});
const deny = (reason: string, status: number) =>
  NextResponse.json({ ok: false, error: reason }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });

/** Exportação opcional e auditada; RLS e autorização são reavaliadas em cada pedido. */
async function readRosterExport(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A CSV delivery is a sensitive, audited operation; reject cross-site
  // browser navigation and never allow unrelated origins to trigger an export.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return deny("Pedido de exportação inválido.", 403);
  }
  const q = new URL(req.url).searchParams;
  const result = inputSchema.safeParse({
    schoolId: id, type: q.get("type"), entityId: q.get("entityId"),
    yearId: q.get("ano_letivo_id"), poloId: q.get("poloId") ?? q.get("polo_id"), query: q.get("q") ?? "",
    filter: q.get("filter") ?? "todos", sort: q.get("sort") ?? "nome_asc",
  });
  if (!result.success) return deny("Parâmetros inválidos.", 400);
  const input = result.data;
  const policy = resolveRosterExportPolicy(input.schoolId, process.env.KLASSE_CC_ROSTER_EXPORT_POLICY_JSON);
  if (!policy.enabled) return NextResponse.json({
    ok: false, code: "EXPORT_DISABLED",
    error: "Exportação desactivada para esta escola. Solicite autorização à administração.",
  }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  if (input.poloId) return deny("Exportação por polo indisponível sem escopo canónico verificado.", 403);
  if (input.query.trim() && input.query.trim().length < 2) return deny("Introduza pelo menos dois caracteres.", 400);
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return deny("A sessão terminou. Inicie novamente sessão.", 401);
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, input.schoolId);
    if (!escolaId) return deny("Sem acesso à escola.", 403);
    const permission = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12", roles: policy.roles,
    });
    if (permission.error) return permission.error;
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: input.yearId, operation: "READ",
    });
    if (year.status === "CLOSED") return deny("Exportação histórica não homologada.", 409);
    const rows: MinimalExportRow[] = [];
    let cursor: { name: string; id: string; priority: number } | null = null;
    for (let page = 0; page <= Math.ceil(policy.maxRows / 50); page++) {
      const remaining = policy.maxRows - rows.length;
      const pageSize = Math.min(50, remaining + 1);
      const { data, error } = await supabase.rpc("command_center_roster_operational_v1", {
        p_escola_id: escolaId, p_ano_letivo: year.ano,
        p_turma_id: input.type === "turma" ? input.entityId : null,
        p_classe_id: input.type === "classe" ? input.entityId : null,
        p_query: input.query.trim() || null,
        p_cursor_name: cursor?.name ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_cursor_priority: cursor?.priority ?? null,
        p_filter: input.filter, p_sort: input.sort,
        p_limit: pageSize, p_polo_id: null,
      });
      if (error) return deny("Não foi possível verificar a autorização da lista.", 403);
      if (data?.[0]?.rate_limited) return NextResponse.json({
        ok: false, error: "Muitas consultas seguidas. Aguarde e tente novamente.",
      }, { status: 429, headers: {
        "Cache-Control": "private, no-store", "Retry-After": "60",
      } });
      // Cardinality is computed before LIMIT, so never deliver an incomplete
      // or truncated roster to a user with a smaller configured export limit.
      if (Number(data?.[0]?.total_filtrado ?? 0) > policy.maxRows) {
        return deny("Esta lista excede o limite de exportação da escola. Aplique um filtro autorizado.", 413);
      }
      const received = (data ?? []).filter((item) => item.aluno_id && item.nome && item.turma_nome);
      for (const record of received) {
        rows.push({ nome: record.nome!, numero: record.numero_processo, turma: record.turma_nome! });
      }
      if (rows.length > policy.maxRows) {
        return deny("Limite de exportação excedido. Reduza a selecção.", 413);
      }
      if (received.length < pageSize) break;
      const last = received[received.length - 1];
      if (!last?.aluno_id || !last.cursor_name) break;
      cursor = { name: last.cursor_name, id: last.aluno_id, priority: last.pendencias_count };
    }

    const timestamp = new Date().toISOString();
    const metadata = rosterExportAudit({
      userId: user.id, escolaId, type: input.type, entityId: input.entityId,
      count: rows.length, hasSearch: Boolean(input.query.trim()), exportedAt: timestamp,
      filter: input.filter, sort: input.sort,
      purposeCode: policy.purposeCode, retentionDays: policy.retentionDays,
    });
    // Falha de auditoria bloqueia o ficheiro: nunca exportar e registar "depois".
    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId, portal: "secretaria", acao: "command_center_roster_export",
      tabela: "alunos", entity: "alunos", entity_id: input.entityId,
      details: metadata,
    });
    if (auditError) return deny("A auditoria não pôde ser registada. Exportação cancelada.", 503);
    const csv = serializeRosterCsv(rows, user.id, timestamp);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=lista_alunos.csv",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return deny("Não foi possível concluir a exportação.", 500);
  }
}

/** Contract: correlation on every success and failure, without private payloads in logs. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withExplorerObservability("roster-export", () => readRosterExport(req, context));
}
