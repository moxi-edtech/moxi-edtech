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
  RefreshCw,
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
import {
  consumeExplorerReturnContext,
  saveExplorerReturnContext,
} from "@/lib/command-center/explorer-return-context";

const ENTITY_LABELS: Record<ContextualEntityType, string> = {
  curso: "Curso",
  classe: "Classe",
  turma: "Turma",
  professor: "Professor",
  disciplina: "Disciplina",
};

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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  restoreExplorerOnOpen?: boolean;
};

function SearchResultRow({ item, onSelect }: { item: MinimalSearchResult; onSelect: () => void }) {
  const student = item.type === "aluno";
  const secondary = item.highlight?.trim();
  const showSecondary = Boolean(secondary && secondary !== item.label?.trim());
  return (
    <Command.Item value={`${item.type}:${item.id}`} onSelect={onSelect} className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 transition-colors aria-selected:bg-slate-100 aria-selected:text-slate-900">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-aria-selected:bg-white">
        {student ? <User className="h-5 w-5" /> : item.type === "turma" ? <GraduationCap className="h-5 w-5" /> : item.type === "candidatura" ? <Bookmark className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-words font-semibold leading-5 text-slate-900">{item.label?.trim() || "Nome não informado"}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span>{student ? "Aluno" : item.type}</span>
          {showSecondary && <span className="break-all text-slate-600">{student ? "Processo/BI: " : "· "}{secondary}</span>}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-aria-selected:text-slate-700" />
    </Command.Item>
  );
}

export function CommandPalette({ escolaId, portal, onStudentSelect, open: openProp, onOpenChange: onOpenChangeProp, hideTrigger, restoreExplorerOnOpen }: Props) {
  const router = useRouter();
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = React.useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(openProp ?? uncontrolledOpen) : next;
    if (openProp === undefined) setUncontrolledOpen(value);
    onOpenChangeProp?.(value);
  }, [openProp, uncontrolledOpen, onOpenChangeProp]);
  const [entityContext, setEntityContext] = React.useState<EntityContext | null>(null);
  const [contextTrail, setContextTrail] = React.useState<EntityContext[]>([]);
  const [courseClassId, setCourseClassId] = React.useState<string | null>(null);
  const [courseTurmaId, setCourseTurmaId] = React.useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const [queryClient] = React.useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }));
  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setEntityContext(null);
      setContextTrail([]);
      setCourseClassId(null);
      setCourseTurmaId(null);
      queryClient.clear();
    }
  }, [queryClient, setOpen]);
  React.useEffect(() => {
    queryClient.clear();
    setEntityContext(null);
    setContextTrail([]);
    setCourseClassId(null);
    setCourseTurmaId(null);
  }, [escolaId, portal, queryClient]);
  React.useEffect(() => {
    if (!open || !restoreExplorerOnOpen || !escolaId) return;
    const snap = consumeExplorerReturnContext(escolaId);
    if (!snap) return;
    setEntityContext(snap.entityContext);
    setContextTrail(snap.contextTrail);
    setCourseClassId(snap.courseClassId);
    setCourseTurmaId(snap.courseTurmaId);
  }, [open, restoreExplorerOnOpen, escolaId]);
  const { query, setQuery, results, loading, error: searchError, clearError, hasMore, loadMore, detectedIntent, recentResults, rememberResult } = useGlobalSearch(escolaId, { portal });
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => { if (current) queryClient.clear(); return !current; });
        setEntityContext(null);
        setContextTrail([]);
        setCourseClassId(null);
        setCourseTurmaId(null);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [queryClient, setOpen]);
  const runCommand = React.useCallback((command: () => unknown) => { handleOpenChange(false); command(); }, [handleOpenChange]);
  const selectResult = React.useCallback((item: MinimalSearchResult) => {
    let href = item.href;
    if (item.type === "aluno" && escolaParam && (portal === "secretaria" || portal === "operacoes")) {
      const currentPath = window.location.pathname;
      const currentParams = new URLSearchParams(window.location.search);
      if (currentPath.endsWith("/secretaria/balcao")) {
        const currentAlunoId = currentParams.get("alunoId");
        const currentAction = currentParams.get("action");
        if (currentAlunoId && (currentAlunoId !== item.id || (currentAction && currentAction !== "desk")) && !window.confirm("Quer mudar o atendimento? Dados não guardados poderão perder-se.")) return;
      }
      href = buildBalcaoActionHref({ escolaParam, portal, actionId: "desk", alunoId: item.id });
      const academicYearId = new URL(item.href, window.location.origin).searchParams.get(ACADEMIC_YEAR_PARAM) || currentParams.get(ACADEMIC_YEAR_PARAM);
      if (academicYearId) href += `${href.includes("?") ? "&" : "?"}${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(academicYearId)}`;
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
    if (item.type === "aluno" && entityContext && escolaId && onStudentSelect && (portal === "operacoes" || portal === "secretaria")) {
      saveExplorerReturnContext({ escolaId, entityContext, contextTrail, courseClassId, courseTurmaId });
    }
    runCommand(() => {
      setQuery("");
      if (item.type === "aluno" && escolaId && onStudentSelect && (portal === "operacoes" || portal === "secretaria")) {
        onStudentSelect({ id: item.id, label: item.label });
        return;
      }
      router.push(href);
    });
  }, [contextTrail, courseClassId, courseTurmaId, entityContext, escolaId, escolaParam, onStudentSelect, portal, rememberResult, router, runCommand, setQuery]);
  const staticActions = React.useMemo(() => {
    const actions = [{ id: "dashboard", label: "Ir para o painel", icon: LayoutDashboard, onSelect: () => router.push(buildPortalHref(escolaParam, portal === "admin" ? "/admin/dashboard" : portal === "operacoes" ? "/operacoes/dashboard" : "/dashboard")) }];
    if (portal === "financeiro" || portal === "admin" || portal === "operacoes") actions.push({ id: "pagamentos", label: "Ver pagamentos", icon: CreditCard, onSelect: () => router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/recebimentos" : "/financeiro/pagamentos")) });
    if (portal === "secretaria" || portal === "admin" || portal === "operacoes") {
      actions.push({ id: "alunos", label: "Gestão de alunos", icon: Users, onSelect: () => router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/alunos" : "/secretaria/alunos")) });
      actions.push({ id: "turmas", label: "Gestão de turmas", icon: GraduationCap, onSelect: () => router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/turmas" : "/secretaria/turmas")) });
    }
    if (portal === "admin" || portal === "operacoes") actions.push({ id: "config", label: "Configurações da escola", icon: Settings, onSelect: () => router.push(buildPortalHref(escolaParam, portal === "operacoes" ? "/operacoes/configuracoes" : "/admin/configuracoes")) });
    return actions;
  }, [portal, escolaParam, router]);
  const pushEntity = (next: EntityContext) => { setContextTrail((t) => [...t, entityContext!]); setEntityContext(next); };
  const year = () => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get(ACADEMIC_YEAR_PARAM);
  return (
    <>
      {!hideTrigger && (
        <button type="button" onClick={() => setOpen(true)} className="group relative flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber/10">
          <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-500" aria-hidden />
          <span className="flex-1 text-left">Pesquisar ou digitar acção...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 sm:flex"><span className="text-xs">⌘</span>K</kbd>
        </button>
      )}
      <QueryClientProvider client={queryClient}>
        <Command.Dialog open={open} onOpenChange={handleOpenChange} label="Menu de comandos KLASSE" shouldFilter={false} className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => handleOpenChange(false)} />
          <motion.div layout={!reduceMotion} transition={{ layout: { duration: 0.18, ease: "easeOut" } }} className={`relative mx-2 w-full ${entityContext ? "max-w-4xl" : "max-w-2xl"} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:mx-0`}>
            <DialogTitle className="sr-only">Pesquisar ou digitar acção</DialogTitle>
            <DialogDescription className="sr-only">Pesquisar alunos, turmas e operações disponíveis neste portal.</DialogDescription>
            {entityContext && (
              <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
                <button type="button" onClick={() => { setEntityContext(contextTrail[contextTrail.length - 1] ?? null); setContextTrail((t) => t.slice(0, -1)); }} className="mt-0.5 flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only sm:inline">{contextTrail.length ? BACK_LABELS[contextTrail[contextTrail.length - 1].type] : "Voltar à pesquisa"}</span>
                </button>
                <nav aria-label="Percurso contextual" className="min-w-0 flex-1">
                  <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    <li><button type="button" className="rounded px-1 py-0.5 hover:bg-slate-100" onClick={() => { setEntityContext(null); setContextTrail([]); }}>Pesquisa</button></li>
                    {contextTrail.map((step, index) => (
                      <li key={`${step.type}:${step.id}:${index}`} className="flex items-center gap-1">
                        <span aria-hidden className="text-slate-300">/</span>
                        <button type="button" className="max-w-[9rem] truncate rounded px-1 py-0.5 hover:bg-slate-100" onClick={() => { setEntityContext(step); setContextTrail((t) => t.slice(0, index)); }} title={step.label}>{step.label}</button>
                      </li>
                    ))}
                    <li className="flex items-center gap-1"><span aria-hidden className="text-slate-300">/</span><span aria-current="page" className="max-w-[12rem] truncate font-semibold text-slate-900" title={entityContext.label}>{entityContext.label}</span></li>
                  </ol>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{ENTITY_LABELS[entityContext.type]}</p>
                </nav>
                <button type="button" onClick={() => handleOpenChange(false)} className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar Command Center"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            )}
            {!entityContext && (
              <div className="flex items-center border-b border-slate-100 px-4 py-3">
                <Search className="mr-3 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <Command.Input value={query} onValueChange={setQuery} placeholder="O que precisa hoje?" className="flex-1 bg-transparent text-lg text-slate-900 placeholder:text-slate-400 outline-none" />
                {loading ? <Loader2 className="ml-2 h-5 w-5 animate-spin text-emerald" aria-hidden /> : <kbd className="mr-1 hidden h-6 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 font-mono text-[10px] font-medium text-slate-400 sm:flex">ESC</kbd>}
                <button type="button" onClick={() => handleOpenChange(false)} className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar pesquisa"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              {!entityContext && (
                <motion.div key="search" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={{ duration: 0.12 }}>
                  <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
                    {detectedIntent && (
                      <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald/10 bg-emerald/5 px-3 py-2">
                        <Zap className="h-3 w-3 text-emerald" aria-hidden />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald">Modo: {detectedIntent === "financeiro" ? "Financeiro" : detectedIntent === "academico" ? "Académico" : detectedIntent === "documentos" ? "Documentos" : "Acção rápida"}</span>
                      </div>
                    )}
                    {searchError && query.trim().length >= 2 && (
                      <div role="alert" className="mx-2 mb-2 space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                        <p>{searchError}</p>
                        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold" onClick={() => { clearError(); const q = query; setQuery(q + " "); setTimeout(() => setQuery(q), 0); }}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Tentar novamente</button>
                      </div>
                    )}
                    {query.length === 0 && (
                      <>
                        {recentResults.length > 0 && (
                          <Command.Group heading="Recentes" className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                            {recentResults.map((item) => <SearchResultRow key={`recent-${item.type}-${item.id}`} item={item} onSelect={() => selectResult(item)} />)}
                          </Command.Group>
                        )}
                        <Command.Group heading="Acções frequentes" className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          {staticActions.map((action) => (
                            <Command.Item key={action.id} onSelect={() => runCommand(action.onSelect)} className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 aria-selected:bg-slate-50 aria-selected:text-emerald">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 group-aria-selected:bg-emerald/10"><action.icon className="h-4 w-4" /></div>
                              <span>{action.label}</span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      </>
                    )}
                    {results.length > 0 && (
                      <Command.Group heading="Resultados da pesquisa" className="mt-4 px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {results.map((item) => <SearchResultRow key={`${item.type}-${item.id}`} item={item} onSelect={() => selectResult(item)} />)}
                      </Command.Group>
                    )}
                    {!loading && !searchError && query.trim().length >= 2 && results.length === 0 && (
                      <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum resultado para &ldquo;{query}&rdquo;.</p>
                    )}
                    {hasMore && results.length > 0 && (
                      <div className="px-2 pb-2">
                        <button type="button" disabled={loading} onClick={() => void loadMore()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Ver mais resultados
                        </button>
                      </div>
                    )}
                    <DisciplinaSearchResults escolaId={escolaId} academicYearId={year()} query={query} enabled={open && !entityContext && (portal === "admin" || portal === "operacoes" || portal === "secretaria")} otherResults={results.length} otherLoading={loading} onSelect={(d) => selectResult({ id: d.id, label: d.label, type: "disciplina", highlight: d.highlight, href: buildPortalHref(escolaParam, portal === "admin" ? "/admin/configuracoes" : "/operacoes/configuracoes"), actions: [] })} />
                  </Command.List>
                </motion.div>
              )}
              {entityContext && (
                <motion.section key={`${entityContext.type}:${entityContext.id}`} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.17 }} aria-label="Visão contextual" className="min-h-64 max-h-[min(70vh,720px)] overflow-y-auto p-4 sm:p-6">
                  {entityContext.type === "curso" && (
                    <CourseContextView key={`${entityContext.escolaId}:${entityContext.id}:${entityContext.academicYearId ?? "c"}`} context={entityContext} portal={portal} initialClasseId={courseClassId} initialTurmaId={courseTurmaId} onClasseChange={setCourseClassId} onTurmaChange={setCourseTurmaId} onExploreClasse={(c) => { setCourseClassId(c.id); pushEntity({ type: "classe", id: c.id, label: c.label, escolaId: entityContext.escolaId, academicYearId: c.academicYearId }); }} onExploreTurma={(t) => { setCourseTurmaId(t.id); pushEntity({ type: "turma", id: t.id, label: t.label, escolaId: entityContext.escolaId, academicYearId: t.academicYearId }); }} onNavigate={(href) => { handleOpenChange(false); router.push(href); }} />
                  )}
                  {entityContext.type === "turma" && (
                    <TurmaContextView key={`${entityContext.escolaId}:${entityContext.id}:${entityContext.academicYearId ?? "c"}`} context={entityContext} portal={portal} onNavigate={(href) => { handleOpenChange(false); router.push(href); }} onStudentSelect={(s) => selectResult({ id: s.id, label: s.label, type: "aluno", highlight: null, href: buildPortalHref(escolaParam, `/secretaria/alunos/${encodeURIComponent(s.id)}`), actions: [] })} onExploreProfessor={(p) => pushEntity({ type: "professor", id: p.id, label: p.label, escolaId: entityContext.escolaId, academicYearId: p.academicYearId })} onExploreDisciplina={(d) => pushEntity({ type: "disciplina", id: d.id, label: d.label, escolaId: entityContext.escolaId, academicYearId: d.academicYearId })} onExploreClasse={(c) => pushEntity({ type: "classe", id: c.id, label: c.label, escolaId: entityContext.escolaId, academicYearId: c.academicYearId })} />
                  )}
                  {entityContext.type === "professor" && (
                    <ProfessorContextView context={entityContext} portal={portal} onExploreTurma={(t) => pushEntity({ type: "turma", id: t.id, label: t.label, escolaId: entityContext.escolaId, academicYearId: t.academicYearId })} onExploreDisciplina={(d) => pushEntity({ type: "disciplina", id: d.id, label: d.label, escolaId: entityContext.escolaId, academicYearId: d.academicYearId })} onNavigate={(href) => { handleOpenChange(false); router.push(href); }} />
                  )}
                  {entityContext.type === "disciplina" && (
                    <DisciplinaContextView context={entityContext} portal={portal} onExploreProfessor={(p) => pushEntity({ type: "professor", id: p.id, label: p.label, escolaId: entityContext.escolaId, academicYearId: p.academicYearId })} onExploreTurma={(t) => pushEntity({ type: "turma", id: t.id, label: t.label, escolaId: entityContext.escolaId, academicYearId: t.academicYearId })} onExploreClasse={(c) => pushEntity({ type: "classe", id: c.id, label: c.label, escolaId: entityContext.escolaId, academicYearId: c.academicYearId })} onNavigate={(href) => { handleOpenChange(false); router.push(href); }} />
                  )}
                  {entityContext.type === "classe" && (
                    <ClasseContextView key={`${entityContext.escolaId}:${entityContext.id}:${entityContext.academicYearId ?? "c"}`} context={entityContext} portal={portal} onExploreCurso={(c) => pushEntity({ type: "curso", id: c.id, label: c.label, escolaId: entityContext.escolaId, academicYearId: c.academicYearId })} onExploreTurma={(t) => pushEntity({ type: "turma", id: t.id, label: t.label, escolaId: entityContext.escolaId, academicYearId: t.academicYearId })} onExploreDisciplina={(d) => pushEntity({ type: "disciplina", id: d.id, label: d.label, escolaId: entityContext.escolaId, academicYearId: d.academicYearId })} onExploreProfessor={(p) => pushEntity({ type: "professor", id: p.id, label: p.label, escolaId: entityContext.escolaId, academicYearId: p.academicYearId })} onStudentSelect={(s) => selectResult({ id: s.id, label: s.label, type: "aluno", highlight: null, href: buildPortalHref(escolaParam, `/secretaria/alunos/${encodeURIComponent(s.id)}`), actions: [] })} onNavigate={(href) => { handleOpenChange(false); router.push(href); }} />
                  )}
                </motion.section>
              )}
            </AnimatePresence>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-400">
                {!entityContext && (<><span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">↑↓</kbd> Navegar</span><span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">↵</kbd> Selecionar</span></>)}
                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">Esc</kbd> Fechar</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">⌘K</kbd> Abrir</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">KLASSE Command Center</div>
            </div>
          </motion.div>
        </Command.Dialog>
      </QueryClientProvider>
    </>
  );
}
