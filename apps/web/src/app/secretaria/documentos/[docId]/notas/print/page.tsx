import QRCode from "react-qr-code";
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { PrintLetterhead } from "@/app/secretaria/documentos/_print/PrintLetterhead";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type NotaHistorica = { disciplina_nome: string | null; nota_final: number | string | null; media_final: number | string | null };

function formatNota(value: number | string | null) {
  if (value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? String(number).replace(".", ",") : "—";
}

export default async function DeclaracaoNotasPrintPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const result = await getDocumentoEmitido(docId);
  if ("error" in result) return <div className="p-8">{result.error}</div>;
  const { doc, escolaNome, logoUrl, validationBaseUrl } = result;
  if (doc.tipo !== "declaracao_notas") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = doc.dados_snapshot as Record<string, unknown>;
  const ano = Number(snapshot.ano_letivo);
  if (!Number.isInteger(ano) || ano < 1900 || ano > 3000 || !doc.aluno_id) {
    return <div className="p-8">Ano letivo inválido no documento emitido.</div>;
  }
  // A coluna disciplina_nome foi acrescentada por migração posterior às types geradas.
  // Aplicar tipagem local ao resultado do SQL versionado até regenerar Database.
  const db = await supabaseServerTyped<any>();
  const { data: historico, error: historicoError } = await db.from("historico_anos")
    .select("id, snapshot_status").eq("escola_id", doc.escola_id)
    .eq("aluno_id", doc.aluno_id).eq("ano_letivo", ano).maybeSingle();
  if (historicoError || !historico || historico.snapshot_status !== "fechado") {
    return <div className="p-8">O histórico deste ano não está fechado. Regularize-o na Secretaria.</div>;
  }

  const { data: notas, error: notasError } = await db.from("historico_disciplinas")
    .select("disciplina_nome, nota_final, media_final").eq("historico_ano_id", historico.id)
    .order("disciplina_nome", { ascending: true }).limit(200);
  if (notasError || !notas?.length) {
    return <div className="p-8">Sem classificações oficiais para o ano letivo selecionado.</div>;
  }

  const base = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? validationBaseUrl ?? (await getRequestOrigin())
  );
  const hash = typeof doc.hash_validacao === "string" ? doc.hash_validacao : "";
  const validationUrl = hash ? `${String(base).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}` : null;
  const nome = String(snapshot.aluno_nome ?? "—");
  const classe = String(snapshot.classe_concluida ?? snapshot.classe_nome ?? "—");

  return (
    <main className={`min-h-screen ${styles.printRoot} font-serif text-slate-900`}>
      <PrintTrigger />
      <article className={`${styles.sheet} space-y-8 shadow-sm`}>
        <PrintLetterhead escolaNome={escolaNome} logoUrl={logoUrl}
          titulo="Declaração com Notas" data={new Date(doc.created_at).toLocaleDateString("pt-PT")}
          numero={snapshot.numero_sequencial ? `N.º ${snapshot.numero_sequencial}` : null} />
        <p className="text-sm leading-7">
          Declara-se, para os devidos efeitos, que <strong>{nome}</strong> frequentou
          a <strong>{classe}</strong>, no ano letivo <strong>{ano}/{ano + 1}</strong>,
          tendo obtido as seguintes classificações registadas no histórico anual fechado.
        </p>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-slate-300 text-left">
            <th className="py-2">Disciplina</th><th className="py-2 text-right">Nota final</th>
          </tr></thead>
          <tbody>{(notas as NotaHistorica[]).map((item, index) => (
            <tr key={`${item.disciplina_nome ?? "disciplina"}-${index}`} className="border-b border-slate-200">
              <td className="py-2">{item.disciplina_nome ?? "—"}</td>
              <td className="py-2 text-right">{formatNota(item.nota_final ?? item.media_final)}</td>
            </tr>
          ))}</tbody>
        </table>
        <footer className="flex items-end justify-between gap-8 pt-8 text-xs">
          <div className="min-w-48 border-t border-slate-400 pt-2 text-center">Assinatura e carimbo da escola</div>
          {validationUrl ? <div className="space-y-1 text-center"><QRCode value={validationUrl} size={80} /><span>Validar autenticidade</span></div> : null}
        </footer>
        <p className="break-all text-[10px] text-slate-500">Hash: {hash || "—"}</p>
      </article>
    </main>
  );
}
