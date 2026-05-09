"use client";

import AlunoSidebar from "./AlunoSidebar";
import { useEscolaId } from "@/hooks/useEscolaId";
import { getEscolaParamFromPath } from "@/lib/navigation";
import { usePathname } from "next/navigation";

export default function AlunoShell({
  children,
  perfil,
  vinculo,
}: {
  children: React.ReactNode;
  perfil: { id: string; nome: string | null } | null;
  vinculo: { escola_id: string } | null;
}) {
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? vinculo?.escola_id ?? escolaId;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AlunoSidebar escolaParam={escolaParam} />
      <div className="flex-1 transition-[padding] duration-300 ease-in-out" style={{ paddingLeft: "var(--sidebar-w, 256px)" }}>
        <main className="p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
            {children}
          </div>
          <footer className="mt-8 text-center text-sm text-slate-400">Bons estudos!</footer>
        </main>
      </div>
    </div>
  );
}
