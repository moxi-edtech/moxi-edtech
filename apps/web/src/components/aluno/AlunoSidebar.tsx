"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  AcademicCapIcon,
  BanknotesIcon,
  MegaphoneIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

const items = [
  { href: "/aluno/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/aluno/disciplinas", label: "Disciplinas", icon: AcademicCapIcon },
  { href: "/aluno/financeiro", label: "Financeiro", icon: BanknotesIcon },
  { href: "/aluno/avisos", label: "Avisos", icon: MegaphoneIcon },
];

export default function AlunoSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className={`fixed md:relative w-72 bg-white z-20 shadow md:shadow-lg md:rounded-r-2xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-teal-500 to-sky-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">🎓</div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-teal-500 to-sky-600 bg-clip-text text-transparent">MoxiNexa</h1>
            <p className="text-xs text-moxinexa-light opacity-70">Portal do Aluno</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden p-2 rounded-lg bg-moxinexa-light/30">✕</button>
      </div>
      <nav className="px-3 py-3 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link key={href} href={href} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${active ? 'bg-moxinexa-teal/10 text-moxinexa-teal' : 'hover:bg-moxinexa-light/40 text-moxinexa-gray'}`}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-moxinexa-light/30 mt-4">
        <div className="px-4 py-3 text-xs text-moxinexa-gray text-center">© 2025 MoxiNexa</div>
      </div>
    </aside>
  );
}

