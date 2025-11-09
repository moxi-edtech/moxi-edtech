"use client";

import { useEffect, useState } from "react";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";
import SignOutButton from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabaseClient";

export default function SecretariaTopbar() {
  const [userName, setUserName] = useState<string | null>(null);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const s = createClient();
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await s.auth.getUser();
        const userId = auth?.user?.id;
        if (mounted && userId) {
          const { data: prof } = await s
            .from('profiles')
            .select('nome, email, escola_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);
          const p = prof?.[0] as any;
          setUserName((p?.nome && p.nome.trim()) || p?.email || 'Usuário');
          const escolaId = p?.escola_id as string | undefined;
          if (escolaId) {
            const { data: esc } = await s.from('escolas').select('nome, plano').eq('id', escolaId).maybeSingle();
            setEscolaNome((esc as any)?.nome ?? null);
            setPlan((esc as any)?.plano ?? null);
          }
        }
      } catch {}
    })();
    return () => { mounted = false };
  }, []);

  return (
    <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm mb-6">
      <div className="flex items-center gap-3">
        <button className="md:hidden p-2 rounded-lg bg-moxinexa-light/30"><Bars3Icon className="w-5 h-5" /></button>
        <h1 className="text-xl font-semibold">Secretaria</h1>
        {plan && (
          <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border text-gray-600">Plano: {plan}</span>
        )}
        {escolaNome && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700" title={escolaNome}>
            Escola: {escolaNome}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-moxinexa-gray">{userName ?? 'Usuário'}</div>
        <button className="relative p-2 rounded-full bg-moxinexa-light/30"><BellIcon className="w-5 h-5" /></button>
        <SignOutButton label="Sair" className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md" />
      </div>
    </div>
  );
}

