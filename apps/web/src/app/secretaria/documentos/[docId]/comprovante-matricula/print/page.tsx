import QRCode from "react-qr-code";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";

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

  const snapshot = (doc.dados_snapshot || {}) as Record<string, any>;
  const baseUrl = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? validationBaseUrl ?? (await getRequestOrigin())
  );
  const hash = typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : "";
  const numero = typeof snapshot.numero_sequencial === "number" ? snapshot.numero_sequencial : null;
  const urlValidacao = hash ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}` : null;

  const efetivacaoRaw = snapshot.data_hora_efetivacao;
  const efetivacao =
    typeof efetivacaoRaw === "string" || typeof efetivacaoRaw === "number"
      ? new Date(String(efetivacaoRaw)).toLocaleString("pt-PT")
      : "—";

  const mensalidades = Array.isArray(snapshot.mensalidades) ? snapshot.mensalidades : [];
  const valorTotalAnual = typeof snapshot.valor_total_anual === "number" ? snapshot.valor_total_anual : 0;

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
            <h1 className="text-2xl font-bold uppercase tracking-tight">Comprovativo de Matrícula</h1>
            <div className="flex justify-center gap-4 text-[10px] text-slate-500 font-sans">
              <p>Emitido em: {new Date(String(doc.created_at)).toLocaleString("pt-PT")}</p>
              {numero ? <p>Nº de Série: {String(numero).padStart(6, "0")}</p> : null}
            </div>
          </header>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Dados do Aluno</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Nome Completo</p>
                <p className="font-semibold text-base">{snapshot.aluno_nome || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Nº de Identificação (BI)</p>
                <p className="font-medium">{snapshot.aluno_bi || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Data de Nascimento</p>
                <p className="font-medium">{snapshot.aluno_nascimento ? new Date(snapshot.aluno_nascimento).toLocaleDateString("pt-PT") : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Pai</p>
                <p className="font-medium">{snapshot.aluno_pai || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Mãe</p>
                <p className="font-medium">{snapshot.aluno_mae || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Endereço de Residência</p>
                <p className="font-medium text-xs">{snapshot.aluno_endereco || "—"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Vínculo Académico</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Curso / Classe</p>
                <p className="font-semibold">{(snapshot.curso_nome || snapshot.classe_nome) ? `${snapshot.curso_nome || ''} - ${snapshot.classe_nome || ''}` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Ano Letivo</p>
                <p className="font-semibold">{snapshot.ano_letivo || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Turma / Turno</p>
                <p className="font-medium">{snapshot.turma_nome ? `${snapshot.turma_nome} (${snapshot.turma_turno || '—'})` : "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Data de Efectivação</p>
                <p className="font-medium">{efetivacao}</p>
              </div>
            </div>
          </section>

          {mensalidades.length > 0 && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Plano de Pagamentos Anual</h2>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Mês / Ano</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2 text-right">Valor (Kz)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mensalidades.map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-medium">{m.mes}/{m.ano}</td>
                        <td className="px-3 py-1.5">{m.vencimento ? new Date(m.vencimento).toLocaleDateString("pt-PT") : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-semibold">{Number(m.valor).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-right uppercase">Total Anual Estimado:</td>
                      <td className="px-3 py-2 text-right text-sm">{valorTotalAnual.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} Kz</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          <div className="pt-8 grid grid-cols-2 gap-12">
            <section className="space-y-6">
              <div className="space-y-1">
                <p className="text-[9px] uppercase text-slate-400 font-bold">Autenticação Digital</p>
                <div className="flex items-center gap-4">
                  {urlValidacao && <QRCode value={urlValidacao} size={64} />}
                  <div className="space-y-1">
                    <p className="text-[8px] text-slate-500 leading-tight max-w-[140px]">
                      Aponte a câmara para validar a autenticidade deste documento no portal oficial.
                    </p>
                    <p className="text-[8px] font-mono text-slate-400 truncate max-w-[140px]">
                      ID: {doc.public_id}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col justify-end items-center text-center space-y-2">
              <div className="w-full border-b border-slate-300 pb-1">
                {/* Espaço para carimbo/assinatura */}
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-600">A Secretaria Académica</p>
              <p className="text-[8px] text-slate-400 italic">Documento processado por computador</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
