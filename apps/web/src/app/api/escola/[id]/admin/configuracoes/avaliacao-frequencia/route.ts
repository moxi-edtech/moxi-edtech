import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

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
  modelo_avaliacao: z.string().min(1),
  avaliacao_config: avaliacaoConfigSchema.optional(),
});

const hasComponentes = (config: unknown): config is { componentes?: { code: string }[] } => {
  if (!config || typeof config !== 'object') return false;
  const componentes = (config as { componentes?: unknown }).componentes;
  return Array.isArray(componentes) && componentes.length > 0;
};

const normalizeComponentes = (config: unknown) => {
  if (Array.isArray(config)) return { componentes: config };
  if (config && typeof config === 'object' && Array.isArray((config as any).componentes)) return config;
  return null;
};

const resolveDefaultConfig = async (supabase: SupabaseClient<Database>, escolaId: string) => {
  const { data } = await supabase
    .from('modelos_avaliacao')
    .select('componentes')
    .eq('escola_id', escolaId)
    .eq('is_default', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return normalizeComponentes((data as any).componentes);
};

const withNoStore = (response: NextResponse) => {
  response.headers.set('Cache-Control', 'no-store');
  return response;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 }));
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return withNoStore(NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 }));
    }

    if (!hasRole) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 }));
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 }));
    }

    const { data: config, error } = await supabase
      .from('configuracoes_escola')
      .select('frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config')
      .eq('escola_id', effectiveEscolaId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching configuracoes_escola:', error);
      return withNoStore(NextResponse.json({ ok: false, error: 'Erro ao carregar configurações.' }, { status: 500 }));
    }

    const modeloAvaliacao = (config?.modelo_avaliacao as string | null) ?? 'PADRAO_ESCOLA';
    const defaultConfig = await resolveDefaultConfig(supabase, effectiveEscolaId);
    const avaliacaoConfig = hasComponentes(config?.avaliacao_config)
      ? config?.avaliacao_config
      : defaultConfig ?? { componentes: [] };

    return withNoStore(NextResponse.json({
      ok: true,
      data: {
        frequencia_modelo: config?.frequencia_modelo ?? 'POR_AULA',
        frequencia_min_percent: config?.frequencia_min_percent ?? 75,
        modelo_avaliacao: modeloAvaliacao,
        avaliacao_config: avaliacaoConfig,
        has_config: Boolean(config),
      },
    }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in avaliacao-frequencia GET API:', message);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 }));
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return withNoStore(NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 }));
    }

    if (!hasRole) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 }));
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 }));
    }

    const body = await req.json();
    const parseResult = payloadSchema.safeParse(body);

    if (!parseResult.success) {
      return withNoStore(NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parseResult.error.issues }, { status: 400 }));
    }

    const payload = parseResult.data;
    const defaultConfig = await resolveDefaultConfig(supabase, effectiveEscolaId);
    const avaliacaoConfig = hasComponentes(payload.avaliacao_config)
      ? payload.avaliacao_config
      : defaultConfig ?? { componentes: [] };

    const { data: existing, error: existingError } = await supabase
      .from('configuracoes_escola')
      .select('estrutura, tipo_presenca, periodo_tipo, autogerar_periodos')
      .eq('escola_id', effectiveEscolaId)
      .maybeSingle();

    if (existingError) {
      console.error('Error fetching existing configuracoes_escola:', existingError);
      return withNoStore(NextResponse.json({ ok: false, error: 'Erro ao preparar configurações.' }, { status: 500 }));
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
      modelo_avaliacao: payload.modelo_avaliacao,
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
      return withNoStore(NextResponse.json({ ok: false, error: 'Erro ao salvar configurações.' }, { status: 500 }));
    }

    return withNoStore(NextResponse.json({ ok: true, data: { ...data, has_config: true } }, { status: 200 }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in avaliacao-frequencia POST API:', message);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}
