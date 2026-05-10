import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { AlertTriangle, CheckCircle2, Clock, FileText, GraduationCap } from "lucide-react";
import { buildPortalHref } from "@/lib/navigation";
import Link from "next/link";
import { buildCutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import type { Database } from "~types/supabase";
import { CutoverResolveActions } from "@/components/secretaria/virada-ano/CutoverResolveActions";

type FechamentoJob = {
  run_id: string;
  estado: string;
  fechamento_tipo: string | null;
  created_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type FechamentoStep = {
  run_id: string;
  etapa: string;
  status: string;
  created_at: string | null;
};

type LoteJob = {
  id: string;
  status: string;
  tipo: string | null;
  documento_tipo: string | null;
  created_at: string | null;
  updated_at: string | null;
  processed: number | null;
  total_turmas: number | null;
  success_count: number | null;
  failed_count: number | null;
  error_message: string | null;
};

const isFinal = (status: string) => ["DONE", "FAILED", "SUCCESS"].includes(status);

function formatDate(value: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

type SearchParams = {
  periodo?: string;
  status?: string;
  tipo?: string;
};

const PERIOD_OPTIONS = [
  { value: "24h", label: "Últimas 24h", hours: 24 },
  { value: "7d", label: "Últimos 7 dias", hours: 24 * 7 },
  { value: "30d", label: "Últimos 30 dias", hours: 24 * 30 },
];

export default async function OperacoesAcademicasPage({
  params,
  searchParams,
}: {
  params?: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const resolvedParams = params ? await params : null;
  const s = await supabaseServerTyped<Database>();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  let escolaId: string | null = null;
  let escolaSlug: string | null = resolvedParams?.id ?? null;

  if (user) {
    const { data: prof } = await s
      .from("profiles")
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();
    escolaId = (prof as { escola_id?: string | null })?.escola_id ?? null;
    
    if (!escolaSlug && escolaId) {
      const { data: esc } = await s
        .from("escolas")
        .select("slug")
        .eq("id", escolaId)
        .maybeSingle();
      escolaSlug = esc?.slug ?? null;
    }
  }

  const escolaParam = escolaSlug || escolaId;

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="operacoes_academicas" />
        <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded text-klasse-gold-800 text-sm">
          Vincule seu perfil a uma escola para acompanhar operações acadêmicas.
        </div>
      </>
    );
  }

  const selectedPeriod = resolvedSearchParams?.periodo ?? "7d";
  const selectedStatus = resolvedSearchParams?.status ?? "all";
  const selectedTipo = resolvedSearchParams?.tipo ?? "all";
  const queryParams = new URLSearchParams({
    periodo: selectedPeriod,
    status: selectedStatus,
    tipo: selectedTipo,
  });
  const monitorQuery = queryParams.toString();
  const exportJsonHref = `/api/secretaria/operacoes-academicas/export?${monitorQuery}&format=json`;
  const exportCsvHref = `/api/secretaria/operacoes-academicas/export?${monitorQuery}&format=csv`;
  const periodConfig = PERIOD_OPTIONS.find((p) => p.value === selectedPeriod) ?? PERIOD_OPTIONS[1];
  const now = new Date();
  const minDate = new Date(now.getTime() - periodConfig.hours * 60 * 60 * 1000).toISOString();

  const { data: fechamentoJobs } = await s
    .from("fechamento_academico_jobs")
    .select("run_id,estado,fechamento_tipo,created_at,updated_at,started_at,finished_at")
    .eq("escola_id", escolaId)
    .gte("created_at", minDate)
    .order("created_at", { ascending: false })
    .limit(10);

  const runIds = (fechamentoJobs ?? []).map((job) => job.run_id);
  const { data: steps } = runIds.length
    ? await s
        .from("fechamento_academico_job_steps")
        .select("run_id,etapa,status,created_at")
        .in("run_id", runIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastStepByRun = new Map<string, FechamentoStep>();
  (steps ?? []).forEach((step) => {
    if (!lastStepByRun.has(step.run_id)) lastStepByRun.set(step.run_id, step as FechamentoStep);
  });

  const { data: loteJobs } = await s
    .from("pautas_lote_jobs")
    .select("id,status,tipo,documento_tipo,created_at,updated_at,processed,total_turmas,success_count,failed_count,error_message")
    .eq("escola_id", escolaId)
    .gte("created_at", minDate)
    .order("created_at", { ascending: false })
    .limit(10);

  const nowMs = now.getTime();
  const statusFilter = selectedStatus.toLowerCase();

  const filteredFechamento = (fechamentoJobs ?? []).filter((job) => {
    if (selectedTipo !== "all" && selectedTipo !== "fechamento") return false;
    const estado = String(job.estado || "").toUpperCase();
    if (statusFilter === "success") return estado === "DONE";
    if (statusFilter === "failed") return estado === "FAILED";
    if (statusFilter === "processing") return !["DONE", "FAILED"].includes(estado);
    return true;
  });

  const filteredLotes = (loteJobs ?? []).filter((job) => {
    if (selectedTipo !== "all" && selectedTipo !== "documentos") return false;
    const status = String(job.status || "").toUpperCase();
    if (statusFilter === "success") return status === "SUCCESS";
    if (statusFilter === "failed") return status === "FAILED";
    if (statusFilter === "processing") return !["SUCCESS", "FAILED"].includes(status);
    return true;
  });
  const fechamentoStuck = filteredFechamento.filter((job) => {
    const estado = String(job.estado || "").toUpperCase();
    if (["DONE", "FAILED"].includes(estado)) return false;
    const ref = job.started_at || job.updated_at || job.created_at;
    if (!ref) return false;
    return nowMs - new Date(ref).getTime() > 30 * 60 * 1000;
  });

  const loteStuck = filteredLotes.filter((job) => {
    const status = String(job.status || "").toUpperCase();
    if (["SUCCESS", "FAILED"].includes(status)) return false;
    const ref = job.updated_at || job.created_at;
    if (!ref) return false;
    return nowMs - new Date(ref).getTime() > 30 * 60 * 1000;
  });

  const fechamentoFalhas = filteredFechamento.filter((job) => String(job.estado || "").toUpperCase() === "FAILED").length;
  const loteFalhas = filteredLotes.filter((job) => String(job.status || "").toUpperCase() === "FAILED").length;
  const cutoverHealth = await buildCutoverHealthReport(s, escolaId);
  const cutoverStatusClass =
    cutoverHealth.status === "BLOCKED"
      ? "bg-red-100 text-red-700"
      : cutoverHealth.status === "WARN"
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="operacoes_academicas" />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <DashboardHeader
            title="Operações Académicas"
            description="Painel único para monitoramento de fechamento acadêmico e lotes oficiais."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Secretaria", href: "/secretaria" },
              { label: "Operações Académicas" },
            ]}
          />
          <div>
            <Link
              href={buildPortalHref(escolaParam, "/admin/operacoes-academicas/wizard")}
              className="text-xs font-semibold text-klasse-green hover:underline"
            >
              Abrir wizard simplificado
            </Link>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_auto_auto_auto] items-end" method="get">
          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Período</label>
            <select
              name="periodo"
              defaultValue={selectedPeriod}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Status</label>
            <select
              name="status"
              defaultValue={selectedStatus}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            >
              <option value="all">Todos</option>
              <option value="success">Sucesso</option>
              <option value="failed">Falha</option>
              <option value="processing">Em processamento</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-slate-400">Tipo</label>
            <select
              name="tipo"
              defaultValue={selectedTipo}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            >
              <option value="all">Todos</option>
              <option value="fechamento">Fechamento</option>
              <option value="documentos">Documentos</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Aplicar filtros
          </button>
          <a
            href={exportJsonHref}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Exportar JSON
          </a>
          <a
            href={exportCsvHref}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Exportar CSV
          </a>
        </form>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase font-semibold">SSOT virada</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cutoverStatusClass}`}>
                {cutoverHealth.status}
              </span>
              <span className="text-xs text-slate-600">
                {cutoverHealth.active_year ? `ano ativo ${cutoverHealth.active_year.ano}` : "sem ano ativo"}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase font-semibold">Fechamentos em aberto</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {filteredFechamento.filter((j) => !["DONE", "FAILED"].includes(String(j.estado || "").toUpperCase())).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase font-semibold">Lotes em aberto</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {filteredLotes.filter((j) => !["SUCCESS", "FAILED"].includes(String(j.status || "").toUpperCase())).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 uppercase font-semibold">Falhas recentes</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{fechamentoFalhas + loteFalhas}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Saúde da Virada de Ano (SSOT)</h2>
            <form action="/api/secretaria/operacoes-academicas/virada/dry-run" method="post">
              <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Executar dry-run
              </button>
            </form>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Turmas sem sessão</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.turmas_session_id_null}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Matrículas sem sessão</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.matriculas_session_id_null}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Histórico anual</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.historico_anos_total}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Snapshot locks</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.snapshot_locks_total}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Mensalidades fora janela</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.mensalidades_competencia_fora_janela}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Mensalidades sem matrícula</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.mensalidades_sem_matricula_id}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Currículos pendentes</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.curriculos_classes_pendentes}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Pautas anuais pendentes</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.pautas_anuais_pendentes}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Matrículas sem final</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.matriculas_status_final_pendente}</p>
            </div>
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Snapshots pendentes</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{cutoverHealth.metrics.snapshot_locks_pendentes}</p>
            </div>
          </div>
          {cutoverHealth.blockers.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Bloqueadores</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
                {cutoverHealth.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {cutoverHealth.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">Alertas</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
                {cutoverHealth.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <CutoverResolveActions
            activeYearId={cutoverHealth.active_year?.id ?? null}
            metrics={cutoverHealth.metrics}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {selectedTipo !== "documentos" && (
            <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Fechamento Académico
              </h2>
              <Link href={buildPortalHref(escolaParam, `/admin/operacoes-academicas/fechamento-academico?${monitorQuery}`)} className="text-xs font-semibold text-klasse-green hover:underline">
                Abrir monitor
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(filteredFechamento as FechamentoJob[] | null)?.length ? (
                (filteredFechamento as FechamentoJob[]).map((job) => {
                  const estado = String(job.estado || "");
                  const step = lastStepByRun.get(job.run_id);
                  const statusClass = ["FAILED"].includes(estado)
                    ? "bg-klasse-gold/20 text-klasse-gold"
                    : ["DONE"].includes(estado)
                      ? "bg-klasse-green/10 text-klasse-green"
                      : "bg-slate-100 text-slate-600";
                  return (
                    <div key={job.run_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700">{job.fechamento_tipo || "fechamento"}</p>
                        <p className="text-slate-400">{job.run_id.slice(0, 8)} · {formatDate(job.created_at)}</p>
                        {step ? (
                          <p className="text-[10px] text-slate-400">Última etapa: {step.etapa}</p>
                        ) : null}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                        {estado}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">Nenhum fechamento recente.</p>
              )}
            </div>
            {fechamentoStuck.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-klasse-gold">
                <Clock className="h-3.5 w-3.5" /> {fechamentoStuck.length} job(s) acima de 30m sem conclusão.
              </div>
            )}
          </div>
          )}

          {selectedTipo !== "fechamento" && (
            <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentos Oficiais (Lote)
              </h2>
              <Link href={buildPortalHref(escolaParam, `/admin/operacoes-academicas/documentos-oficiais?${monitorQuery}`)} className="text-xs font-semibold text-klasse-green hover:underline">
                Abrir monitor
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(filteredLotes as LoteJob[] | null)?.length ? (
                (filteredLotes as LoteJob[]).map((job) => {
                  const status = String(job.status || "");
                  const statusClass = ["FAILED"].includes(status)
                    ? "bg-klasse-gold/20 text-klasse-gold"
                    : ["SUCCESS"].includes(status)
                      ? "bg-klasse-green/10 text-klasse-green"
                      : "bg-slate-100 text-slate-600";
                  return (
                    <div key={job.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700">{job.documento_tipo || job.tipo || "lote"}</p>
                        <p className="text-slate-400">{job.id.slice(0, 8)} · {formatDate(job.created_at)}</p>
                        {job.total_turmas ? (
                          <p className="text-[10px] text-slate-400">
                            {job.processed ?? 0}/{job.total_turmas} turmas processadas
                          </p>
                        ) : null}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                        {status}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">Nenhum lote recente.</p>
              )}
            </div>
            {loteStuck.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-klasse-gold">
                <Clock className="h-3.5 w-3.5" /> {loteStuck.length} job(s) acima de 30m sem conclusão.
              </div>
            )}
          </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            {fechamentoFalhas + loteFalhas > 0 ? <AlertTriangle className="h-4 w-4 text-klasse-gold" /> : <CheckCircle2 className="h-4 w-4 text-klasse-green" />}
            {fechamentoFalhas + loteFalhas > 0
              ? "Há falhas recentes. Recomenda-se revisar os logs dos jobs."
              : "Nenhuma falha recente registrada nos jobs."}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Receitas de reprocessamento</h2>
            <p className="text-xs text-slate-500">
              Guia rápido por classe de erro para execução assistida.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-700">Dados faltantes (notas/frequências)</p>
              <p className="text-xs text-slate-500 mt-1">
                Corrigir pendências e reexecutar o fechamento a partir do monitor.
              </p>
              <Link href={buildPortalHref(escolaParam, "/admin/notas")} className="text-[10px] font-semibold text-klasse-green hover:underline">
                Abrir notas
              </Link>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-700">Snapshot legal bloqueado</p>
              <p className="text-xs text-slate-500 mt-1">
                Solicitar reabertura auditada e repetir fechamento com justificativa.
              </p>
              <Link href={buildPortalHref(escolaParam, "/admin/operacoes-academicas/fechamento-academico")} className="text-[10px] font-semibold text-klasse-green hover:underline">
                Abrir fechamento
              </Link>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-700">Permissões insuficientes</p>
              <p className="text-xs text-slate-500 mt-1">
                Revalidar roles do operador antes de reprocessar.
              </p>
              <Link href={buildPortalHref(escolaParam, "/admin/configuracoes/seguranca")} className="text-[10px] font-semibold text-klasse-green hover:underline">
                Ver acessos
              </Link>
            </div>
            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-700">Falha de storage (ZIP/manifest)</p>
              <p className="text-xs text-slate-500 mt-1">
                Reprocessar o lote com falha e verificar o download.
              </p>
              <Link href={buildPortalHref(escolaParam, "/admin/operacoes-academicas/documentos-oficiais")} className="text-[10px] font-semibold text-klasse-green hover:underline">
                Abrir documentos oficiais
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
