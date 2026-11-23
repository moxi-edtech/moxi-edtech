import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { PrintLetterhead } from "@/app/secretaria/documentos/_print/PrintLetterhead";
import { formatDocumentoIdentificacao } from "@/lib/documentos/identificacao";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { buildCertificadoSnapshot, type CertificadoSnapshot } from "@/lib/documentos/certificadoSnapshot";
import { verificarCertificadoElegivel } from "@/lib/documentos/certificadoElegibilidade";

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
  let certificadoPendente: string | null = null;
  let historicoNotas: Array<{ disciplina_nome?: string | null; nota_final?: number | string | null; media_final?: number | string | null }> = [];
  if (expectedType === "certificado") {
    const supabase = await supabaseServerTyped();
    const elegibilidade = await verificarCertificadoElegivel({
      supabase, escolaId: result.doc.escola_id, alunoId: result.doc.aluno_id ?? "",
      anoLetivo: targetYear,
    });
    if (!elegibilidade.ok) {
      certificadoPendente = elegibilidade.error;
    } else {
      try {
        certificado = await buildCertificadoSnapshot({
          supabase, escolaId: result.doc.escola_id, alunoId: result.doc.aluno_id ?? "",
          baseSnapshot: snapshot, hashValidacao: result.doc.hash_validacao ?? null,
        });
        if (certificado.disciplinas.length === 0 ||
            certificado.colunas.length === 0) {
          certificadoPendente = "O certificado não contém notas oficiais para apresentar.";
        }
      } catch (error) {
        console.error("[FINAL_DOCUMENT_PRINT_CERTIFICATE]", error);
        certificadoPendente = "Não foi possível validar as notas do certificado. Atualize a situação académica antes de imprimir.";
      }
    }
  } else {
    const supabase = await supabaseServerTyped<any>();
    const { data: history } = await supabase.from("historico_anos").select("id").eq("escola_id", result.doc.escola_id).eq("aluno_id", result.doc.aluno_id).eq("ano_letivo", Number(snapshot.ano_letivo)).maybeSingle();
    if (history?.id) {
      const { data: notes } = await supabase.from("historico_disciplinas").select("disciplina_nome, nota_final, media_final").eq("historico_ano_id", history.id).order("disciplina_nome", { ascending: true }).limit(100);
      historicoNotas = notes ?? [];
    }
  }
  // Falha fechada: não montar PrintTrigger, timbre nem selo oficial quando
  // o certificado não contém notas verificáveis. Não cobrar outra impressão.
  if (certificadoPendente) {
    const href = requireStudentOwnership
      ? "/aluno/avisos"
      : `/escola/${encodeURIComponent(result.doc.escola_id)}/operacoes/academico/reconciliacao-historica?tipo=historicos&ano=${targetYear}`;
    return (
      <main className="mx-auto max-w-2xl p-8 text-sm text-foreground">
        <section role="alert" className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h1 className="text-base font-semibold">Certificado ainda não disponível para impressão</h1>
          <p>{certificadoPendente}</p>
          <p className="text-muted-foreground">O documento não foi impresso. Se a taxa já estiver paga, a regularização não cria nova cobrança.</p>
          <a href={href} className="inline-flex rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-muted">
            {requireStudentOwnership ? "Contactar secretaria" : "Abrir Reconciliação Histórica"}
          </a>
        </section>
      </main>
    );
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
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2">Disciplina</th>
                  {certificado.colunas.map((coluna) => <th key={coluna.key} className="px-2 py-2 text-center">{coluna.label} classe</th>)}
                  <th className="py-2 text-center">Média</th>
                </tr></thead>
                <tbody>{certificado.disciplinas.map((item, index) => (
                  <tr key={`${item.nome}-${index}`} className="border-b border-border">
                    <td className="py-2">{item.nome}</td>
                    {certificado!.colunas.map((coluna) => <td key={coluna.key} className="px-2 py-2 text-center">{nota(item.notas[coluna.key])}</td>)}
                    <td className="py-2 text-center">{nota(item.media_final)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2">Disciplina</th><th className="py-2">Nota final</th><th className="py-2">Média</th></tr></thead>
                <tbody>{historicoNotas.map((item, index) => (
                  <tr key={`${item.disciplina_nome}-${index}`} className="border-b border-border">
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
