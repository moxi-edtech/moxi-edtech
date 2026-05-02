import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import InscricaoSelfServiceForm from "./InscricaoSelfServiceForm";

export const dynamic = "force-dynamic";

type Params = Promise<{ centroSlug: string; cohortRef: string }>;

export default async function SelfServiceInscricaoPage({ params }: { params: Params }) {
  const { centroSlug, cohortRef } = await params;
  const s = (await supabaseServer()) as FormacaoSupabaseClient;
  const { data, error } = await (s as FormacaoSupabaseClient & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("formacao_self_service_resolve_target", {
    p_escola_slug: centroSlug,
    p_cohort_ref: cohortRef,
  });

  if (error) {
    notFound();
  }

  const target = (Array.isArray(data) ? data[0] : data) as
    | {
        escola_nome?: string | null;
        cohort_nome?: string | null;
        curso_nome?: string | null;
        data_inicio?: string | null;
        data_fim?: string | null;
        vagas?: number | null;
        vagas_ocupadas?: number | null;
      }
    | undefined;

  if (!target) {
    notFound();
  }

  const escolaNome = String(target.escola_nome ?? "Centro de Formação");
  const cohortNome = String(target.cohort_nome ?? "Turma");
  const cursoNome = String(target.curso_nome ?? "Curso");
  const dataInicio = String(target.data_inicio ?? "");
  const dataFim = String(target.data_fim ?? "");
  const vagasTotal = Number(target.vagas ?? 0);
  const vagasOcupadas = Number(target.vagas_ocupadas ?? 0);

  return (
    <main className="min-h-screen bg-[#F5F0E8] px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-2xl border border-[#E4EBE6] bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Inscrição Online</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1F6B3B]">Bem-vindo ao {escolaNome}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete os dados para se inscrever na turma <strong>{cohortNome}</strong> do curso{" "}
            <strong>{cursoNome}</strong>.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {dataInicio && dataFim ? `Período: ${dataInicio} até ${dataFim}` : "Datas serão confirmadas pelo centro."}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl border border-[#E4EBE6] bg-white p-6 shadow-sm">
            <InscricaoSelfServiceForm
              centroSlug={centroSlug}
              cohortRef={cohortRef}
              centroNome={escolaNome}
              cohortNome={cohortNome}
              cursoNome={cursoNome}
              vagasTotal={vagasTotal}
              vagasOcupadas={vagasOcupadas}
            />
          </section>

          <aside className="rounded-2xl border border-[#E4EBE6] bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Como funciona</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Preencha os dados e confirme sua inscrição.</li>
              <li>Se já existir cadastro com este BI, confirme sua senha.</li>
              <li>Depois, faça login no portal do formando.</li>
            </ol>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">Já tem conta?</p>
              <Link
                href="/login"
                className="mt-2 inline-flex rounded-lg border border-[#1F6B3B]/30 px-3 py-2 text-sm font-medium text-[#1F6B3B] transition hover:bg-[#1F6B3B]/5"
              >
                Ir para login
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
