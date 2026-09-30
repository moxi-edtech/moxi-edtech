"use client";

import { docPrintUrl, type TipoDocumentoEmitivel } from "./printUrl";

/**
 * Cliente partilhado de emissão de documentos.
 *
 * Existia duplicado: o balcão e o hub de documentos construíam cada um o seu
 * corpo de pedido, tratavam cada um os seus erros e — o que motivou isto —
 * lidavam cada um com o popup de impressão à sua maneira. O balcão chegou a
 * fazer `window.open` do recibo sem verificação nenhuma, perdendo o documento
 * em silêncio com popups bloqueados.
 */

export type EmitirDocumentoInput = {
  escolaId: string;
  alunoId: string;
  tipoDocumento: TipoDocumentoEmitivel;
  /** Id de `school_sessions`. Obrigatório para histórico, certificado,
   *  comprovante, notas e boletim. */
  anoLetivoId?: string | null;
  /** Ano numérico. Só o boletim trimestral usa. */
  anoLetivo?: number | null;
};

export type EmitirDocumentoResult =
  | { ok: true; docId: string; printUrl: string }
  | { ok: false; error: string };

/**
 * Emite e devolve SEMPRE o URL de impressão junto com o `docId`, para que
 * nenhum chamador possa receber um documento emitido e perder o URL.
 */
export async function emitirDocumento(
  input: EmitirDocumentoInput
): Promise<EmitirDocumentoResult> {
  const { escolaId, alunoId, tipoDocumento, anoLetivoId, anoLetivo } = input;

  const corpo: Record<string, unknown> = { alunoId, escolaId, tipoDocumento };
  // O zod da rota declara `.optional()`, não `.nullable()`. Enviar
  // `ano_letivo_id: null` falha a validação e a rota responde com o
  // `error.format()` do zod — um objecto, que virava "[object Object]" na
  // mensagem mostrada ao operador. Omitir a chave é o que a rota espera.
  if (anoLetivoId) corpo.ano_letivo_id = anoLetivoId;
  if (tipoDocumento === "boletim_trimestral" && anoLetivo != null) {
    corpo.ano_letivo = anoLetivo;
  }

  try {
    const response = await fetch("/api/secretaria/documentos/emitir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      docId?: string;
      error?: unknown;
    };

    if (!response.ok || !json?.ok || !json?.docId) {
      return { ok: false, error: mensagemDeErro(json?.error) };
    }

    const docId = String(json.docId);
    return { ok: true, docId, printUrl: docPrintUrl(docId, tipoDocumento) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível emitir o documento.",
    };
  }
}

/** Extrai uma mensagem legível de um erro da rota, que tanto pode ser string
 *  como o objecto de `error.format()` do zod. */
function mensagemDeErro(erro: unknown): string {
  if (typeof erro === "string" && erro.trim()) return erro;
  if (erro && typeof erro === "object") {
    const mensagem = primeiroErroZod(erro, 0);
    if (mensagem) return mensagem;
  }
  return "Não foi possível emitir o documento.";
}

function primeiroErroZod(no: unknown, profundidade: number): string | null {
  if (!no || typeof no !== "object" || profundidade > 3) return null;
  const registo = no as Record<string, unknown>;
  const lista = registo._errors;
  if (Array.isArray(lista) && typeof lista[0] === "string") return lista[0];
  for (const valor of Object.values(registo)) {
    const encontrado = primeiroErroZod(valor, profundidade + 1);
    if (encontrado) return encontrado;
  }
  return null;
}

export type ResultadoImpressao =
  | { ok: true; url: string }
  | { ok: false; url: string; motivo: "popup_bloqueado" };

/**
 * Abre o URL numa aba nova. Função TOTAL: nunca lança, e devolve o URL nos dois
 * ramos — quem chama nunca fica sem o documento, mesmo quando o browser bloqueia
 * o popup. Nesse caso o URL deve ir para a fila de impressão visível.
 *
 * NOTA IMPORTANTE sobre a detecção: isto abre SEM a feature `noopener`, porque
 * `window.open(url, "_blank", "noopener")` devolve `null` por especificação,
 * independentemente de o popup ter aberto ou sido bloqueado. Testar esse
 * retorno como sinal de bloqueio — que era o que o código fazia — nunca
 * distingue os dois casos. O isolamento do `noopener` é obtido a seguir, ao
 * limpar `opener` na janela devolvida.
 */
export function abrirParaImpressao(url: string): ResultadoImpressao {
  let janela: Window | null = null;
  try {
    janela = window.open(url, "_blank");
  } catch {
    janela = null;
  }

  if (!janela) return { ok: false, url, motivo: "popup_bloqueado" };

  try {
    janela.opener = null;
  } catch {
    // Alguns browsers não permitem tocar em `opener`; a aba já está aberta,
    // portanto isto não é motivo para reportar falha.
  }

  return { ok: true, url };
}
