import Link from "next/link";
"use client";

import AuditPageView from "@/components/audit/AuditPageView";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import DocumentosAprovacoesQueue from "@/components/secretaria/DocumentosAprovacoesQueue";
import { useEscolaId } from "@/hooks/useEscolaId";

export default function DocumentosPage() {
  const { escolaId, isLoading, error } = useEscolaId();

  if (isLoading) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
        <div className="p-4 text-sm text-slate-500">Carregando contexto da escola...</div>
      </>
    );
  }

  if (error || !escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          {error || "Vincule seu perfil a uma escola para emitir documentos."}
        </div>
      </>
    );
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <div className="p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-slate-900">Boletim de notas: pagamento e liberação</p>
            <p className="mt-1 text-xs text-slate-600">Os comprovativos pagos são confirmados em Recebimentos, não na fila de documentos gratuitos. Confira o valor antes de validar.</p>
            <p className="mt-1 text-xs text-slate-500">Se a taxa não aparecer para o aluno, a direção deve defini-la em Administração → Configurações → Emolumentos &amp; Serviços.</p>
          </div>
          <Link href={`/escola/${escolaId}/secretaria/recebimentos`} className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Validar comprovativos</Link>
        </div>
        <DocumentosAprovacoesQueue />
        <DocumentosEmissaoHubClient escolaId={escolaId} />
      </div>
    </>
  );
}
