import QRCode from "react-qr-code";
import { getRequestOrigin } from "@/lib/serverUrl";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";

export const dynamic = "force-dynamic";

export default async function FichaInscricaoPrintPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const data = await getDocumentoEmitido(docId);

  if ("error" in data) {
    return <div className="p-8">{data.error}</div>;
  }

  const { doc, escolaNome, validationBaseUrl } = data;
  if (String(doc.tipo) !== "ficha_inscricao") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = doc.dados_snapshot || {};
  const baseUrl =
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
    validationBaseUrl ??
    (await getRequestOrigin());
  const hash = snapshot.hash_validacao || "";
  const numero = snapshot.numero_sequencial;
  const urlValidacao = hash
    ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}`
    : null;

  const hoje = new Date().toLocaleDateString("pt-PT");

  return (
    <div className={`min-h-screen ${styles.printRoot} font-serif text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} shadow-lg`}>
        <div className="space-y-6">
          <header className="text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {escolaNome}
            </p>
            <h1 className="text-2xl font-semibold">Ficha de Inscrição</h1>
            <p className="text-xs text-slate-500">Data: {hoje}</p>
            {numero ? (
              <p className="text-[11px] text-slate-500">Nº {String(numero).padStart(4, "0")}</p>
            ) : null}
          </header>

          <section className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Aluno</p>
                <p className="font-semibold">{snapshot.aluno_nome || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">BI</p>
                <p className="font-semibold">{snapshot.aluno_bi || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Turma</p>
                <p className="font-semibold">{snapshot.turma_nome || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Classe</p>
                <p className="font-semibold">{snapshot.classe_nome || "—"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-2 text-xs text-slate-500">
            <p>Assinatura do responsável:</p>
            <div className="h-10 border-b border-slate-400" />
          </section>

          {urlValidacao ? (
            <section className="flex items-center justify-between">
              <div className="text-[10px] text-slate-500">Validar autenticidade</div>
              <QRCode value={urlValidacao} size={72} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
