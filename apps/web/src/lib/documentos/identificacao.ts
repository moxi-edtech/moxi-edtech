const TIPO_CODIGO: Record<string, string> = {
  recibo: "RECIBO",
  comprovante_matricula: "COMPROVANTE_MATRICULA",
  declaracao_frequencia: "DECLARACAO_FREQUENCIA",
  declaracao_notas: "DECLARACAO_NOTAS",
  boletim_trimestral: "BOLETIM_TRIMESTRAL",
  ficha_inscricao: "FICHA_INSCRICAO",
  cartao_estudante: "CARTAO_ESTUDANTE",
  historico: "HISTORICO_ESCOLAR",
  certificado: "CERTIFICADO_HABILITACOES",
};

export function getDocumentoTipoCodigo(tipo: unknown, snapshotTipo?: unknown) {
  const value = String(snapshotTipo ?? tipo ?? "documento").trim().toUpperCase();
  if (value.startsWith("DOC_")) return value;
  return `DOC_${TIPO_CODIGO[value.toLowerCase()] ?? value.replace(/[^A-Z0-9]+/g, "_")}`;
}

export function formatDocumentoIdentificacao(tipo: unknown, numero: unknown) {
  const numeric = Number(numero);
  return Number.isFinite(numeric) && numeric > 0
    ? `${getDocumentoTipoCodigo(tipo)}-${String(Math.trunc(numeric)).padStart(6, "0")}`
    : getDocumentoTipoCodigo(tipo);
}
