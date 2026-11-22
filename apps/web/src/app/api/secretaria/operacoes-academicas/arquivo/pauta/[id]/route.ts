import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const Query = z.object({
  id: z.string().uuid(),
  turma_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
});
function deny(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}

/** Apenas segunda leitura de PDF previamente publicado; nunca gerar nem alterar pauta. */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const search = new URL(req.url).searchParams;
    const parsed = Query.safeParse({
      id: (await context.params).id,
      turma_id: search.get("turma_id"),
      ano_letivo_id: search.get("ano_letivo_id"),
    });
    if (!parsed.success) return deny("Identificadores inválidos.", 400);
    const supabase = await supabaseServerTyped<any>();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) return deny("Não autenticado.", 401);

    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, search.get("escola_id"));
    if (!escolaId) return deny("Sem acesso à escola.", 403);
    const permission = await authorizeTurmasManage(supabase, escolaId, auth.user.id);
    if (!permission.allowed) return deny("Sem permissão para consultar pautas.", 403);
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.ano_letivo_id, operation: "READ",
    });
    if (year.status !== "CLOSED") return deny("O ano solicitado não pertence ao arquivo.", 409);

    const [turmaRes, pautaRes] = await Promise.all([
      supabase.from("turmas").select("id").eq("escola_id", escolaId)
        .eq("session_id", year.id).eq("id", parsed.data.turma_id).maybeSingle(),
      supabase.from("pautas_oficiais")
        .select("id, periodo_letivo_id, pdf_path, status")
        .eq("id", parsed.data.id)
        .eq("escola_id", escolaId).eq("turma_id", parsed.data.turma_id)
        .maybeSingle(),
    ]);
    if (turmaRes.error || pautaRes.error) throw turmaRes.error ?? pautaRes.error;
    if (!turmaRes.data || !pautaRes.data || pautaRes.data.status !== "SUCCESS" || !pautaRes.data.pdf_path) {
      return deny("Pauta oficial fechada não encontrada nesta turma.", 404);
    }
    const { data: period, error: periodError } = await supabase.from("periodos_letivos")
      .select("id").eq("id", pautaRes.data.periodo_letivo_id)
      .eq("escola_id", escolaId).eq("ano_letivo_id", year.id).maybeSingle();
    if (periodError) throw periodError;
    if (!period) return deny("A pauta não pertence ao ano selecionado.", 409);

    const { data: signed, error: signError } = await supabase.storage
      .from("pautas_oficiais_fechadas")
      .createSignedUrl(pautaRes.data.pdf_path, 60);
    if (signError || !signed?.signedUrl) return deny("Documento indisponível para este utilizador.", 403);
    return NextResponse.redirect(signed.signedUrl, {
      status: 302, headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof AcademicYearContextError) return deny(err.message, err.status);
    console.error("[ArquivoPauta] Falha de consulta", err);
    return deny("Não foi possível abrir a pauta publicada.", 500);
  }
}
