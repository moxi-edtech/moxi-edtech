"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import DocumentosAprovacoesQueue from "@/components/secretaria/DocumentosAprovacoesQueue";
import { FaltasJustificacoesQueue } from "@/components/secretaria/FaltasJustificacoesQueue";

/** Uma composição para as rotas canónica e de compatibilidade da Secretaria. */
export default function SecretariaDocumentosWorkspace({ escolaId }: { escolaId: string }) {
  const pathname = usePathname();
  const escolaParam = getEscolaParamFromPath(pathname);
  const recebimentosHref = buildPortalHref(escolaParam, "/secretaria/recebimentos");

  return (
    <div className={PORTAL_PAGE_INSET}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-bold text-foreground">Central de Documentos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Emita declarações, históricos e certificados no mesmo lugar. Os documentos pagos só são liberados após liquidação; a reimpressão nunca gera outra cobrança.
          </p>
        </div>
        <Link href={recebimentosHref} className="inline-flex min-h-11 items-center rounded-xl bg-klasse-gold px-4 text-sm font-bold text-klasse-gold-900 hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">
          Validar comprovativos
        </Link>
      </div>
      <DocumentosAprovacoesQueue key={escolaId} />
      <FaltasJustificacoesQueue key={escolaId} />
      <DocumentosEmissaoHubClient escolaId={escolaId} />
    </div>
  );
}
