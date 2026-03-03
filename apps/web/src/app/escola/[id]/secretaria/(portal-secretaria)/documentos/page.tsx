"use client";

import AuditPageView from "@/components/audit/AuditPageView";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
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
        <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded-xl text-klasse-gold-800 text-sm">
          {error || "Vincule seu perfil a uma escola para emitir documentos."}
        </div>
      </>
    );
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <div className="p-4 md:p-6">
        <DocumentosEmissaoHubClient escolaId={escolaId} />
      </div>
    </>
  );
}
