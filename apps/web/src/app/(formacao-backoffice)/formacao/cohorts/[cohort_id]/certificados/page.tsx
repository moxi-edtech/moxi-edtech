import { notFound, redirect } from "next/navigation";
import { getFormacaoContext } from "@/lib/auth/formacaoAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type CertificadoRow = {
  id: string;
  numero_documento: string;
  emitido_em: string;
  formando_user_id: string;
  template_id: string | null;
};

type ProfileRow = {
  user_id: string;
  nome: string | null;
};

type TemplateRow = {
  id: string;
  nome: string;
};

export default async function CohortCertificadosPage({
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

  const { data: certificados } = await supabase
    .from("formacao_certificados_emitidos")
    .select("id, numero_documento, emitido_em, formando_user_id, template_id")
    .eq("escola_id", escolaId)
    .eq("cohort_id", cohortId)
    .order("emitido_em", { ascending: false })
    .limit(500);

  const certificadoRows = (certificados ?? []) as CertificadoRow[];
  const userIds = Array.from(new Set(certificadoRows.map((row) => row.formando_user_id)));
  const templateIds = Array.from(
    new Set(certificadoRows.map((row) => row.template_id).filter((value): value is string => Boolean(value)))
  );

  const { data: profiles } =
    userIds.length === 0
      ? ({ data: [] } as { data: ProfileRow[] })
      : await supabase
          .from("profiles")
          .select("user_id, nome")
          .eq("escola_id", escolaId)
          .in("user_id", userIds);

  const { data: templates } =
    templateIds.length === 0
      ? ({ data: [] } as { data: TemplateRow[] })
      : await supabase
          .from("formacao_certificado_templates")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .in("id", templateIds);

  const profileMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((row) => [row.user_id, row])
  );
  const templateMap = new Map<string, TemplateRow>(
    ((templates ?? []) as TemplateRow[]).map((row) => [row.id, row])
  );

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Certificados</h1>
        <p className="mt-2 text-sm text-slate-600">
          Certificados emitidos para a turma {cohort.codigo} ({cohort.nome}).
        </p>
      </header>

      {certificadoRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
          Nenhum certificado emitido para esta turma.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Nº Documento</th>
                <th className="px-4 py-3">Emitido em</th>
                <th className="px-4 py-3">Formando</th>
                <th className="px-4 py-3">Template</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {certificadoRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.numero_documento}</td>
                  <td className="px-4 py-3 text-slate-700">{row.emitido_em}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {profileMap.get(row.formando_user_id)?.nome || row.formando_user_id}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.template_id ? templateMap.get(row.template_id)?.nome || "Template removido" : "Sem template"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
