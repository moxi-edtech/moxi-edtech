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
} from "lucide-react";
import { Command } from "cmdk";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useGlobalSearch, type MinimalSearchResult } from "@/hooks/useGlobalSearch";
import { buildBalcaoActionHref } from "@/lib/balcao/action-registry";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

type Props = {
  escolaId?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";
  onStudentSelect?: (student: { id: string; label: string }) => void;
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

export function CommandPalette({ escolaId, portal, onStudentSelect }: Props) {
  const router = useRouter();
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  const [open, setOpen] = React.useState(false);
  const { query, setQuery, results, loading, detectedIntent, recentResults, rememberResult } = useGlobalSearch(escolaId, {
    portal,
  });

  // Shortcut to open Cmd+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

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
      const academicYearId = currentParams.get(ACADEMIC_YEAR_PARAM);
      if (academicYearId) {
        const join = href.includes("?") ? "&" : "?";
        href += `${join}${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(academicYearId)}`;
      }
    }

    rememberResult(item);
    runCommand(() => {
      setQuery("");
      if (item.type === "aluno" && escolaId && onStudentSelect && (portal === "operacoes" || portal === "secretaria")) {
        // O aluno abre o Balcão em modal; a página atual mantém o seu estado.
        onStudentSelect({ id: item.id, label: item.label });
        return;
      }
      router.push(href);
    });
  }, [escolaId, escolaParam, onStudentSelect, portal, rememberResult, router, runCommand, setQuery]);

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
        onClick={() => setOpen(true)}
        className="group relative flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber/10"
      >
        <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-500" />
        <span className="flex-1 text-left">Buscar ou digitar ação...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global Command Menu"
        shouldFilter={false}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
        
        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <DialogTitle className="sr-only">Buscar ou digitar ação</DialogTitle>
          <DialogDescription className="sr-only">Pesquisar alunos, turmas e operações disponíveis neste portal.</DialogDescription>
          <div className="flex items-center border-b border-slate-100 px-4 py-3">
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
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
            {detectedIntent && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-emerald/5 border border-emerald/10">
                <Zap className="h-3 w-3 text-emerald" />
                <span className="text-[10px] font-bold text-emerald uppercase tracking-wider">
                  Modo: {detectedIntent === 'financeiro' ? 'Financeiro' : detectedIntent === 'academico' ? 'Acadêmico' : detectedIntent === 'documentos' ? 'Documentos' : 'Ação Rápida'}
                </span>
              </div>
            )}
            <Command.Empty className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-50 p-4 mb-4">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Nenhum resultado encontrado para "{query}"
              </p>
            </Command.Empty>

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
          </Command.List>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">↑↓</kbd> Navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 shadow-sm">↵</kbd> Selecionar
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">
              KLASSE Command Center
            </div>
          </div>
        </div>
      </Command.Dialog>
    </>
  );
}
