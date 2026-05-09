"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, BookOpen, FileText, Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { AlunoHeader } from "@/components/aluno/layout/AlunoHeader";
import { AlunoBottomNav } from "@/components/aluno/layout/AlunoBottomNav";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

type Educando = { id: string; nome: string; escola_id: string | null };

export default function AlunoLayoutClient({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [escolaParam, setEscolaParam] = useState<string | null>(null);
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
        router.replace("/redirect");
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
        .select("nome, slug, plano_atual, aluno_portal_enabled, status")
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
      const resolvedEscolaParam = esc?.slug ? String(esc.slug) : String(escolaId);
      setEscolaParam(resolvedEscolaParam);
      setEducandos(merged);

      const safePath = pathname ?? "";
      const query = searchValue ? `?${searchValue}` : "";
      const disabledPath = buildPortalHref(resolvedEscolaParam, "/aluno/desabilitado");

      if (!acessoPortal) {
        if (safePath !== disabledPath) {
          router.replace(disabledPath);
          return;
        }
        setReady(true);
        return;
      }

      if (acessoPortal && safePath.startsWith("/aluno")) {
        router.replace(`${buildPortalHref(resolvedEscolaParam, safePath)}${query}`);
        return;
      }

      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [pathname, router, searchValue]);

  const alunoSelecionado = useMemo(() => searchParams?.get("aluno") ?? educandos[0]?.id ?? null, [searchParams, educandos]);
  const alunoSelecionadoNome = useMemo(
    () => educandos.find((aluno) => aluno.id === alunoSelecionado)?.nome ?? educandos[0]?.nome ?? "",
    [educandos, alunoSelecionado]
  );

  const safePathname = pathname ?? "";
  const escolaParamFromPath = getEscolaParamFromPath(safePathname);
  const navEscolaParam = escolaParamFromPath ?? escolaParam;
  const navItems = useMemo(
    () =>
      [
        { path: "/aluno/dashboard", label: "Início", icon: Home },
        { path: "/aluno/academico", label: "Académico", icon: BookOpen },
        { path: "/aluno/financeiro", label: "Financeiro", icon: Wallet },
        { path: "/aluno/documentos", label: "Documentos", icon: FileText },
        { path: "/aluno/avisos", label: "Avisos", icon: Bell },
      ].map((item) => ({
        ...item,
        href: buildPortalHref(navEscolaParam, item.path),
      })),
    [navEscolaParam],
  );

  const withAlunoParam = useCallback((href: string) => {
    if (!alunoSelecionado) return href;
    const params = new URLSearchParams(searchValue);
    params.set("aluno", alunoSelecionado);
    return `${href}?${params.toString()}`;
  }, [alunoSelecionado, searchValue]);

  const handleTrocarAluno = (id: string) => {
    const params = new URLSearchParams(searchValue);
    params.set("aluno", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(withAlunoParam(item.href));
    });
  }, [navItems, router, withAlunoParam]);

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
        homeHref={withAlunoParam(navItems[0]?.href ?? buildPortalHref(navEscolaParam, "/aluno/dashboard"))}
      />

      <main className="mx-auto w-full max-w-5xl px-4 py-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
        <div className="rounded-2xl bg-white p-4 shadow-sm md:p-6">{children}</div>

        <AlunoBottomNav items={navItems} activePath={safePathname} withAlunoParam={withAlunoParam} />
      </main>
    </div>
  );
}
