import { supabaseServerTyped } from "@/lib/supabaseServer";
import { listAlunos } from "@/lib/services/alunos.service";
import AlunosListClient from "@/components/escola-admin/AlunosListClient";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { notFound } from "next/navigation";
import type { Database } from "~types/supabase";

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const s = await supabaseServerTyped<Database>();

  // Get user for resolution
  const { data: { user } } = await s.auth.getUser();
  if (!user) return notFound();

  // Resolve UUID from slug or param
  const escolaId = await resolveEscolaIdForUser(s, user.id, idParam);
  if (!escolaId) return notFound();

  // Fetch initial alumnos for SSR
  const { items: initialAlunos, page } = await listAlunos(s, escolaId, { status: 'active', limit: 30 }, {
    includeFinanceiro: true,
    includeResumo: true,
  });

  // Fetch initial turmas for the filter dropdown
  const { data: anoAtivo } = await s
    .from("anos_letivos")
    .select("ano")
    .eq("escola_id", escolaId)
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let turmasQuery = s
    .from("turmas")
    .select("id, nome, turma_codigo, ano_letivo, curso_id, classe_id, turno, classes ( nome )")
    .eq("escola_id", escolaId)
    .order("nome", { ascending: true })
    .limit(200);
  if (anoAtivo?.ano) turmasQuery = turmasQuery.eq("ano_letivo", Number(anoAtivo.ano));
  const { data: turmasData } = await turmasQuery;

  const initialTurmas = (turmasData || []).map((t: any) => ({
    id: t.id,
    nome: t.nome,
    turma_codigo: t.turma_codigo,
    ano_letivo: t.ano_letivo,
    classe_id: t.classe_id ?? null,
    classe_nome: (Array.isArray(t.classes) ? t.classes[0] : t.classes)?.nome ?? null,
    turno: t.turno ?? null,
  }));

  const initialCursor = page.nextCursor ? `${page.nextCursor.created_at},${page.nextCursor.id}` : null;

  return (
    <AlunosListClient 
      escolaId={escolaId} 
      initialAlunos={initialAlunos as any} 
      initialTurmas={initialTurmas}
      initialAno={anoAtivo?.ano ?? null}
      initialCursor={initialCursor}
    />
  );
}
