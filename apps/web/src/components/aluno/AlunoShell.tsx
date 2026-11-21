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
    <div className="flex min-h-screen bg-background text-foreground">
      <AlunoSidebar escolaParam={escolaParam} />
      <div className="min-w-0 flex-1 transition-[padding] duration-300 ease-in-out" style={{ paddingLeft: "var(--sidebar-w, 256px)" }}>
        <main className="min-w-0 overflow-y-auto p-4 sm:p-6">
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            {children}
          </div>
          <footer className="mt-8 text-center text-sm text-muted-foreground">Bons estudos!</footer>
        </main>
      </div>
    </div>
  );
}
