import type {
  DisciplinaBoletim,
  DisciplinaClassificacoes,
  ClassificacaoTrimestral,
} from "@/lib/aluno/boletimNotas";

export type PublishedStudentDiscipline = DisciplinaBoletim & {
  classificacoes: ClassificacaoTrimestral[];
};

/**
 * Só se devolvem avaliações de trimestres com pauta oficial publicada.
 * A publicação institucional é a evidência conservadora existente;
 * uma avaliação em curso nunca se converte por inferência em nota final.
 */
export function selectPublishedStudentGrades(
  grades: ReadonlyArray<DisciplinaBoletim>,
  classifications: ReadonlyArray<DisciplinaClassificacoes>,
  publishedTrimesters: ReadonlySet<number>,
): PublishedStudentDiscipline[] {
  const classificationBySubject = new Map(classifications.map((row) => [row.id, row.classificacoes]));
  return grades.map((subject) => ({
    ...subject,
    avaliacoes: subject.avaliacoes.filter((item) => publishedTrimesters.has(item.trimestre)),
    classificacoes: (classificationBySubject.get(subject.id) ?? [])
      .filter((item) => publishedTrimesters.has(item.trimestre))
      .map((item) => item.status === "disponivel" && item.nota !== null
        ? item
        : { ...item, status: "pendente" as const, nota: null }),
  })).filter((subject) => subject.avaliacoes.length > 0 || subject.classificacoes.length > 0);
}

/** Só o documento `trimestral` bem-sucedido conta como publicação.
 * `PROCESSING`, `FAILED`, pauta anual e caminho vazio não libertam dados.
 */
export function publishedTrimestersFromOfficialSheets(
  records: ReadonlyArray<{
    numero: number | null;
    tipo: string | null;
    status: string | null;
    pdf_path: string | null;
  }>,
): Set<number> {
  return new Set(records
    .filter((row) => row.tipo === "trimestral" && row.status === "SUCCESS" &&
      Boolean(row.pdf_path?.trim()) && Number.isInteger(row.numero) &&
      row.numero !== null && row.numero >= 1 && row.numero <= 3)
    .map((row) => Number(row.numero)));
}
