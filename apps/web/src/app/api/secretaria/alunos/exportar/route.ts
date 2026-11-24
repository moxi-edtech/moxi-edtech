import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { InvalidAlunoFiltersError, listAllAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import { loadAlunosPdfInstitutionalContext } from "@/lib/services/alunosExportPdfContext.server";
import {
  parseAlunoExportFormat,
  renderAlunosExport,
  sortAlunoExportRows,
} from "@/lib/services/alunosExport.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let phase = "authorization";
  try {
    const supabase = await createRouteClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const requestedEscolaId = url.searchParams.get("escolaId") || url.searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase, userRes.user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (authz.error) {
      return authz.error;
    }

    const context = await resolveAcademicYearContext(supabase as any, {
      userId: userRes.user.id,
      requestedAcademicYearId: url.searchParams.get("ano_letivo_id"),
      operation: "READ",
    });
    phase = "filters";
    const filters = parseAlunoListFilters(url);
    const format = parseAlunoExportFormat(url.searchParams.get("tipo"));
    phase = "list";
    console.info("[alunos export start]", { requestId, format });
    const sorted = sortAlunoExportRows(
      await listAllAlunos(supabase, escolaId, filters, {
        includeFinanceiro: true,
        includeResumo: true,
        academicYearId: filters.ano ? undefined : context.anoLetivoId,
      })
    );
    phase = "pdf-context";
    const pdfContext = format === "pdf"
      ? await loadAlunosPdfInstitutionalContext(supabase, escolaId, filters, {
          academicYearId: filters.ano ? undefined : context.anoLetivoId,
        })
      : undefined;
    phase = "render";
    const rendered = await renderAlunosExport(sorted, format, pdfContext);
    console.info("[alunos export ready]", { requestId, format, elapsedMs: Date.now() - startedAt });
    const status = filters.status ?? "ativo";
    const segmento = filters.situacaoFinanceira === "em_atraso" ? "inadimplentes" : status;
    const filename = `alunos-${segmento}-${Date.now()}.${rendered.extension}`;

    return new NextResponse(rendered.body as BodyInit, {
      headers: {
        "Content-Type": rendered.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof InvalidAlunoFiltersError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
    }
    console.error("[alunos export error]", { requestId, phase, elapsedMs: Date.now() - startedAt, code: e?.code });
    return NextResponse.json({ ok: false, error: "Não foi possível gerar a lista de alunos.", requestId }, { status: 500 });
  }
}
