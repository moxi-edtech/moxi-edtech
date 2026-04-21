// @kf2 allow-scan
import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { assertEscolaAccessAndPermissions } from '@/lib/api/assertEscolaAccessAndPermissions';
import { PAPEL_GROUP_ESCOLA_ADMIN_SETUP } from '@/lib/permissions';
import type { Database } from '~types/supabase';
import { applyKf2ListInvariants } from '@/lib/kf2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    let anoLetivoAtivo: number | null = null;
    let activeYearQuery = supabase
      .from('anos_letivos')
      .select('ano')
      .eq('escola_id', userEscolaId)
      .eq('ativo', true);
    activeYearQuery = applyKf2ListInvariants(activeYearQuery, {
      defaultLimit: 1,
      order: [{ column: 'created_at', ascending: false }],
    });
    const { data: activeYearRows, error: activeYearError } = await activeYearQuery;
    if (activeYearError) {
      console.error('Error fetching active school year:', activeYearError);
      return NextResponse.json({ ok: false, error: 'Erro ao consultar ano letivo ativo.' }, { status: 500 });
    }
    const activeYear = Array.isArray(activeYearRows) ? activeYearRows[0] : activeYearRows;
    anoLetivoAtivo = typeof activeYear?.ano === 'number' ? activeYear.ano : null;

    if (!anoLetivoAtivo) {
      return NextResponse.json({ ok: true, data: {
        escola_id: userEscolaId,
        has_ano_letivo_ativo: false,
        has_3_trimestres: false,
        has_curriculo_published: false,
        has_turmas_no_ano: false,
        ano_letivo_ok: false,
        periodos_ok: false,
        avaliacao_ok: false,
        frequencia_ok: false,
        avaliacao_frequencia_ok: false,
        curriculo_ok: false,
        turmas_ok: false,
        progress_percent: 0,
        modelo_avaliacao: '',
      } }, { status: 200 });
    }

    const { data: stateData, error: stateError } = await (supabase as any).rpc('get_setup_state', {
      p_escola_id: userEscolaId,
      p_ano_letivo: anoLetivoAtivo,
    });
    if (stateError) {
      console.error('Error fetching setup state via RPC:', stateError);
      return NextResponse.json({ ok: false, error: 'Erro ao consultar status do setup.' }, { status: 500 });
    }

    const badges = stateData?.badges ?? {};

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
      .select('modelo_avaliacao')
      .eq('escola_id', userEscolaId);

    configQuery = applyKf2ListInvariants(configQuery, {
      defaultLimit: 1,
      order: [{ column: 'updated_at', ascending: false }],
    });

    const { data: config } = await configQuery.maybeSingle();

    const modeloAvaliacao = (config?.modelo_avaliacao ?? '').toString();
    const avaliacaoOk = Boolean(badges.avaliacao_ok);
    const frequenciaOk = Boolean(badges.avaliacao_ok);
    const avaliacaoFrequenciaOk = Boolean(badges.avaliacao_ok);
    const setupData = {
      escola_id: userEscolaId,
      has_ano_letivo_ativo: Boolean(badges.ano_letivo_ok),
      has_3_trimestres: Boolean(badges.periodos_ok),
      has_curriculo_published: Boolean(badges.curriculo_published_ok),
      has_turmas_no_ano: Boolean(badges.turmas_ok),
    };

    const progressSteps = [
      setupData.has_ano_letivo_ativo,
      setupData.has_3_trimestres,
      Boolean(badges.avaliacao_ok),
      setupData.has_curriculo_published,
      setupData.has_turmas_no_ano,
    ];
    const progressPercent = Math.round((progressSteps.filter(Boolean).length / progressSteps.length) * 100);

    return NextResponse.json({
      ok: true,
      data: {
        ...setupData,
        ano_letivo: anoLetivoAtivo,
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
