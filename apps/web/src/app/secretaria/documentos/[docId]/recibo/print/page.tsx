import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { ReciboPagamentoDuasVias } from "@/components/financeiro/ReciboPagamentoCompacto";
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";

export const dynamic = "force-dynamic";

const getSnapshotString = (value: unknown, fallback = "—") => {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
};

export default async function ReciboPrintPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const data = await getDocumentoEmitido(docId);

  if ("error" in data) return <div className="p-8">{data.error}</div>;

  const { doc, escolaNome, validationBaseUrl, logoUrl } = data;
  if (String(doc.tipo) !== "recibo") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = (doc.dados_snapshot || {}) as Record<string, unknown>;
  let fallbackAlunoNome: string | null = null;
  let fallbackAlunoBi: string | null = null;
  let fallbackTurmaNome: string | null = null;
  let fallbackClasseNome: string | null = null;
  let fallbackCursoNome: string | null = null;

  if (
    doc.aluno_id &&
    (!snapshot.aluno_nome || !snapshot.aluno_bi || !snapshot.turma_nome || !snapshot.classe_nome)
  ) {
    const { supabaseServerTyped } = await import("@/lib/supabaseServer");
    const supabase = await supabaseServerTyped();
    const { data: aluno } = await supabase
      .from("alunos")
      .select("nome, bi_numero")
      .eq("id", doc.aluno_id)
      .maybeSingle();
    fallbackAlunoNome = aluno?.nome ?? null;
    fallbackAlunoBi = aluno?.bi_numero ?? null;

    const { data: matricula } = await supabase
      .from("matriculas")
      .select(`
        id,
        aluno_id,
        turmas (
          nome,
          classes ( nome ),
          cursos ( nome )
        )
      `)
      .eq("aluno_id", doc.aluno_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const turma = (matricula as any)?.turmas;
    fallbackTurmaNome = turma?.nome ?? null;
    fallbackClasseNome = turma?.classes?.nome ?? null;
    fallbackCursoNome = turma?.cursos?.nome ?? null;
  }

  const baseUrl = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? validationBaseUrl ?? (await getRequestOrigin())
  );
  const hash = typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : "";
  const urlValidacao = hash ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}` : null;

  const referencia = getSnapshotString(snapshot.referencia, "Mensalidade");
  const valorPago = Number(snapshot.valor_pago ?? 0);
  const dataPagamento = snapshot.data_pagamento
    ? new Date(String(snapshot.data_pagamento)).toLocaleDateString("pt-PT")
    : "—";
  const metodo = getSnapshotString(snapshot.metodo);
  const numero = snapshot.numero_sequencial ? String(snapshot.numero_sequencial).padStart(6, "0") : null;
  const emitidoEm = new Date(String(doc.created_at)).toLocaleString("pt-PT");

  const alunoNome = getSnapshotString(snapshot.aluno_nome, fallbackAlunoNome ?? "—");
  const alunoBi = getSnapshotString(snapshot.aluno_bi, fallbackAlunoBi ?? "—");
  const turmaNome = getSnapshotString(snapshot.turma_nome, fallbackTurmaNome ?? "—");
  const classeNome = getSnapshotString(snapshot.classe_nome, fallbackClasseNome ?? "—");
  const cursoNome = getSnapshotString(snapshot.curso_nome, fallbackCursoNome ?? "");

  return (
    <div className={`min-h-screen ${styles.printRoot} text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} ${styles.receiptCompactSheet} shadow-lg`}>
        <ReciboPagamentoDuasVias
          escolaNome={escolaNome}
          alunoNome={alunoNome}
          alunoBi={alunoBi}
          classeNome={classeNome}
          cursoNome={cursoNome}
          turmaNome={turmaNome}
          referencia={referencia}
          metodo={metodo}
          valorPago={valorPago}
          dataPagamento={dataPagamento}
          numero={numero}
          publicId={doc.public_id}
          urlValidacao={urlValidacao}
          logoUrl={logoUrl}
          emitidoEm={emitidoEm}
        />
      </div>
    </div>
  );
}
