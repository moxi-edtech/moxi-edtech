import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formacao_financeiro",
  "super_admin",
  "global_admin",
];

type UploadRow = {
  nome?: string;
  email?: string;
  bi_numero?: string;
  telefone?: string;
  valor_cobrado?: number;
};

type UploadPayload = {
  cohort_id?: string;
  cliente_b2b_id?: string;
  cliente_nome?: string;
  vencimento_em?: string;
  descricao_cobranca?: string;
  valor_cobrado_padrao?: number;
  criar_cobranca?: boolean;
  rows?: UploadRow[];
};

async function assertCohortInTenant(s: FormacaoSupabaseClient, escolaId: string, cohortId: string) {
  const { data, error } = await s
    .from("formacao_cohorts")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("id", cohortId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function assertB2BClientInTenant(s: FormacaoSupabaseClient, escolaId: string, clienteId: string) {
  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("id", clienteId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const batchId = new URL(request.url).searchParams.get("batch_id")?.trim() ?? "";
  const s = auth.supabase as FormacaoSupabaseClient;

  if (batchId) {
    const { data, error } = await s
      .from("formacao_b2b_upload_jobs")
      .select("id, status, total_rows, processed_rows, success_count, failed_count, created_at, started_at, finished_at, last_error, report")
      .eq("escola_id", auth.escolaId)
      .eq("id", batchId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ ok: false, error: "batch_id não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, job: data });
  }

  const { data, error } = await s
    .from("formacao_b2b_upload_jobs")
    .select("id, status, total_rows, processed_rows, success_count, failed_count, created_at, started_at, finished_at")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, jobs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as UploadPayload | null;
  const cohortId = String(body?.cohort_id ?? "").trim();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const criarCobranca = body?.criar_cobranca !== false;
  const vencimentoEm = String(body?.vencimento_em ?? "").trim();
  const clienteB2bIdInput = String(body?.cliente_b2b_id ?? "").trim();
  const s = auth.supabase as FormacaoSupabaseClient;

  if (!cohortId) return NextResponse.json({ ok: false, error: "cohort_id é obrigatório" }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "rows deve conter ao menos 1 formando" }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ ok: false, error: "rows excede limite de 5000 por lote" }, { status: 400 });
  if (criarCobranca && !vencimentoEm) {
    return NextResponse.json({ ok: false, error: "vencimento_em é obrigatório quando criar_cobranca=true" }, { status: 400 });
  }

  try {
    const cohortExists = await assertCohortInTenant(s, String(auth.escolaId), cohortId);
    if (!cohortExists) return NextResponse.json({ ok: false, error: "cohort_id inválido para esta escola" }, { status: 400 });

    if (clienteB2bIdInput) {
      const clientExists = await assertB2BClientInTenant(s, String(auth.escolaId), clienteB2bIdInput);
      if (!clientExists) {
        return NextResponse.json({ ok: false, error: "cliente_b2b_id inválido para esta escola" }, { status: 400 });
      }
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha de validação" }, { status: 400 });
  }

  const { data: job, error: jobError } = await s
    .from("formacao_b2b_upload_jobs")
    .insert({
      escola_id: auth.escolaId,
      created_by: auth.userId,
      cohort_id: cohortId,
      cliente_b2b_id: clienteB2bIdInput || null,
      payload: body ?? {},
      status: "queued",
      total_rows: rows.length,
      processed_rows: 0,
      success_count: 0,
      failed_count: 0,
    })
    .select("id, status, total_rows, created_at")
    .single();

  if (jobError) return NextResponse.json({ ok: false, error: jobError.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    batch_id: job.id,
    status: job.status,
    total_rows: job.total_rows,
    message: "Lote enfileirado. Execute /api/formacao/secretaria/inscricoes/upload-b2b/process para processar.",
    report_csv_url: `/api/formacao/secretaria/inscricoes/upload-b2b/report.csv?batch_id=${job.id}`,
  }, { status: 202 });
}
