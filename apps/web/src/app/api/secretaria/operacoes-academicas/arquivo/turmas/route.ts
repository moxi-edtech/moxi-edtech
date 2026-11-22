import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMIT = 25;

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Arquivo académico: leitura por escola/ano sem depender do seletor global.
 * Não usa service_role. Os filtros de tenant, sessão e autorização são mandatórios.
 */
export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return response({ ok: false, error: "Não autenticado" }, 401);

    const params = new URL(req.url).searchParams;
    const requestedAcademicYearId = params.get("ano_letivo_id");
    if (!requestedAcademicYearId || !UUID.test(requestedAcademicYearId)) {
      return response({ ok: false, error: "Ano letivo válido obrigatório" }, 400);
    }
    const rawPage = Number(params.get("page") ?? "1");
    if (!Number.isSafeInteger(rawPage) || rawPage < 1 || rawPage > 10000) {
      return response({ ok: false, error: "Página inválida" }, 400);
    }
    const q = (params.get("q") ?? "").trim();
    if (q.length > 80) return response({ ok: false, error: "Pesquisa demasiado longa" }, 400);

    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, params.get("escola_id"));
    if (!escolaId) return response({ ok: false, error: "Escola não encontrada" }, 404);
    const authz = await authorizeTurmasManage(supabase, escolaId, auth.user.id);
    if (!authz.allowed) return response({ ok: false, error: "Sem permissão" }, 403);

    const session = await resolveAcademicYearScope(supabase, {
      escolaId,
      requestedAcademicYearId,
      operation: "READ",
    });
    if (session.status !== "CLOSED") {
      return response({ ok: false, error: "Consulte este ano no espaço operacional." }, 409);
    }

    const offset = (rawPage - 1) * LIMIT;
    let query = supabase
      .from("turmas")
      .select("id, nome, turma_codigo, turno, ano_letivo, status_validacao, classes(nome), cursos(nome)", { count: "exact" })
      .eq("escola_id", escolaId)
      .eq("session_id", session.id);
    if (q) {
      // Escape SQL LIKE wildcards; nunca usar expressão OR interpolada pelo cliente.
      const literal = q.replace(/[\\%_]/g, "\\$&");
      query = query.ilike("nome", `%${literal}%`);
    }
    const { data, count, error } = await query
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + LIMIT - 1);
    if (error) throw error;
    return response({
      ok: true,
      ano_letivo_id: session.id,
      ano: session.ano,
      page: rawPage,
      page_size: LIMIT,
      total: count ?? 0,
      items: (data ?? []).map((row: any) => ({
        id: String(row.id),
        nome: row.nome ?? "Turma",
        codigo: row.turma_codigo ?? null,
        turno: row.turno ?? null,
        classe: (Array.isArray(row.classes) ? row.classes[0] : row.classes)?.nome ?? null,
        curso: (Array.isArray(row.cursos) ? row.cursos[0] : row.cursos)?.nome ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return response({ ok: false, code: error.code, error: error.message }, error.status);
    }
    console.error("[ArquivoAcademico] Falha ao consultar turmas", error);
    return response({ ok: false, error: "Não foi possível consultar as turmas." }, 500);
  }
}
