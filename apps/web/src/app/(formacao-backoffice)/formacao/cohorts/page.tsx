import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormacaoContext } from "@/lib/auth/formacaoAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type CohortRow = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  vagas: number;
  status: string;
  data_inicio: string;
  data_fim: string;
};

type LotacaoRow = {
  cohort_id: string;
  inscritos_total: number | null;
  lotacao_percentual: number | null;
};

type MargemRow = {
  cohort_id: string;
  receita_total: number | null;
  margem_bruta: number | null;
};

function statusLabel(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "aberta" || value === "planeada") return "Abertura";
  if (value === "em_andamento") return "Em andamento";
  if (value === "concluida") return "Concluída";
  if (value === "cancelada") return "Cancelada";
  return status || "Sem status";
}

function statusTone(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "aberta" || value === "planeada") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "em_andamento") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "concluida") return "border-slate-200 bg-slate-100 text-slate-700";
  if (value === "cancelada") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-white text-slate-700";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default async function FormacaoCohortsPage() {
  const context = await getFormacaoContext();
  if (!context?.escolaId) redirect("/login");

  const supabase = await supabaseServer();
  const escolaId = String(context.escolaId);

  const [cohortsRes, lotacaoRes, margemRes] = await Promise.all([
    supabase
      .from("formacao_cohorts")
      .select("id, codigo, nome, curso_nome, vagas, status, data_inicio, data_fim")
      .eq("escola_id", escolaId)
      .order("data_inicio", { ascending: false })
      .limit(300),
    supabase.from("vw_formacao_cohorts_lotacao").select("cohort_id, inscritos_total, lotacao_percentual"),
    supabase.from("vw_formacao_margem_por_edicao").select("cohort_id, receita_total, margem_bruta"),
  ]);

  const cohorts = (cohortsRes.data ?? []) as CohortRow[];
  const lotacaoMap = new Map<string, LotacaoRow>(
    ((lotacaoRes.data ?? []) as LotacaoRow[]).map((row) => [row.cohort_id, row])
  );
  const margemMap = new Map<string, MargemRow>(
    ((margemRes.data ?? []) as MargemRow[]).map((row) => [row.cohort_id, row])
  );

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Turmas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Listagem operacional das edições de formação com acesso rápido aos módulos de execução.
        </p>
      </header>

      {cohorts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Nenhuma turma encontrada para este centro.
        </div>
      ) : (
        <section className="grid gap-4">
          {cohorts.map((cohort) => {
            const lotacao = lotacaoMap.get(cohort.id);
            const margem = margemMap.get(cohort.id);
            const inscritos = Number(lotacao?.inscritos_total ?? 0);
            const lotacaoPercent = Number(lotacao?.lotacao_percentual ?? 0);
            const receita = Number(margem?.receita_total ?? 0);
            const margemBruta = Number(margem?.margem_bruta ?? 0);

            return (
              <article key={cohort.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cohort.codigo}</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">{cohort.nome}</h2>
                    <p className="mt-1 text-sm text-slate-600">{cohort.curso_nome}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(cohort.status)}`}>
                    {statusLabel(cohort.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-4">
                  <div>
                    <p className="font-semibold text-slate-700">Inscritos</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {inscritos}/{cohort.vagas} ({lotacaoPercent.toFixed(1)}%)
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Receita</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(receita)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Margem Bruta</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(margemBruta)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Período</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {cohort.data_inicio} → {cohort.data_fim}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <Link href={`/formacao/cohorts/${cohort.id}/overview`} className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-slate-300">
                    Visão
                  </Link>
                  <Link href={`/formacao/cohorts/${cohort.id}/formandos`} className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-slate-300">
                    Formandos
                  </Link>
                  <Link href={`/formacao/cohorts/${cohort.id}/sessoes`} className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-slate-300">
                    Sessões
                  </Link>
                  <Link href={`/formacao/cohorts/${cohort.id}/materiais`} className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-slate-300">
                    Materiais
                  </Link>
                  <Link href={`/formacao/cohorts/${cohort.id}/certificados`} className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-slate-300">
                    Certificados
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
