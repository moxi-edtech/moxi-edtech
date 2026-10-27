"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, FileText, GraduationCap } from "lucide-react";
import { TabNotas } from "@/components/aluno/tabs/TabNotas";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";
import { DisciplinasList } from "@/components/aluno/disciplinas/DisciplinasList";
import { BOLETIM_SERVICE_CODE } from "@/lib/aluno/boletimAccess";

type AcademicTab = "notas" | "disciplinas" | "documentos";
const validTabs: AcademicTab[] = ["notas", "disciplinas", "documentos"];

export function resolveAcademicTab(value: string | null | undefined): AcademicTab {
  return validTabs.find((tab) => tab === value) ?? "notas";
}

const sections = [
  { id: "notas" as const, title: "Notas", icon: GraduationCap },
  { id: "disciplinas" as const, title: "Disciplinas", icon: BookOpen },
  { id: "documentos" as const, title: "Documentos", icon: FileText },
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
    // Muda apenas o separador. Não executa router.push/replace nem remonta
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Académico</h1>
        <p className="text-sm leading-6 text-slate-600">Acompanha o teu percurso escolar e os serviços da secretaria.</p>
      </header>
      <div role="tablist" aria-label="Área académica" className="flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200" data-testid="academic-local-tabs">
        {sections.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`academic-tab-${id}`}
            aria-controls={`academic-panel-${id}`}
            aria-selected={activeTab === id}
            onClick={() => navigateTab(id)}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:gap-2 sm:px-4 sm:text-sm ${
              activeTab === id ? "border-emerald-700 text-emerald-900" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {title}
          </button>
        ))}
      </div>
      <section id="academic-panel-notas" role="tabpanel" aria-labelledby="academic-tab-notas" hidden={activeTab !== "notas"}>
        <TabNotas embedded onOpenDocuments={() => navigateTab("documentos", BOLETIM_SERVICE_CODE)} />
      </section>
      {visited.includes("disciplinas") && (
        <section id="academic-panel-disciplinas" role="tabpanel" aria-labelledby="academic-tab-disciplinas" hidden={activeTab !== "disciplinas"}>
          <DisciplinasList />
        </section>
      )}
      {visited.includes("documentos") && (
        <section id="academic-panel-documentos" role="tabpanel" aria-labelledby="academic-tab-documentos" hidden={activeTab !== "documentos"}>
          <TabDocumentos embedded focusServiceCode={focusService} />
        </section>
      )}
    </div>
  );
}
