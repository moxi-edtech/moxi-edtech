"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import DocumentosAprovacoesQueue from "@/components/secretaria/DocumentosAprovacoesQueue";

/** Uma composição para as rotas canónica e de compatibilidade da Secretaria. */
export default function SecretariaDocumentosWorkspace({ escolaId }: { escolaId: string }) {
  const pathname = usePathname();
  const escolaParam = getEscolaParamFromPath(pathname);
  const recebimentosHref = buildPortalHref(escolaParam, "/secretaria/recebimentos");

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold text-slate-900">Boletim de notas: pagamento e liberação</p>
          <p className="mt-1 text-xs text-slate-600">
            Confirme pagamentos em Recebimentos. Os documentos gratuitos são aprovados na fila abaixo, sem confirmar transacções bancárias. Declaração oficial com notas e boletim dinâmico são documentos diferentes, ambos dependem das taxas configuradas pela escola e liquidadas.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Se a taxa do boletim não aparecer ao aluno, configure-a em Administração → Configurações → Emolumentos &amp; Serviços.
          </p>
        </div>
        <Link href={recebimentosHref} className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">
          Validar comprovativos
        </Link>
      </div>
      <DocumentosAprovacoesQueue />
      <DocumentosEmissaoHubClient escolaId={escolaId} />
    </div>
  );
}
