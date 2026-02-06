"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import AlunoShell from "@/components/aluno/AlunoShell";
import { parsePlanTier, type PlanTier } from "@/config/plans";
import { Tables } from "~types/supabase";

type Vínculo = Tables<"escola_users"> | null;
type Perfil = { id: string; nome: string | null } | null;

export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [perfil, setPerfil] = useState<Perfil>(null);
  const [vinculo, setVinculo] = useState<Vínculo>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const s = createClient();
    (async () => {
      const { data: userRes } = await s.auth.getUser();
      const user = userRes?.user;
      if (!user) { router.replace("/login"); return; }

      // Perfil básico
      const { data: prof } = await s
        .from("profiles")
        .select("user_id, nome")
        .eq("user_id", user.id)
        .maybeSingle();

      // Vínculo do aluno
      const { data: vinc } = await s
        .from("escola_users")
        .select("*")
        .eq("user_id", user.id)
        .limit(10);

      const vincAluno = (vinc || []).find((v: Tables<'escola_users'>) => {
        const papel = v.papel ?? v.role ?? null;
        return papel === "aluno";
      });

      if (!vincAluno) { router.replace("/"); return; }

      const escolaId = vincAluno?.escola_id;

      // Gate por plano/feature
      let ok = true;
      if (escolaId) {
      const { data: esc } = await s
        .from("escolas")
        .select("plano_atual, aluno_portal_enabled")
        .eq("id", escolaId)
        .maybeSingle();
      const planoRaw = esc?.plano_atual ?? null;
        const plano: PlanTier = parsePlanTier(planoRaw);
        const enabled = Boolean(esc?.aluno_portal_enabled);
        ok = Boolean(plano && (plano === 'profissional' || plano === 'premium') && enabled);
      }

      if (!active) return;
      const papel = vincAluno?.papel ?? vincAluno?.role ?? null;

      const perfilData = prof ? { id: prof.user_id, nome: prof.nome } : null;

      setPerfil(perfilData);
      setVinculo(vincAluno ?? null);
      if (!ok && pathname !== '/aluno/desabilitado') {
        router.replace('/aluno/desabilitado');
        return;
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return <div className="p-6">🔒 Verificando acesso do aluno…</div>;
  }

  return <AlunoShell perfil={perfil} vinculo={vinculo}>{children}</AlunoShell>;
}
