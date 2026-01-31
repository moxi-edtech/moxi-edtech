import QRCode from "react-qr-code";
import { getRequestOrigin } from "@/lib/serverUrl";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type NotaLinha = {
  disciplina_nome: string | null;
  notas_por_tipo: Record<string, any> | null;
};

const TRIM_KEYS = {
  t1: ["I_TRIM", "TRIMESTRE_1", "T1", "1TRI"],
  t2: ["II_TRIM", "TRIMESTRE_2", "T2", "2TRI"],
  t3: ["III_TRIM", "TRIMESTRE_3", "T3", "3TRI"],
};

function pickNota(payload: Record<string, any> | null | undefined, keys: string[]) {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function formatNota(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export default async function DeclaracaoNotasPrintPage({
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
  if (doc.tipo !== "declaracao_notas") {
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

  const supabase = await supabaseServerTyped();
  const { data: notasRows } = await supabase
    .from("vw_boletim_por_matricula")
    .select("disciplina_nome, notas_por_tipo")
    .eq("matricula_id", snapshot.matricula_id || "")
    .order("disciplina_nome", { ascending: true });

  const linhas = (notasRows || []) as NotaLinha[];
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
              Declaração de Aproveitamento
            </p>
            <p className="text-xs text-slate-500">Data: {hoje}</p>
            {numero ? (
              <p className="text-[11px] text-slate-500">Nº {String(numero).padStart(4, "0")}</p>
            ) : null}
          </header>

          <section className="space-y-3 text-sm leading-relaxed">
            <p>
              Declara-se, para os devidos efeitos, que <strong>{snapshot.aluno_nome || "—"}</strong>,
              portador do BI nº <strong>{snapshot.aluno_bi || "—"}</strong>, está regularmente
              matriculado na <strong>{snapshot.classe_nome || "—"}</strong>, Turma
              <strong> {snapshot.turma_nome || "—"}</strong>, Turno
              <strong> {snapshot.turma_turno || "—"}</strong>, no ano letivo
              <strong> {snapshot.ano_letivo || "—"}</strong>, tendo obtido o seguinte aproveitamento
              pedagógico até a presente data:
            </p>
          </section>

          <section className="space-y-3">
            <table className="w-full border border-slate-200 text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="border border-slate-200 px-2 py-2 text-left">Disciplina</th>
                  <th className="border border-slate-200 px-2 py-2">I Trim.</th>
                  <th className="border border-slate-200 px-2 py-2">II Trim.</th>
                  <th className="border border-slate-200 px-2 py-2">III Trim.</th>
                  <th className="border border-slate-200 px-2 py-2">Média Final</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                      Sem notas lançadas até o momento.
                    </td>
                  </tr>
                ) : (
                  linhas.map((row, index) => {
                    const notas = row.notas_por_tipo || {};
                    const t1 = pickNota(notas, TRIM_KEYS.t1);
                    const t2 = pickNota(notas, TRIM_KEYS.t2);
                    const t3 = pickNota(notas, TRIM_KEYS.t3);
                    const media =
                      t1 !== null && t2 !== null && t3 !== null
                        ? (t1 + t2 + t3) / 3
                        : null;

                    return (
                      <tr key={`${row.disciplina_nome || "disc"}-${index}`}>
                        <td className="border border-slate-200 px-2 py-2 text-left">
                          {row.disciplina_nome || "—"}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {formatNota(t1)}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {formatNota(t2)}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {formatNota(t3)}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {formatNota(media)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>

          <section className="flex items-end justify-between gap-6 pt-6 text-sm">
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
