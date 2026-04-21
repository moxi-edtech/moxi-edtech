import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { assertEscolaAccessAndPermissions } from '@/lib/api/assertEscolaAccessAndPermissions';
import { PAPEL_GROUP_ESCOLA_ADMIN_SETUP } from '@/lib/permissions';
import type { Database } from '~types/supabase';
import { applyKf2ListInvariants } from '@/lib/kf2';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const avaliacaoComponentSchema = z.object({
  code: z.string().min(1),
  peso: z.number().int().min(0).max(100),
  ativo: z.boolean(),
});

const avaliacaoConfigSchema = z.object({
  componentes: z.array(avaliacaoComponentSchema).optional(),
}).passthrough();

const payloadSchema = z.object({
  frequencia_modelo: z.enum(['POR_AULA', 'POR_PERIODO']),
  frequencia_min_percent: z.number().int().min(0).max(100),
  modelo_avaliacao: z.string().trim().optional(),
  avaliacao_config: avaliacaoConfigSchema.optional(),
});

type AvaliacaoComponente = { code: string; peso?: number; ativo?: boolean };
type AvaliacaoConfig = { componentes?: AvaliacaoComponente[] };
type ModeloAvaliacaoRow = {
  id: string;
  escola_id: string | null;
  componentes: unknown;
};

const hasComponentes = (config: unknown): config is AvaliacaoConfig => {
  if (!config || typeof config !== 'object') return false;
  const componentes = (config as { componentes?: unknown }).componentes;
  return Array.isArray(componentes) && componentes.length > 0;
};

const normalizeComponentes = (config: unknown): AvaliacaoConfig | null => {
  if (Array.isArray(config)) return { componentes: config as AvaliacaoComponente[] };
  if (config && typeof config === 'object') {
    const componentes = (config as { componentes?: unknown }).componentes;
    if (Array.isArray(componentes)) return { componentes: componentes as AvaliacaoComponente[] };
  }
  return null;
};

const buildFormulaFromComponentes = (componentes: AvaliacaoComponente[]) => {
  const ativos = componentes.filter((comp) => comp.ativo !== false);
  if (ativos.length === 0) return null;
  return {
    tipo: 'ponderada',
    mt_formula: ativos.map((comp) => comp.code),
    pesos: ativos.reduce<Record<string, number>>((acc, comp) => {
      acc[comp.code] = Number(comp.peso ?? 0);
      return acc;
    }, {}),
  };
};

const resolveDefaultModel = async (supabase: SupabaseClient<Database>, resolvedEscolaId: string) => {
  const pickCandidate = (rows: ModeloAvaliacaoRow[]) => {
    const escolaRows = rows.filter((row) => row.escola_id === resolvedEscolaId);
    const globalRows = rows.filter((row) => row.escola_id == null);
    const candidates = [...escolaRows, ...globalRows, ...rows];
    const withComponentes = candidates.find((row) => hasComponentes(normalizeComponentes(row.componentes)));
    return withComponentes ?? candidates[0] ?? null;
  };

  let defaultConfigQuery = supabase
    .from('modelos_avaliacao')
    .select('id, escola_id, componentes')
    .eq('is_default', true)
    .or(`escola_id.eq.${resolvedEscolaId},escola_id.is.null`);

  defaultConfigQuery = applyKf2ListInvariants(defaultConfigQuery, {
    defaultLimit: 20,
    order: [{ column: 'updated_at', ascending: false }],
  });

  const { data, error } = await defaultConfigQuery;
  let rows = (!error && Array.isArray(data) ? (data as unknown as ModeloAvaliacaoRow[]) : []);
  if (rows.length === 0) {
    let fallbackQuery = supabase
      .from('modelos_avaliacao')
      .select('id, escola_id, componentes')
      .eq('is_default', true);
    fallbackQuery = applyKf2ListInvariants(fallbackQuery, {
      defaultLimit: 50,
      order: [{ column: 'updated_at', ascending: false }],
    });
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    rows = (!fallbackError && Array.isArray(fallbackData) ? (fallbackData as unknown as ModeloAvaliacaoRow[]) : []);
  }
  const chosen = pickCandidate(rows);
  if (!chosen) return null;

  return {
    id: chosen.id,
    config: normalizeComponentes(chosen.componentes),
  };
};

const withNoStore = (response: NextResponse, start?: number) => {
  response.headers.set('Cache-Control', 'no-store');
  if (start !== undefined) {
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`);
  }
  return response;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const MODELOS_AVALIACAO_VALIDOS = new Set([
  'SIMPLIFICADO',
  'ANGOLANO_TRADICIONAL',
  'COMPETENCIAS',
  'DEPOIS',
]);

const normalizeModeloAvaliacaoCode = (value?: string | null) => {
  const normalized = (value ?? '').trim().toUpperCase();
  if (MODELOS_AVALIACAO_VALIDOS.has(normalized)) return normalized;
  return 'SIMPLIFICADO';
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 }), start);
    }

    const access = await assertEscolaAccessAndPermissions({
      client: supabase,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: PAPEL_GROUP_ESCOLA_ADMIN_SETUP,
      route: '/api/escola/[id]/admin/configuracoes/avaliacao-frequencia',
    });
    if (!access.ok) {
      return withNoStore(
        NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status }),
        start
      );
    }
    const effectiveEscolaId = access.escolaId;

    const { data: config, error } = await supabase
      .from('configuracoes_escola')
      .select('frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config')
      .eq('escola_id', effectiveEscolaId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching configuracoes_escola:', error);
      return withNoStore(
        NextResponse.json({ ok: false, error: 'Erro ao carregar configurações.' }, { status: 500 }),
        start
      );
    }

    const defaultModel = await resolveDefaultModel(supabase, effectiveEscolaId);
    const modeloAvaliacao = (config?.modelo_avaliacao as string | null) ?? 'PADRAO_ESCOLA';
    const avaliacaoConfig = hasComponentes(config?.avaliacao_config)
      ? config?.avaliacao_config
      : defaultModel?.config ?? { componentes: [] };

    return withNoStore(NextResponse.json({
      ok: true,
      data: {
        frequencia_modelo: config?.frequencia_modelo ?? 'POR_AULA',
        frequencia_min_percent: config?.frequencia_min_percent ?? 75,
        modelo_avaliacao: modeloAvaliacao,
        avaliacao_config: avaliacaoConfig,
        has_config: Boolean(config),
      },
    }), start);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in avaliacao-frequencia GET API:', message);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 }), start);
    }

    const access = await assertEscolaAccessAndPermissions({
      client: supabase,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: PAPEL_GROUP_ESCOLA_ADMIN_SETUP,
      route: '/api/escola/[id]/admin/configuracoes/avaliacao-frequencia',
    });
    if (!access.ok) {
      return withNoStore(
        NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status }),
        start
      );
    }
    const effectiveEscolaId = access.escolaId;

    const body = await req.json();
    const parseResult = payloadSchema.safeParse(body);

    if (!parseResult.success) {
      return withNoStore(
        NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parseResult.error.issues }, { status: 400 }),
        start
      );
    }

    const payload = parseResult.data;
    const defaultModel = await resolveDefaultModel(supabase, effectiveEscolaId);
    const requestedModelRef = payload.modelo_avaliacao?.trim() ?? '';
    const modeloAvaliacao = normalizeModeloAvaliacaoCode(
      isUuid(requestedModelRef) ? null : requestedModelRef
    );
    const avaliacaoConfig = hasComponentes(payload.avaliacao_config)
      ? payload.avaliacao_config
      : defaultModel?.config ?? { componentes: [] };
    const formulaAvaliacao = buildFormulaFromComponentes(avaliacaoConfig.componentes ?? []);

    const { data: existing, error: existingError } = await supabase
      .from('configuracoes_escola')
      .select('estrutura, tipo_presenca, periodo_tipo, autogerar_periodos')
      .eq('escola_id', effectiveEscolaId)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching existing configuracoes_escola:', existingError);
      return withNoStore(
        NextResponse.json({ ok: false, error: 'Erro ao preparar configurações.' }, { status: 500 }),
        start
      );
    }

    const baseConfig = existing ?? {
      estrutura: 'classes',
      tipo_presenca: payload.frequencia_modelo === 'POR_AULA' ? 'secao' : 'curso',
      periodo_tipo: 'trimestre',
      autogerar_periodos: false,
    };

    const upsertData: Database['public']['Tables']['configuracoes_escola']['Insert'] = {
      escola_id: effectiveEscolaId,
      ...baseConfig,
      frequencia_modelo: payload.frequencia_modelo,
      frequencia_min_percent: payload.frequencia_min_percent,
      modelo_avaliacao: modeloAvaliacao,
      avaliacao_config:
        avaliacaoConfig as Database['public']['Tables']['configuracoes_escola']['Row']['avaliacao_config'],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('configuracoes_escola')
      .upsert(upsertData, { onConflict: 'escola_id' })
      .select('frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config')
      .single();

    if (error) {
      console.error('Error upserting configuracoes_escola:', error);
      return withNoStore(
        NextResponse.json({ ok: false, error: 'Erro ao salvar configurações.' }, { status: 500 }),
        start
      );
    }

    if (requestedModelRef && isUuid(requestedModelRef)) {
      const { error: updateModeloError } = await supabase
        .from('modelos_avaliacao')
        .update({
          componentes: avaliacaoConfig,
          formula: formulaAvaliacao,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestedModelRef);

      if (updateModeloError) {
        console.error('Error updating modelos_avaliacao formula:', updateModeloError);
        return withNoStore(
          NextResponse.json({ ok: false, error: 'Erro ao atualizar o modelo de avaliação.' }, { status: 500 }),
          start
        );
      }
    }

    return withNoStore(NextResponse.json({ ok: true, data: { ...data, has_config: true } }, { status: 200 }), start);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in avaliacao-frequencia POST API:', message);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}
