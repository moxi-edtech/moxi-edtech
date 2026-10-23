import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { requireCommandCenterSchoolWideAccess } from "@/lib/command-center/school-wide-scope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";
import { normalizeDisciplinaSearch } from "@/lib/command-center/disciplina-explorer";

export const dynamic = "force-dynamic";
const searchSchema = z.object({
  escolaId: z.string().uuid(),
  q: z.string().min(2).max(100),
  academicYearId: z.string().uuid().nullable(),
});
const MAX_RESULTS = 8;

/** Dedicated, read-only search while the global-search RPC has no disciplina entity. */
async function readDisciplinas(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const input = searchSchema.safeParse({
    escolaId: id,
    q: url.searchParams.get("q") ?? "",
    academicYearId: url.searchParams.get("ano_letivo_id"),
  });
  if (!input.success) return NextResponse.json(
    { ok: false, error: "Pesquisa inválida." }, { status: 400 },
  );

  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(
      { ok: false, error: "Não autenticado." }, { status: 401 },
    );
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, input.data.escolaId);
    if (!escolaId) return NextResponse.json(
      { ok: false, error: "Sem acesso à escola." }, { status: 403 },
    );
    const permission = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (permission.error) return permission.error;
    const schoolScopeError = await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req);
    if (schoolScopeError) return schoolScopeError;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: input.data.academicYearId, operation: "READ",
    });
    const q = normalizeDisciplinaSearch(input.data.q);
    if (q.length < 2) return NextResponse.json(
      { ok: true, items: [], anoLetivoId: year.id },
      { headers: { "Cache-Control": "private, no-store" } },
    );

    const { data, error } = await supabase.from("disciplinas_catalogo")
      .select("id,nome,sigla,area")
      .eq("escola_id", escolaId)
      .or(`nome.ilike.%${q}%,sigla.ilike.%${q}%`)
      .order("nome", { ascending: true })
      .limit(MAX_RESULTS);
    if (error) throw error;
    const items = (data ?? []).map((row) => ({
      id: row.id,
      label: row.nome,
      highlight: row.sigla || row.area || null,
      type: "disciplina" as const,
      academicYearId: year.id,
    }));
    return NextResponse.json(
      { ok: true, items, anoLetivoId: year.id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AcademicYearContextError) return NextResponse.json(
      { ok: false, error: error.message }, { status: error.status },
    );
    return NextResponse.json(
      { ok: false, error: "Não foi possível pesquisar disciplinas." }, { status: 500 },
    );
  }
}

/** Contract: correlation on every success and failure, without private payloads in logs. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withExplorerObservability("disciplina-search", () => readDisciplinas(req, context));
}
