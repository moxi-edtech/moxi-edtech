import { notFound, redirect } from "next/navigation";
import { getFormacaoContext } from "@/lib/auth/formacaoAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ModuloRow = {
  id: string;
  ordem: number;
  titulo: string;
  carga_horaria: number | null;
  descricao: string | null;
};

export default async function CohortMateriaisPage({
  params,
}: {
  params: Promise<{ cohort_id: string }>;
}) {
  const context = await getFormacaoContext();
  if (!context?.escolaId) redirect("/redirect");
  const { cohort_id: cohortId } = await params;

  const supabase = await supabaseServer();
  const escolaId = String(context.escolaId);

  const { data: cohort } = await supabase
    .from("formacao_cohorts")
    .select("id, nome, codigo")
    .eq("escola_id", escolaId)
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) notFound();

  const { data: modulos } = await supabase
    .from("formacao_cohort_modulos")
    .select("id, ordem, titulo, carga_horaria, descricao")
    .eq("escola_id", escolaId)
    .eq("cohort_id", cohortId)
    .order("ordem", { ascending: true });

  const moduloRows = (modulos ?? []) as ModuloRow[];

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Materiais</h1>
        <p className="mt-2 text-sm text-slate-600">
          Snapshot de conteúdos da turma {cohort.codigo} ({cohort.nome}) com base em módulos publicados.
        </p>
      </header>

      {moduloRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Esta turma não possui módulos/materiais registrados.
        </div>
      ) : (
        <section className="grid gap-3">
          {moduloRows.map((modulo) => (
            <article key={modulo.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Módulo {modulo.ordem}</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{modulo.titulo}</h2>
              <p className="mt-2 text-sm text-slate-600">{modulo.descricao || "Sem descrição adicional."}</p>
              <p className="mt-3 text-xs font-medium text-slate-700">
                Carga horária: {modulo.carga_horaria != null ? `${modulo.carga_horaria}h` : "não definida"}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
