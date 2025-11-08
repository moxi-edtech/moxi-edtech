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
      } catch (e) {
        // noop
      }
    };
    if (escolaId && !initialNome) load();
    return () => {
      mounted = false;
    };
  }, [supabase, escolaId, initialNome]);

  // Itens principais (unificados, sem seções, como no Super Admin)
  const items = [
    { label: "Dashboard", icon: HomeIcon, path: `/escola/${escolaId}` },
    { label: "Turmas", icon: UserGroupIcon, path: `/escola/${escolaId}/turmas` },
    { label: "Alunos", icon: AcademicCapIcon, path: `/escola/${escolaId}/alunos` },
    { label: "Professores", icon: UsersIcon, path: `/escola/${escolaId}/professores` }, // 👈
    { label: "Provas / Notas", icon: ClipboardDocumentListIcon, path: `/escola/${escolaId}/avaliacoes` },
    { label: "Avisos", icon: MegaphoneIcon, path: `/escola/${escolaId}/avisos` },
    { label: "Eventos", icon: CalendarIcon, path: `/escola/${escolaId}/eventos` },
    { label: "Rotina", icon: ClockIcon, path: `/escola/${escolaId}/rotina` },
    { label: "Configurações Acadêmicas", icon: Cog6ToothIcon, path: `/escola/${escolaId}/admin/configuracoes` },
    { label: "Promoção", icon: ArrowTrendingUpIcon, path: `/escola/${escolaId}/promocao` },
    { label: "Pagamentos", icon: BanknotesIcon, path: `/escola/${escolaId}/pagamentos` },
    { label: "Funcionários", icon: UserGroupIcon, path: `/escola/${escolaId}/funcionarios` },
    { label: "Biblioteca", icon: BookOpenIcon, path: `/escola/${escolaId}/biblioteca` },
  ];

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
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <a
                key={item.label}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  active
                    ? "bg-white/20 text-white shadow-sm border-l-4 border-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${active ? "text-white" : "text-moxinexa-light/70 group-hover:text-white"}`} />
                <span>{item.label}</span>
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
