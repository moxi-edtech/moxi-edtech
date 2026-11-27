"use client";

import AuditPageView from "@/components/audit/AuditPageView";
import { usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator";
import { TabNotificacoes } from "@/components/aluno/tabs/TabNotificacoes";
import { AcademicoWorkspace, type AcademicTab } from "@/components/aluno/academico/AcademicoWorkspace";
import { TabFinanceiro } from "@/components/aluno/tabs/TabFinanceiro";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";
import { RematriculaBanner } from "@/components/aluno/home/RematriculaBanner";

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
  if (kind === "enrollment") return <RematriculaBanner embedded onFinance={() => navigation?.push({
    id: `${scope}:finance`, title: "Situação financeira", description: "Consulta propinas e pagamentos.",
    content: <StudentDrawerWorkspace scope={scope} kind="finance" />,
  })} />;
  if (kind === "finance") return <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="financeiro_portal" /><TabFinanceiro onOpenDocuments={openDocuments} /></>;
  if (kind === "documents") return <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="documentos" /><TabDocumentos embedded focusServiceCode={serviceCode} onOpenNotas={openNotes} onOpenNotices={openNotices} /></>;
  return <><AuditPageView portal="aluno" acao="PAGE_VIEW" entity="academico" /><AcademicoWorkspace embedded initialTab={initialTab} onOpenNotices={openNotices} /></>;
}
