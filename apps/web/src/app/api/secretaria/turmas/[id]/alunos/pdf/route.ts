import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { requireFeature } from "@/lib/plan/requireFeature";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { renderListaNominalPdfBuffer } from "@/lib/documentos/listaNominalPdf";
import { canExportSensitiveRosterFields } from "@/lib/documentos/rosterSensitivePermission";
import { recordAuditServer } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id: turmaId } = await params;
    const { data: turmaScope } = await supabase
      .from("turmas")
      .select("escola_id")
      .eq("id", turmaId)
      .maybeSingle();

    const escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      (turmaScope as any)?.escola_id ?? null
    );
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Escola não encontrada" },
        { status: 400 }
      );
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const isAttendance = searchParams.get("attendance") === "true";
    const month = searchParams.get("month");
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const disciplinaId = searchParams.get("disciplina_id");
    const isAlbum = searchParams.get("album") === "true";
    const enableQr = searchParams.get("qr") === "true";
    if (enableQr || isAlbum || isAttendance || month) await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });
    const includeAllStatus = searchParams.get("all_status") === "true";
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
    const fallbackLogoUrl = `${new URL(req.url).origin}/insignia_med.png`;

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const pdfBytes = await renderListaNominalPdfBuffer({
      supabase: supabase as any,
      escolaId,
      turmaId,
      month,
      year,
      isAttendance,
      disciplinaId,
      isAlbum,
      includeAllStatus,
      mode,
      enableQr,
      camposSensiveis,
      emissor: user.email ?? user.id,
      fallbackLogoUrl,
    });

    if (camposSensiveis) {
      await recordAuditServer({
        escolaId, portal: "secretaria", acao: "LISTA_NOMINAL_SENSIVEL_EXPORTADA",
        entity: "turmas", entityId: turmaId,
        details: { modo: mode ?? "automatico", ano: year, campos: ["nascimento", "naturalidade", "bi"] },
      });
    }

    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `attachment; filename="lista_escola_${escolaId}_turma_${turmaId}_${year}_${new Date().toISOString().slice(0,10)}.pdf"`
    );
    return new NextResponse(pdfBytes as any, {
      headers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[secretaria/turmas/pdf] error:", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
