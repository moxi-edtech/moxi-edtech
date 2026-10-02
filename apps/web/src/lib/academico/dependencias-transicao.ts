export type AcademicCarryoverStatus =
  | "pendente"
  | "em_recurso"
  | "resolvida_aprovada"
  | "resolvida_reprovada"
  | "cancelada";

export type AcademicCarryoverPresentation = {
  terminal: boolean;
  tone: "amber" | "sky" | "emerald" | "rose" | "slate";
  title: string;
  description: string;
  nextAction: string | null;
};

export function describeAcademicCarryover(
  status: AcademicCarryoverStatus,
  source?: string | null,
): AcademicCarryoverPresentation {
  const normalizedSource = String(source ?? "").toLowerCase();
  const sourceLabel = normalizedSource === "extraordinario"
    ? "exame extraordinário"
    : normalizedSource === "recurso"
      ? "recurso"
      : "avaliação académica";

  switch (status) {
    case "pendente":
      return {
        terminal: false,
        tone: "amber",
        title: "Dependência académica pendente",
        description: "A disciplina do ano anterior ainda precisa de uma resolução académica oficial.",
        nextAction: "Acompanhar a abertura e publicação da avaliação indicada pela escola.",
      };
    case "em_recurso":
      return {
        terminal: false,
        tone: "sky",
        title: "Dependência em resolução",
        description: `A disciplina está a ser resolvida por ${sourceLabel}.`,
        nextAction: "Aguardar a publicação do resultado oficial.",
      };
    case "resolvida_aprovada":
      return {
        terminal: true,
        tone: "emerald",
        title: "Dependência resolvida",
        description: `O ${sourceLabel} resolveu a disciplina com resultado positivo.`,
        nextAction: null,
      };
    case "resolvida_reprovada":
      return {
        // A avaliação terminou, mas a situação operacional do aluno não.
        // Não inferimos retenção/cancelamento sem uma regra RAA explícita.
        terminal: false,
        tone: "rose",
        title: "Resultado negativo — decisão académica necessária",
        description: `O ${sourceLabel} foi concluído, mas a disciplina permaneceu com resultado negativo.`,
        nextAction: "A secretaria deve aplicar a decisão académica seguinte prevista pelo RAA antes de encerrar este acompanhamento.",
      };
    case "cancelada":
      return {
        terminal: true,
        tone: "slate",
        title: "Dependência cancelada",
        description: "O acompanhamento desta dependência foi cancelado por uma operação académica válida.",
        nextAction: null,
      };
  }
}
