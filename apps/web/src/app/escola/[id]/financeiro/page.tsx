import PortalLayout from "@/components/layout/PortalLayout";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const awaitedParams = await params;
  const escolaId = awaitedParams.id
  const s = await supabaseServer()

  let kpisQuery = s
    .from("vw_financeiro_kpis_mes")
    .select("mes_ref, previsto_total, realizado_total, inadimplencia_total")
    .eq("escola_id", escolaId);
  kpisQuery = applyKf2ListInvariants(kpisQuery, {
    defaultLimit: 1,
    order: [{ column: "mes_ref", ascending: false }],
  });

  let pagamentosStatusQuery = s
    .from("pagamentos_status")
    .select("status, total")
    .eq("escola_id", escolaId);
  pagamentosStatusQuery = applyKf2ListInvariants(pagamentosStatusQuery, {
    defaultLimit: 50,
    order: [{ column: "status", ascending: true }],
  });

  let radarResumoQuery = s
    .from("vw_financeiro_radar_resumo")
    .select("aluno_id, aluno_nome, turma_nome, meses_atraso, valor_total_atraso, responsavel_nome, telefone_responsavel")
    .eq("escola_id", escolaId);
  radarResumoQuery = applyKf2ListInvariants(radarResumoQuery, {
    defaultLimit: 5,
    order: [{ column: "valor_total_atraso", ascending: false }],
  });

  const [kpisRes, pagamentosStatusRes, detalhes, radarResumoRes, anoAtivoRes] = await Promise.all([
    kpisQuery,
    pagamentosStatusQuery,
    s.from("escolas").select("plano").eq("id", escolaId).maybeSingle(),
    radarResumoQuery,
    s
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("ano", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const anoLetivo = Number(anoAtivoRes.data?.ano ?? new Date().getFullYear());
  const precosRes = await findClassesSemPreco(s as any, escolaId, anoLetivo).catch(() => ({ items: [] }));

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const kpisRows = (kpisRes.data || []) as Array<{
    mes_ref?: string | null
    previsto_total?: number | null
    realizado_total?: number | null
    inadimplencia_total?: number | null
  }>;
  const kpiAtual = kpisRows.find((row) => row.mes_ref === currentMonth) ?? kpisRows[0];

  const previsto = Number(kpiAtual?.previsto_total ?? 0);
  const realizado = Number(kpiAtual?.realizado_total ?? 0);
  const inadimplenciaTotal = Number(kpiAtual?.inadimplencia_total ?? 0);
  const percentPago = previsto ? Math.round((realizado / previsto) * 100) : 0;
  const percentInadimplencia = previsto ? Math.round((inadimplenciaTotal / previsto) * 100) : 0;

  const pagamentosStatus = (pagamentosStatusRes.data ?? []) as Array<{ status?: string | null; total?: number | null }>;
  const totalPagamentos = pagamentosStatus.reduce((acc, row) => acc + Number(row.total ?? 0), 0);
  const cursosPendentes = (precosRes.items || []).length;

  const recentesInadimplentes = (radarResumoRes?.data || []) as Array<{
    aluno_id: string
    aluno_nome: string | null
    turma_nome: string | null
    meses_atraso: string[] | null
    valor_total_atraso: number | null
    responsavel_nome: string | null
    telefone_responsavel: string | null
  }>;

  const plan: PlanTier = parsePlanTier((detalhes?.data as { plano?: string | null } | null)?.plano);

  const isStandard = plan === 'profissional' || plan === 'premium';
  const isPremium = plan === 'premium';

  const formatKz = (value: number) =>
    new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value || 0);

  const formatMonth = (value: string) =>
    new Date(value).toLocaleDateString("pt-PT", { month: "short" }).replace(".", "");

  const formatTelefone = (value?: string | null) => (value || "").replace(/\D+/g, "");

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="home" />
      <div className="mb-4 text-sm text-moxinexa-gray">Plano atual: <b className="uppercase">{PLAN_NAMES[plan]}</b></div>
      {cursosPendentes > 0 && (
        <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-base font-semibold">Cursos sem tabela de preços configurada</div>
              <p className="text-sm">{cursosPendentes} curso(s) desta escola precisam de uma tabela de preços para gerar propinas corretamente.</p>
            </div>
            <Link
              href="configuracoes/precos"
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700"
            >
              Configurar preços agora
            </Link>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-moxinexa-gray text-sm font-medium">Previsto</h2>
          <p className="text-3xl font-bold text-slate-600 mt-2">{formatKz(previsto)}</p>
          <p className="text-moxinexa-gray text-sm">Total esperado</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-moxinexa-gray text-sm font-medium">Realizado</h2>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{formatKz(realizado)}</p>
          <p className="text-moxinexa-gray text-sm">{percentPago}% do previsto</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-moxinexa-gray text-sm font-medium">Inadimplência</h2>
          <p className="text-3xl font-bold text-rose-600 mt-2">{formatKz(inadimplenciaTotal)}</p>
          <p className="text-moxinexa-gray text-sm">{percentInadimplencia}% do previsto</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inadimplência Recente</h2>
              <p className="text-xs text-slate-500">Últimos lançamentos em atraso</p>
            </div>
            <Link
              href={`/escola/${escolaId}/financeiro/radar`}
              className="text-xs font-semibold text-moxinexa-teal hover:underline"
            >
              Ver lista completa
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentesInadimplentes.length === 0 && (
              <div className="text-sm text-slate-500">Sem pendências recentes.</div>
            )}
            {recentesInadimplentes.map((row) => {
              const telefone = formatTelefone(row.telefone_responsavel);
              const mensagem = `Olá, referente à mensalidade do aluno ${row.aluno_nome || ""}. Podemos ajudar?`;
              const whatsappLink = telefone
                ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
                : null;
              const mesesAtraso = (row.meses_atraso || []).map(formatMonth).join(", ") || "—";
              const initials = (row.aluno_nome || "A").trim().charAt(0).toUpperCase();
              return (
                <div key={row.aluno_id} className="flex flex-col gap-3 rounded-lg border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
                      {initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{row.aluno_nome || "Aluno"}</div>
                      <div className="text-xs text-slate-500">
                        {row.turma_nome || "Turma"} • {mesesAtraso}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-700">{formatKz(Number(row.valor_total_atraso || 0))}</div>
                      <div className="text-xs text-slate-500">Em atraso</div>
                    </div>
                    {whatsappLink ? (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                        Sem contacto
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Ações rápidas</h2>
            <p className="text-xs text-slate-500">Operações do dia</p>
          </div>
          <div className="grid gap-2">
            <Link
              href={`/escola/${escolaId}/financeiro/pagamentos`}
              className="inline-flex items-center justify-center rounded-lg bg-moxinexa-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-moxinexa-teal/90"
            >
              + Novo Pagamento
            </Link>
            <Link
              href={`/escola/${escolaId}/financeiro/fecho`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              🖨️ Fecho de Caixa
            </Link>
          </div>
          <div className="pt-2 text-xs text-moxinexa-gray font-sans">Total de pagamentos: {totalPagamentos}</div>
        </div>
      </div>
      
      {/* Banner de upgrade */}
      {(plan === 'essencial' || plan === 'profissional') && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-300 rounded text-amber-800 text-sm font-sans">
          {plan === 'essencial' ? (
            <>
              <div className="font-medium">Desbloqueie recursos do plano Profissional:</div>
              <ul className="list-disc ml-5 mt-1">
                <li>Geração de boletos/links de pagamento</li>
                <li>Relatórios financeiros detalhados</li>
                <li>Alertas automáticos para inadimplentes</li>
                <li>Exportação Excel/PDF</li>
              </ul>
              <div className="mt-2">Fale com o administrador da escola para atualizar o plano.</div>
            </>
          ) : (
            <>
              <div className="font-medium">Desbloqueie recursos do plano Premium:</div>
              <ul className="list-disc ml-5 mt-1">
                <li>Módulo Fiscal (NF-e, AGT)</li>
                <li>Integração com contabilidade</li>
                <li>Dashboards financeiros avançados</li>
              </ul>
              <div className="mt-2">Fale com o administrador da escola para atualizar o plano.</div>
            </>
          )}
        </div>
      )}
    </PortalLayout>
  )
}
