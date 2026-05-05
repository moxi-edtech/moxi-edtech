import { notFound, redirect } from "next/navigation";
import { getFormacaoContext } from "@/lib/auth/formacaoAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type InscricaoRow = {
  id: string;
  formando_user_id: string;
  estado: string;
  nome_snapshot: string | null;
  email_snapshot: string | null;
  telefone_snapshot: string | null;
};

type ProfileRow = {
  user_id: string;
  nome: string | null;
  email: string | null;
};

type PagamentoItem = {
  formando_user_id: string;
  status_pagamento: string;
  valor_total: number | null;
};

function normalizePaymentStatus(statuses: string[]) {
  const values = statuses.map((item) => item.toLowerCase());
  if (values.some((item) => item.includes("atras"))) return "Atrasado";
  if (values.length > 0 && values.every((item) => item.includes("pago"))) return "Pago";
  return "Pendente";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export default async function CohortFormandosPage({
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

  const { data: inscricoes } = await supabase
    .from("formacao_inscricoes")
    .select("id, formando_user_id, estado, nome_snapshot, email_snapshot, telefone_snapshot")
    .eq("escola_id", escolaId)
    .eq("cohort_id", cohortId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });

  const inscricoesRows = (inscricoes ?? []) as InscricaoRow[];
  const userIds = Array.from(new Set(inscricoesRows.map((row) => row.formando_user_id)));

  const { data: profileRows } =
    userIds.length === 0
      ? ({ data: [] } as { data: ProfileRow[] })
      : await supabase
          .from("profiles")
          .select("user_id, nome, email")
          .eq("escola_id", escolaId)
          .in("user_id", userIds);

  const { data: faturas } = await supabase
    .from("formacao_faturas_lote")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("cohort_id", cohortId);
  const loteIds = (faturas ?? []).map((row) => String((row as { id: string }).id));

  const { data: pagamentosRows } =
    loteIds.length === 0
      ? ({ data: [] } as { data: PagamentoItem[] })
      : await supabase
          .from("formacao_faturas_lote_itens")
          .select("formando_user_id, status_pagamento, valor_total")
          .eq("escola_id", escolaId)
          .in("fatura_lote_id", loteIds);

  const profileMap = new Map<string, ProfileRow>(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.user_id, row])
  );

  const paymentMap = new Map<string, { statuses: string[]; total: number }>();
  for (const item of (pagamentosRows ?? []) as PagamentoItem[]) {
    const current = paymentMap.get(item.formando_user_id) ?? { statuses: [], total: 0 };
    current.statuses.push(String(item.status_pagamento ?? ""));
    current.total += Number(item.valor_total ?? 0);
    paymentMap.set(item.formando_user_id, current);
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Formandos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cohort {cohort.codigo}: {cohort.nome}
        </p>
      </header>

      {inscricoesRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Esta turma ainda não possui formandos inscritos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Estado académico</th>
                <th className="px-4 py-3">Estado pagamento</th>
                <th className="px-4 py-3">Valor agregado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inscricoesRows.map((row) => {
                const profile = profileMap.get(row.formando_user_id);
                const payment = paymentMap.get(row.formando_user_id);
                const nome = profile?.nome || row.nome_snapshot || "Formando";
                const email = profile?.email || row.email_snapshot || "—";
                const telefone = row.telefone_snapshot || "—";

                return (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{nome}</p>
                      <p className="text-xs text-slate-500">{row.formando_user_id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{email}</p>
                      <p className="text-xs text-slate-500">{telefone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.estado || "cursando"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {normalizePaymentStatus(payment?.statuses ?? [])}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatMoney(Number(payment?.total ?? 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
