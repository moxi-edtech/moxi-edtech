import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { listAllAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import {
  parseAlunoExportFormat,
  renderAlunosExport,
  sortAlunoExportRows,
} from "@/lib/services/alunosExport.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
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

    const filters = parseAlunoListFilters(url);
    const format = parseAlunoExportFormat(url.searchParams.get("tipo"));
    const sorted = sortAlunoExportRows(
      await listAllAlunos(supabase, escolaId, filters, { includeFinanceiro: true, includeResumo: true })
    );
    const rendered = await renderAlunosExport(sorted, format);
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
    console.error("[alunos export error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro desconhecido" }, { status: 500 });
  }
}
