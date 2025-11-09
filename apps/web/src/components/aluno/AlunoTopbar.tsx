"use client";

import { useEffect, useState } from "react";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";
import SignOutButton from "@/components/auth/SignOutButton";

export default function AlunoTopbar({
  perfil,
  vinculo,
}: {
  perfil: { id: string; nome: string | null } | null;
  vinculo: { escola_id: string } | null;
}) {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!vinculo?.escola_id) return;
        const res = await fetch(`/api/escolas/${vinculo.escola_id}/plano`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setPlan(json?.plano ?? null);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [vinculo?.escola_id]);

  return (
    <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm mb-6">
      <div className="flex items-center gap-3">
        <button className="md:hidden p-2 rounded-lg bg-moxinexa-light/30"><Bars3Icon className="w-5 h-5" /></button>
        <h1 className="text-xl font-semibold">Portal do Aluno</h1>
        {plan && (
          <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border text-gray-600">Plano: {plan}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-moxinexa-gray">{perfil?.nome ?? "Aluno"}</div>
        <button className="relative p-2 rounded-full bg-moxinexa-light/30"><BellIcon className="w-5 h-5" /></button>
        <SignOutButton label="Sair" className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md" />
      </div>
    </div>
  );
}

