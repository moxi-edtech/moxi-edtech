/** Projecção de interface; não altera nem cria estados persistidos na pauta. */
export type ReopeningStoredState = "PENDENTE" | "APROVADO" | "REJEITADO" | "EXPIRADO";
export type ReopeningDisplayState = ReopeningStoredState | "REVOGADO";

export function reopeningDisplayState(
  status: ReopeningStoredState,
  expiraEm: string | null,
  now = Date.now(),
): ReopeningDisplayState {
  // A decisão "EXPIRADO" gravada pela Direção corresponde a revogação.
  // Um pedido cuja validade terminou permanece registado com o estado
  // original na base e é apresentado como expirado na interface.
  if (status === "EXPIRADO") return "REVOGADO";
  if ((status === "PENDENTE" || status === "APROVADO") &&
      expiraEm && Number.isFinite(Date.parse(expiraEm)) &&
      Date.parse(expiraEm) <= now) return "EXPIRADO";
  return status;
}

export const reopeningFeedback: Record<ReopeningDisplayState, {
  label: string;
  next: string;
}> = {
  PENDENTE: {
    label: "Aguarda decisão",
    next: "A escola vai analisar o pedido. Não precisas de enviar outro.",
  },
  APROVADO: {
    label: "Reabertura aprovada",
    next: "Abre a pauta e guarda a nota dentro do prazo autorizado.",
  },
  REJEITADO: {
    label: "Pedido rejeitado",
    next: "Consulta o motivo da decisão antes de apresentar outro pedido.",
  },
  EXPIRADO: {
    label: "Prazo terminado",
    next: "O prazo terminou. Podes solicitar uma nova reabertura na pauta.",
  },
  REVOGADO: {
    label: "Autorização revogada",
    next: "A escola revogou a autorização. Contacta a Direção se precisares de esclarecimentos.",
  },
};
