import QRCode from "react-qr-code";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";

export const dynamic = "force-dynamic";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    minimumFractionDigits: 2,
  }).format(value || 0);

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

  const snapshot = (doc.dados_snapshot || {}) as Record<string, any>;
  const baseUrl = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? validationBaseUrl ?? (await getRequestOrigin())
  );
  const hash = typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : "";
  const urlValidacao = hash ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}` : null;

  const referencia = snapshot.referencia || "Mensalidade";
  const valorPago = Number(snapshot.valor_pago || 0);
  const dataPagamento = snapshot.data_pagamento
    ? new Date(String(snapshot.data_pagamento)).toLocaleDateString("pt-PT")
    : "—";
  const metodo = snapshot.metodo || "—";
  const numero = snapshot.numero_sequencial ? String(snapshot.numero_sequencial).padStart(6, "0") : null;

  return (
    <div className={`min-h-screen ${styles.printRoot} font-serif text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} shadow-lg`}>
        <div className="space-y-8">
          <header className="text-center space-y-2 border-b border-slate-200 pb-6">
            <div className="flex justify-center">
              <img
                src={logoUrl ?? "/insignia_med.png"}
                alt="Insígnia da República de Angola"
                className="h-20 w-20 max-h-20 max-w-20 object-contain"
              />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">{escolaNome}</p>
            <h1 className="text-2xl font-bold uppercase tracking-tight">Recibo de Pagamento</h1>
            <div className="flex justify-center gap-4 text-[10px] text-slate-500 font-sans">
              <p>Emitido em: {new Date(String(doc.created_at)).toLocaleString("pt-PT")}</p>
              {numero ? <p>Nº de Série: {numero}</p> : null}
            </div>
          </header>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Dados do Pagamento</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Referência</p>
                <p className="font-semibold">{String(referencia)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Data de Pagamento</p>
                <p className="font-semibold">{dataPagamento}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Método</p>
                <p className="font-medium">{String(metodo)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Valor Pago</p>
                <p className="font-bold text-lg">{formatMoney(valorPago)}</p>
              </div>
            </div>
          </section>

          <div className="pt-8 grid grid-cols-2 gap-12">
            <section className="space-y-2">
              <p className="text-[9px] uppercase text-slate-400 font-bold">Autenticação Digital</p>
              {urlValidacao ? (
                <div className="flex items-center gap-4">
                  <QRCode value={urlValidacao} size={72} />
                  <div className="space-y-1">
                    <p className="text-[8px] text-slate-500 leading-tight max-w-[150px]">
                      Valide este recibo no portal oficial através do QR Code.
                    </p>
                    <p className="text-[8px] font-mono text-slate-400 truncate max-w-[150px]">
                      ID: {doc.public_id}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">Validação indisponível.</p>
              )}
            </section>

            <section className="flex flex-col justify-end items-center text-center space-y-2">
              <div className="w-full border-b border-slate-300 pb-1" />
              <p className="text-[10px] uppercase font-bold text-slate-600">A Secretaria</p>
              <p className="text-[8px] text-slate-400 italic">Documento processado por computador</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
