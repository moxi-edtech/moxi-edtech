"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, BookOpen, FileText, Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { AlunoHeader } from "@/components/aluno/layout/AlunoHeader";
import { AlunoBottomNav } from "@/components/aluno/layout/AlunoBottomNav";

type Educando = { id: string; nome: string; escola_id: string | null };

export default function AlunoLayoutClient({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [educandos, setEducandos] = useState<Educando[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchValue = searchParams?.toString() ?? "";

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

      const enabled = Boolean(esc?.aluno_portal_enabled);
      const acessoPortal = enabled;

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
  const alunoSelecionadoNome = useMemo(
    () => educandos.find((aluno) => aluno.id === alunoSelecionado)?.nome ?? educandos[0]?.nome ?? "",
    [educandos, alunoSelecionado]
  );

  const safePathname = pathname ?? "";
  const navItems = [
    { href: "/aluno/dashboard", label: "Início", icon: Home },
    { href: "/aluno/academico", label: "Académico", icon: BookOpen },
    { href: "/aluno/financeiro", label: "Financeiro", icon: Wallet },
    { href: "/aluno/documentos", label: "Documentos", icon: FileText },
    { href: "/aluno/avisos", label: "Avisos", icon: Bell },
  ];

  const withAlunoParam = (href: string) => {
    if (!alunoSelecionado) return href;
    const params = new URLSearchParams(searchValue);
    params.set("aluno", alunoSelecionado);
    return `${href}?${params.toString()}`;
  };

  const handleTrocarAluno = (id: string) => {
    const params = new URLSearchParams(searchValue);
    params.set("aluno", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(withAlunoParam(item.href));
    });
  }, [alunoSelecionado, searchValue, router]);

  if (!ready) {
    return <div className="p-6">🔒 Verificando acesso do aluno…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AlunoHeader
        escolaNome={escolaNome}
        alunoSelecionadoNome={alunoSelecionadoNome}
        educandos={educandos}
        alunoSelecionadoId={alunoSelecionado}
        onSelectAluno={handleTrocarAluno}
      />

      <main className="mx-auto w-full max-w-5xl px-4 py-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
        <div className="rounded-2xl bg-white p-4 shadow-sm md:p-6">{children}</div>

        <AlunoBottomNav items={navItems} activePath={safePathname} withAlunoParam={withAlunoParam} />
      </main>
    </div>
  );
}
