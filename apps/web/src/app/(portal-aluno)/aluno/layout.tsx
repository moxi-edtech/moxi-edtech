"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { parsePlanTier, type PlanTier } from "@/config/plans";
import { StudentSwitcher } from "@/components/aluno/StudentSwitcher";
import { BottomNav } from "@/components/aluno/BottomNav";

type Educando = { id: string; nome: string; escola_id: string | null };

function shortSchoolName(nome: string | null): string {
  if (!nome) return "Portal Aluno";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return nome;
  return parts.slice(0, 2).join(" ");
}

export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [educandos, setEducandos] = useState<Educando[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    const s = createClient();

    (async () => {
      const { data: userRes } = await s.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: vinc } = await s
        .from("escola_users")
        .select("escola_id, papel, role")
        .eq("user_id", user.id)
        .limit(10);

      const vincPortal = (vinc || []).find((v) => {
        const papel = v.papel ?? v.role ?? null;
        return papel === "aluno" || papel === "encarregado";
      });

      if (!vincPortal?.escola_id) {
        router.replace("/");
        return;
      }

      const escolaId = vincPortal.escola_id;

      const { data: esc } = await s
        .from("escolas")
        .select("nome, plano_atual, aluno_portal_enabled, status")
        .eq("id", escolaId)
        .maybeSingle();

      if (esc?.status === "suspensa") {
        router.replace("/escola/suspensa");
        return;
      }

      const plano: PlanTier = parsePlanTier(esc?.plano_atual ?? null);
      const enabled = Boolean(esc?.aluno_portal_enabled);
      const acessoPortal = Boolean(plano && (plano === "profissional" || plano === "premium") && enabled);

      const alunosDiretosPromise = s
        .from("alunos")
        .select("id, nome, escola_id")
        .eq("profile_id", user.id)
        .eq("escola_id", escolaId)
        .limit(20);

      const encarregadoPromise = user.email
        ? s
            .from("encarregados")
            .select("id")
            .eq("escola_id", escolaId)
            .ilike("email", user.email)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null as { id: string } | null });

      const [{ data: alunosDiretos }, { data: encarregado }] = await Promise.all([alunosDiretosPromise, encarregadoPromise]);

      let alunosVinculados: Educando[] = [];
      if (encarregado?.id) {
        const { data: alunoLinks } = await s
          .from("aluno_encarregados")
          .select("aluno:alunos!aluno_encarregados_aluno_id_fkey(id, nome, escola_id)")
          .eq("escola_id", escolaId)
          .eq("encarregado_id", encarregado.id)
          .limit(20);

        alunosVinculados = (alunoLinks || [])
          .map((row) => row.aluno)
          .flat()
          .filter(Boolean) as Educando[];
      }

      const merged = [...(alunosDiretos || []), ...alunosVinculados].reduce<Educando[]>((acc, row) => {
        if (!acc.some((a) => a.id === row.id)) acc.push({ id: row.id, nome: row.nome ?? "Educando", escola_id: row.escola_id });
        return acc;
      }, []);

      if (!active) return;

      setEscolaNome(esc?.nome ?? null);
      setEducandos(merged);

      if (!acessoPortal && pathname !== "/aluno/desabilitado") {
        router.replace("/aluno/desabilitado");
        return;
      }

      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  const alunoSelecionado = useMemo(() => searchParams?.get("aluno") ?? educandos[0]?.id ?? null, [searchParams, educandos]);

  if (!ready) {
    return <div className="p-6">🔒 Verificando acesso do aluno…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-[calc(84px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B] text-sm font-semibold text-white">KL</div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Portal aluno</p>
              <p className="text-sm font-semibold text-slate-900">{shortSchoolName(escolaNome)}</p>
            </div>
          </div>

          <StudentSwitcher educandos={educandos} selectedId={alunoSelecionado} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-4">
        <div className="rounded-xl bg-white p-4 shadow-sm md:p-6">{children}</div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full px-3 py-1 font-medium text-white" style={{ backgroundColor: "#1F6B3B" }}>
            CTA principal
          </span>
          <span className="rounded-full px-3 py-1 font-medium text-slate-900" style={{ backgroundColor: "#E3B23C" }}>
            Alerta
          </span>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
