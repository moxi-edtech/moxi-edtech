import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import AlunoLayoutClient from "@/app/(portal-aluno)/aluno/AlunoLayoutClient";
import { isAuthSessionMissingError, isRefreshTokenNotFoundError } from "@/lib/auth/isRefreshTokenNotFoundError";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-aluno.json",
};

const resolveAlunoIds = async (supabase: Awaited<ReturnType<typeof supabaseServer>>, escolaId: string, userId: string, email?: string | null) => {
  const alunoIds = new Set<string>();

  // Consultas independentes: alunos diretos e identidade do encarregado.
  const directPromise = supabase
    .from("alunos")
    .select("id")
    .eq("profile_id", userId)
    .eq("escola_id", escolaId)
    .limit(20);

  const guardianPromise = email
    ? supabase
        .from("encarregados")
        .select("id")
        .eq("escola_id", escolaId)
        .ilike("email", email)
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [directResult, guardianResult] = await Promise.all([directPromise, guardianPromise]);
  (directResult.data ?? []).forEach((aluno) => {
    if (aluno?.id) alunoIds.add(aluno.id);
  });

  const encarregadoId = guardianResult.data?.id;
  if (encarregadoId) {
    const { data: alunoLinks } = await supabase
      .from("aluno_encarregados")
      .select("aluno_id")
      .eq("escola_id", escolaId)
      .eq("encarregado_id", encarregadoId)
      .limit(50);

    (alunoLinks ?? []).forEach((link) => {
      if (link?.aluno_id) alunoIds.add(link.aluno_id);
    });
  }

  return Array.from(alunoIds);
};

const alunoTemInadimplencia = async (
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  escolaId: string,
  alunoIds: string[]
) => {
  if (alunoIds.length === 0) return false;
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: mensalidades } = await supabase
    .from("mensalidades")
    .select("id")
    .eq("escola_id", escolaId)
    .in("aluno_id", alunoIds)
    .lte("data_vencimento", cutoff)
    .not("status", "in", "(pago,isento,cancelado)")
    .limit(1);

  return Boolean(mensalidades && mensalidades.length > 0);
};

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  let user: { id: string; email?: string | null } | null = null;
  try {
    // A identidade é validada no servidor: getSession() apenas lê cookies.
    const userResult = await supabase.auth.getUser();
    if (isRefreshTokenNotFoundError(userResult.error)) {
      redirect("/auth-recover?next=/redirect");
    }
    if (userResult.error && !isAuthSessionMissingError(userResult.error)) {
      throw userResult.error;
    }
    user = userResult.data.user ?? null;
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      redirect("/auth-recover?next=/redirect");
    }
    if (isAuthSessionMissingError(error)) {
      redirect("/redirect");
    }
    throw error;
  }

  if (!user) {
    redirect("/redirect");
  }

  const { data: vinculos } = await supabase
    .from("escola_users")
    .select("escola_id, papel, role")
    .eq("user_id", user.id)
    .limit(10);

  const vincPortal = (vinculos || []).find((v) => {
    const papel = v.papel ?? v.role ?? null;
    return papel === "aluno" || papel === "encarregado";
  });

  if (!vincPortal?.escola_id) {
    redirect("/");
  }

  const escolaId = vincPortal.escola_id;
  // Apenas depois de validar o vínculo: escola e política financeira
  // pertencem ao mesmo tenant, mas não dependem uma da outra.
  const [escolaResult, configuracoesResult] = await Promise.all([
    supabase
      .from("escolas")
      .select("nome, slug, aluno_portal_enabled, status")
      .eq("id", escolaId)
      .maybeSingle(),
    (supabase as any)
      .from("configuracoes_financeiro")
      .select("bloquear_inadimplentes")
      .eq("escola_id", escolaId)
      .maybeSingle(),
  ]);
  const escolaInfo = escolaResult.data;
  const configuracoes = configuracoesResult.data;
  if (!escolaInfo) redirect("/");
  if (escolaInfo.status === "suspensa") redirect("/escola/suspensa");
  const escolaParam = escolaInfo.slug ? String(escolaInfo.slug) : String(escolaId);

  if (configuracoes?.bloquear_inadimplentes) {
    const alunoIds = await resolveAlunoIds(supabase, escolaId, user.id, user.email);
    const bloqueado = await alunoTemInadimplencia(supabase, escolaId, alunoIds);
    if (bloqueado) {
      redirect(`/escola/${escolaParam}/aluno/desabilitado`);
    }
  }

  return (
    <AlunoLayoutClient
      key={`${escolaId}:${user.id}`}
      escolaId={escolaId}
      escolaParam={escolaParam}
      escolaNome={escolaInfo.nome ?? null}
      portalEnabled={Boolean(escolaInfo.aluno_portal_enabled)}
      userId={user.id}
      userEmail={user.email ?? null}
    >
      {children}
    </AlunoLayoutClient>
  );
}
