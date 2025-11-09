"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import AlunoShell from "@/components/aluno/AlunoShell";

type Vínculo = { papel: string; escola_id: string } | null;
type Perfil = { id: string; nome: string | null } | null;

export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [perfil, setPerfil] = useState<Perfil>(null);
  const [vinculo, setVinculo] = useState<Vínculo>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean>(true);

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
        .select("id, nome")
        .eq("id", user.id)
        .maybeSingle();

      // Vínculo do aluno
      const { data: vinc } = await s
        .from("escola_usuarios")
        .select("papel, escola_id")
        .eq("user_id", user.id)
        .eq("papel", "aluno")
        .limit(1);

      if (!vinc || vinc.length === 0) { router.replace("/"); return; }

      const escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;

      // Gate por plano/feature
      let ok = true;
      if (escolaId) {
        const { data: esc } = await s.from('escolas').select('plano, aluno_portal_enabled').eq('id', escolaId).maybeSingle();
        const plano = (esc as any)?.plano as string | undefined;
        const enabled = Boolean((esc as any)?.aluno_portal_enabled);
        ok = Boolean(plano && (plano === 'standard' || plano === 'premium') && enabled);
      }

      if (!active) return;
      setPerfil((prof as any) ?? null);
      setVinculo((vinc?.[0] as any) ?? null);
      setAllowed(ok);
      if (!ok && pathname !== '/aluno/desabilitado') {
        router.replace('/aluno/desabilitado');
        return;
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return <div className="p-6">🔒 Verificando acesso do aluno…</div>;
  }

  return <AlunoShell perfil={perfil} vinculo={vinculo}>{children}</AlunoShell>;
}
