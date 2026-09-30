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

// Inverso de TIPO_CODIGO, com o prefixo DOC_ que os serviços usam como código.
const CODIGO_TIPO: Record<string, string> = Object.fromEntries(
  Object.entries(TIPO_CODIGO).map(([tipo, codigo]) => [`DOC_${codigo}`, tipo]),
);

/**
 * Dado o código de um serviço (ex.: "DOC_DECLARACAO_FREQUENCIA") ou já um tipo
 * (ex.: "declaracao_frequencia"), devolve o tipo que a API de emissão aceita.
 *
 * Devolve null quando não há correspondência — quem chama deve desistir em vez
 * de enviar um tipo inventado, que a API recusa com 400.
 *
 * Os códigos são configuráveis por escola e por isso aparecem variantes
 * truncadas do mesmo documento (a Escola KLASSE tem DOC_DECLARACAO_FREQ a par
 * de DOC_DECLARACAO_FREQUENCIA). Daí a correspondência por prefixo, escolhendo
 * sempre o código mais longo para não haver ambiguidade.
 */
export function getTipoDocumentoFromCodigo(valor: unknown): string | null {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;

  const minusculo = bruto.toLowerCase();
  if (TIPO_CODIGO[minusculo]) return minusculo; // já é um tipo

  const maiusculo = bruto.toUpperCase();
  if (CODIGO_TIPO[maiusculo]) return CODIGO_TIPO[maiusculo]; // código exacto

  const candidatos = Object.keys(CODIGO_TIPO)
    .filter((codigo) => codigo.startsWith(maiusculo) || maiusculo.startsWith(codigo))
    .sort((a, b) => b.length - a.length);

  if (!candidatos.length) return null;
  if (candidatos.length > 1 && candidatos[0].length === candidatos[1].length) return null; // ambíguo
  return CODIGO_TIPO[candidatos[0]];
}

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
