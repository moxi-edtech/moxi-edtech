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
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Command } from "cmdk";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { cn } from "@/lib/utils";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

type Props = {
  escolaId?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "professor" | "aluno" | "gestor" | "superadmin";
};

export function CommandPalette({ escolaId, portal }: Props) {
  const router = useRouter();
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  const [open, setOpen] = React.useState(false);
  const { query, setQuery, results, loading, detectedIntent } = useGlobalSearch(escolaId, {
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

  const getStatusColor = (status: string | null) => {
    if (!status) return "bg-slate-100 text-slate-500";
    const s = status.toLowerCase();
    if (s.includes("ativo") || s.includes("aprovada") || s.includes("pago")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s.includes("pendente") || s.includes("aguardando") || s.includes("atraso")) return "bg-amber-50 text-amber-700 border-amber-100";
    if (s.includes("cancelado") || s.includes("inativo")) return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  const staticActions = React.useMemo(() => {
    const actions = [
      {
        id: "dashboard",
        label: "Ir para Dashboard",
        icon: LayoutDashboard,
        onSelect: () => router.push(buildPortalHref(escolaParam, portal === "admin" ? "/admin/dashboard" : "/dashboard")),
      },
    ];

    if (portal === "financeiro" || portal === "admin") {
      actions.push({
        id: "pagamentos",
        label: "Ver Pagamentos",
        icon: CreditCard,
        onSelect: () => router.push(buildPortalHref(escolaParam, "/financeiro/pagamentos")),
      });
    }

    if (portal === "secretaria" || portal === "admin") {
      actions.push({
        id: "alunos",
        label: "Gestão de Alunos",
        icon: Users,
        onSelect: () => router.push(buildPortalHref(escolaParam, "/secretaria/alunos")),
      });
      actions.push({
        id: "turmas",
        label: "Gestão de Turmas",
        icon: GraduationCap,
        onSelect: () => router.push(buildPortalHref(escolaParam, "/secretaria/turmas")),
      });
    }

    if (portal === "admin") {
      actions.push({
        id: "config",
        label: "Configurações da Escola",
        icon: Settings,
        onSelect: () => router.push(buildPortalHref(escolaParam, "/admin/configuracoes")),
      });
    }

    return actions;
  }, [portal, escolaParam, router]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-klasse-gold/10"
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
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
        
        <Command
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          shouldFilter={false} // results are already filtered/ranked by useGlobalSearch
        >
          <div className="flex items-center border-b border-slate-100 px-4 py-3">
            <Search className="mr-3 h-5 w-5 text-slate-400" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="O que você precisa hoje?"
              className="flex-1 bg-transparent text-lg text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {loading ? (
              <Loader2 className="ml-2 h-5 w-5 animate-spin text-klasse-green" />
            ) : (
              <kbd className="hidden h-6 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 font-mono text-[10px] font-medium text-slate-400 sm:flex">
                ESC
              </kbd>
            )}
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
            {detectedIntent && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-klasse-green/5 border border-klasse-green/10">
                <Zap className="h-3 w-3 text-klasse-green" />
                <span className="text-[10px] font-bold text-klasse-green uppercase tracking-wider">
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
              <Command.Group heading="Ações Frequentes" className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                {staticActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    onSelect={() => runCommand(action.onSelect)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 aria-selected:bg-slate-50 aria-selected:text-klasse-green transition-colors cursor-pointer group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 group-aria-selected:bg-klasse-green/10 transition-colors">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <span>{action.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.length > 0 && (
              <Command.Group heading="Resultados da Busca" className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4">
                {results.map((item) => (
                  <Command.Item
                    key={item.id}
                    onSelect={() => runCommand(() => router.push(item.href))}
                    className="flex items-center justify-between rounded-xl px-2 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 aria-selected:bg-slate-50 aria-selected:text-klasse-green transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 group-aria-selected:bg-klasse-green/10 transition-colors">
                        {item.intent === "financeiro" ? (
                          <CreditCard className="h-4 w-4" />
                        ) : item.type === "aluno" ? (
                          <User className="h-4 w-4" />
                        ) : item.type === "turma" ? (
                          <GraduationCap className="h-4 w-4" />
                        ) : item.type === "candidatura" ? (
                          <Bookmark className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-900 group-aria-selected:text-klasse-green transition-colors">
                            {item.label}
                          </span>
                          {item.highlight && (
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                              getStatusColor(item.highlight)
                            )}>
                              {item.highlight}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                          {item.type} {item.intent && `• ${item.intent}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.intent && (
                        <span className="text-[10px] font-bold text-klasse-green bg-klasse-green/10 px-2 py-1 rounded-lg">
                          {item.intent === 'financeiro' ? 'Lançar' : 'Ver'}
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-aria-selected:opacity-100 -translate-x-2 group-aria-selected:translate-x-0 transition-all" />
                    </div>
                  </Command.Item>
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
              Moxi Command Center
            </div>
          </div>
        </Command>
      </Command.Dialog>
    </>
  );
}
