import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { requireRoleInSchool } from '@/lib/authz';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id: requestedEscolaId } = await (params as any);
    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
    }

    const authz = await requireRoleInSchool({
      supabase: supabase as any, escolaId: userEscolaId,
      roles: ['admin', 'admin_escola', 'diretor', 'admin_secretaria'],
    });
    if (authz.error) return authz.error;

    const body = await req.json();
    const { fromAnoId, toAnoId } = body;

    if (fromAnoId === toAnoId) {
      return NextResponse.json({ ok: false, error: 'A origem e o destino precisam ser anos diferentes.' }, { status: 400 });
    }
    if (!fromAnoId || !toAnoId) {
      return NextResponse.json({ ok: false, error: 'IDs de origem e destino são obrigatórios.' }, { status: 400 });
    }

    // 1. Buscar anos letivos para saber a diferença de anos
    const { data: anos } = await supabase
      .from('anos_letivos')
      .select('id, ano')
      .eq('escola_id', userEscolaId)
      .in('id', [fromAnoId, toAnoId]);

    const fromAno = anos?.find(a => a.id === fromAnoId);
    const toAno = anos?.find(a => a.id === toAnoId);

    if (!fromAno || !toAno) {
      return NextResponse.json({ ok: false, error: 'Anos letivos não encontrados.' }, { status: 404 });
    }

    if (Number(toAno.ano) >= 2026) {
      return NextResponse.json({
        ok: false, code: 'OFFICIAL_CALENDAR_COPY_NOT_ALLOWED',
        error: 'Eventos nacionais e provas não podem ser copiados de outro ano. Aplique o calendário oficial.',
      }, { status: 409 });
    }

    const yearDiff = toAno.ano - fromAno.ano;

    // 2. Buscar eventos do ano de origem
    const { data: eventosOrigem, error: fetchError } = await supabase
      .from('calendario_eventos')
      .select('*')
      .eq('ano_letivo_id', fromAnoId)
      .eq('escola_id', userEscolaId);

    if (fetchError) throw fetchError;
    if (!eventosOrigem || eventosOrigem.length === 0) {
      return NextResponse.json({ ok: false, error: 'O ano de origem não possui eventos para copiar.' }, { status: 400 });
    }

    // 3. Preparar novos eventos ajustando o ano
    const novosEventos = eventosOrigem.map(ev => {
      const dataInicio = new Date(ev.data_inicio);
      const dataFim = new Date(ev.data_fim);

      dataInicio.setFullYear(dataInicio.getFullYear() + yearDiff);
      dataFim.setFullYear(dataFim.getFullYear() + yearDiff);

      return {
        escola_id: userEscolaId,
        ano_letivo_id: toAnoId,
        tipo: ev.tipo,
        nome: ev.nome,
        data_inicio: dataInicio.toISOString().split('T')[0],
        data_fim: dataFim.toISOString().split('T')[0],
        cor_hex: ev.cor_hex
      };
    });

    // 4. Inserir (Upsert por nome/data para evitar duplicados se rodar 2x)
    const { error: insertError } = await supabase
      .from('calendario_eventos')
      .upsert(novosEventos, { onConflict: 'escola_id,ano_letivo_id,offering_id,nome,data_inicio' });

    if (insertError) throw insertError;

    return NextResponse.json({ 
      ok: true, 
      message: `${novosEventos.length} eventos copiados de ${fromAno.ano} para ${toAno.ano}.` 
    });

  } catch (e: any) {
    console.error('Erro ao copiar eventos:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
