import TurmasListClient from "@/components/secretaria/TurmasListClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaIdParam } = await params;
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  const escolaId = user ? await resolveEscolaIdForUser(supabase as any, user.id, escolaIdParam) : null;

  if (!escolaId) {
    return <div className="p-8 text-center text-slate-500">Escola não identificada.</div>;
  }

  // Fetch initial data for SSR
  const { data: items, error } = await supabase
    .from('vw_turmas_para_matricula')
    .select('id, turma_nome, turma_codigo, turno, sala, capacidade_maxima, curso_nome, classe_nome, status_validacao, ocupacao_atual, ultima_matricula, escola_id, curso_id')
    .eq('escola_id', escolaId)
    .order('turma_nome', { ascending: true })
    .limit(100);

  let finalItems = items || [];
  if (error) {
    console.error("[SSR] Error fetching turmas view:", error);
    const { data: fallbackRows } = await supabase
      .from('turmas')
      .select('id, nome, turma_codigo, turno, sala, capacidade_maxima, status_validacao, escola_id, curso_id, classe_id')
      .eq('escola_id', escolaId)
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
    capacidade_maxima: t.capacidade_maxima || 60,
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
