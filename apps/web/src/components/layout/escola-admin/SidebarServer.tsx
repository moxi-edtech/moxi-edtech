
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  HomeIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  MegaphoneIcon,
  CalendarIcon,
  ClockIcon,
  Cog6ToothIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  UsersIcon,
  BookOpenIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

import { createClient } from "@/lib/supabaseClient";
import { Bars3Icon, XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export default function SidebarServer({
  escolaId,
  escolaNome: initialNome,
  collapsed,
}: {
  escolaId: string;
  escolaNome?: string;
  collapsed: boolean;
}) {
  // Active state follows the URL, matching Super Admin behavior
  const [nomeEscola, setNomeEscola] = useState<string>(initialNome || "");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const [estrutura, setEstrutura] = useState<"classes" | "secoes" | "cursos" | null>(null);
  const [periodoTipo, setPeriodoTipo] = useState<"semestre" | "trimestre" | null>(null);
  const [tipoPresenca, setTipoPresenca] = useState<"secao" | "curso" | null>(null);
  const [needsAcademicSetup, setNeedsAcademicSetup] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [periodCount, setPeriodCount] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<{ nome: string; ano: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data: escolaData, error } = await supabase
          .from("escolas")
          .select("nome, onboarding_finalizado, onboarding_completed_at")
          .eq("id", escolaId)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          const msg = (error as any)?.message || (typeof error === 'string' ? error : JSON.stringify(error));
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[Sidebar] Failed to fetch escola ${escolaId}:`, msg);
          }
          setNomeEscola(initialNome || "");
          setOnboardingDone(null);
          setNeedsAcademicSetup(null);
          return;
        }

        if (escolaData) {
          setNomeEscola((escolaData as any).nome || "");
          // Determina conclusão do onboarding (compatível com colunas antigas e novas)
          const done = Boolean((escolaData as any)?.onboarding_finalizado) || Boolean((escolaData as any)?.onboarding_completed_at);
          // Se a coluna needs_academic_setup não existir, tratamos como null e deixamos outras checagens decidirem
          setOnboardingDone(done);
          setNeedsAcademicSetup(null); // Set to null as we are no longer fetching this column
        } else {
            // Handle case where no data is returned (e.g., escola not found)
            setNomeEscola(initialNome || "");
            setOnboardingDone(null);
            setNeedsAcademicSetup(null);
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[Sidebar] Exception fetching escola ${escolaId}:`, msg);
        }
      }
    };
    if (escolaId && !initialNome) load();
    return () => {
      mounted = false;
    };
  }, [supabase, escolaId, initialNome]);

  // Carrega preferências/configurações acadêmicas para adaptar o menu
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escolas/${escolaId}/onboarding/preferences`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (res.ok && json?.data) {
          const estr = json.data.estrutura as string | undefined;
          const per = json.data.periodo_tipo as string | undefined;
          const pres = json.data.tipo_presenca as string | undefined;
          if (estr === "classes" || estr === "secoes" || estr === "cursos") setEstrutura(estr);
          if (per === "semestre" || per === "trimestre") setPeriodoTipo(per);
          if (pres === "secao" || pres === "curso") setTipoPresenca(pres);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [escolaId]);

  // Sessão ativa (mostrar no topo do sidebar)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!escolaId) return;
      try {
        const { data } = await supabase
          .from("school_sessions")
          .select("id, nome, data_inicio, data_fim, status")
          .eq("escola_id", escolaId)
          .order("data_inicio", { ascending: false });
        if (!mounted) return;
        const rows = (data as any[]) || [];
        const ativa = rows.find((r) => String(r.status).toLowerCase() === "ativa") || rows[0];
        if (ativa) {
          const ano = `${String(ativa.data_inicio).slice(0, 4)}-${String(ativa.data_fim).slice(0, 4)}`;
          setActiveSession({ nome: ativa.nome || "Sessão", ano });
          // Carrega quantidade de períodos da sessão ativa para compor o bloqueio
          try {
            const res = await fetch(`/api/escolas/${escolaId}/semestres?session_id=${encodeURIComponent(ativa.id)}`, { cache: 'no-store' });
            const json = await res.json().catch(() => null);
            if (mounted) setPeriodCount(res.ok && Array.isArray(json?.data) ? (json.data as any[]).length : 0);
          } catch {
            if (mounted) setPeriodCount(0);
          }
        } else {
          setActiveSession(null);
          setPeriodCount(0);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, escolaId]);

  // Itens principais (unificados, sem seções, como no Super Admin)
  // Considera pronto se: onboarding marcado como concluído OU explicitamente não precisa de setup
  // OU preferências acadêmicas preenchidas (estrutura, período, presença) OU heurística (sessão + períodos).
  const prefsReady = Boolean(estrutura) && Boolean(periodoTipo) && Boolean(tipoPresenca);
  const heuristicReady = Boolean(activeSession) && (typeof periodCount === 'number' ? periodCount > 0 : false);
  const setupReady = onboardingDone === true || needsAcademicSetup === false || prefsReady || heuristicReady;
  const items = [
    { label: "Dashboard", icon: HomeIcon, path: `/escola/${escolaId}`, requiresSetup: false },
    {
      label: estrutura === "secoes" ? "Seções" : "Turmas",
      icon: UserGroupIcon,
      path: `/escola/${escolaId}/turmas`,
      requiresSetup: false,
    },
    { label: "Alunos", icon: AcademicCapIcon, path: `/escola/${escolaId}/alunos`, requiresSetup: false },
    { label: "Professores", icon: UsersIcon, path: `/escola/${escolaId}/professores`, requiresSetup: false }, // acesso direto
    { label: "Provas / Notas", icon: ClipboardDocumentListIcon, path: `/escola/${escolaId}/avaliacoes`, requiresSetup: false },
    { label: "Avisos", icon: MegaphoneIcon, path: `/escola/${escolaId}/avisos`, requiresSetup: false },
    { label: "Eventos", icon: CalendarIcon, path: `/escola/${escolaId}/eventos`, requiresSetup: false },
    { label: tipoPresenca === "curso" ? "Rotina por Curso" : tipoPresenca === "secao" ? "Rotina por Seção" : "Rotina", icon: ClockIcon, path: `/escola/${escolaId}/rotina`, requiresSetup: false },
    { label: "Configurações Acadêmicas", icon: Cog6ToothIcon, path: `/escola/${escolaId}/admin/configuracoes`, requiresSetup: false },
    { label: "Promoção", icon: ArrowTrendingUpIcon, path: `/escola/${escolaId}/promocao`, requiresSetup: false },
    { label: "Financeiro", icon: BanknotesIcon, path: `/escola/${escolaId}/financeiro`, requiresSetup: false },
    { label: "Funcionários", icon: UserGroupIcon, path: `/escola/${escolaId}/funcionarios`, requiresSetup: false },
    { label: "Biblioteca", icon: BookOpenIcon, path: `/escola/${escolaId}/biblioteca`, requiresSetup: false },
  ] as const;
  // Itens realmente com gate habilitado (com base no requiresSetup)
  const gatedItems = (items as readonly { requiresSetup: boolean }[]).filter((i) => i.requiresSetup && !setupReady);
  const blockedCount = gatedItems.length;

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed md:relative z-40 h-full bg-gradient-to-b from-sky-700 to-teal-700 text-white shadow-xl transition-all",
          collapsed ? "w-20" : "w-64"
        )}
        style={{ width: "var(--escola-admin-sidebar-w,256px)" }}
      >
        <div className="flex justify-between items-center pr-4">
          <div className="px-6 py-5 flex items-center gap-3">
            <div className="bg-gradient-to-r from-teal-500 to-sky-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">
              <span className="text-lg">🎓</span>
            </div>
            <div className={clsx("truncate", { "hidden": collapsed })}>
              <h1
                className="text-xl font-bold bg-gradient-to-r from-white to-moxinexa-light bg-clip-text text-transparent truncate"
                title={nomeEscola || undefined}
              >
                {nomeEscola || ""}
              </h1>
              <p className="text-xs text-moxinexa-light/80">Admin Escola</p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/80">
                {activeSession ? (
                  <span title={`${activeSession.nome} • ${activeSession.ano}`} className="truncate">
                    Sessão: {activeSession.nome} • {activeSession.ano}
                  </span>
                ) : (
                  <span>Sessão não configurada</span>
                )}
                {periodoTipo && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20">{periodoTipo === 'trimestre' ? 'Trimestral' : 'Semestral'}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className={clsx("px-4 py-3", { "hidden": collapsed })}>
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-moxinexa-light/70" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 text-sm placeholder:text-moxinexa-light/70"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {blockedCount > 0 && (
            <div className={clsx("mx-1 mb-2 rounded-lg border border-amber-300/40 bg-amber-400/10 text-amber-50 px-3 py-2 text-xs", { "hidden": collapsed })}>
              {blockedCount} {blockedCount === 1 ? 'item bloqueado' : 'itens bloqueados'} até concluir as Configurações Acadêmicas.
              <a
                href={`/escola/${escolaId}/admin/configuracoes`}
                className="ml-2 underline hover:opacity-90"
              >
                Abrir configurações
              </a>
            </div>
          )}
          {items.map((item) => {
            const active = isActive(item.path);
            const gated = item.requiresSetup && !setupReady;
            const href = gated ? `/escola/${escolaId}/admin/configuracoes` : item.path;
            const title = gated ? "Finalize as Configurações Acadêmicas para acessar este recurso" : undefined;
            return (
              <a
                key={item.label}
                href={href}
                title={title}
                aria-disabled={gated ? true : undefined}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                  {
                    "justify-center": collapsed,
                    "opacity-70 cursor-pointer bg-white/5 text-white/70 hover:bg-white/10": gated,
                    "bg-white/20 text-white shadow-sm border-l-4 border-white": !gated && active,
                    "text-white/70 hover:bg-white/10 hover:text-white": !gated && !active,
                  }
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {gated ? (
                  <LockClosedIcon className="w-5 h-5 text-amber-200/90" />
                ) : (
                  <item.icon className={clsx("w-5 h-5", {
                    "text-white": active,
                    "text-moxinexa-light/70 group-hover:text-white": !active,
                  })} />
                )}
                <span className={clsx("truncate", { "hidden": collapsed })}>{item.label}</span>
                {item.label === "Configurações Acadêmicas" && (
                  <span className={clsx("ml-auto flex items-center gap-1", { "hidden": collapsed })}>
                    {setupReady === false && (
                      <span className="px-2 py-0.5 bg-amber-400/20 text-amber-200 text-[10px] rounded-full border border-amber-400/30">
                        Pendente
                      </span>
                    )}
                    {periodoTipo && (
                      <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] rounded-full border border-white/20">
                        {periodoTipo === "trimestre" ? "Tri" : "Sem"}
                      </span>
                    )}
                    {estrutura && (
                      <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] rounded-full border border-white/20">
                        {estrutura === "secoes" ? "Seções" : estrutura === "cursos" ? "Cursos" : "Classes"}
                      </span>
                    )}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className={clsx("p-4 border-t border-white/10", { "hidden": collapsed })}>
          <div className="bg-white/5 p-3 rounded-xl mb-3">
            <h3 className="font-semibold text-sm text-white">Status do Sistema</h3>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-teal-400 rounded-full mr-2"></div>
              <p className="text-xs text-moxinexa-light/80">Todos os sistemas operacionais</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs text-moxinexa-light/70">
            <span>v2.1.0 · Admin Escola</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </aside>

      <button
        className="fixed bottom-4 left-4 z-40 lg:hidden p-3 rounded-full bg-gradient-to-r from-teal-500 to-sky-600 text-white shadow-lg"
        onClick={() => setIsMobileMenuOpen(true)}
        aria-label="Abrir menu"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    </>
  );
}
