// @kf2 allow-scan
import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';
import { applyKf2ListInvariants } from '@/lib/kf2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const hasComponentes = (config?: { componentes?: { code: string }[] }) => (
  Array.isArray(config?.componentes) && config.componentes.length > 0
);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    // Permission is enforced by resolver for UUID and slug path params.
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para acessar este recurso.' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('vw_escola_setup_status')
      .select('*')
      .eq('escola_id', userEscolaId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching setup status:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao consultar status do setup.' }, { status: 500 });
    }

    const { data: estruturaCounts, error: estruturaError } = await supabase
      .from('vw_escola_estrutura_counts')
      .select('cursos_total, classes_total, disciplinas_total')
      .eq('escola_id', userEscolaId)
      .maybeSingle();

    if (estruturaError) {
      console.warn('Error fetching estrutura counts:', estruturaError);
    }

    let configQuery = supabase
      .from('configuracoes_escola')
      .select('frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config')
      .eq('escola_id', userEscolaId)

    configQuery = applyKf2ListInvariants(configQuery, { defaultLimit: 1, order: [{ column: 'updated_at', ascending: false }] })

    const { data: config } = await configQuery.maybeSingle();

    const modeloAvaliacao = (config?.modelo_avaliacao ?? '').toString();
    const avaliacaoOk = hasComponentes(config?.avaliacao_config as any);
    const frequenciaOk = Boolean(config?.frequencia_modelo)
      && typeof config?.frequencia_min_percent === 'number';
    const avaliacaoFrequenciaOk = avaliacaoOk && frequenciaOk;

    const setupData = data ?? {
      escola_id: userEscolaId,
      has_ano_letivo_ativo: false,
      has_3_trimestres: false,
      has_curriculo_published: false,
      has_turmas_no_ano: false,
    };

    const progressSteps = [
      setupData.has_ano_letivo_ativo,
      setupData.has_3_trimestres,
      avaliacaoFrequenciaOk,
      setupData.has_curriculo_published,
      setupData.has_turmas_no_ano,
    ];
    const progressPercent = Math.round((progressSteps.filter(Boolean).length / progressSteps.length) * 100);

    return NextResponse.json({
      ok: true,
      data: {
        ...setupData,
        ano_letivo_ok: setupData.has_ano_letivo_ativo,
        periodos_ok: setupData.has_3_trimestres,
        avaliacao_ok: avaliacaoOk,
        frequencia_ok: frequenciaOk,
        avaliacao_frequencia_ok: avaliacaoFrequenciaOk,
        curriculo_ok: setupData.has_curriculo_published,
        turmas_ok: setupData.has_turmas_no_ano,
        progress_percent: progressPercent,
        modelo_avaliacao: modeloAvaliacao,
        estrutura_counts: estruturaCounts
          ? {
            cursos_total: estruturaCounts.cursos_total ?? 0,
            classes_total: estruturaCounts.classes_total ?? 0,
            disciplinas_total: estruturaCounts.disciplinas_total ?? 0,
          }
          : undefined,
      },
    }, { status: 200 });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in setup status API:', message);
    return NextResponse.json({ 
      ok: false, 
      error: message,
      stack: e instanceof Error ? e.stack : undefined 
    }, { status: 500 });
  }
}
