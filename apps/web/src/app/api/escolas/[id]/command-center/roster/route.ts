import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";
import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope, AcademicYearContextError } from "@/lib/academic-year/context";
import { allowRosterRequest } from "@/lib/command-center/roster-rate-limit";

export const dynamic = "force-dynamic";
const schema = z.object({
  escolaId: z.string().uuid(),
  type: z.enum(["turma", "classe"]),
  entityId: z.string().uuid(),
  yearId: z.string().uuid().nullable(),
  poloId: z.string().uuid().nullable(),
  search: z.string().max(90).default(""),
  cursorName: z.string().max(200).nullable(),
  cursorId: z.string().uuid().nullable(),
  cursorPriority: z.coerce.number().int().min(0).max(2).nullable(),
  size: z.coerce.number().int().min(1).max(25).default(20),
  sort: z.enum(["nome_asc", "nome_desc", "pendencias_primeiro"]).default("nome_asc"),
  filter: z.enum(["todos", "documentos_sinalizados", "propinas_vencidas"]).default("todos"),
});
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/** A read-only service. Filtering, counting and keyset ordering happen before LIMIT in SQL. */
async function readRoster(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaIdParam } = await params;
  const u = new URL(req.url);
  const parsed = schema.safeParse({
    escolaId: escolaIdParam,
    type: u.searchParams.get("type"),
    entityId: u.searchParams.get("entityId"),
    yearId: u.searchParams.get("ano_letivo_id"),
    poloId: u.searchParams.get("poloId") ?? u.searchParams.get("polo_id"),
    search: u.searchParams.get("q") ?? "",
    cursorName: u.searchParams.get("cursorName"),
    cursorId: u.searchParams.get("cursorId"),
    cursorPriority: u.searchParams.get("cursorPriority"),
    size: u.searchParams.get("size") ?? "20",
    sort: u.searchParams.get("sort") ?? "nome_asc",
    filter: u.searchParams.get("filter") ?? "todos",
  });
  if (!parsed.success) return response({ ok: false, error: "Parâmetros inválidos." }, 400);
  const input = parsed.data;
  if ((input.cursorId === null) !== (input.cursorName === null)) {
    return response({ ok: false, error: "Cursor incompleto." }, 400);
  }
  if (input.sort === "pendencias_primeiro" && input.cursorId && input.cursorPriority === null) {
    return response({ ok: false, error: "Cursor de pendências incompleto." }, 400);
  }
  if (input.search.trim() && input.search.trim().length < 2) {
    return response({ ok: false, error: "Introduza pelo menos dois caracteres." }, 400);
  }
  if (input.poloId) {
    return response({
      ok: false,
      code: "POLO_SCOPE_UNDEFINED",
      error: "A listagem por polo está indisponível até existir uma relação de polo verificada nos dados canónicos.",
    }, 403);
  }
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response({ ok: false, error: "A sessão terminou. Volte a iniciar sessão." }, 401);
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, input.escolaId);
    if (!escolaId) return response({ ok: false, error: "Sem acesso à escola." }, 403);
    const permission = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (permission.error) return permission.error;
    const budget = allowRosterRequest(user.id, escolaId);
    if (!budget.allowed) return NextResponse.json({
      ok: false, error: "Muitas pesquisas seguidas. Aguarde um pouco e tente novamente.",
    }, { status: 429, headers: {
      "Cache-Control": "private, no-store",
      "Retry-After": String(budget.retryAfterSeconds),
    } });
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: input.yearId, operation: "READ",
    });
    // Historical enrolments remain gated; current-year verified signals do not infer final matriculation states.
    if (year.status === "CLOSED") return response({
      ok: false, code: "HISTORIC_ROSTER_UNAVAILABLE",
      error: "Pesquisa histórica indisponível até homologar os estados de matrícula.",
    }, 409);

    const { data, error } = await supabase.rpc("command_center_roster_operational_v1", {
      p_escola_id: escolaId,
      p_ano_letivo: year.ano,
      p_turma_id: input.type === "turma" ? input.entityId : null,
      p_classe_id: input.type === "classe" ? input.entityId : null,
      p_query: input.search.trim() || null,
      p_cursor_name: input.cursorName,
      p_cursor_id: input.cursorId,
      p_cursor_priority: input.cursorPriority,
      p_limit: input.size + 1,
      p_polo_id: null,
      p_sort: input.sort,
      p_filter: input.filter,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
      return response({
        ok: false, error: status === 403 ? "Sem autorização para consultar esta lista." : "Não foi possível carregar a lista. Tente novamente.",
      }, status);
    }
    if (data?.[0]?.rate_limited) return NextResponse.json({
      ok: false, error: "Limite de pesquisas atingido. Aguarde um minuto e tente novamente.",
      code: "RATE_LIMITED",
    }, { status: 429, headers: {
      "Cache-Control": "private, no-store", "Retry-After": "60",
    } });
    const items = (data ?? []).filter((item) => Boolean(item.aluno_id)).slice(0, input.size);
    const last = items[items.length - 1];
    return response({
      ok: true,
      items: items.map((item) => ({
        id: item.aluno_id, nome: item.nome ?? "Aluno", numero: item.numero_processo,
        turmaId: item.turma_id, turmaNome: item.turma_nome ?? "Turma", numeroChamada: item.numero_chamada,
        documentosSinalizados: item.documentos_sinalizados,
        propinasVencidas: item.propinas_vencidas,
        pendenciasCount: item.pendencias_count,
      })),
      total: data?.[0]?.total_filtrado ?? 0,
      hasMore: (data?.length ?? 0) > input.size,
      cursor: last ? { name: last.cursor_name, id: last.aluno_id, priority: last.pendencias_count } : null,
      filter: input.filter,
      sort: input.sort,
      size: input.size,
    });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return response({ ok: false, error: cause.message }, cause.status);
    }
    return response({ ok: false, error: "Falha de consulta. Tente novamente." }, 500);
  }
}

/** Contract: correlation on every success and failure, without private payloads in logs. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withExplorerObservability("roster-search", () => readRoster(req, context));
}
