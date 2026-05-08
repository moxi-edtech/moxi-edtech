import QRCode from "react-qr-code";
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";
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

  const { doc, escolaNome, validationBaseUrl, logoUrl } = data;
  if (String(doc.tipo) !== "ficha_inscricao") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = (doc.dados_snapshot || {}) as Record<string, any>;
  const baseUrl = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
      validationBaseUrl ??
      (await getRequestOrigin())
  );
  const hash = snapshot.hash_validacao || "";
  const numero = snapshot.numero_sequencial;
  const urlValidacao = hash
    ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}`
    : null;

  const hoje = new Date().toLocaleDateString("pt-PT");
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">
              {escolaNome}
            </p>
            <h1 className="text-2xl font-bold uppercase tracking-tight">Ficha de Inscrição Académica</h1>
            <div className="flex justify-center gap-4 text-[10px] text-slate-500 font-sans">
              <p>Data de Emissão: {hoje}</p>
              {numero ? (
                <p>Nº Registo: {String(numero).padStart(6, "0")}</p>
              ) : null}
            </div>
          </header>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Dados Pessoais</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Nome Completo</p>
                <p className="font-semibold text-base">{snapshot.aluno_nome || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Nº de Documento (BI)</p>
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
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Residência</p>
                <p className="font-medium text-xs">{snapshot.aluno_endereco || "—"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Opção de Matrícula</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Curso / Classe</p>
                <p className="font-semibold">{(snapshot.curso_nome || snapshot.classe_nome) ? `${snapshot.curso_nome || ''} - ${snapshot.classe_nome || ''}` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Ano Letivo</p>
                <p className="font-semibold">{snapshot.ano_letivo || "—"}</p>
              </div>
              <div className="col-span-3">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Turma / Turno Designado</p>
                <p className="font-medium">{snapshot.turma_nome ? `${snapshot.turma_nome} (${snapshot.turma_turno || '—'})` : "—"}</p>
              </div>
            </div>
          </section>

          {mensalidades.length > 0 && (
            <section className="space-y-4 pt-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Compromisso Financeiro (Propinas)</h2>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Mês / Ano</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2 text-right">Valor Mensal (Kz)</th>
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
                      <td colSpan={2} className="px-3 py-2 text-right uppercase">Total Anual Acordado:</td>
                      <td className="px-3 py-2 text-right text-sm">{valorTotalAnual.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} Kz</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          <div className="pt-12 grid grid-cols-2 gap-12">
            <section className="flex flex-col justify-end items-center text-center space-y-2">
              <div className="w-full border-b border-slate-300 pb-1"></div>
              <p className="text-[10px] uppercase font-bold text-slate-600">Assinatura do Encarregado</p>
            </section>

            <section className="flex flex-col justify-end items-center text-center space-y-2">
              <div className="w-full border-b border-slate-300 pb-1"></div>
              <p className="text-[10px] uppercase font-bold text-slate-600">Pela Instituição</p>
            </section>
          </div>

          <footer className="pt-8 flex items-center justify-between border-t border-slate-100 italic">
            <div className="text-[8px] text-slate-400">
              ID Digital: {doc.public_id} | Autenticado via Sistema KLASSE
            </div>
            {urlValidacao && (
              <div className="flex items-center gap-2 opacity-50">
                <span className="text-[8px] font-sans">Validação QR:</span>
                <QRCode value={urlValidacao} size={48} />
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
