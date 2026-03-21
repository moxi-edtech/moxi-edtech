import QRCode from "react-qr-code";
import { getRequestOrigin } from "@/lib/serverUrl";
import PrintTrigger from "@/app/secretaria/documentos/_print/PrintTrigger";
import styles from "@/app/secretaria/documentos/_print/print.module.css";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type NotaLinha = {
  disciplina_id: string | null;
  disciplina_nome: string | null;
  trimestre: number | null;
  nota_final: number | null;
};

function formatNota(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export default async function BoletimTrimestralPrintPage({
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
  const tipoDocumento = String(doc.tipo);
  if (tipoDocumento !== "boletim_trimestral") {
    return <div className="p-8">Documento inválido para esta página.</div>;
  }

  const snapshot = (doc.dados_snapshot || {}) as Record<string, unknown>;
  const baseUrl =
    process.env.NEXT_PUBLIC_VALIDATION_BASE_URL ??
    validationBaseUrl ??
    (await getRequestOrigin());
  const hash = typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : "";
  const numero = typeof snapshot.numero_sequencial === "number" ? snapshot.numero_sequencial : null;
  const urlValidacao = hash
    ? `${String(baseUrl).replace(/\/$/, "")}/documentos/${doc.public_id}?hash=${hash}`
    : null;

  const supabase = await supabaseServerTyped();
  const { data: notasRows } = await supabase
    .from("vw_boletim_por_matricula")
    .select("disciplina_id, disciplina_nome, trimestre, nota_final")
    .eq("matricula_id", typeof snapshot.matricula_id === "string" ? snapshot.matricula_id : "")
    .order("disciplina_nome", { ascending: true });

  const linhas = (notasRows || []) as NotaLinha[];
  const notasByDisciplina = new Map<string, { nome: string; t1?: number | null; t2?: number | null; t3?: number | null }>();
  linhas.forEach((row, index) => {
    const key = row.disciplina_id ?? row.disciplina_nome ?? `disc-${index}`;
    const existing = notasByDisciplina.get(key) ?? {
      nome: row.disciplina_nome ?? "—",
    };
    if (row.trimestre === 1) existing.t1 = row.nota_final ?? null;
    if (row.trimestre === 2) existing.t2 = row.nota_final ?? null;
    if (row.trimestre === 3) existing.t3 = row.nota_final ?? null;
    notasByDisciplina.set(key, existing);
  });

  let disciplinas: Array<{ key: string; nome: string; t1?: number | null; t2?: number | null; t3?: number | null }> = [];
  if (typeof snapshot.turma_id === "string") {
    const { data: turmaDisciplinas } = await supabase
      .from("turma_disciplinas")
      .select("id, curso_matriz(disciplina_id, disciplinas_catalogo(nome))")
      .eq("escola_id", doc.escola_id)
      .eq("turma_id", snapshot.turma_id);
    disciplinas = (turmaDisciplinas || []).map((row) => {
      const disciplinaId = (row as any)?.curso_matriz?.disciplina_id ?? row.id;
      const nome = (row as any)?.curso_matriz?.disciplinas_catalogo?.nome ?? "Disciplina";
      const notas = notasByDisciplina.get(String(disciplinaId));
      return {
        key: String(disciplinaId),
        nome,
        t1: notas?.t1 ?? null,
        t2: notas?.t2 ?? null,
        t3: notas?.t3 ?? null,
      };
    });
  }

  if (disciplinas.length === 0) {
    disciplinas = Array.from(notasByDisciplina.entries()).map(([key, notas]) => ({
      key,
      nome: notas.nome,
      t1: notas.t1 ?? null,
      t2: notas.t2 ?? null,
      t3: notas.t3 ?? null,
    }));
  }
  const hoje = new Date().toLocaleDateString("pt-PT");

  return (
    <div className={`min-h-screen ${styles.printRoot} font-serif text-slate-900`}>
      <PrintTrigger />
      <div className={`${styles.sheet} shadow-lg`}>
        <div className="space-y-8">
          <header className="text-center space-y-2">
            <div className="flex justify-center">
              <img
                src={logoUrl ?? "/insignia_med.png"}
                alt="Insígnia da República de Angola"
                className="h-20 w-20 max-h-20 max-w-20 object-contain"
              />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              República de Angola · Ministério da Educação
            </p>
            <h1 className="text-2xl font-semibold">{escolaNome}</h1>
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">
              Declaração com Notas
            </p>
            <p className="text-xs text-slate-500">Data: {hoje}</p>
            {numero ? (
              <p className="text-[11px] text-slate-500">Nº {String(numero).padStart(4, "0")}</p>
            ) : null}
          </header>

          <section className="space-y-3 text-sm leading-relaxed">
            <p>
              Declara-se, para os devidos efeitos, que <strong>{typeof snapshot.aluno_nome === "string" ? snapshot.aluno_nome : "—"}</strong>,
              portador do BI nº <strong>{typeof snapshot.aluno_bi === "string" ? snapshot.aluno_bi : "—"}</strong>, está regularmente
              matriculado na <strong>{typeof snapshot.classe_nome === "string" ? snapshot.classe_nome : "—"}</strong>, Turma
              <strong> {typeof snapshot.turma_nome === "string" ? snapshot.turma_nome : "—"}</strong>, Turno
              <strong> {typeof snapshot.turma_turno === "string" ? snapshot.turma_turno : "—"}</strong>, no ano letivo
              <strong> {typeof snapshot.ano_letivo === "string" || typeof snapshot.ano_letivo === "number" ? String(snapshot.ano_letivo) : "—"}</strong>, tendo obtido o seguinte aproveitamento
              pedagógico:
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
                {disciplinas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                      Sem notas lançadas até o momento.
                    </td>
                  </tr>
                ) : (
                  disciplinas.map((row, index) => {
                    const t1 = row.t1 ?? null;
                    const t2 = row.t2 ?? null;
                    const t3 = row.t3 ?? null;
                    const media =
                      t1 !== null && t2 !== null && t3 !== null
                        ? (t1 + t2 + t3) / 3
                        : null;

                    return (
                      <tr key={`${row.key}-${index}`}>
                        <td className="border border-slate-200 px-2 py-2 text-left">
                          {row.nome || "—"}
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
