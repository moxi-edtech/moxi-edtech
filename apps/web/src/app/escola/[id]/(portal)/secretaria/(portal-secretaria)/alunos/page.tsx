import { redirect } from "next/navigation";
import AuditPageView from "@/components/audit/AuditPageView";
import AlunosListClient from "@/components/escola-admin/AlunosListClient";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { listAlunos } from "@/lib/services/alunos.service";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const supabase = await supabaseServerTyped<Database>();
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;

  if (!user) {
    redirect("/redirect");
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!resolvedEscolaId) {
    redirect("/redirect");
  }

  const { items: initialAlunos, page } = await listAlunos(
    supabase,
    resolvedEscolaId,
    { status: "active", limit: 30 },
    {
      includeFinanceiro: true,
      includeResumo: true,
    }
  );

  const { data: turmasData } = await supabase
    .from("turmas")
    .select("id, nome, turma_codigo, ano_letivo, curso_id")
    .eq("escola_id", resolvedEscolaId)
    .order("nome", { ascending: true })
    .limit(100);

  const initialTurmas = (turmasData || []).map((t: any) => ({
    id: t.id,
    nome: t.nome,
    turma_codigo: t.turma_codigo,
    ano_letivo: t.ano_letivo,
  }));

  const initialCursor = page.nextCursor ? `${page.nextCursor.created_at},${page.nextCursor.id}` : null;

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alunos_list" />
      <AlunosListClient
        escolaId={resolvedEscolaId}
        initialAlunos={initialAlunos as any}
        initialTurmas={initialTurmas}
        initialCursor={initialCursor}
      />
    </>
  );
}
