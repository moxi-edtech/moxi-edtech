import { NextResponse } from "next/server";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const { id: jobId } = await ctx.params;
    const { data: job, error } = await supabase
      .from("pautas_lote_jobs")
      .select("id,tipo,documento_tipo,periodo_letivo_id,status,total_turmas,processed,success_count,failed_count,zip_path,manifest_path,zip_checksum_sha256,signed_url_expires_at,error_message,created_at,updated_at")
      .eq("id", jobId)
      .eq("escola_id", escolaId)
      .single();

    if (error || !job) return NextResponse.json({ ok: false, error: error?.message || "Lote não encontrado" }, { status: 404 });

    const { data: itens } = await supabase
      .from("pautas_lote_itens")
      .select("id,turma_id,status,pdf_path,checksum_sha256,artifact_expires_at,error_message,retry_count,updated_at")
      .eq("job_id", jobId)
      .order("updated_at", { ascending: false });

    return NextResponse.json({ ok: true, job: { ...job, itens: itens ?? [] } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
