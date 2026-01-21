import Link from "next/link";
import { Eye } from "lucide-react";
import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null;

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Vincule seu perfil a uma escola para emitir documentos.
        </div>
      </>
    );
  }

  const query = supabase
    .from("matriculas")
    .select(
      `
      id,
      data_matricula,
      numero_matricula,
      alunos ( nome ),
      turmas ( nome, classes ( nome ) )
    `
    )
    .eq("escola_id", escolaId)
    .order("data_matricula", { ascending: false })
    .limit(50);

  const { data: matriculas } = await query;

  type MatriculaResumo = {
    id: string;
    data_matricula: string | null;
    numero_matricula: string | null;
    alunos?: { nome?: string | null } | null;
    turmas?: { nome?: string | null; classes?: { nome?: string | null } | null } | null;
  };

  const rows = (matriculas ?? []) as MatriculaResumo[];

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <main className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documentos Oficiais</h1>
          <p className="text-sm text-slate-500">
            Gere declarações de matrícula para alunos ativos.
          </p>
        </div>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase">Aluno</th>
                <th className="px-4 py-3 text-left font-semibold uppercase">Turma</th>
                <th className="px-4 py-3 text-left font-semibold uppercase">Classe</th>
                <th className="px-4 py-3 text-left font-semibold uppercase">Matrícula</th>
                <th className="px-4 py-3 text-left font-semibold uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(matriculas ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                    Nenhuma matrícula encontrada.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.alunos?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.turmas?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.turmas?.classes?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.numero_matricula ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/api/secretaria/admissoes/matriculas/${row.id}/declaracao`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                    >
                      <Eye className="h-4 w-4" />
                      Emitir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
