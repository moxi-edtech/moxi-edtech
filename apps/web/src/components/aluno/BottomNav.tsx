"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Home, Wallet } from "lucide-react";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/academico", label: "Académico", icon: GraduationCap },
  { href: "/aluno/financeiro", label: "Financeiro", icon: Wallet },
];

export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação do portal do aluno"
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-3 px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-xs font-medium transition ${
                active ? "bg-klasse-green/10 text-klasse-green" : "text-slate-500 hover:bg-slate-100"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="mb-1 h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
