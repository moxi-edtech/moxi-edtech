import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { requireFeature } from "@/lib/plan/requireFeature";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { renderListaNominalPdfBuffer } from "@/lib/documentos/listaNominalPdf";

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
    const { data: classeScope } = await supabase
      .from("classes")
      .select("escola_id")
      .eq("id", classeId)
      .maybeSingle();

    const escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      (classeScope as any)?.escola_id ?? null
    );
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Escola não encontrada" },
        { status: 400 }
      );
    }

    await requireFeature("doc_qr_code", { requestedEscolaId: escolaId });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json(
        { ok: false, error: authz.reason || "Sem permissão" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const includeAllStatus = searchParams.get("all_status") === "true";
    const fallbackLogoUrl = `${new URL(req.url).origin}/insignia_med.png`;

    const pdfBytes = await renderListaNominalPdfBuffer({
      supabase: supabase as any,
      escolaId,
      classeId,
      year,
      includeAllStatus,
      fallbackLogoUrl,
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `attachment; filename="lista_nominal_classe_${classeId}_${year}.pdf"`
    );

    return new NextResponse(pdfBytes as any, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[secretaria/classes/alunos/pdf] error:", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
