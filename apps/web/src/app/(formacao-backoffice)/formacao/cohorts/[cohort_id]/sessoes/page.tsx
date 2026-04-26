import { notFound, redirect } from "next/navigation";
import { getFormacaoContext } from "@/lib/auth/formacaoAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type SessaoRow = {
  id: string;
  formador_user_id: string;
  competencia: string;
  horas_ministradas: number;
  valor_hora: number;
  status: string;
};

type ProfileRow = {
  user_id: string;
  nome: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default async function CohortSessoesPage({
  params,
}: {
  params: Promise<{ cohort_id: string }>;
}) {
  const context = await getFormacaoContext();
  if (!context?.escolaId) redirect("/login");
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

  const { data: sessoes } = await supabase
    .from("formacao_honorarios_lancamentos")
    .select("id, formador_user_id, competencia, horas_ministradas, valor_hora, status")
    .eq("escola_id", escolaId)
    .eq("cohort_id", cohortId)
    .order("competencia", { ascending: false })
    .limit(300);

  const sessoesRows = (sessoes ?? []) as SessaoRow[];
  const userIds = Array.from(new Set(sessoesRows.map((row) => row.formador_user_id)));
  const { data: profiles } =
    userIds.length === 0
      ? ({ data: [] } as { data: ProfileRow[] })
      : await supabase
          .from("profiles")
          .select("user_id, nome")
          .eq("escola_id", escolaId)
          .in("user_id", userIds);

  const profileMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((row) => [row.user_id, row])
  );

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Sessões</h1>
        <p className="mt-2 text-sm text-slate-600">
          Registo operacional da turma {cohort.codigo} ({cohort.nome}) com base nos lançamentos de honorários.
        </p>
      </header>

      {sessoesRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Sem sessões lançadas para esta turma.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Competência</th>
                <th className="px-4 py-3">Formador</th>
                <th className="px-4 py-3">Horas</th>
                <th className="px-4 py-3">Valor hora</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessoesRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-700">{row.competencia}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {profileMap.get(row.formador_user_id)?.nome || "Formador"}
                    </p>
                    <p className="text-xs text-slate-500">{row.formador_user_id}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{Number(row.horas_ministradas ?? 0).toFixed(2)}h</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(Number(row.valor_hora ?? 0))}</td>
                  <td className="px-4 py-3 text-slate-700">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
