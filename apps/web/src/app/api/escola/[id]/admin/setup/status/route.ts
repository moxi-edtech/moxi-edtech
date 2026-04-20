// @kf2 allow-scan
import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { assertEscolaAccessAndPermissions } from '@/lib/api/assertEscolaAccessAndPermissions';
import { PAPEL_GROUP_ESCOLA_ADMIN_SETUP } from '@/lib/permissions';
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

    const access = await assertEscolaAccessAndPermissions({
      client: supabase as any,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: PAPEL_GROUP_ESCOLA_ADMIN_SETUP,
      route: '/api/escola/[id]/admin/setup/status',
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status });
    }
    const userEscolaId = access.escolaId;

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

    let hasAnoAtivoFallback = false;
    if (!data?.has_ano_letivo_ativo) {
      const { data: anoAtivoRows, error: anoAtivoError } = await supabase
        .from('anos_letivos')
        .select('id')
        .eq('escola_id', userEscolaId)
        .eq('ativo', true)
        .limit(1);
      if (anoAtivoError) {
        console.warn('Error fetching fallback anos_letivos ativos:', anoAtivoError);
      }
      hasAnoAtivoFallback = Array.isArray(anoAtivoRows) && anoAtivoRows.length > 0;
    }

    const setupData = data ?? {
      escola_id: userEscolaId,
      has_ano_letivo_ativo: hasAnoAtivoFallback,
      has_3_trimestres: false,
      has_curriculo_published: false,
      has_turmas_no_ano: false,
    };
    if (data && !data.has_ano_letivo_ativo && hasAnoAtivoFallback) {
      setupData.has_ano_letivo_ativo = true;
    }

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
