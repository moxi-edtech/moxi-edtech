import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { buildCertificadoSnapshot, type CertificadoSnapshot } from "@/lib/documentos/certificadoSnapshot";

export default async function FinalDocumentPrint({ docId, expectedType, title, requireStudentOwnership = true }: { docId: string; expectedType: "historico" | "certificado"; title: string; requireStudentOwnership?: boolean }) {
  const result = await getDocumentoEmitido(docId, { requireStudentOwnership });
  if ("error" in result) return <div className="p-8">{result.error}</div>;
  if (result.doc.tipo !== expectedType) return <div className="p-8">Documento inválido para esta página.</div>;
  const snapshot = (result.doc.dados_snapshot || {}) as Record<string, unknown>;
  let certificado: CertificadoSnapshot | null = null;
  let historicoNotas: Array<{ disciplina_nome?: string | null; nota_final?: number | string | null; media_final?: number | string | null }> = [];
  if (expectedType === "certificado") {
    try {
      certificado = await buildCertificadoSnapshot({ supabase: (await supabaseServerTyped()) as any, escolaId: result.doc.escola_id, alunoId: result.doc.aluno_id ?? "", baseSnapshot: snapshot, hashValidacao: result.doc.hash_validacao ?? null });
    } catch (error) {
      console.error("[FINAL_DOCUMENT_PRINT_CERTIFICATE]", error);
    }
  } else {
    const supabase = await supabaseServerTyped<any>();
    const { data: history } = await supabase.from("historico_anos").select("id").eq("escola_id", result.doc.escola_id).eq("aluno_id", result.doc.aluno_id).eq("ano_letivo", Number(snapshot.ano_letivo)).maybeSingle();
    if (history?.id) {
      const { data: notes } = await supabase.from("historico_disciplinas").select("disciplina_nome, nota_final, media_final").eq("historico_ano_id", history.id).order("disciplina_nome", { ascending: true }).limit(100);
      historicoNotas = notes ?? [];
    }
  }
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 print:bg-white md:p-10">
      <article className="mx-auto max-w-3xl space-y-8 bg-white p-8 shadow-sm print:max-w-none print:shadow-none">
        <header className="space-y-2 border-b pb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documento oficial escolar</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-slate-500">Nº {String(snapshot.numero_sequencial ?? "—")}</p>
        </header>
        <section className="grid gap-4 text-sm sm:grid-cols-2">
          <p><strong>Aluno:</strong> {String(snapshot.aluno_nome ?? "—")}</p>
          <p><strong>BI:</strong> {String(snapshot.aluno_bi ?? "—")}</p>
          <p><strong>Processo:</strong> {String(snapshot.processo_individual_numero ?? "—")}</p>
          <p><strong>Ano letivo:</strong> {String(snapshot.ano_letivo ?? "—")}</p>
          <p><strong>Classe:</strong> {String(snapshot.classe_nome ?? snapshot.classe_concluida ?? "—")}</p>
          <p><strong>Curso:</strong> {String(snapshot.curso_nome ?? "—")}</p>
          <p><strong>Turma:</strong> {String(snapshot.turma_nome ?? "—")}</p>
          <p><strong>Resultado:</strong> {String(snapshot.status_final ?? "—")}</p>
        </section>
        {(certificado?.disciplinas?.length || historicoNotas.length) ? (
          <section className="space-y-3">
            <h2 className="border-b pb-2 text-sm font-bold uppercase tracking-wide">Disciplinas e resultados</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Disciplina</th><th className="py-2">Nota final</th><th className="py-2">Média</th></tr></thead><tbody>
              {(certificado?.disciplinas ?? historicoNotas).map((item: any, index) => <tr key={`${item.nome ?? item.disciplina_nome}-${index}`} className="border-b border-slate-100"><td className="py-2">{String(item.nome ?? item.disciplina_nome ?? "—")}</td><td className="py-2">{String(item.media_final ?? item.nota_final ?? "—")}</td><td className="py-2">{String(item.media_final ?? "—")}</td></tr>)}
            </tbody></table></div>
          </section>
        ) : null}
        <p className="text-sm leading-7">Este documento foi emitido a partir do histórico anual fechado da escola e pode ser validado pelo identificador oficial associado.</p>
        <footer className="border-t pt-5 text-xs text-slate-500">Hash de validação: {String(snapshot.hash_validacao ?? result.doc.hash_validacao ?? "—")}</footer>
      </article>
    </main>
  );
}
