/**
 * Mapa canónico "tipo de documento -> segmento da página de impressão".
 *
 * Existia duplicado em dois sítios: um `Record` em BalcaoAtendimento.tsx e uma
 * cadeia de ternários em DocumentosEmissaoHubClient.tsx. Os conteúdos eram
 * idênticos, mas nada os obrigava a continuar a ser. Este módulo é a fonte
 * única.
 *
 * Módulo PURO, deliberadamente sem "use client": há módulos de servidor que
 * constroem URLs de impressão (`documentos/emitirComprovanteMatricula.ts` e
 * várias rotas em `api/secretaria/**`). Marcar este ficheiro como cliente faria
 * os seus exports virarem referências de cliente e partiria esses
 * consumidores — em Next.js, um módulo "use client" importado por um Server
 * Component não é executável no servidor.
 */

/** Tipos aceites pela rota `POST /api/secretaria/documentos/emitir`. */
export type TipoDocumentoEmitivel =
  | "declaracao_frequencia"
  | "declaracao_notas"
  | "boletim_trimestral"
  | "cartao_estudante"
  | "ficha_inscricao"
  | "comprovante_matricula"
  | "historico"
  | "certificado";

export const TIPOS_DOCUMENTO_EMITIVEL = [
  "declaracao_frequencia",
  "declaracao_notas",
  "boletim_trimestral",
  "cartao_estudante",
  "ficha_inscricao",
  "comprovante_matricula",
  "historico",
  "certificado",
] as const satisfies readonly TipoDocumentoEmitivel[];

/**
 * `satisfies` obriga a que acrescentar um membro ao union sem lhe dar segmento
 * seja erro de compilação, em vez de cair silenciosamente no fallback.
 */
export const DOC_PRINT_SEGMENT = {
  declaracao_frequencia: "frequencia",
  declaracao_notas: "notas",
  boletim_trimestral: "boletim-trimestral",
  cartao_estudante: "cartao",
  ficha_inscricao: "ficha",
  comprovante_matricula: "comprovante-matricula",
  historico: "historico",
  certificado: "certificado",
} as const satisfies Record<TipoDocumentoEmitivel, string>;

/** Segmento usado por qualquer tipo fora do mapa. */
export const DOC_PRINT_SEGMENT_FALLBACK = "ficha";

/**
 * `getTipoDocumentoFromCodigo` pode devolver tipos que a rota de emissão não
 * aceita — `"recibo"` é o caso real: existe no catálogo de serviços e na
 * página de impressão, mas não no enum do zod. Sem esta guarda o balcão fazia
 * o POST e recebia um 400.
 */
export function isTipoDocumentoEmitivel(valor: unknown): valor is TipoDocumentoEmitivel {
  return (
    typeof valor === "string" &&
    (TIPOS_DOCUMENTO_EMITIVEL as readonly string[]).includes(valor)
  );
}

/**
 * `/secretaria/documentos/${docId}/${segmento}/print`.
 *
 * O caminho é deliberadamente sem prefixo de escola: as páginas em
 * `[docId]/*​/print` são Server Components que resolvem tudo pelo `docId`, e o
 * hub é montado tanto em `/secretaria/documentos` como em
 * `/escola/[id]/secretaria/documentos`.
 *
 * `tipoDocumento` fica tipado como `string` (e não como o union) porque o
 * fallback é comportamento real a preservar.
 */
export function docPrintUrl(docId: string, tipoDocumento: string): string {
  const segmento =
    DOC_PRINT_SEGMENT[tipoDocumento as TipoDocumentoEmitivel] ?? DOC_PRINT_SEGMENT_FALLBACK;
  return `/secretaria/documentos/${docId}/${segmento}/print`;
}
