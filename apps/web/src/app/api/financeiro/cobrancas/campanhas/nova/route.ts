// apps/web/src/app/api/financeiro/cobrancas/campanhas/nova/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { z } from 'zod';
import { AcademicYearContextError, resolveAcademicYearContext } from '@/lib/academic-year/context';

export const dynamic = 'force-dynamic';

const NovaCampanhaSchema = z.object({
  nome: z.string().min(1, 'Nome da campanha é obrigatório.'),
  canal: z.enum(['whatsapp', 'sms', 'email', 'push']),
  templateId: z.string().uuid('Template inválido').optional().nullable(),
  destinatariosTipo: z.enum(['todos', 'turma', 'selecionados', 'atraso']),
  destinatariosIds: z.array(z.string().uuid()).optional(),
  turmaId: z.string().uuid().optional().nullable(),
  diasAtrasoMinimo: z.number().int().min(0).optional(),
  dataAgendamento: z.string().datetime('Data de agendamento inválida.'), // ISO string
  mensagemPersonalizada: z.string().optional().nullable(),
  ano_letivo_id: z.string().uuid('Ano letivo inválido.').optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = NovaCampanhaSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const {
      nome,
      canal,
      templateId,
      dataAgendamento,
      destinatariosTipo,
      destinatariosIds,
      ano_letivo_id,
    } = parsedBody.data;

    const academicContext = await resolveAcademicYearContext(supabase as any, {
      userId: user.id,
      requestedAcademicYearId: ano_letivo_id,
      operation: 'WRITE',
    });

    if (destinatariosIds?.length) {
      const { data: memberships, error: membershipError } = await supabase
        .from('matriculas')
        .select('aluno_id')
        .eq('escola_id', academicContext.escolaId)
        .eq('session_id', academicContext.anoLetivoId)
        .in('aluno_id', destinatariosIds);
      if (membershipError) throw membershipError;
      const allowed = new Set((memberships ?? []).map((row: any) => String(row.aluno_id)));
      if (destinatariosIds.some((id) => !allowed.has(id))) {
        return NextResponse.json(
          { error: 'Existem destinatários que não pertencem ao ano letivo selecionado.', code: 'CROSS_YEAR_ENTITY_MISMATCH' },
          { status: 409 },
        );
      }
    }

    const destinatariosStats = {
      tipo: destinatariosTipo,
      total: destinatariosIds?.length ?? 0,
      alunos_ids: destinatariosIds ?? [],
    };

    const { data: campaign, error } = await supabase
      .from('financeiro_campanhas_cobranca')
      .insert({
        escola_id: escolaId,
        nome: nome,
        canal: canal,
        template_id: templateId,
        data_agendamento: new Date(dataAgendamento).toISOString(),
        status: 'agendada', // New campaigns are always 'agendada' initially
        criado_por: user.id,
        destinatarios_stats: destinatariosStats,
        // data_envio will be updated later
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, campaign });
  } catch (e: any) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error('Erro ao criar nova campanha:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
