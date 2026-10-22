"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  ArrowRight,
  User,
  Users,
  CreditCard,
  FileText,
  Settings,
  GraduationCap,
  LayoutDashboard,
  Zap,
  Bookmark,
  ArrowLeft,
  ExternalLink,
  X,
} from "lucide-react";
import { Command } from "cmdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useGlobalSearch, type MinimalSearchResult } from "@/hooks/useGlobalSearch";
import { buildBalcaoActionHref } from "@/lib/balcao/action-registry";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import { createEntityContext, type EntityContext } from "@/lib/command-center/entity-context";
import { CourseContextView } from "@/components/secretaria/command-center/CourseContextView";
import { ClasseContextView } from "@/components/secretaria/command-center/ClasseContextView";
import { TurmaContextView } from "@/components/secretaria/command-center/TurmaContextView";
import { ProfessorContextView } from "@/components/secretaria/command-center/ProfessorContextView";
import { DisciplinaContextView } from "@/components/secretaria/command-center/DisciplinaContextView";
import { DisciplinaSearchResults } from "@/components/secretaria/command-center/DisciplinaSearchResults";
import type { ContextualEntityType } from "@/lib/command-center/entity-context";

const BACK_LABELS: Record<ContextualEntityType, string> = {
  curso: "Voltar ao curso",
  classe: "Voltar à classe",
  turma: "Voltar à turma",
  professor: "Voltar ao professor",
  disciplina: "Voltar à disciplina",
};

type Props = {
  escolaId?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";
  onStudentSelect?: (student: { id: string; label: string }) => void;
  studentWorkspaceClosedVersion?: number;
};

// Cada item é uma única opção de teclado/clique, sem botões de ação aninhados.
// A RPC já devolve o nome em label e o número de processo/BI em highlight.
function SearchResultRow({ item, onSelect }: { item: MinimalSearchResult; onSelect: () => void }) {
  const student = item.type === "aluno";
  const secondary = item.highlight?.trim();
  const showSecondary = Boolean(secondary && secondary !== item.label?.trim());

  return (
    <Command.Item
      value={`${item.type}:${item.id}`}
      onSelect={onSelect}
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 transition-colors aria-selected:bg-slate-100 aria-selected:text-slate-900"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-aria-selected:bg-white">
        {student ? <User className="h-5 w-5" /> : item.type === "turma" ? (
          <GraduationCap className="h-5 w-5" />
        ) : item.type === "candidatura" ? (
          <Bookmark className="h-5 w-5" />
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-words font-semibold leading-5 text-slate-900">
          {item.label?.trim() || "Nome não informado"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span>{student ? "Aluno" : item.type}</span>
          {showSecondary && (
            <span className="break-all text-slate-600">
              {student ? "Processo/BI: " : "· "}{secondary}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-aria-selected:text-slate-700" />
    </Command.Item>
  );
}

export function CommandPalette({ escolaId, portal, onStudentSelect, studentWorkspaceClosedVersion = 0 }: Props) {
  const router = useRouter();
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  const [open, setOpen] = React.useState(false);
  const [entityContext, setEntityContext] = React.useState<EntityContext | null>(null);
  const [contextTrail, setContextTrail] = React.useState<EntityContext[]>([]);
  const [courseClassId, setCourseClassId] = React.useState<string | null>(null);
  const [courseTurmaId, setCourseTurmaId] = React.useState<string | null>(null);
  const [turmaPage, setTurmaPage] = React.useState(1);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [turmaScrollTop, setTurmaScrollTop] = React.useState(0);
  const resumeAfterBalcao = React.useRef(false);
  const [restoreStudentFocus, setRestoreStudentFocus] = React.useState(false);
  const reduceMotion = useReducedMotion();
  // Only this palette owns the cache. Do not leak data between school/user sessions.
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
  }));
  const onOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setEntityContext(null);
      setContextTrail([]);
      setCourseClassId(null);
      setCourseTurmaId(null);
      setTurmaPage(1);
      setSelectedStudentId(null);
      setTurmaScrollTop(0);
      resumeAfterBalcao.current = false;
      setRestoreStudentFocus(false);
      queryClient.clear();
    }
  }, [queryClient]);
  React.useEffect(() => {
    queryClient.clear();
    setEntityContext(null);
    setContextTrail([]);
    setCourseClassId(null);
    setCourseTurmaId(null);
    setTurmaPage(1);
    setSelectedStudentId(null);
    setTurmaScrollTop(0);
    resumeAfterBalcao.current = false;
    setRestoreStudentFocus(false);
  }, [escolaId, portal, queryClient]);
  React.useEffect(() => {
    if (!studentWorkspaceClosedVersion || !resumeAfterBalcao.current) return;
    resumeAfterBalcao.current = false;
    void queryClient.invalidateQueries();
    setRestoreStudentFocus(true);
    setOpen(true);
  }, [studentWorkspaceClosedVersion, queryClient]);
  const { query, setQuery, results, loading, error: searchError, retry: retrySearch, hasMore, loadMore, detectedIntent, recentResults, rememberResult } = useGlobalSearch(escolaId, {
    portal,
  });

  // Shortcut to open Cmd+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => {
          if (current) queryClient.clear();
          return !current;
        });
        setEntityContext(null);
        setContextTrail([]);
        setCourseClassId(null);
        setCourseTurmaId(null);
        setTurmaPage(1);
        setSelectedStudentId(null);
        setTurmaScrollTop(0);
        resumeAfterBalcao.current = false;
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [queryClient]);

  const runCommand = React.useCallback((command: () => unknown) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  const selectResult = React.useCallback((item: MinimalSearchResult) => {
    let href = item.href;

    // A pesquisa encontra a pessoa; o Balcão existente concentra as ações.
    // Outros tipos de resultado mantêm a navegação canónica do seu portal.
    if (item.type === "aluno" && escolaParam && (portal === "secretaria" || portal === "operacoes")) {
      const currentPath = window.location.pathname;
      const currentParams = new URLSearchParams(window.location.search);
      if (currentPath.endsWith("/secretaria/balcao")) {
        const currentAlunoId = currentParams.get("alunoId");
        const currentAction = currentParams.get("action");
        if (
          currentAlunoId &&
          (currentAlunoId !== item.id || (currentAction && currentAction !== "desk")) &&
          !window.confirm("Quer mudar o atendimento? Dados não guardados poderão perder-se.")
        ) return;
      }

      href = buildBalcaoActionHref({
        escolaParam,
        portal,
        actionId: "desk",
        alunoId: item.id,
      });

      // Não perder o ano letivo que a escola selecionou no portal de origem.
      const academicYearId = new URL(item.href, window.location.origin).searchParams.get(ACADEMIC_YEAR_PARAM) || currentParams.get(ACADEMIC_YEAR_PARAM);
      if (academicYearId) {
        const join = href.includes("?") ? "&" : "?";
        href += `${join}${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(academicYearId)}`;
      }
    }

    const context = createEntityContext(item, escolaId, new URLSearchParams(window.location.search).get(ACADEMIC_YEAR_PARAM));
    if (context && (portal === "admin" || portal === "operacoes" || portal === "secretaria")) {
      rememberResult(item);
      setContextTrail([]);
      setCourseClassId(null);
      setCourseTurmaId(null);
      setEntityContext(context);
      return;
    }

    rememberResult(item);
    if (item.type === "aluno" && escolaId && onStudentSelect && (portal === "operacoes" || portal === "secretaria")) {
      if (entityContext) {
        resumeAfterBalcao.current = true;
        setSelectedStudentId(item.id);
        setRestoreStudentFocus(false);
        setOpen(false); // Keep explorer state without nesting Balcão dialogs.
      } else {
        onOpenChange(false);
      }
      onStudentSelect({ id: item.id, label: item.label });
      return;
    }
    runCommand(() => { setQuery(""); router.push(href); });
  }, [entityContext, escolaId, escolaParam, onOpenChange, onStudentSelect, portal, rememberResult, router, runCommand, setQuery]);

  const staticActions = React.useMemo(() => {
    const actions = [
      {
        id: "dashboard",
        label: "Ir para Dashboard",
        icon: LayoutDashboard,
        onSelect: () =>
          router.push(
            buildPortalHref(
              escolaParam,
              portal === "admin"
                ? "/admin/dashboard"
                : portal === "operacoes"
                  ? "/operacoes/dashboard"
                  : "/dashboard",
            ),
          ),
      },
    ];

    if (portal === "financeiro" || portal === "admin" || portal === "operacoes") {
      actions.push({
        id: "pagamentos",
        label: "Ver Pagamentos",
        icon: CreditCard,
        onSelect: () =>
          router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/recebimentos" : "/financeiro/pagamentos")),
      });
    }

    if (portal === "secretaria" || portal === "admin" || portal === "operacoes") {
      actions.push({
        id: "alunos",
        label: "Gestão de Alunos",
        icon: Users,
        onSelect: () =>
          router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/alunos" : "/secretaria/alunos")),
      });
      actions.push({
        id: "turmas",
        label: "Gestão de Turmas",
        icon: GraduationCap,
        onSelect: () =>
          router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/turmas" : "/secretaria/turmas")),
      });
    }

    if (portal === "admin" || portal === "operacoes") {
      actions.push({
        id: "config",
        label: "Configurações da Escola",
        icon: Settings,
        onSelect: () =>
          router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/configuracoes" : "/admin/configuracoes")),
      });
    }

    return actions;
  }, [portal, escolaParam, router]);

  return (
    <>
      <button
        onClick={() => { setRestoreStudentFocus(false); setOpen(true); }}
        className="group relative flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber/10"
      >
        <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-500" />
        <span className="flex-1 truncate text-left">{entityContext ? `Continuar · ${entityContext.label}` : "Buscar ou digitar ação..."}</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <QueryClientProvider client={queryClient}>
      <Command.Dialog
        open={open}
        onOpenChange={onOpenChange}
        label="Pesquisar e explorar o KLASSE"
        shouldFilter={false}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
        
        <motion.div layout={!reduceMotion} transition={{ layout: { duration: 0.18, ease: "easeOut" } }} className={`relative mx-2 w-full ${entityContext ? "max-w-4xl" : "max-w-2xl"} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:mx-0`}>
          <DialogTitle className="sr-only">Buscar ou digitar ação</DialogTitle>
          <DialogDescription className="sr-only">Pesquisar alunos, turmas e operações disponíveis neste portal.</DialogDescription>
          {entityContext && (
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <button type="button" onClick={() => {
                setEntityContext(contextTrail[contextTrail.length - 1] ?? null);
                setContextTrail((trail) => trail.slice(0, -1));
              }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                <ArrowLeft className="h-4 w-4" />
                {contextTrail.length ? BACK_LABELS[contextTrail[contextTrail.length - 1].type] : "Voltar à pesquisa"}
              </button>
              <nav aria-label="Percurso de exploração" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
                {contextTrail.map((step, index) => (
                  <React.Fragment key={`${step.type}:${step.id}:${index}`}>
                    <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => { setEntityContext(step); setContextTrail((trail) => trail.slice(0, index)); setRestoreStudentFocus(false); }}>
                      {step.label}
                    </button>
                    <span aria-hidden="true" className="text-slate-400">/</span>
                  </React.Fragment>
                ))}
                <span aria-current="page" className="truncate font-semibold text-slate-900">{entityContext.label}</span>
              </nav>
              <button type="button" aria-label="Fechar explorador" title="Fechar explorador"
                className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-amber"
                onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></button>
            </div>
          )}
          {!entityContext && <div className="flex items-center border-b border-slate-100 px-4 py-3">
            <Search className="mr-3 h-5 w-5 text-slate-400" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="O que você precisa hoje?"
              className="flex-1 bg-transparent text-lg text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {loading ? (
              <Loader2 className="ml-2 h-5 w-5 animate-spin text-emerald" />
            ) : (
              <kbd className="hidden h-6 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 font-mono text-[10px] font-medium text-slate-400 sm:flex">
                ESC
              </kbd>
            )}
          </div>}

          <AnimatePresence mode="wait" initial={false}>
          {!entityContext && <motion.div key="search" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={{ duration: 0.12 }}>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
            {detectedIntent && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-emerald/5 border border-emerald/10">
                <Zap className="h-3 w-3 text-emerald" />
                <span className="text-[10px] font-bold text-emerald uppercase tracking-wider">
                  Modo: {detectedIntent === 'financeiro' ? 'Financeiro' : detectedIntent === 'academico' ? 'Acadêmico' : detectedIntent === 'documentos' ? 'Documentos' : 'Ação Rápida'}
                </span>
              </div>
            )}
            {!loading && !searchError && query.trim().length >= 2 && !results.length && !(portal === "admin" || portal === "operacoes") && (
            <Command.Empty className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-50 p-4 mb-4">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;
              </p>
            </Command.Empty>
            )}

            {searchError && <div role="alert" className="mx-3 my-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 p-3 text-sm text-rose-800"><span>Não foi possível pesquisar. Tente novamente.</span><button type="button" onClick={retrySearch} className="rounded-xl border border-rose-200 px-3 py-2 font-semibold">Tentar novamente</button></div>}
            {query.length === 0 && (
              <>
              {recentResults.length > 0 && (
                <Command.Group heading="Recentes" className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {recentResults.map((item) => (
                    <SearchResultRow
                      key={`recent-${item.type}-${item.id}`}
                      item={item}
                      onSelect={() => selectResult(item)}
                    />
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Ações Frequentes" className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                {staticActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    onSelect={() => runCommand(action.onSelect)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 aria-selected:bg-slate-50 aria-selected:text-emerald transition-colors cursor-pointer group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 group-aria-selected:bg-emerald/10 transition-colors">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <span>{action.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              </>
            )}

            {results.length > 0 && (
              <Command.Group heading="Resultados da Busca" className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4">
                {results.map((item) => (
                  <SearchResultRow
                    key={`${item.type}-${item.id}`}
                    item={item}
                    onSelect={() => selectResult(item)}
                  />
                ))}
              </Command.Group>
            )}
            {hasMore && !searchError && <div className="p-3 text-center"><button type="button" disabled={loading} onClick={() => void loadMore()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Ver mais resultados</button></div>}
            <DisciplinaSearchResults
              escolaId={escolaId}
              academicYearId={new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get(ACADEMIC_YEAR_PARAM)}
              query={query}
              enabled={open && !entityContext && (portal === "admin" || portal === "operacoes")}
              otherResults={results.length}
              otherLoading={loading}
              onSelect={(discipline) => selectResult({
                id: discipline.id,
                label: discipline.label,
                type: "disciplina",
                highlight: discipline.highlight,
                href: buildPortalHref(escolaParam, portal === "admin" ? "/admin/configuracoes" : "/operacoes/configuracoes"),
                actions: [],
              })}
            />
          </Command.List>
          </motion.div>}
          {entityContext && (
            <motion.section key={`${entityContext.type}:${entityContext.id}`} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.17 }} aria-label="Visão contextual" className="min-h-64 p-4 sm:p-6">
              {entityContext.type === "curso" ? (
                <CourseContextView
                  key={`${entityContext.escolaId}:${entityContext.id}:${entityContext.academicYearId ?? "current"}`}
                  context={entityContext}
                  portal={portal}
                  initialClasseId={courseClassId}
                  initialTurmaId={courseTurmaId}
                  onClasseChange={setCourseClassId}
                  onTurmaChange={setCourseTurmaId}
                  onExploreClasse={(classe) => {
                    setCourseClassId(classe.id);
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "classe", id: classe.id, label: classe.label,
                      escolaId: entityContext.escolaId, academicYearId: classe.academicYearId,
                    });
                  }}
                  onExploreTurma={(turma) => {
                    setTurmaPage(1);
                    setTurmaScrollTop(0);
                    setSelectedStudentId(null);
                    setCourseTurmaId(turma.id);
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "turma",
                      id: turma.id,
                      label: turma.label,
                      escolaId: entityContext.escolaId,
                      academicYearId: turma.academicYearId,
                    });
                  }}
                  onNavigate={(href) => {
                    onOpenChange(false);
                    router.push(href);
                  }}
                />
              ) : entityContext.type === "turma" ? (
                <TurmaContextView
                  key={`${entityContext.escolaId}:${entityContext.id}:${entityContext.academicYearId ?? "current"}`}
                  context={entityContext}
                  portal={portal}
                  initialPage={turmaPage}
                  onPageChange={setTurmaPage}
                  initialScrollTop={turmaScrollTop}
                  onScrollTopChange={setTurmaScrollTop}
                  selectedStudentId={selectedStudentId}
                  restoreStudentFocus={restoreStudentFocus}
                  onNavigate={(href) => {
                    onOpenChange(false);
                    router.push(href);
                  }}
                  onStudentSelect={(student) => selectResult({
                    id: student.id,
                    label: student.label,
                    type: "aluno",
                    highlight: null,
                    href: buildPortalHref(escolaParam, `/secretaria/alunos/${encodeURIComponent(student.id)}${entityContext.academicYearId ? `?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(entityContext.academicYearId)}` : ""}`),
                    actions: [],
                  })}
                  onExploreProfessor={(professor) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "professor",
                      id: professor.id,
                      label: professor.label,
                      escolaId: entityContext.escolaId,
                      academicYearId: professor.academicYearId,
                    });
                  }}
                  onExploreDisciplina={(disciplina) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "disciplina", id: disciplina.id, label: disciplina.label,
                      escolaId: entityContext.escolaId, academicYearId: disciplina.academicYearId,
                    });
                  }}
                  onExploreClasse={(classe) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "classe", id: classe.id, label: classe.label,
                      escolaId: entityContext.escolaId, academicYearId: classe.academicYearId,
                    });
                  }}
                />
              ) : entityContext.type === "professor" ? (
                <ProfessorContextView
                  context={entityContext}
                  portal={portal}
                  onExploreTurma={(turma) => {
                    setTurmaPage(1);
                    setTurmaScrollTop(0);
                    setSelectedStudentId(null);
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "turma",
                      id: turma.id,
                      label: turma.label,
                      escolaId: entityContext.escolaId,
                      academicYearId: turma.academicYearId,
                    });
                  }}
                  onExploreDisciplina={(disciplina) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "disciplina", id: disciplina.id, label: disciplina.label,
                      escolaId: entityContext.escolaId, academicYearId: disciplina.academicYearId,
                    });
                  }}
                  onNavigate={(href) => {
                    onOpenChange(false);
                    router.push(href);
                  }}
                />
              ) : entityContext.type === "disciplina" ? (
                <DisciplinaContextView
                  context={entityContext}
                  portal={portal}
                  onExploreProfessor={(professor) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "professor", id: professor.id, label: professor.label,
                      escolaId: entityContext.escolaId, academicYearId: professor.academicYearId,
                    });
                  }}
                  onExploreTurma={(turma) => {
                    setTurmaPage(1);
                    setTurmaScrollTop(0);
                    setSelectedStudentId(null);
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "turma", id: turma.id, label: turma.label,
                      escolaId: entityContext.escolaId, academicYearId: turma.academicYearId,
                    });
                  }}
                  onExploreClasse={(classe) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "classe", id: classe.id, label: classe.label,
                      escolaId: entityContext.escolaId, academicYearId: classe.academicYearId,
                    });
                  }}
                  onNavigate={(href) => {
                    onOpenChange(false);
                    router.push(href);
                  }}
                />
              ) : entityContext.type === "classe" ? (
                <ClasseContextView
                  key={`${entityContext.escolaId}:${entityContext.id}:${entityContext.academicYearId ?? "current"}`}
                  context={entityContext}
                  portal={portal}
                  onExploreCurso={(curso) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setCourseClassId(entityContext.id);
                    setEntityContext({
                      type: "curso", id: curso.id, label: curso.label,
                      escolaId: entityContext.escolaId, academicYearId: curso.academicYearId,
                    });
                  }}
                  onExploreTurma={(turma) => {
                    setTurmaPage(1);
                    setTurmaScrollTop(0);
                    setSelectedStudentId(null);
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "turma", id: turma.id, label: turma.label,
                      escolaId: entityContext.escolaId, academicYearId: turma.academicYearId,
                    });
                  }}
                  onExploreDisciplina={(disciplina) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "disciplina", id: disciplina.id, label: disciplina.label,
                      escolaId: entityContext.escolaId, academicYearId: disciplina.academicYearId,
                    });
                  }}
                  onExploreProfessor={(professor) => {
                    setContextTrail((trail) => [...trail, entityContext]);
                    setEntityContext({
                      type: "professor", id: professor.id, label: professor.label,
                      escolaId: entityContext.escolaId, academicYearId: professor.academicYearId,
                    });
                  }}
                  onStudentSelect={(student) => selectResult({
                    id: student.id, label: student.label, type: "aluno", highlight: null,
                    href: buildPortalHref(escolaParam, `/secretaria/alunos/${encodeURIComponent(student.id)}${entityContext.academicYearId ? `?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(entityContext.academicYearId)}` : ""}`),
                    actions: [],
                  })}
                  onNavigate={(href) => {
                    onOpenChange(false);
                    router.push(href);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entityContext.type}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{entityContext.label}</h2>
                  <p className="text-sm text-slate-600">A visão desta entidade será disponibilizada em seguida. A página existente permanece disponível.</p>
                  <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => {
                    const target = results.find((item) => item.id === entityContext.id && item.type === entityContext.type) || recentResults.find((item) => item.id === entityContext.id && item.type === entityContext.type);
                    if (!target) return;
                    onOpenChange(false);
                    router.push(target.href);
                  }}><ExternalLink className="h-4 w-4" /> Abrir página existente</button>
                </div>
              )}
            </motion.section>
          )}
          </AnimatePresence>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
              {!entityContext && <><span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">↑↓</kbd> Navegar</span><span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">↵</kbd> Selecionar</span></>}
              {entityContext && <span>Selecione uma entidade ou volte à pesquisa</span>}
            </div>
            <div className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">
              KLASSE Command Center
            </div>
          </div>
        </motion.div>
      </Command.Dialog>
      </QueryClientProvider>
    </>
  );
}
