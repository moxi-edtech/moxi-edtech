"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  AcademicCapIcon,
  ChartBarIcon,
  BellAlertIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const items = [
  { href: "/secretaria", label: "Dashboard", icon: HomeIcon },
  { href: "/secretaria/alunos", label: "Alunos", icon: UsersIcon },
  { href: "/secretaria/matriculas", label: "Matrículas", icon: AcademicCapIcon },
  { href: "/secretaria/relatorios", label: "Relatórios", icon: ChartBarIcon },
  { href: "/secretaria/alertas", label: "Alertas", icon: BellAlertIcon },
  { href: "/secretaria/exportacoes", label: "Exportações", icon: ArrowDownTrayIcon },
];

export default function SecretariaSidebar() {
  const pathname = usePathname();
  return (
    <aside className={`fixed md:relative w-80 md:w-72 bg-white text-moxinexa-dark flex-col z-30
      shadow-xl md:shadow-lg md:rounded-r-2xl transition-all duration-300 md:flex h-screen`}>
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="bg-gradient-to-r from-teal-500 to-sky-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">🎓</div>
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-teal-500 to-sky-600 bg-clip-text text-transparent">MoxiNexa</h1>
          <p className="text-xs text-moxinexa-light opacity-70">Secretaria</p>
        </div>
      </div>
      <nav className="px-3 py-3 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/secretaria" ? pathname === "/secretaria" : pathname?.startsWith(href);
          return (
            <Link key={href} href={href} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${active ? 'bg-moxinexa-teal/10 text-moxinexa-teal' : 'hover:bg-moxinexa-light/40 text-moxinexa-gray'}`}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 mt-auto border-t border-moxinexa-light/30">
        <div className="px-4 py-3 text-xs text-moxinexa-gray text-center">© 2025 MoxiNexa</div>
      </div>
    </aside>
  );
}

