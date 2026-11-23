import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { PrintLetterhead } from "@/app/secretaria/documentos/_print/PrintLetterhead";
import { formatDocumentoIdentificacao } from "@/lib/documentos/identificacao";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { buildCertificadoSnapshot, type CertificadoSnapshot } from "@/lib/documentos/certificadoSnapshot";

function nota(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed).replace(".", ",") : "—";
}

export default async function FinalDocumentPrint({ docId, expectedType, title, requireStudentOwnership = true }: { docId: string; expectedType: "historico" | "certificado"; title: string; requireStudentOwnership?: boolean }) {
  const result = await getDocumentoEmitido(docId, { requireStudentOwnership });
  if ("error" in result) return <div className="p-8">{result.error}</div>;
  if (result.doc.tipo !== expectedType) return <div className="p-8">Documento inválido para esta página.</div>;
  const snapshot = (result.doc.dados_snapshot || {}) as Record<string, unknown>;
  const targetYear = Number(snapshot.ano_letivo);
  if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 3000) {
    return <div className="p-8">O documento não possui ano letivo válido.</div>;
  }
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
    <main className="min-h-screen bg-slate-100 p-4 font-serif text-slate-900 print:bg-white md:p-10">
      <PrintTrigger />
      <article className="mx-auto max-w-3xl space-y-8 bg-white p-8 shadow-sm print:max-w-none print:shadow-none">
        <PrintLetterhead
          escolaNome={result.escolaNome}
          logoUrl={result.logoUrl}
          titulo={title}
          data={new Date(result.doc.created_at).toLocaleDateString("pt-PT")}
          numero={`Código: ${formatDocumentoIdentificacao(result.doc.tipo, snapshot.numero_sequencial)}`}
        />
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
            {certificado ? (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead><tr className="border-b text-xs text-slate-500">
                  <th className="py-2">Disciplina</th>
                  {certificado.colunas.map((coluna) => <th key={coluna.key} className="px-2 py-2 text-center">{coluna.label} classe</th>)}
                  <th className="py-2 text-center">Média</th>
                </tr></thead>
                <tbody>{certificado.disciplinas.map((item, index) => (
                  <tr key={`${item.nome}-${index}`} className="border-b border-slate-100">
                    <td className="py-2">{item.nome}</td>
                    {certificado!.colunas.map((coluna) => <td key={coluna.key} className="px-2 py-2 text-center">{nota(item.notas[coluna.key])}</td>)}
                    <td className="py-2 text-center">{nota(item.media_final)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Disciplina</th><th className="py-2">Nota final</th><th className="py-2">Média</th></tr></thead>
                <tbody>{historicoNotas.map((item, index) => (
                  <tr key={`${item.disciplina_nome}-${index}`} className="border-b border-slate-100">
                    <td className="py-2">{item.disciplina_nome ?? "—"}</td>
                    <td className="py-2">{nota(item.nota_final)}</td>
                    <td className="py-2">{nota(item.media_final)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        ) : null}
        <p className="text-sm leading-7">Este documento foi emitido a partir do histórico anual fechado da escola e pode ser validado pelo identificador oficial associado.</p>
        <footer className="border-t pt-5 text-xs text-slate-500">Hash de validação: {String(snapshot.hash_validacao ?? result.doc.hash_validacao ?? "—")}</footer>
      </article>
    </main>
  );
}
