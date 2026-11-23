import TurmasListClient from "@/components/secretaria/TurmasListClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope } from "@/lib/academic-year/context";

export const dynamic = 'force-dynamic';

export default async function Page({ 
  params,
  searchParams,
}: { 
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ano_letivo_id?: string }>;
}) {
  const { id: escolaIdParam } = await params;
  const { ano_letivo_id: anoLetivoIdParam } = (await searchParams) || {};
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  const escolaId = user ? await resolveEscolaIdForUser(supabase as any, user.id, escolaIdParam) : null;

  if (!escolaId) {
    return <div className="p-8 text-center text-muted-foreground">Escola não identificada.</div>;
  }

  // A sessão é resolvida no servidor: nenhuma consulta de turmas sem ano.
  let academicYearId: string;
  try {
    const scope = await resolveAcademicYearScope(supabase as any, {
      escolaId,
      requestedAcademicYearId: anoLetivoIdParam ?? null,
      operation: "READ",
    });
    academicYearId = scope.id;
  } catch {
    return <div role="alert" className="mx-4 rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">
      Não foi possível confirmar o ano letivo desta consulta. Verifique a configuração da escola.
    </div>;
  }

  // Fetch initial data for SSR
  let query = supabase
    .from('vw_turmas_para_matricula')
    .select('id, turma_nome, turma_codigo, turno, sala, capacidade_maxima, curso_nome, classe_nome, status_validacao, ocupacao_atual, ultima_matricula, escola_id, curso_id, session_id')
    .eq('escola_id', escolaId)
    .eq('session_id', academicYearId);

  const { data: items, error } = await query
    .order('turma_nome', { ascending: true })
    .limit(100);

  let finalItems = items || [];
  if (error) {
    console.error("[SSR] Error fetching turmas view:", error);
    const { data: fallbackRows } = await supabase
      .from('turmas')
      .select('id, nome, turma_codigo, turno, sala, capacidade_maxima, status_validacao, escola_id, curso_id, classe_id, session_id')
      .eq('escola_id', escolaId)
      .eq('session_id', academicYearId)
      .order('nome', { ascending: true })
      .limit(100);
    
    finalItems = (fallbackRows || []).map((t: any) => ({
      ...t,
      turma_nome: t.nome,
      curso_nome: '',
      classe_nome: '',
      ocupacao_atual: 0,
    }));
  }

  const normalizedItems = finalItems.map((t: any) => ({
    ...t,
    nome: t.turma_nome || 'Sem Nome',
    turno: t.turno || 'sem_turno',
    sala: t.sala || '',
    capacidade_maxima: t.capacidade_maxima || 70,
    curso_nome: t.curso_nome || '',
    classe_nome: t.classe_nome || '',
    status_validacao: t.status_validacao || 'ativo',
    ocupacao_atual: t.ocupacao_atual || 0,
    ultima_matricula: t.ultima_matricula || null,
    turma_codigo: t.turma_codigo || '',
  }));

  const initialData = {
    ok: true,
    items: normalizedItems,
    stats: {
      totalTurmas: normalizedItems.length,
      totalAlunos: normalizedItems.reduce((acc: number, curr: any) => acc + (curr.ocupacao_atual || 0), 0),
      porTurno: [] 
    }
  };

  return (
    <>
      <AuditPageView
        portal="admin_escola"
        acao="PAGE_VIEW"
        entity="turmas_list"
        entityId={null}
        escolaId={escolaId}
      />
      <TurmasListClient adminMode initialData={initialData as any} />
    </>
  );
}
