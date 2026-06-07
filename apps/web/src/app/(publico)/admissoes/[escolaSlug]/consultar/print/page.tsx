import QRCode from "react-qr-code";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getRequestOrigin, normalizeValidationBaseUrl } from "@/lib/serverUrl";
import { formatTurmaDisplayName, formatTurnoDisplay } from "@/utils/formatters";

export const dynamic = "force-dynamic";

async function getDocumentoPublico(docId: string) {
  const supabase = supabaseServerRole();
  const { data: doc, error } = await supabase
    .from("documentos_emitidos")
    .select(`
      id, 
      public_id, 
      escola_id, 
      aluno_id, 
      tipo, 
      created_at, 
      dados_snapshot, 
      numero_sequencial, 
      hash_validacao,
      escolas (
        nome,
        logo_url
      )
    `)
    .eq("id", docId)
    .single();

  if (error || !doc) return { error: "Documento não encontrado" };

  return {
    doc,
    escolaNome: (doc.escolas as any)?.nome || "Escola",
    logoUrl: (doc.escolas as any)?.logo_url || null
  };
}

export default async function PublicComprovantePrintPage(props: {
  params: Promise<{ escolaSlug: string }>;
  searchParams: Promise<{ docId: string }>;
}) {
  const { docId } = await props.searchParams;
  if (!docId) return <div className="p-8">Documento não especificado.</div>;

  const data = await getDocumentoPublico(docId);

  if ("error" in data) {
    return <div className="p-8">{data.error}</div>;
  }

  const { doc, escolaNome, logoUrl } = data;
  const snapshot = (doc.dados_snapshot || {}) as Record<string, any>;
  const baseUrl = normalizeValidationBaseUrl(
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ?? (await getRequestOrigin())
  );
  const hash = doc.hash_validacao || "";
  const numero = doc.numero_sequencial || null;
  const urlValidacao = hash ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}` : null;

  const efetivacaoRaw = snapshot.data_hora_efetivacao;
  const efetivacao =
    typeof efetivacaoRaw === "string" || typeof efetivacaoRaw === "number"
      ? new Date(String(efetivacaoRaw)).toLocaleString("pt-PT")
      : "—";

  const mensalidades = Array.isArray(snapshot.mensalidades) ? snapshot.mensalidades : [];
  const valorTotalAnual = typeof snapshot.valor_total_anual === "number" ? snapshot.valor_total_anual : 0;

  return (
    <div className={`min-h-screen ${styles.printRoot} font-serif text-slate-900 bg-white`}>
      <PrintTrigger />
      <div className={`${styles.sheet} mx-auto`}>
        <div className="space-y-8">
          <header className="text-center space-y-2 border-b border-slate-200 pb-6">
            <div className="flex justify-center">
              <img
                src={logoUrl ?? "/insignia_med.png"}
                alt="Logo"
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
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Vínculo Académico</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Nível de ensino / Classe</p>
                <p className="font-semibold">{(snapshot.curso_nome || snapshot.classe_nome) ? `${snapshot.curso_nome || ''} - ${snapshot.classe_nome || ''}` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Ano Letivo</p>
                <p className="font-semibold">{snapshot.ano_letivo || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Classe/Turma / Turno</p>
                <p className="font-medium">
                  {snapshot.turma_nome
                    ? `${formatTurmaDisplayName({ turma_nome: snapshot.turma_nome, turma_turno: snapshot.turma_turno })} (${formatTurnoDisplay(snapshot.turma_turno) || "—"})`
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase text-slate-400 font-sans font-bold">Data de Efectivação</p>
                <p className="font-medium">{efetivacao}</p>
              </div>
            </div>
          </section>

          <div className="pt-8 grid grid-cols-2 gap-12">
            <section className="space-y-6">
              <div className="space-y-1">
                <p className="text-[9px] uppercase text-slate-400 font-bold">Autenticação Digital</p>
                <div className="flex items-center gap-4">
                  {urlValidacao && <QRCode value={urlValidacao} size={64} />}
                  <div className="space-y-1">
                    <p className="text-[8px] text-slate-500 leading-tight max-w-[140px]">
                      Documento oficial processado pelo sistema KLASSE.
                    </p>
                    <p className="text-[8px] font-mono text-slate-400 truncate max-w-[140px]">
                      ID: {doc.public_id}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col justify-end items-center text-center space-y-2">
              <div className="w-full border-b border-slate-300 pb-1"></div>
              <p className="text-[10px] uppercase font-bold text-slate-600">A Secretaria Académica</p>
              <p className="text-[8px] text-slate-400 italic">Documento processado por computador</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
