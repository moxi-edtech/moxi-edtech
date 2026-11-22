import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeAcademicArchiveRead } from "@/lib/academico/archive-read-authorization";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";
import { ARCHIVE_TURMAS_PAGE_SIZE, literalIlikePattern, parseArchiveTurmasQuery } from "@/lib/academico/archive-turmas-query";

export const dynamic = "force-dynamic";
export const revalidate = 0;


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
    const parsed = parseArchiveTurmasQuery(params);
    if (!parsed.ok) return response({ ok: false, error: parsed.error }, parsed.status);
    const { academicYearId: requestedAcademicYearId, page: rawPage, q } = parsed.value;

    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, params.get("escola_id"));
    if (!escolaId) return response({ ok: false, error: "Escola não encontrada" }, 404);
    const permission = await authorizeAcademicArchiveRead(supabase, escolaId);
    if (permission.error) return permission.error;

    const session = await resolveAcademicYearScope(supabase, {
      escolaId,
      requestedAcademicYearId,
      operation: "READ",
    });
    if (session.status !== "CLOSED") {
      return response({ ok: false, error: "Consulte este ano no espaço operacional." }, 409);
    }

    const offset = (rawPage - 1) * ARCHIVE_TURMAS_PAGE_SIZE;
    let query = supabase
      .from("turmas")
      .select("id, nome, turma_codigo, turno, ano_letivo, status_validacao, classes(nome), cursos(nome)", { count: "exact" })
      .eq("escola_id", escolaId)
      .eq("session_id", session.id);
    if (q) {
      query = query.ilike("nome", literalIlikePattern(q));
    }
    const { data, count, error } = await query
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + ARCHIVE_TURMAS_PAGE_SIZE - 1);
    if (error) throw error;
    return response({
      ok: true,
      ano_letivo_id: session.id,
      ano: session.ano,
      page: rawPage,
      page_size: ARCHIVE_TURMAS_PAGE_SIZE,
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
