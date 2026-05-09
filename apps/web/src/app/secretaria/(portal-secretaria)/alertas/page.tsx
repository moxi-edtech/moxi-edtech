import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type FechamentoJob = {
  run_id: string;
  estado: string;
  fechamento_tipo: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type PautasJob = {
  id: string;
  status: string;
  tipo: string | null;
  documento_tipo: string | null;
  created_at: string | null;
  updated_at: string | null;
  error_message: string | null;
  processed: number | null;
  total_turmas: number | null;
  success_count: number | null;
  failed_count: number | null;
};

export default async function Page() {
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  let isSuperAdmin = false
  if (user) {
    const { data: prof } = await s
      .from('profiles')
      .select('escola_id, role')
      .eq('user_id', user.id)
      .maybeSingle()
    escolaId = (prof as any)?.escola_id ?? null
    isSuperAdmin = ((prof as any)?.role) === 'super_admin'
  }
  if (!escolaId) {
    return (
      <>
<AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alertas" />
        <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded text-klasse-gold-800 text-sm">
          Vincule seu perfil a uma escola para configurar alertas.
        </div>
      </>
    )
  }
  const eid: string = escolaId
  let plan: PlanTier = 'essencial'
  try {
    const res = await fetch(`/api/secretaria/dashboard/summary`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    plan = parsePlanTier(json?.escola?.plano)
  } catch {}
  const allowed = plan === 'profissional' || plan === 'premium'

  const { data: fechamentoJobs } = await s
    .from('fechamento_academico_jobs')
    .select('run_id,estado,fechamento_tipo,started_at,finished_at,updated_at,created_at')
    .eq('escola_id', eid)
    .order('created_at', { ascending: false })
    .limit(8);

  const { data: pautasJobs } = await s
    .from('pautas_lote_jobs')
    .select('id,status,tipo,documento_tipo,created_at,updated_at,error_message,processed,total_turmas,success_count,failed_count')
    .eq('escola_id', eid)
    .order('created_at', { ascending: false })
    .limit(8);

  const now = Date.now();
  const fechamentoStuck = (fechamentoJobs || []).filter((job) => {
    const estado = String(job.estado || '').toUpperCase();
    if (['DONE', 'FAILED'].includes(estado)) return false;
    const ref = job.started_at || job.updated_at || job.created_at;
    if (!ref) return false;
    return now - new Date(ref).getTime() > 30 * 60 * 1000;
  });

  const pautasStuck = (pautasJobs || []).filter((job) => {
    const status = String(job.status || '').toUpperCase();
    if (['SUCCESS', 'FAILED'].includes(status)) return false;
    const ref = job.updated_at || job.created_at;
    if (!ref) return false;
    return now - new Date(ref).getTime() > 30 * 60 * 1000;
  });

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alertas" />
      <div className="bg-white rounded-xl shadow border p-5 space-y-6">
        <div>
          <h1 className="text-lg font-semibold mb-1">Alertas (Secretaria)</h1>
          <p className="text-xs text-slate-500">Telemetria interna de jobs críticos.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Fechamento Académico</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">últimos 8</span>
                <a
                  href="fechamento-academico"
                  className="text-[10px] font-semibold text-klasse-green hover:underline"
                >
                  Abrir monitor
                </a>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {fechamentoJobs?.length ? (
                fechamentoJobs.map((job) => (
                  <div key={job.run_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700">{job.fechamento_tipo || 'fechamento'}</p>
                      <p className="text-slate-400">{job.run_id.slice(0, 8)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ['FAILED'].includes(String(job.estado || '').toUpperCase())
                        ? 'bg-klasse-gold/20 text-klasse-gold'
                        : ['DONE'].includes(String(job.estado || '').toUpperCase())
                          ? 'bg-klasse-green/10 text-klasse-green'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {job.estado}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Nenhum job recente.</p>
              )}
            </div>
            {fechamentoStuck.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-klasse-gold">
                <Clock className="h-3.5 w-3.5" /> {fechamentoStuck.length} job(s) acima de 30m sem conclusão.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Documentos Oficiais (Lote)</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">últimos 8</span>
                <a
                  href="documentos-oficiais"
                  className="text-[10px] font-semibold text-klasse-green hover:underline"
                >
                  Abrir monitor
                </a>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {pautasJobs?.length ? (
                pautasJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700">{job.documento_tipo || job.tipo || 'lote'}</p>
                      <p className="text-slate-400">{job.id.slice(0, 8)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ['FAILED'].includes(String(job.status || '').toUpperCase())
                        ? 'bg-klasse-gold/20 text-klasse-gold'
                        : ['SUCCESS'].includes(String(job.status || '').toUpperCase())
                          ? 'bg-klasse-green/10 text-klasse-green'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Nenhum job recente.</p>
              )}
            </div>
            {pautasStuck.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-klasse-gold">
                <Clock className="h-3.5 w-3.5" /> {pautasStuck.length} job(s) acima de 30m sem conclusão.
              </div>
            )}
          </div>
        </div>

        {!allowed && (
          <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded text-klasse-gold-800 text-sm">
            Alertas automáticos por responsável estão disponíveis no plano {PLAN_NAMES.profissional} ou {PLAN_NAMES.premium}.
            {isSuperAdmin && escolaId && (
              <> {' '}<a href={`/super-admin/escolas/${escolaId}/edit`} className="underline text-klasse-gold-900">Abrir edição da escola</a></>
            )}
          </div>
        )}
      </div>
    </>
  )
}
