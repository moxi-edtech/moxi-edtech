import QRCode from "react-qr-code";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getRequestOrigin } from "@/lib/serverUrl";

export const dynamic = "force-dynamic";

export default async function ComprovanteMatriculaPrintPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const data = await getDocumentoEmitido(docId);

  if ("error" in data) {
    return <div className="p-8">{data.error}</div>;
  }

  const { doc, escolaNome, validationBaseUrl, logoUrl } = data;
  if (String(doc.tipo) !== "comprovante_matricula") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = (doc.dados_snapshot || {}) as Record<string, unknown>;
  const baseUrl = process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? validationBaseUrl ?? (await getRequestOrigin());
  const hash = typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : "";
  const numero = typeof snapshot.numero_sequencial === "number" ? snapshot.numero_sequencial : null;
  const urlValidacao = hash ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}` : null;

  const efetivacaoRaw = snapshot.data_hora_efetivacao;
  const efetivacao =
    typeof efetivacaoRaw === "string" || typeof efetivacaoRaw === "number"
      ? new Date(String(efetivacaoRaw)).toLocaleString("pt-PT")
      : "—";

  return (
    <div className={`min-h-screen ${styles.printRoot} font-serif text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} shadow-lg`}>
        <div className="space-y-6">
        <header className="text-center space-y-2">
          <div className="flex justify-center">
            <img
              src={logoUrl ?? "/insignia_med.png"}
              alt="Insígnia da República de Angola"
              className="h-20 w-20 max-h-20 max-w-20 object-contain"
            />
          </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{escolaNome}</p>
            <h1 className="text-2xl font-semibold">Comprovante Oficial de Matrícula</h1>
            <p className="text-xs text-slate-500">Emitido em {new Date(String(doc.created_at)).toLocaleString("pt-PT")}</p>
            {numero ? <p className="text-[11px] text-slate-500">Nº {String(numero).padStart(4, "0")}</p> : null}
          </header>

          <section className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Aluno</p>
                <p className="font-semibold">{typeof snapshot.aluno_nome === "string" ? snapshot.aluno_nome : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Turma</p>
                <p className="font-semibold">{typeof snapshot.turma_nome === "string" ? snapshot.turma_nome : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Ano Letivo</p>
                <p className="font-semibold">
                  {typeof snapshot.ano_letivo === "string" || typeof snapshot.ano_letivo === "number"
                    ? String(snapshot.ano_letivo)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Data/hora da efetivação</p>
                <p className="font-semibold">{efetivacao}</p>
              </div>
            </div>
          </section>

          <section className="space-y-2 text-xs text-slate-500">
            <p>Assinatura / validação institucional:</p>
            <div className="h-10 border-b border-slate-400" />
            <p>Código de validação: {hash || "—"}</p>
          </section>

          {urlValidacao ? (
            <section className="flex items-center justify-between">
              <div className="text-[10px] text-slate-500">Valide a autenticidade via QR</div>
              <QRCode value={urlValidacao} size={72} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
