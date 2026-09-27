import type { ReactNode } from "react";

/**
 * Cabeçalho canónico dos documentos escolares impressos.
 *
 * Extraído da variante que estava copiada em cinco páginas de impressão
 * (frequência, boletim-trimestral, ficha, cartão, comprovante-matricula). Ao
 * adoptá-lo num documento novo, o resultado fica igual ao dos restantes sem
 * voltar a copiar o markup — que é precisamente como as cinco cópias
 * divergiram.
 *
 * Componente de servidor: sem "use client", para poder ser consumido tanto por
 * Server Components (FinalDocumentPrint) como por páginas que já imprimem.
 *
 * O logótipo cai para a Insígnia da República quando a escola não tem um
 * configurado — é o mesmo fallback que os restantes documentos usam.
 */
export function PrintLetterhead({
  escolaNome,
  logoUrl,
  titulo,
  data,
  numero,
}: {
  escolaNome?: string | null;
  logoUrl?: string | null;
  /** Título do documento, ex.: "Certificado de Habilitações". */
  titulo: string;
  /** Data por extenso já formatada. Omitida, a linha não é renderizada. */
  data?: string | null;
  /** Identificação do documento (nº sequencial, código). ReactNode para
   *  acomodar os dois formatos que os documentos usam hoje. */
  numero?: ReactNode;
}) {
  return (
    <header className="space-y-2 text-center">
      <div className="flex justify-center">
        <img
          src={logoUrl ?? "/insignia_med.png"}
          alt="Insígnia da República de Angola"
          className="h-20 w-20 max-h-20 max-w-20 object-contain"
        />
      </div>
      <p className="text-xs font-semibold uppercase text-slate-500">
        República de Angola · Ministério da Educação
      </p>
      <h1 className="text-2xl font-semibold">{escolaNome ?? "—"}</h1>
      <p className="text-sm font-semibold uppercase">{titulo}</p>
      {data ? <p className="text-xs text-slate-500">Data: {data}</p> : null}
      {numero ? <p className="text-[11px] text-slate-500">{numero}</p> : null}
    </header>
  );
}
