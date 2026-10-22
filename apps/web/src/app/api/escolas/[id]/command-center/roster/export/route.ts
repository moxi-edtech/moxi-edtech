import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
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
});
const deny = (reason: string, status: number) =>
  NextResponse.json({ ok: false, error: reason }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });

/** Exportação opcional e auditada; RLS e autorização são reavaliadas em cada pedido. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const result = inputSchema.safeParse({
    schoolId: id, type: q.get("type"), entityId: q.get("entityId"),
    yearId: q.get("ano_letivo_id"), poloId: q.get("poloId") ?? q.get("polo_id"), query: q.get("q") ?? "",
  });
  if (!result.success) return deny("Parâmetros inválidos.", 400);
  const input = result.data;
  const policy = resolveRosterExportPolicy(input.schoolId, process.env.KLASSE_CC_ROSTER_EXPORT_POLICY_JSON);
  if (!policy.enabled) return deny("Exportação desactivada para esta escola. Solicite autorização à administração.", 403);
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
    let cursor: { name: string; id: string } | null = null;
    for (let page = 0; page <= Math.ceil(policy.maxRows / 50); page++) {
      const { data, error } = await supabase.rpc("command_center_roster_keyset", {
        p_escola_id: escolaId, p_ano_letivo: year.ano,
        p_turma_id: input.type === "turma" ? input.entityId : null,
        p_classe_id: input.type === "classe" ? input.entityId : null,
        p_query: input.query.trim() || null,
        p_cursor_name: cursor?.name ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: Math.min(50, policy.maxRows - rows.length + 1),
        p_polo_id: null,
      });
      if (error) return deny("Não foi possível verificar a autorização da lista.", 403);
      const received = data ?? [];
      for (const record of received) rows.push({
        nome: record.nome, numero: record.numero_processo, turma: record.turma_nome,
      });
      if (rows.length > policy.maxRows) return deny("Limite de linhas excedido. Reduza a selecção.", 413);
      if (received.length < Math.min(50, policy.maxRows - rows.length + received.length + 1)) break;
      const last = received[received.length - 1];
      if (!last) break;
      cursor = { name: last.cursor_name, id: last.aluno_id };
    }

    const timestamp = new Date().toISOString();
    const metadata = rosterExportAudit({
      userId: user.id, escolaId, type: input.type, entityId: input.entityId,
      count: rows.length, hasSearch: Boolean(input.query.trim()), exportedAt: timestamp,
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
