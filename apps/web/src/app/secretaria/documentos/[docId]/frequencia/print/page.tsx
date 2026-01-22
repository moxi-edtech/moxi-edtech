import QRCode from "react-qr-code";
import { getRequestOrigin } from "@/lib/serverUrl";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";

export const dynamic = "force-dynamic";

export default async function DeclaracaoFrequenciaPrintPage({
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
  if (doc.tipo !== "declaracao_frequencia") {
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

  const hoje = new Date().toLocaleDateString("pt-PT");

  return (
    <div className={`min-h-screen ${styles.printRoot} font-serif text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} shadow-lg`}>
        <div className="space-y-8">
          <header className="text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              República de Angola · Ministério da Educação
            </p>
            <h1 className="text-2xl font-semibold">{escolaNome}</h1>
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">
              Ficha de Declaração de Frequência
            </p>
            <p className="text-xs text-slate-500">Data: {hoje}</p>
          </header>

          <section className="space-y-3 text-sm leading-relaxed">
            <p>
              Declara-se, para os devidos efeitos, que <strong>{snapshot.aluno_nome || "—"}</strong>,
              portador do BI nº <strong>{snapshot.aluno_bi || "—"}</strong>, está regularmente
              matriculado na <strong>{snapshot.classe_nome || "—"}</strong>, Turma
              <strong> {snapshot.turma_nome || "—"}</strong>, Turno
              <strong> {snapshot.turma_turno || "—"}</strong>, no ano letivo
              <strong> {snapshot.ano_letivo || "—"}</strong>.
            </p>

            <p>
              Por ser verdade e me ter sido solicitada, mandei passar a presente declaração que
              vai por mim assinada e autenticada com o carimbo a óleo em uso nesta instituição.
            </p>
          </section>

          <section className="flex items-end justify-between gap-6 pt-6">
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Assinatura do funcionário</p>
              <div className="h-10 w-64 border-b border-slate-400" />
            </div>

            {urlValidacao ? (
              <div className="text-center text-[10px] text-slate-500">
                <QRCode value={urlValidacao} size={96} />
                <div className="mt-2">Validar autenticidade</div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
