import ChartsStaticSectionForEscola from "@/components/super-admin/ChartsStaticSectionForEscola";
import ActivitiesSection from "@/components/super-admin/ActivitiesSection";
import QuickActionsSection from "@/components/super-admin/QuickActionsSection";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import { getBranding } from "@/lib/branding";
import {
  AcademicCapIcon,
  UsersIcon,
  BanknotesIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import EscolaSettingsClient from "@/components/super-admin/EscolaSettingsClient";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type EscolaHealth = {
  tem_ano_letivo: boolean;
  tem_cursos_com_matriz: boolean;
  tem_turmas_ativas: boolean;
  tem_precos_definidos: boolean;
};

const StatusItem = ({ label, ok }: { label: string; ok: boolean }) => (
  <div className="flex items-center gap-2 text-sm">
    {ok ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-400" />}
    <span className={ok ? "text-gray-700" : "text-red-600 font-medium"}>{label}</span>
  </div>
);

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id: routeId } = await props.params;
  const escolaId = String(routeId);

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const hasServiceRoleKey =
    !!supabaseUrl &&
    !!serviceRoleKey &&
    (serviceRoleKey.startsWith("ey") || serviceRoleKey.startsWith("sb_secret_")) &&
    !/YOUR-service-role-key/i.test(serviceRoleKey);

  const supabase = hasServiceRoleKey
    ? createClient<Database>(supabaseUrl, serviceRoleKey)
    : await supabaseServer();

  const [escolaRes, fallbackRes, healthRes, kpiRes] = await Promise.all([
    supabase
      .from("escolas_view" as unknown as never)
      .select("id, nome, status, plano_atual, plano, cidade, estado, total_alunos, total_professores")
      .eq("id", escolaId)
      .maybeSingle(),
    supabase
      .from("escolas" as unknown as never)
      .select("id, nome, status, plano_atual, plano, endereco, aluno_portal_enabled")
      .eq("id", escolaId)
      .maybeSingle(),
    supabase
      .from("view_escola_health_check" as any)
      .select("*")
      .eq("escola_id", escolaId)
      .maybeSingle(),
    supabase.rpc("admin_get_escola_kpis" as any, { p_escola_id: escolaId }).maybeSingle(),
  ]);

  const viewData = escolaRes.data as any;
  const baseData = fallbackRes.data as any;

  const escola = viewData
    ? {
        ...viewData,
        aluno_portal_enabled: baseData?.aluno_portal_enabled ?? false,
      }
    : baseData
    ? {
        id: baseData.id,
        nome: baseData.nome,
        status: baseData.status,
        plano: baseData.plano_atual ?? baseData.plano,
        plano_atual: baseData.plano_atual,
        cidade: baseData.endereco ?? "",
        estado: "",
        total_alunos: 0,
        total_professores: 0,
        aluno_portal_enabled: baseData.aluno_portal_enabled ?? false,
      }
    : null;

  if (!escola) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold text-gray-700">Escola não encontrada</h2>
        <p className="text-gray-500">Verifique o ID ou se a escola foi deletada.</p>
        <Link href="/super-admin/escolas" className="text-blue-600 hover:underline mt-4 block">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const planVal = escola.plano_atual ?? escola.plano;
  const plano: PlanTier = parsePlanTier(planVal);

  const brand = getBranding();
  const waNumber = (brand.financeWhatsApp || "").replace(/\D/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null;

  const stats = (kpiRes.data as any) || {
    total_alunos: escola.total_alunos ?? 0,
    total_professores: escola.total_professores ?? 0,
    percentual_notas: 0,
    adimplencia: 0,
  };

  const kpis = [
    { title: "Alunos Ativos", value: stats.total_alunos ?? 0, icon: UsersIcon, color: "text-blue-600" },
    { title: "Professores", value: stats.total_professores ?? 0, icon: UserGroupIcon, color: "text-purple-600" },
    { title: "Notas Lançadas", value: `${stats.percentual_notas ?? 0}%`, icon: AcademicCapIcon, color: "text-amber-600" },
    { title: "Adimplência", value: `${stats.adimplencia ?? 0}%`, icon: BanknotesIcon, color: "text-emerald-600" },
  ];

  const health = (healthRes.data as EscolaHealth | null) ?? null;

  return (
    <div className="space-y-6 pb-20">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escola_edit" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            {escola.nome}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                escola.status === "ativa"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : escola.status === "suspensa"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {escola.status}
            </span>
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
            <span>{escola.cidade || "Cidade não informada"} {escola.estado ? `- ${escola.estado}` : ""}</span>
            <span>•</span>
            <span className="font-medium text-gray-700">Plano {PLAN_NAMES[plano]}</span>
          </p>
        </div>

        <form action="/api/auth/impersonate" method="POST">
          <input type="hidden" name="escola_id" value={escola.id} />
          <button
            type="submit"
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-sm"
          >
            <ShieldCheckIcon className="w-4 h-4" />
            Acessar Painel (Suporte)
          </button>
        </form>
      </div>

      {escola.status === "suspensa" && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          <div className="flex gap-3">
            <XCircleIcon className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold">Escola suspensa financeiramente</p>
              <p className="text-sm mt-1 mb-3">O acesso está bloqueado para alunos e professores.</p>
              <div className="flex flex-wrap gap-2">
                {brand.financeEmail && (
                  <a
                    href={`mailto:${brand.financeEmail}`}
                    className="px-3 py-1.5 rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold"
                  >
                    Email Financeiro
                  </a>
                )}
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold border border-transparent"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
          Health Check (Configuração)
        </h3>
        {health ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusItem label="Ano Letivo Ativo" ok={health.tem_ano_letivo} />
            <StatusItem label="Cursos & Matrizes" ok={health.tem_cursos_com_matriz} />
            <StatusItem label="Turmas Validadas" ok={health.tem_turmas_ativas} />
            <StatusItem label="Tabela de Preços" ok={health.tem_precos_definidos} />
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Dados de saúde indisponíveis (View não encontrada).</p>
        )}
      </div>

      <EscolaSettingsClient
        escolaId={String(escola.id)}
        initialAlunoPortalEnabled={Boolean(escola.aluno_portal_enabled)}
        initialPlano={plano}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.title}
            className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow rounded-xl p-5 flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">{kpi.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-gray-50 ${kpi.color}`}>
              <kpi.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <ChartsStaticSectionForEscola escolaId={String(escola.id)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivitiesSection activities={[]} />
        </div>
        <div className="lg:col-span-1">
          <QuickActionsSection />
        </div>
      </div>
    </div>
  );
}
