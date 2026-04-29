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

type ReportRow = {
  index?: number;
  status?: string;
  code?: string;
  error?: string;
  user_id?: string;
  valor_cobrado?: number;
  created_user?: boolean;
};

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\"")) {
    return `"${raw.replace(/\"/g, '""')}"`;
  }
  return raw;
}

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const batchId = new URL(request.url).searchParams.get("batch_id")?.trim() ?? "";
  if (!batchId) {
    return new Response(JSON.stringify({ ok: false, error: "batch_id é obrigatório" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_b2b_upload_jobs")
    .select("id, status, report")
    .eq("escola_id", auth.escolaId)
    .eq("id", batchId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ ok: false, error: "batch_id não encontrado" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const report = (data as { report?: { results?: ReportRow[] } }).report;
  const rows = Array.isArray(report?.results) ? report.results : [];

  const header = ["index", "status", "code", "error", "user_id", "valor_cobrado", "created_user"];
  const csvRows = rows.map((row) => [
    row.index ?? "",
    row.status ?? "",
    row.code ?? "",
    row.error ?? "",
    row.user_id ?? "",
    row.valor_cobrado ?? "",
    row.created_user ?? "",
  ].map(csvEscape).join(","));

  const csv = [header.join(","), ...csvRows].join("\n");
  const filename = `formacao-b2b-upload-${batchId}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"${filename}\"`,
      "cache-control": "no-store",
    },
  });
}
