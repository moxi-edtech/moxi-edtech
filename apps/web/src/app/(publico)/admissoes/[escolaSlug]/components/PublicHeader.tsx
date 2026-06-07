"use client";

import Link from "next/link";
import { LogIn, School } from "lucide-react";
import type { AdmissionConfig } from "../AdmissionForm";

export function PublicHeader({ config }: { config: AdmissionConfig }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {config.escola.logo_url ? (
            <img 
              src={config.escola.logo_url} 
              alt={config.escola.nome} 
              className="h-10 w-10 object-contain rounded-lg border border-slate-100 bg-white" 
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <School size={20} />
            </div>
          )}
          <span className="text-sm font-black text-slate-900 hidden sm:inline-block">
            {config.escola.nome}
          </span>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href={`/escola/${config.escola.slug}/aluno/dashboard`}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <LogIn size={14} />
            Portal do Aluno
          </Link>
          <Link
            href={`/escola/${config.escola.slug}/professor`}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Portal do Professor
          </Link>
          {/* Mobile Login Dropdown or generic login button */}
          <Link
            href={`/redirect`}
            className="flex sm:hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <LogIn size={14} />
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}
