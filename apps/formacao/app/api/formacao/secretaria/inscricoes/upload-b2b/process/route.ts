import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { processB2BUploadJob } from "@/lib/b2b-upload-jobs";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formacao_financeiro",
  "super_admin",
  "global_admin",
];

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { batch_id?: string } | null;
  const batchId = String(body?.batch_id ?? "").trim();
  if (!batchId) return NextResponse.json({ ok: false, error: "batch_id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;

  const { data: job, error: jobError } = await s
    .from("formacao_b2b_upload_jobs")
    .select("id, status, payload, escola_id")
    .eq("escola_id", auth.escolaId)
    .eq("id", batchId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ ok: false, error: jobError.message }, { status: 400 });
  if (!job) return NextResponse.json({ ok: false, error: "batch_id não encontrado" }, { status: 404 });

  const typedJob = job as { id: string; status: string; payload: Record<string, unknown> | null; escola_id: string };
  if (["running"].includes(typedJob.status)) {
    return NextResponse.json({ ok: false, error: "job já está em execução" }, { status: 409 });
  }

  await s
    .from("formacao_b2b_upload_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      last_error: null,
      processed_rows: 0,
      success_count: 0,
      failed_count: 0,
      report: null,
      updated_at: new Date().toISOString(),
    })
    .eq("escola_id", auth.escolaId)
    .eq("id", batchId);

  try {
    const report = await processB2BUploadJob({
      supabase: s,
      escolaId: String(auth.escolaId),
      userId: String(auth.userId),
      payload: (typedJob.payload ?? {}) as any,
    });

    const status = report.failed > 0 && report.success > 0 ? "partial" : report.failed > 0 ? "failed" : "success";

    await s
      .from("formacao_b2b_upload_jobs")
      .update({
        status,
        processed_rows: report.total,
        success_count: report.success,
        failed_count: report.failed,
        report,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("escola_id", auth.escolaId)
      .eq("id", batchId);

    return NextResponse.json({
      ok: true,
      batch_id: batchId,
      status,
      report,
      report_csv_url: `/api/formacao/secretaria/inscricoes/upload-b2b/report.csv?batch_id=${batchId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar lote";
    await s
      .from("formacao_b2b_upload_jobs")
      .update({
        status: "failed",
        last_error: message,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("escola_id", auth.escolaId)
      .eq("id", batchId);

    return NextResponse.json({ ok: false, error: message, batch_id: batchId }, { status: 500 });
  }
}
