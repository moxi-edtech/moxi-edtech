import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope, AcademicYearContextError } from "@/lib/academic-year/context";

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
  size: z.coerce.number().int().min(1).max(25).default(20),
});
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/** A read-only service. Filtering, counting and keyset ordering happen before LIMIT in SQL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaIdParam } = await params;
  const u = new URL(req.url);
  const parsed = schema.safeParse({
    escolaId: escolaIdParam,
    type: u.searchParams.get("type"),
    entityId: u.searchParams.get("entityId"),
    yearId: u.searchParams.get("ano_letivo_id"),
    poloId: u.searchParams.get("poloId"),
    search: u.searchParams.get("q") ?? "",
    cursorName: u.searchParams.get("cursorName"),
    cursorId: u.searchParams.get("cursorId"),
    size: u.searchParams.get("size") ?? "20",
  });
  if (!parsed.success) return response({ ok: false, error: "Parâmetros inválidos." }, 400);
  const input = parsed.data;
  if ((input.cursorId === null) !== (input.cursorName === null)) {
    return response({ ok: false, error: "Cursor incompleto." }, 400);
  }
  if (input.search.trim() && input.search.trim().length < 2) {
    return response({ ok: false, error: "Introduza pelo menos dois caracteres." }, 400);
  }
  if (input.poloId) {
    return response({
      ok: false,
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
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: input.yearId, operation: "READ",
    });
    // The contract deliberately disables historic/filter-specific rosters
    // until status semantics and school-specific documentary/financial rules are signed off.
    if (year.status === "CLOSED") return response({
      ok: false, error: "Pesquisa histórica indisponível até homologar os estados de matrícula.",
    }, 409);

    const { data, error } = await supabase.rpc("command_center_roster_keyset", {
      p_escola_id: escolaId,
      p_ano_letivo: year.ano,
      p_turma_id: input.type === "turma" ? input.entityId : null,
      p_classe_id: input.type === "classe" ? input.entityId : null,
      p_query: input.search.trim() || null,
      p_cursor_name: input.cursorName,
      p_cursor_id: input.cursorId,
      p_limit: input.size + 1,
      p_polo_id: null,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
      return response({
        ok: false, error: status === 403 ? "Sem autorização para consultar esta lista." : "Não foi possível carregar a lista. Tente novamente.",
      }, status);
    }
    const items = (data ?? []).slice(0, input.size);
    const last = items.at(-1);
    return response({
      ok: true,
      items: items.map((item) => ({
        id: item.aluno_id, nome: item.nome, numero: item.numero_processo,
        turmaId: item.turma_id, turmaNome: item.turma_nome, numeroChamada: item.numero_chamada,
      })),
      total: data?.[0]?.total_filtrado ?? 0,
      hasMore: (data?.length ?? 0) > input.size,
      cursor: last ? { name: last.cursor_name, id: last.aluno_id } : null,
      size: input.size,
    });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return response({ ok: false, error: cause.message }, cause.status);
    }
    return response({ ok: false, error: "Falha de consulta. Tente novamente." }, 500);
  }
}
