"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, BookOpen, FileText, Home, Wallet, Clock, IdCard, Settings, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { AlunoHeader } from "@/components/aluno/layout/AlunoHeader";
import { AlunoBottomNav } from "@/components/aluno/layout/AlunoBottomNav";
import { NetworkStatus } from "@/components/aluno/layout/NetworkStatus";
import { PWAInstallPrompt } from "@/components/aluno/layout/PWAInstallPrompt";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

type Educando = { id: string; nome: string; escola_id: string | null };

type AlunoLayoutProps = {
  children: React.ReactNode;
  escolaId: string;
  escolaParam: string;
  escolaNome: string | null;
  portalEnabled: boolean;
  userId: string;
  userEmail: string | null;
};

export default function AlunoLayoutClient({
  children, escolaId, escolaParam, escolaNome, portalEnabled, userId, userEmail,
}: AlunoLayoutProps) {
  const [educandos, setEducandos] = useState<Educando[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchValue = searchParams?.toString() ?? "";
  const safePathname = pathname ?? "";
  const pathSchool = getEscolaParamFromPath(safePathname);
  const disabledPath = buildPortalHref(escolaParam, "/aluno/desabilitado");

  // Uma navegação não deve reconstruir sessão, vínculo, escola e educandos.
  // O layout servidor já validou a identidade e o vínculo; as APIs continuam com RLS.
  const query = searchValue ? `?${searchValue}` : "";
  let redirectTarget: string | null = null;
  if (!portalEnabled && safePathname !== disabledPath) {
    redirectTarget = disabledPath;
  } else if (portalEnabled && safePathname.startsWith("/aluno")) {
    redirectTarget = `${buildPortalHref(escolaParam, safePathname)}${query}`;
  } else if (pathSchool && pathSchool !== escolaParam && safePathname.startsWith(`/escola/${pathSchool}/aluno`)) {
    const tail = safePathname.slice(`/escola/${pathSchool}`.length);
    redirectTarget = `${buildPortalHref(escolaParam, tail)}${query}`;
  }

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && session?.user.id !== userId)) {
        router.replace("/redirect");
      }
    });
    return () => subscription.unsubscribe();
  }, [router, userId]);

  // A lista de educandos é acessória ao cabeçalho. Carrega depois do primeiro
  // render sem bloquear a dashboard nem executar novamente a cada clique.
  useEffect(() => {
    if (!portalEnabled) return;
    let active = true;
    const s = createClient();
    setEducandos([]);

    void (async () => {
      const alunosDiretosPromise = s.from("alunos")
        .select("id, nome, escola_id")
        .eq("profile_id", userId)
        .eq("escola_id", escolaId)
        .limit(20);
      const encarregadoPromise = userEmail
        ? s.from("encarregados")
            .select("id")
            .eq("escola_id", escolaId)
            .ilike("email", userEmail)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null as { id: string } | null });

      const [{ data: alunosDiretos }, { data: encarregado }] =
        await Promise.all([alunosDiretosPromise, encarregadoPromise]);

      let alunosVinculados: Educando[] = [];
      if (encarregado?.id) {
        const { data: links } = await s.from("aluno_encarregados")
          .select("aluno:alunos!aluno_encarregados_aluno_id_fkey(id, nome, escola_id)")
          .eq("escola_id", escolaId)
          .eq("encarregado_id", encarregado.id)
          .limit(20);
        alunosVinculados = (links || []).flatMap(row => row.aluno ?? []) as Educando[];
      }
      const merged = new Map<string, Educando>();
      for (const row of [...(alunosDiretos || []), ...alunosVinculados]) {
        if (row?.id) merged.set(row.id, {
          id: row.id, nome: row.nome ?? "Educando", escola_id: row.escola_id,
        });
      }
      if (active) setEducandos(Array.from(merged.values()));
    })().catch(() => {
      // Falha acessória não impede as páginas; os endpoints continuam protegidos.
      if (active) setEducandos([]);
    });
    return () => { active = false; };
  }, [escolaId, portalEnabled, userEmail, userId]);

  const alunoSelecionado = useMemo(() => searchParams?.get("aluno") ?? educandos[0]?.id ?? null, [searchParams, educandos]);
  const alunoSelecionadoNome = useMemo(
    () => educandos.find((aluno) => aluno.id === alunoSelecionado)?.nome ?? educandos[0]?.nome ?? "",
    [educandos, alunoSelecionado]
  );

  const navEscolaParam = escolaParam;
  const navItems = useMemo(
    () =>
      [
        { 
          path: "/aluno/dashboard", 
          label: "Início", 
          icon: Home,
          preload: {
            keys: [`home-status-${alunoSelecionado ?? "default"}`, `home-alert-${alunoSelecionado ?? "default"}`],
            urls: [`/api/aluno/home/status?studentId=${alunoSelecionado}`, `/api/aluno/home/finance-alert?studentId=${alunoSelecionado}`]
          }
        },
        { path: "/aluno/horario", label: "Horário", icon: Clock },
        { 
          path: "/aluno/academico", 
          label: "Académico", 
          icon: BookOpen,
          preload: {
            keys: [`academic-disciplinas-${alunoSelecionado ?? "default"}`],
            urls: [`/api/aluno/academico/disciplinas?studentId=${alunoSelecionado}`]
          }
        },
        { 
          path: "/aluno/financeiro", 
          label: "Financeiro", 
          icon: Wallet,
          preload: {
            keys: [`finance-status-${alunoSelecionado ?? "default"}`],
            urls: [`/api/aluno/financeiro/status?studentId=${alunoSelecionado}`]
          }
        },
        { path: "/aluno/atividades", label: "Actividades", icon: Sparkles },
        { path: "/aluno/identidade", label: "ID Digital", icon: IdCard },
        { path: "/aluno/documentos", label: "Documentos", icon: FileText },
        { path: "/aluno/avisos", label: "Avisos", icon: Bell },
        { path: "/aluno/perfil", label: "Perfil", icon: Settings },
      ].map((item) => ({
        ...item,
        href: buildPortalHref(navEscolaParam, item.path),
      })),
    [navEscolaParam, alunoSelecionado],
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

  if (redirectTarget) return null;

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

      <NetworkStatus />

      <main className="mx-auto w-full max-w-5xl px-4 py-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
        <div className="rounded-2xl bg-white p-4 shadow-sm md:p-6">{children}</div>

        <AlunoBottomNav items={navItems} activePath={safePathname} withAlunoParam={withAlunoParam} />
      </main>

      <PWAInstallPrompt />
    </div>
  );
}
