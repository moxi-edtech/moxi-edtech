// apps/web/src/app/api/financeiro/cobrancas/campanhas/nova/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const NovaCampanhaSchema = z.object({
  nome: z.string().min(1, 'Nome da campanha é obrigatório.'),
  canal: z.enum(['whatsapp', 'sms', 'email', 'push']),
  templateId: z.string().uuid('Template inválido').optional().nullable(),
  destinatariosTipo: z.enum(['todos', 'turma', 'selecionados', 'atraso']),
  turmaId: z.string().uuid().optional().nullable(),
  diasAtrasoMinimo: z.number().int().min(0).optional(),
  dataAgendamento: z.string().datetime('Data de agendamento inválida.'), // ISO string
  mensagemPersonalizada: z.string().optional().nullable(),
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

    const { nome, canal, templateId, dataAgendamento } = parsedBody.data;

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
        // destinatarios_stats and data_envio will be updated later
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, campaign });
  } catch (e: any) {
    console.error('Erro ao criar nova campanha:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
