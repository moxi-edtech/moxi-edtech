"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, FileText, GraduationCap, CalendarCheck } from "lucide-react";
import { TabNotas } from "@/components/aluno/tabs/TabNotas";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";
import { TabFaltas } from "@/components/aluno/tabs/TabFaltas";
import { DisciplinasList } from "@/components/aluno/disciplinas/DisciplinasList";
import { PortalTabs } from "@/components/portal/ui/PortalTabs";

type AcademicTab = "notas" | "disciplinas" | "faltas" | "documentos";
const validTabs: AcademicTab[] = ["notas", "disciplinas", "faltas", "documentos"];

export function resolveAcademicTab(value: string | null | undefined): AcademicTab {
  return validTabs.find((tab) => tab === value) ?? "notas";
}

const sections = [
  { id: "notas" as const, label: "Notas", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "disciplinas" as const, label: "Disciplinas", icon: <BookOpen className="h-4 w-4" /> },
  { id: "faltas" as const, label: "Faltas", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "documentos" as const, label: "Documentos", icon: <FileText className="h-4 w-4" /> },
];

export function AcademicoWorkspace() {
  const searchParams = useSearchParams();
  const selectedFromUrl = resolveAcademicTab(searchParams?.get("aba"));
  const [activeTab, setActiveTab] = useState<AcademicTab>(selectedFromUrl);
  const [visited, setVisited] = useState<AcademicTab[]>([selectedFromUrl]);
  const [focusService, setFocusService] = useState<string | null>(null);

  const navigateTab = useCallback((tab: AcademicTab, service?: string) => {
    setActiveTab(tab);
    setVisited((current) => current.includes(tab) ? current : [...current, tab]);
    setFocusService(tab === "documentos" ? service ?? null : null);
    // Muda apenas o separador. Não executa navegação Next nem remonta
    // o layout servidor; preserva aluno, ano letivo e os dados já carregados.
    const url = new URL(window.location.href);
    if (tab === "notas") url.searchParams.delete("aba");
    else url.searchParams.set("aba", tab);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    const selected = resolveAcademicTab(searchParams?.get("aba"));
    setActiveTab(selected);
    setVisited((current) => current.includes(selected) ? current : [...current, selected]);
  }, [searchParams]);

  useEffect(() => {
    const onPopState = () => {
      const selected = resolveAcademicTab(new URL(window.location.href).searchParams.get("aba"));
      setActiveTab(selected);
      setVisited((current) => current.includes(selected) ? current : [...current, selected]);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 pb-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold text-emerald-800">Portal do aluno</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Académico</h1>
        <p className="text-sm leading-6 text-muted-foreground">Acompanha o teu percurso escolar e os serviços da secretaria.</p>
      </header>
      <PortalTabs items={sections} value={activeTab} onChange={navigateTab}
        idPrefix="academic" label="Área académica" testId="academic-local-tabs" />
      <section id="academic-panel-notas" role="tabpanel" aria-labelledby="academic-tab-notas" hidden={activeTab !== "notas"} tabIndex={0}>
        <TabNotas embedded onOpenDocuments={(serviceCode) => navigateTab("documentos", serviceCode ?? undefined)} />
      </section>
      <section id="academic-panel-disciplinas" role="tabpanel" aria-labelledby="academic-tab-disciplinas" hidden={activeTab !== "disciplinas"} tabIndex={0}>
        {visited.includes("disciplinas") && <DisciplinasList />}
      </section>
      <section id="academic-panel-faltas" role="tabpanel" aria-labelledby="academic-tab-faltas" hidden={activeTab !== "faltas"} tabIndex={0}>
        {visited.includes("faltas") && <TabFaltas />}
      </section>
      <section id="academic-panel-documentos" role="tabpanel" aria-labelledby="academic-tab-documentos" hidden={activeTab !== "documentos"} tabIndex={0}>
        {visited.includes("documentos") && <TabDocumentos embedded focusServiceCode={focusService} onOpenNotas={() => navigateTab("notas")} />}
      </section>
    </div>
  );
}
