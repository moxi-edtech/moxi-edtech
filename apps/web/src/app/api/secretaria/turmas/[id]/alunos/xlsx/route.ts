import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resumoExclusoes, type ListaNominalMode } from "@/lib/documentos/listaNominalPolicy";
import { renderNominalXlsx } from "@/lib/documentos/listaNominalXlsx";
import {
  authorizeNominalExport, loadNominalRoster, NominalRosterError, toNominalXlsxRows,
} from "@/lib/documentos/listaNominalService";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function deny(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}

/** Excel nominal por turma: mesma autorização, sessão, paginação e estados do PDF. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  if (url.searchParams.has("polo_id") || url.searchParams.has("poloId")) {
    return deny("Exportação por polo indisponível sem vínculo canónico", 403);
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return deny("Origem da exportação não autorizada", 403);
  }
  const requestedMode = url.searchParams.get("mode");
  if (requestedMode && requestedMode !== "ano_letivo" && requestedMode !== "operacional") {
    return deny("Modo de lista inválido", 400);
  }
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return deny("Sessão terminada", 401);
    const { id: turmaId } = await params;
    const escolaId = await authorizeNominalExport(supabase, auth.user.id, { turmaId });
    const roster = await loadNominalRoster({
      supabase, escolaId, turmaId,
      mode: requestedMode as ListaNominalMode | undefined,
      includeAllStatus: url.searchParams.get("all_status") === "true",
    });
    const rows = toNominalXlsxRows(roster);
    const workbook = renderNominalXlsx({
      escola: roster.escola.nome ?? "Escola",
      turma: roster.turma.nome ?? "—",
      ano: roster.anoLabel, mode: roster.mode,
      totalOrigem: roster.seleccao.totalOrigem,
      exclusoes: resumoExclusoes(roster.seleccao.excluidos), rows,
    });

    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId, portal: "secretaria",
      acao: "LISTA_NOMINAL_XLSX_EXPORTADA",
      tabela: "turmas", entity: "turmas", entity_id: turmaId,
      details: {
        actor_id: auth.user.id, turma_id: turmaId, ano_letivo_id: roster.sessionId,
        modo: roster.mode, linhas: rows.length,
        total_originais: roster.seleccao.totalOrigem,
        total_excluidos: roster.seleccao.totalOrigem - rows.length,
        campos_sensiveis: false,
      },
    });
    if (auditError) return deny("Auditoria indisponível. Excel não emitido.", 503);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="lista_turma_' +
          turmaId + "_" + roster.anoLabel.replace("/", "-") + '.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Lista-Mode": roster.mode,
      },
    });
  } catch (error) {
    if (error instanceof NominalRosterError) return deny(error.message, error.status);
    return deny("Não foi possível gerar o Excel da turma", 500);
  }
}
