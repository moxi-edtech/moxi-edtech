import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuerySchema = z.object({
  periodo: z.enum(["24h", "7d", "30d"]).optional(),
  status: z.enum(["all", "success", "failed", "processing"]).optional(),
  tipo: z.enum(["all", "fechamento", "documentos"]).optional(),
  format: z.enum(["json", "csv"]).optional(),
});

const PERIOD_TO_HOURS: Record<string, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

export async function GET(req: Request) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    periodo: url.searchParams.get("periodo") || undefined,
    status: url.searchParams.get("status") || undefined,
    tipo: url.searchParams.get("tipo") || undefined,
    format: url.searchParams.get("format") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  const periodo = parsed.data.periodo ?? "7d";
  const statusFilter = (parsed.data.status ?? "all").toLowerCase();
  const tipo = parsed.data.tipo ?? "all";
  const format = parsed.data.format ?? "json";
  const minDate = new Date(Date.now() - PERIOD_TO_HOURS[periodo] * 60 * 60 * 1000).toISOString();

  const { data: fechamentoJobs } = await supabase
    .from("fechamento_academico_jobs")
    .select("run_id,estado,fechamento_tipo,created_at,updated_at,started_at,finished_at")
    .eq("escola_id", escolaId)
    .gte("created_at", minDate)
    .order("created_at", { ascending: false });

  const { data: loteJobs } = await supabase
    .from("pautas_lote_jobs")
    .select("id,status,tipo,documento_tipo,created_at,updated_at,processed,total_turmas,success_count,failed_count,error_message")
    .eq("escola_id", escolaId)
    .gte("created_at", minDate)
    .order("created_at", { ascending: false });

  const filteredFechamento = (fechamentoJobs ?? []).filter((job) => {
    if (tipo !== "all" && tipo !== "fechamento") return false;
    const estado = String(job.estado || "").toUpperCase();
    if (statusFilter === "success") return estado === "DONE";
    if (statusFilter === "failed") return estado === "FAILED";
    if (statusFilter === "processing") return !["DONE", "FAILED"].includes(estado);
    return true;
  });

  const filteredLotes = (loteJobs ?? []).filter((job) => {
    if (tipo !== "all" && tipo !== "documentos") return false;
    const status = String(job.status || "").toUpperCase();
    if (statusFilter === "success") return status === "SUCCESS";
    if (statusFilter === "failed") return status === "FAILED";
    if (statusFilter === "processing") return !["SUCCESS", "FAILED"].includes(status);
    return true;
  });

  const payload = {
    periodo,
    status: statusFilter,
    tipo,
    fechamento: filteredFechamento,
    documentos: filteredLotes,
  };

  if (format === "csv") {
    const header = "tipo,id,status,subtipo,created_at,updated_at,processed,total,success,failed,error_message";
    const rows = [
      ...filteredFechamento.map((job) => [
        "fechamento",
        job.run_id,
        job.estado,
        job.fechamento_tipo ?? "",
        job.created_at ?? "",
        job.updated_at ?? "",
        "",
        "",
        "",
        "",
        "",
      ]),
      ...filteredLotes.map((job) => [
        "documentos",
        job.id,
        job.status,
        job.documento_tipo ?? job.tipo ?? "",
        job.created_at ?? "",
        job.updated_at ?? "",
        String(job.processed ?? ""),
        String(job.total_turmas ?? ""),
        String(job.success_count ?? ""),
        String(job.failed_count ?? ""),
        job.error_message ?? "",
      ]),
    ];
    const csv = [header, ...rows.map((row) => row.map((cell) => String(cell).replace(/\n/g, " ")).join(","))].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=operacoes_academicas_${periodo}.csv`,
      },
    });
  }

  return NextResponse.json({ ok: true, ...payload });
}
