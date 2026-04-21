import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

type StepStatus = "done" | "pending";

type Step = {
  key: string;
  title: string;
  hint: string;
  status: StepStatus;
  required: boolean;
  href: string;
  actionLabel: string;
};

function stepStatusClass(status: StepStatus) {
  return status === "done"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export default async function FormacaoOnboardingPage() {
  const session = await resolveFormacaoSessionContext();
  if (!session?.userId) redirect("/login");
  if (!session.tenantId) redirect("/forbidden");

  const role = String(session.role ?? "").trim().toLowerCase();
  if (!["formacao_admin", "super_admin", "global_admin"].includes(role)) {
    redirect("/forbidden");
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;
  const escolaId = session.tenantId;

  const [
    cursosRes,
    cohortsRes,
    valoresRes,
    formadoresRes,
    cobrancasRes,
  ] = await Promise.all([
    s.from("formacao_cursos").select("id").eq("escola_id", escolaId).limit(1),
    s.from("formacao_cohorts").select("id").eq("escola_id", escolaId).limit(1),
    s
      .from("formacao_cohort_financeiro")
      .select("id")
      .eq("escola_id", escolaId)
      .gt("valor_referencia", 0)
      .limit(1),
    s.from("formacao_cohort_formadores").select("id").eq("escola_id", escolaId).limit(1),
    s.from("formacao_faturas_lote_itens").select("id").eq("escola_id", escolaId).limit(1),
  ]);

  const hasCurso = (cursosRes.data ?? []).length > 0;
  const hasCohort = (cohortsRes.data ?? []).length > 0;
  const hasValor = (valoresRes.data ?? []).length > 0;
  const hasFormador = (formadoresRes.data ?? []).length > 0;
  const hasCobranca = (cobrancasRes.data ?? []).length > 0;

  const steps: Step[] = [
    {
      key: "curso",
      title: "Curso criado",
      hint: "Pelo menos 1 curso ativo no catálogo.",
      status: hasCurso ? "done" : "pending",
      required: true,
      href: "/admin/cursos",
      actionLabel: hasCurso ? "Ver cursos" : "Criar curso",
    },
    {
      key: "cohort",
      title: "Turma criada (datas e vagas)",
      hint: "Pelo menos 1 edição operacional com calendário.",
      status: hasCohort ? "done" : "pending",
      required: true,
      href: "/admin/cohorts",
      actionLabel: hasCohort ? "Ver turmas" : "Criar turma",
    },
    {
      key: "valor",
      title: "Valor do curso definido para a turma",
      hint: "Definir valor de referência (> 0) para cobrança.",
      status: hasValor ? "done" : "pending",
      required: true,
      href: "/admin/cohorts",
      actionLabel: hasValor ? "Rever valor" : "Definir valor",
    },
    {
      key: "formador",
      title: "Formador atribuído à turma",
      hint: "Pelo menos 1 formador vinculado à edição.",
      status: hasFormador ? "done" : "pending",
      required: true,
      href: "/admin/equipa",
      actionLabel: "Cadastrar formador",
    },
    {
      key: "cobranca",
      title: "Primeira cobrança preparada (opcional)",
      hint: "Recomendado criar a primeira cobrança para validar operação financeira.",
      status: hasCobranca ? "done" : "pending",
      required: false,
      href: "/financeiro/faturacao-b2c",
      actionLabel: hasCobranca ? "Ver cobranças" : "Preparar cobrança",
    },
  ];

  const requiredSteps = steps.filter((step) => step.required);
  const requiredDone = requiredSteps.filter((step) => step.status === "done").length;
  const requiredTotal = requiredSteps.length;
  const progressPct = Math.round((requiredDone / requiredTotal) * 100);
  const onboardingReady = requiredDone === requiredTotal;

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">onboarding operacional</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Activação do Centro de Formação</h1>
        <p className="mt-2 text-sm text-slate-600">
          Dados base já vêm do provisionamento Super Admin. Aqui garantimos go-live operacional.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
          <span>Obrigatórios concluídos</span>
          <strong>
            {requiredDone}/{requiredTotal} ({progressPct}%)
          </strong>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#C8902A] to-[#E3B23C]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {onboardingReady
            ? "Centro pronto para operar: curso, turma, valor e formador já configurados."
            : "Conclua os 4 itens obrigatórios para marcar o centro como operacional."}
        </p>
      </section>

      <section className="grid gap-3">
        {steps.map((step, index) => (
          <article
            key={step.key}
            className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  passo {index + 1} {step.required ? "· obrigatório" : "· opcional"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{step.hint}</p>
              </div>

              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stepStatusClass(step.status)}`}>
                {step.status === "done" ? "Concluído" : "Pendente"}
              </span>
            </div>

            <div className="mt-3">
              <Link
                href={step.href}
                className="inline-flex items-center justify-center rounded-lg border border-[#C8902A] bg-[#C8902A] px-3 py-1.5 text-xs font-semibold text-slate-900 transition-all duration-200 hover:bg-[#B07E21]"
              >
                {step.actionLabel} →
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
