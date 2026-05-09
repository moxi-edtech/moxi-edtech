import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import AlunoLayoutClient from "@/app/(portal-aluno)/aluno/AlunoLayoutClient";

const resolveAlunoIds = async (supabase: Awaited<ReturnType<typeof supabaseServer>>, escolaId: string, userId: string, email?: string | null) => {
  const alunoIds = new Set<string>();

  const { data: alunosDiretos } = await supabase
    .from("alunos")
    .select("id")
    .eq("profile_id", userId)
    .eq("escola_id", escolaId)
    .limit(20);

  (alunosDiretos ?? []).forEach((aluno) => {
    if (aluno?.id) alunoIds.add(aluno.id);
  });

  if (email) {
    const { data: encarregado } = await supabase
      .from("encarregados")
      .select("id")
      .eq("escola_id", escolaId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (encarregado?.id) {
      const { data: alunoLinks } = await supabase
        .from("aluno_encarregados")
        .select("aluno_id")
        .eq("escola_id", escolaId)
        .eq("encarregado_id", encarregado.id)
        .limit(50);

      (alunoLinks ?? []).forEach((link) => {
        if (link?.aluno_id) alunoIds.add(link.aluno_id);
      });
    }
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
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

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
  const { data: escolaInfo } = await supabase
    .from("escolas")
    .select("slug")
    .eq("id", escolaId)
    .maybeSingle();
  const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : String(escolaId);

  const { data: configuracoes } = await (supabase as any)
    .from("configuracoes_financeiro")
    .select("bloquear_inadimplentes")
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (configuracoes?.bloquear_inadimplentes) {
    const alunoIds = await resolveAlunoIds(supabase, escolaId, user.id, user.email);
    const bloqueado = await alunoTemInadimplencia(supabase, escolaId, alunoIds);
    if (bloqueado) {
      redirect(`/escola/${escolaParam}/aluno/desabilitado`);
    }
  }

  return <AlunoLayoutClient>{children}</AlunoLayoutClient>;
}
