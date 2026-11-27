"use client";

import dynamic from "next/dynamic";
import AuditPageView from "@/components/audit/AuditPageView";
import { usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { TabNotificacoes } from "@/components/aluno/tabs/TabNotificacoes";
import type { AcademicTab } from "@/components/aluno/academico/AcademicoWorkspace";

const loading = () => <p role="status" className="text-sm text-muted-foreground">A carregar informação…</p>;
const Enrollment = dynamic(() => import("@/components/aluno/home/RematriculaBanner").then(module => module.RematriculaBanner));

const Academic = dynamic(() => import("@/components/aluno/academico/AcademicoWorkspace").then(module => module.AcademicoWorkspace), { loading });
const Finance = dynamic(() => import("@/components/aluno/tabs/TabFinanceiro").then(module => module.TabFinanceiro), { loading });
const Documents = dynamic(() => import("@/components/aluno/tabs/TabDocumentos").then(module => module.TabDocumentos), { loading });

export function StudentDrawerWorkspace({ scope, kind, initialTab, serviceCode }: {
  scope: string;
  kind: "academic" | "finance" | "documents" | "enrollment";
  initialTab?: AcademicTab;
  serviceCode?: string | null;
}) {
  const navigation = usePortalDrawerNavigation();
  const openNotices = () => navigation?.push({
    id: `${scope}:notices`, title: "Avisos", description: "Comunicações publicadas pela escola.",
    content: <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="avisos" /><TabNotificacoes /></>,
  });
  const openDocuments = (code: string | null) => navigation?.push({
    id: `${scope}:documents:${code ?? "all"}`, title: "Documentos e serviços", description: "Consulta e acompanha os teus pedidos.",
    content: <StudentDrawerWorkspace scope={scope} kind="documents" serviceCode={code} />,
  });
  const openNotes = () => navigation?.push({
    id: `${scope}:academic`, title: "Académico", description: "Notas, disciplinas, faltas e documentos.",
    content: <StudentDrawerWorkspace scope={scope} kind="academic" initialTab="notas" />,
  });
  if (kind === "enrollment") return <Enrollment embedded onFinance={() => navigation?.push({
    id: `${scope}:finance`, title: "Situação financeira", description: "Consulta propinas e pagamentos.",
    content: <StudentDrawerWorkspace scope={scope} kind="finance" />,
  })} />;
  if (kind === "finance") return <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="financeiro_portal" /><Finance onOpenDocuments={openDocuments} /></>;
  if (kind === "documents") return <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="documentos" /><Documents embedded focusServiceCode={serviceCode} onOpenNotas={openNotes} onOpenNotices={openNotices} /></>;
  return <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="academico" /><Academic embedded initialTab={initialTab} onOpenNotices={openNotices} /></>;
}
