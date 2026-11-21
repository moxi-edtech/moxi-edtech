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
          <p className="text-sm font-bold text-foreground">Boletim de notas: pagamento e liberação</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirme pagamentos em Recebimentos. Os documentos gratuitos são aprovados na fila abaixo, sem confirmar transacções bancárias. Declaração oficial com notas e boletim dinâmico são documentos diferentes, ambos dependem das taxas configuradas pela escola e liquidadas.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se a taxa do boletim não aparecer ao aluno, configure-a em Administração → Configurações → Emolumentos &amp; Serviços.
          </p>
        </div>
        <Link href={recebimentosHref} className="inline-flex min-h-11 items-center rounded-xl bg-klasse-gold px-4 text-sm font-bold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">
          Validar comprovativos
        </Link>
      </div>
      <DocumentosAprovacoesQueue />
      <FaltasJustificacoesQueue />
      <DocumentosEmissaoHubClient escolaId={escolaId} />
    </div>
  );
}
