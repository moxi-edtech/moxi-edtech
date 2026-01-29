import QRCode from "react-qr-code";
import { getRequestOrigin } from "@/lib/serverUrl";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";

export const dynamic = "force-dynamic";

export default async function CartaoEstudantePrintPage({
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
  if (doc.tipo !== "cartao_estudante") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = doc.dados_snapshot || {};
  const baseUrl =
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
    validationBaseUrl ??
    (await getRequestOrigin());
  const hash = snapshot.hash_validacao || "";
  const urlValidacao = hash
    ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}`
    : null;

  return (
    <div className={`min-h-screen ${styles.printRoot} text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} shadow-lg`}>
        <div className="max-w-md border border-slate-200 rounded-xl p-6 space-y-4">
          <header className="text-center space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cartão de Estudante</p>
            <h1 className="text-lg font-semibold">{escolaNome}</h1>
          </header>

          <section className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              Foto
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{snapshot.aluno_nome || "—"}</p>
              <p className="text-xs text-slate-500">BI: {snapshot.aluno_bi || "—"}</p>
              <p className="text-xs text-slate-500">
                Turma: {snapshot.turma_nome || "—"} • {snapshot.classe_nome || "—"}
              </p>
            </div>
          </section>

          {urlValidacao ? (
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-slate-500">Validar autenticidade</div>
              <QRCode value={urlValidacao} size={64} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
