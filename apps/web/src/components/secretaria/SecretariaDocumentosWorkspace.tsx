"use client";
import { useState } from "react";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildPortalHref, buildContextualPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import DocumentosAprovacoesQueue from "@/components/secretaria/DocumentosAprovacoesQueue";
import DocumentosEmitidosList from "@/components/secretaria/DocumentosEmitidosList";
import { FaltasJustificacoesQueue } from "@/components/secretaria/FaltasJustificacoesQueue";
import { FileText, Inbox, History, CalendarCheck, ClipboardList } from "lucide-react";

const tabs = [
  { id: "emitir", label: "Emitir", Icon: FileText },
  { id: "solicitacoes", label: "Solicitações", Icon: Inbox },
  { id: "emitidos", label: "Emitidos", Icon: History },
  { id: "faltas", label: "Justificações de faltas", Icon: CalendarCheck },
] as const;

export default function SecretariaDocumentosWorkspace({ escolaId }: { escolaId: string }) {
  const pathname = usePathname();
  const escolaParam = getEscolaParamFromPath(pathname);
  const recebimentosHref = buildPortalHref(escolaParam, "/secretaria/recebimentos");
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("emitir");
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  return (
    <div className={PORTAL_PAGE_INSET}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Central de Documentos</h1>
          <p className="text-sm text-muted-foreground">Emissão, solicitações dos alunos e histórico de documentos.</p>
        </div>
        <Link href={recebimentosHref} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">
          Validar comprovativos
        </Link>
      </div>
      <nav aria-label="Áreas da Central de Documentos" className="mb-5 flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${tab === id ? "bg-muted text-foreground ring-1 ring-klasse-gold/25" : "text-muted-foreground hover:bg-muted"}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
            {id === "solicitacoes" && pendingCount !== null && pendingCount > 0 && <span className="rounded-full bg-muted px-2 text-xs" aria-label={`${pendingCount} pendentes`}>{pendingCount}</span>}
          </button>
        ))}
        <Link href={buildContextualPortalHref(escolaParam ?? escolaId, "/secretaria/provas", pathname)} prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"><ClipboardList className="h-4 w-4" aria-hidden="true"/> Provas</Link>
      </nav>
      <div hidden={tab !== "emitir"}><DocumentosEmissaoHubClient key={escolaId} escolaId={escolaId} /></div>
      <div hidden={tab !== "solicitacoes"}><DocumentosAprovacoesQueue key={escolaId} onCountChange={setPendingCount} /></div>
      {tab === "emitidos" && <DocumentosEmitidosList key={escolaId} />}
      {tab === "faltas" && <FaltasJustificacoesQueue key={escolaId} />}
    </div>
  );
}
