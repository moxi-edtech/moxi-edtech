"use client";

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

export default function Sidebar({
  escolaId,
  escolaNome: initialNome,
}: {
  escolaId: string;
  escolaNome?: string;
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
  const [activeSession, setActiveSession] = useState<{ nome: string; ano: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("escolas")
          .select("nome")
          .eq("id", escolaId)
          .maybeSingle();
        if (!mounted) return;
        setNomeEscola(data?.nome || "");
        const done = false; // Assuming not done if columns are missing
        const needs = true; // Assuming setup is needed if column is missing
        setOnboardingDone(done);
        setNeedsAcademicSetup(needs);
      } catch (e) {
        // noop
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
        } else {
          setActiveSession(null);
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
  const setupReady = onboardingDone === true || needsAcademicSetup === false;
  const items = [
    { label: "Dashboard", icon: HomeIcon, path: `/escola/${escolaId}`, requiresSetup: false },
    {
      label: estrutura === "secoes" ? "Seções" : "Turmas",
      icon: UserGroupIcon,
      path: `/escola/${escolaId}/turmas`,
      requiresSetup: false,
    },
    { label: "Alunos", icon: AcademicCapIcon, path: `/escola/${escolaId}/alunos`, requiresSetup: true },
    { label: "Professores", icon: UsersIcon, path: `/escola/${escolaId}/professores`, requiresSetup: true }, // 👈
    { label: "Provas / Notas", icon: ClipboardDocumentListIcon, path: `/escola/${escolaId}/avaliacoes`, requiresSetup: true },
    { label: "Avisos", icon: MegaphoneIcon, path: `/escola/${escolaId}/avisos`, requiresSetup: false },
    { label: "Eventos", icon: CalendarIcon, path: `/escola/${escolaId}/eventos`, requiresSetup: false },
    { label: tipoPresenca === "curso" ? "Rotina por Curso" : tipoPresenca === "secao" ? "Rotina por Seção" : "Rotina", icon: ClockIcon, path: `/escola/${escolaId}/rotina`, requiresSetup: true },
    { label: "Configurações Acadêmicas", icon: Cog6ToothIcon, path: `/escola/${escolaId}/admin/configuracoes`, requiresSetup: false },
    { label: "Promoção", icon: ArrowTrendingUpIcon, path: `/escola/${escolaId}/promocao`, requiresSetup: true },
    { label: "Pagamentos", icon: BanknotesIcon, path: `/escola/${escolaId}/pagamentos`, requiresSetup: false },
    { label: "Funcionários", icon: UserGroupIcon, path: `/escola/${escolaId}/funcionarios`, requiresSetup: false },
    { label: "Biblioteca", icon: BookOpenIcon, path: `/escola/${escolaId}/biblioteca`, requiresSetup: false },
  ] as const;
  const blockedCount = !setupReady ? items.filter(i => i.requiresSetup).length : 0;

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
        className={`fixed lg:fixed inset-y-0 left-0 z-50 w-80 lg:w-72 bg-gradient-to-b from-teal-500/95 to-sky-600/95 text-white flex flex-col shadow-xl backdrop-blur-sm ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-300 h-full`}
      >
        <div className="flex justify-between items-center pr-4">
          <div className="px-6 py-5 flex items-center gap-3">
            <div className="bg-gradient-to-r from-teal-500 to-sky-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">
              <span className="text-lg">🎓</span>
            </div>
            <div className="truncate">
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

        <div className="px-4 py-3">
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
          {setupReady === false && (
            <div className="mx-1 mb-2 rounded-lg border border-amber-300/40 bg-amber-400/10 text-amber-50 px-3 py-2 text-xs">
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
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  gated
                    ? "opacity-70 cursor-pointer bg-white/5 text-white/70 hover:bg-white/10"
                    : active
                    ? "bg-white/20 text-white shadow-sm border-l-4 border-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {gated ? (
                  <LockClosedIcon className="w-5 h-5 text-amber-200/90" />
                ) : (
                  <item.icon className={`w-5 h-5 ${active ? "text-white" : "text-moxinexa-light/70 group-hover:text-white"}`} />
                )}
                <span className="truncate">{item.label}</span>
                {item.label === "Configurações Acadêmicas" && (
                  <span className="ml-auto flex items-center gap-1">
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

        <div className="p-4 border-t border-white/10">
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
