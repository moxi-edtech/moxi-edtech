import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireFeature } from "@/lib/plan/requireFeature";
import { renderListaNominalPdfBuffer } from "@/lib/documentos/listaNominalPdf";
import { authorizeNominalExport, NominalRosterError } from "@/lib/documentos/listaNominalService";
import { canExportSensitiveRosterFields } from "@/lib/documentos/rosterSensitivePermission";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id: classeId } = await params;
    const escolaId = await authorizeNominalExport(supabase, user.id, { classeId });

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const includeAllStatus = searchParams.get("all_status") === "true";
    const enableQr = searchParams.get("qr") === "true";
    if (enableQr) await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });
    const modeParam = searchParams.get("mode");
    if (modeParam && modeParam !== "ano_letivo" && modeParam !== "operacional") {
      return NextResponse.json({ ok: false, error: "Modo de lista inválido" }, { status: 400 });
    }
    const mode = modeParam === "ano_letivo" || modeParam === "operacional" ? modeParam : undefined;
    const camposSensiveis = searchParams.get("sensiveis") === "true";
    if (camposSensiveis) {
      const authorised = await canExportSensitiveRosterFields(supabase, escolaId, user.id);
      if (!authorised) {
        return NextResponse.json({ ok: false, error: "Campos sensíveis reservados à Direcção" }, { status: 403 });
      }
    }
    const logoBaseUrl = new URL(req.url).origin;

    let linhasExportadas = 0;
    const pdfBytes = await renderListaNominalPdfBuffer({
      supabase: supabase as any,
      escolaId,
      classeId,
      year,
      includeAllStatus,
      mode,
      enableQr,
      camposSensiveis,
      emissor: user.email ?? user.id,
      onRowsCount: (count) => { linhasExportadas = count; },
      logoBaseUrl,
    });

    const headers = new Headers();
    const { error: auditError } = await supabase.from("audit_logs").insert({
      escola_id: escolaId, portal: "secretaria",
      acao: "LISTA_NOMINAL_PDF_EXPORTADA",
      tabela: "classes", entity: "classes", entity_id: classeId,
      details: {
        actor_id: user.id, classe_id: classeId,
        modo: mode ?? "conforme_sessao", ano: year,
        linhas: linhasExportadas,
        campos_sensiveis: camposSensiveis,
        campos: camposSensiveis ? ["nascimento", "naturalidade", "bi"] : [],
      },
    });
    if (auditError) {
      return NextResponse.json({ ok: false, error: "Auditoria indisponível. Lista não emitida." }, { status: 503 });
    }

    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `attachment; filename="lista_escola_${escolaId}_classe_${classeId}_${year}_${new Date().toISOString().slice(0,10)}.pdf"`
    );

    return new NextResponse(pdfBytes as any, { headers });
  } catch (error) {
    if (error instanceof NominalRosterError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[secretaria/classes/alunos/pdf] Falha na geração da lista");
    return NextResponse.json(
      { ok: false, error: "Não foi possível gerar a lista" },
      { status: 500 }
    );
  }
}
