/**
 * Historic academic evidence from the school's own pauta, independent of the
 * current operational curriculum. This is a REVIEW ONLY read model.
 * Never infer approval, write notes or close a snapshot from this projection.
 */
export type PautaHistoricaNota = {
  disciplina_id: string;
  disciplina_nome: string | null;
  nota_final: number | string | null;
  notas_detalhe: Record<string, unknown> | null;
};

export type PautaHistoricaReview = {
  disciplinas: Array<{
    id: string;
    nome: string;
    nota: number | null;
    escala: number | null;
    arquivo: string | null;
    aba: string | null;
    linha: string | null;
    mapeada_na_turma: boolean | null;
    nota_abaixo_metade: boolean;
  }>;
  arquivos: string[];
  contagem_notas: number;
  contagem_matriz: number | null;
  sem_mapeamento: number;
  notas_abaixo_metade: number;
  divergencia_ano_documento: boolean;
  processo_verificado: boolean | null;
  alertas: string[];
  evidencia_original_confirmada: false;
};

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const processNumber = (s: string) => s.replace(/^0+/, "") || "0";
const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Never treat today's turma_disciplinas as ground truth for a past school year. */
export function buildPautaHistoricaReview(
  notas: PautaHistoricaNota[],
  currentCurriculumIds: ReadonlySet<string> | null,
  numeroProcesso: string | null,
  anoLetivo: number,
): PautaHistoricaReview {
  const alertas = new Set<string>();
  const arquivos = new Set<string>();
  const disciplinas: PautaHistoricaReview["disciplinas"] = [];
  let semMapeamento = 0;
  let notasAbaixoMetade = 0;
  let divergenciaAno = false;
  let processoVerificado: boolean | null = null;
  const uniqueDiscipline = new Set<string>();
  const periodo = new Set([String(anoLetivo), `${anoLetivo}/${anoLetivo + 1}`]);

  for (const item of notas) {
    const info = item.notas_detalhe ?? {};
    const arquivo = clean(info.arquivo) || null;
    const aba = clean(info.aba) || null;
    const linha = clean(info.linha) || null;
    const ano = clean(info.ano_letivo);
    const nome = clean(item.disciplina_nome);
    const nota = numeric(item.nota_final);
    const escala = numeric(info.escala_maxima ?? info.escala);
    const origemProcesso = clean(info.numero_processo);
    const match = currentCurriculumIds === null ? null : currentCurriculumIds.has(item.disciplina_id);
    if (arquivo) {
      arquivos.add(arquivo);
      // A legacy filename alone is an inspection flag, not proof of a bad
      // academic year: the workbook's actual sheet header must be checked.
      if (/20(?:\d\d)[-_](?:\d\d)/.test(arquivo) &&
          !arquivo.includes(String(anoLetivo)) &&
          !arquivo.includes(`${anoLetivo - 2000}-${(anoLetivo + 1) - 2000}`))
        alertas.add("ANO_NO_NOME_DO_ARQUIVO");
    } else {
      alertas.add("ARQUIVO_ORIGEM_AUSENTE");
    }
    if (!periodo.has(ano)) {
      divergenciaAno = true;
      alertas.add("ANO_DECLARADO_NA_ORIGEM");
    }
    if (nota === null || (escala !== null && (nota < 0 || nota > escala))) {
      alertas.add("NOTA_OU_ESCALA_INVALIDA");
    }
    if (escala === null) alertas.add("ESCALA_NAO_DOCUMENTADA");
    if (!nome || !item.disciplina_id) alertas.add("DISCIPLINA_NAO_IDENTIFICADA");
    if (uniqueDiscipline.has(item.disciplina_id)) alertas.add("DISCIPLINA_REPETIDA");
    uniqueDiscipline.add(item.disciplina_id);
    if (match === false) semMapeamento += 1;
    // A below-half subject is an academic review flag, not a failed grade:
    // legal progression, final-cycle exams and remediation vary by regime.
    const notaAbaixoMetade = nota !== null && escala !== null && escala > 0 && nota < escala / 2;
    if (notaAbaixoMetade) notasAbaixoMetade += 1;
    if (origemProcesso) {
      if (numeroProcesso) {
        const same = processNumber(numeroProcesso) === processNumber(origemProcesso);
        processoVerificado = processoVerificado === false ? false : same;
        if (!same) alertas.add("PROCESSO_DIVERGENTE");
      } else {
        alertas.add("PROCESSO_CADASTRAL_AUSENTE");
      }
    }
    disciplinas.push({
      id: item.disciplina_id, nome: nome || "Disciplina não identificada", nota,
      escala, arquivo, aba, linha, mapeada_na_turma: match,
      nota_abaixo_metade: notaAbaixoMetade,
    });
  }
  if (!notas.length) alertas.add("SEM_NOTAS_NA_PAUTA");
  if (semMapeamento) alertas.add("MATRIZ_ATUAL_DIFERENTE_DA_PAUTA");
  if (notasAbaixoMetade) alertas.add("NOTAS_BAIXAS_VERIFICAR_RAA");
  if (currentCurriculumIds !== null &&
      uniqueDiscipline.size < currentCurriculumIds.size)
    alertas.add("PAUTA_MENOR_QUE_MATRIZ_ATUAL");
  // External original XLSX/teacher-signed pauta is not present in metadata.
  // A named XLSX or a hash string is not confirmation of its original bytes.
  alertas.add("CONFERIR_EXCEL_ORIGINAL");
  return {
    disciplinas: disciplinas.sort((a,b) => a.nome.localeCompare(b.nome, "pt")),
    arquivos: [...arquivos].sort(),
    contagem_notas: notas.length,
    contagem_matriz: currentCurriculumIds?.size ?? null,
    sem_mapeamento: semMapeamento,
    notas_abaixo_metade: notasAbaixoMetade,
    divergencia_ano_documento: divergenciaAno,
    processo_verificado: processoVerificado,
    alertas: [...alertas],
    evidencia_original_confirmada: false,
  };
}
