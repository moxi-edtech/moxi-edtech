"use client";

import AlunoSidebar from "./AlunoSidebar";
import AppHeader from "@/components/layout/shared/AppHeader";

export default function AlunoShell({
  children,
  perfil,
  vinculo,
}: {
  children: React.ReactNode;
  perfil: { id: string; nome: string | null } | null;
  vinculo: { escola_id: string } | null;
}) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-moxinexa-light/20 to-white text-moxinexa-dark">
      <AlunoSidebar />
      <div className="flex-1 transition-[padding] duration-300 ease-in-out" style={{ paddingLeft: "var(--sidebar-w, 256px)" }}>
        <AppHeader title="Portal do Aluno" />
        <main className="p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-moxinexa-light/30">
            {children}
          </div>
          <footer className="mt-8 text-center text-sm text-moxinexa-gray">Bons estudos! 🎓</footer>
        </main>
      </div>
    </div>
  );
}
