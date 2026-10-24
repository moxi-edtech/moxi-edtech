import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { withExplorerObservability } from "@/lib/command-center/observability";
import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { requireCommandCenterSchoolWideAccess } from "@/lib/command-center/school-wide-scope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
const schema = z.object({
  escolaId: z.string().uuid(),
  cursoId: z.string().uuid(),
  anoLetivoId: z.string().uuid().nullable(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  classeId: z.string().uuid().nullable(),
  search: z.string().max(72).nullable(),
});

/** Bounded Course roster; does not return BI, student identities or financial data. */
async function readPage(req: NextRequest, context: {
  params: Promise<{ id: string; cursoId: string }>;
}) {
  const { id: requestedSchoolId, cursoId } = await context.params;
  const params = new URL(req.url).searchParams;
  const input = schema.safeParse({
    escolaId: requestedSchoolId, cursoId,
    anoLetivoId: params.get("ano_letivo_id"),
    page: params.get("page") ?? 1,
    pageSize: params.get("pageSize") ?? 25,
    classeId: params.get("classeId"),
    search: params.get("search"),
  });
  if (!input.success) return NextResponse.json(
    { ok: false, error: "Parâmetros de paginação inválidos." }, { status: 400 },
  );
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, input.data.escolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola sem acesso." }, { status: 403 });
    const authz = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (authz.error) return authz.error;
    const schoolScopeError = await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req);
    if (schoolScopeError) return schoolScopeError;
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: input.data.anoLetivoId, operation: "READ",
    });
    const { data, error } = await (supabase as any).rpc("command_center_course_turmas_page", {
      p_escola_id: escolaId, p_curso_id: input.data.cursoId, p_ano_letivo_id: year.id,
      p_page: input.data.page, p_page_size: input.data.pageSize,
      p_classe_id: input.data.classeId, p_search: input.data.search?.trim() || null,
    });
    if (error) {
      const unavailable = error.code === "PGRST202" || error.code === "42883";
      const invalid = error.code === "22023";
      return NextResponse.json({ ok: false, error: unavailable
        ? "A paginação do curso ainda não está instalada neste ambiente."
        : invalid ? "Classe ou janela inválida." : "Não foi possível carregar as turmas." },
        { status: unavailable ? 503 : invalid ? 400 : 500 });
    }
    if (!data) return NextResponse.json({ ok: false, error: "Curso não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, data },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Falha ao carregar turmas do curso." }, { status: 500 });
  }
}
export async function GET(req: NextRequest, context: {
  params: Promise<{ id: string; cursoId: string }>;
}) {
  return withExplorerObservability("curso-turmas", () => readPage(req, context));
}
