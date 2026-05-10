import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
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

    const body = await req.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json({ ok: false, error: 'ID do template é obrigatório.' }, { status: 400 });
    }

    // 1. Obter o Template e seus itens
    const { data: template, error: tError } = await supabase
      .from('calendario_templates')
      .select('*, items:calendario_template_items(*)')
      .eq('id', templateId)
      .single();

    if (tError || !template) {
      return NextResponse.json({ ok: false, error: 'Template não encontrado.' }, { status: 404 });
    }

    const items = (template as any).items || [];

    // 2. Obter ou Criar o Ano Letivo Base do Template
    let { data: anoLetivo, error: anoError } = await supabase
      .from('anos_letivos')
      .select('id, ano, data_inicio, data_fim, ativo')
      .eq('escola_id', userEscolaId)
      .eq('ano', template.ano_base)
      .maybeSingle();

    let anoLetivoId = anoLetivo?.id;

    if (!anoLetivo) {
      // Se não existir, criar via RPC (que cuida da regra de ativação única)
      const { data: rpcResult, error: createError } = await supabase.rpc('setup_active_ano_letivo', {
        p_escola_id: userEscolaId,
        p_ano_data: {
          ano: template.ano_base,
          data_inicio: template.data_inicio,
          data_fim: template.data_fim,
          ativo: false // Criar como inativo por segurança, o admin ativa depois se quiser
        }
      });
      
      if (createError) throw createError;
      anoLetivoId = (rpcResult as any)?.id;
    }

    // 3. Separar Trimestres e Eventos
    const periodosData = items
      .filter((i: any) => i.tipo === 'PROVA_TRIMESTRAL')
      .map((i: any) => ({
        ano_letivo_id: anoLetivoId,
        tipo: 'TRIMESTRE',
        numero: i.numero,
        data_inicio: i.data_inicio,
        data_fim: i.data_fim,
        peso: i.peso
      }));

    const eventosData = items
      .filter((i: any) => i.tipo !== 'PROVA_TRIMESTRAL')
      .map((i: any) => ({
        escola_id: userEscolaId,
        ano_letivo_id: anoLetivoId,
        tipo: i.tipo,
        nome: i.nome,
        data_inicio: i.data_inicio,
        data_fim: i.data_fim
      }));

    // 4. Executar Inserções
    if (periodosData.length > 0) {
      const { error: errorPeriodos } = await supabase.rpc('upsert_bulk_periodos_letivos', {
        p_escola_id: userEscolaId,
        p_periodos_data: periodosData as any
      });
      if (errorPeriodos) throw errorPeriodos;
    }

    if (eventosData.length > 0) {
      const { error: errorEventos } = await supabase
        .from('calendario_eventos')
        .upsert(eventosData, { onConflict: 'escola_id,ano_letivo_id,nome,data_inicio' });
      if (errorEventos) throw errorEventos;
    }

    return NextResponse.json({ 
      ok: true, 
      message: `Template '${template.nome}' aplicado com sucesso.`,
      anoLetivoId: anoLetivoId
    });

  } catch (e: any) {
    console.error('Erro ao aplicar template:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
