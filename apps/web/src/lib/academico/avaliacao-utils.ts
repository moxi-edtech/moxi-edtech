import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'

type ComponentConfig = { code?: string | null; peso?: number | null; ativo?: boolean | null }

type ResolvedModelo = {
  componentes: ComponentConfig[]
  tipo: string
  regras: Record<string, unknown>
  formula: Record<string, unknown>
}

const normalizeComponentes = (raw: unknown): ComponentConfig[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as ComponentConfig[]
  if (typeof raw === 'object' && Array.isArray((raw as any).componentes)) {
    return (raw as any).componentes as ComponentConfig[]
  }
  return []
}

const emptyResolved: ResolvedModelo = {
  componentes: [],
  tipo: 'trimestral',
  regras: {},
  formula: {},
}

const resolveDefaultModelo = async (
  supabase: SupabaseClient<Database>,
  escolaId: string
): Promise<ResolvedModelo | null> => {
  const { data } = await supabase
    .from('modelos_avaliacao')
    .select('componentes, tipo, regras, formula')
    .eq('escola_id', escolaId)
    .eq('is_default', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    componentes: normalizeComponentes((data as any).componentes),
    tipo: (data as any).tipo ?? 'trimestral',
    regras: (data as any).regras ?? {},
    formula: (data as any).formula ?? {},
  }
}

const resolveModeloById = async (
  supabase: SupabaseClient<Database>,
  escolaId: string,
  modeloId: string
): Promise<ResolvedModelo | null> => {
  const { data } = await supabase
    .from('modelos_avaliacao')
    .select('componentes, tipo, regras, formula')
    .eq('escola_id', escolaId)
    .eq('id', modeloId)
    .maybeSingle()

  if (!data) return null

  return {
    componentes: normalizeComponentes((data as any).componentes),
    tipo: (data as any).tipo ?? 'trimestral',
    regras: (data as any).regras ?? {},
    formula: (data as any).formula ?? {},
  }
}

export const resolveModeloAvaliacao = async (args: {
  supabase: SupabaseClient<Database>
  escolaId: string
  cursoId: string
  classeId: string
  matriz: {
    avaliacao_mode?: string | null
    avaliacao_modelo_id?: string | null
    avaliacao_disciplina_id?: string | null
  }
}): Promise<ResolvedModelo> => {
  const { supabase, escolaId, cursoId, classeId, matriz } = args

  const { data: configuracoes } = await supabase
    .from('configuracoes_escola')
    .select('avaliacao_config')
    .eq('escola_id', escolaId)
    .maybeSingle()

  let resolved: ResolvedModelo = {
    ...emptyResolved,
    componentes: normalizeComponentes((configuracoes as any)?.avaliacao_config),
  }

  if (!resolved.componentes.length) {
    const fallback = await resolveDefaultModelo(supabase, escolaId)
    if (fallback) resolved = fallback
  }

  if (matriz?.avaliacao_mode === 'custom' && matriz?.avaliacao_modelo_id) {
    const custom = await resolveModeloById(supabase, escolaId, matriz.avaliacao_modelo_id)
    if (custom) return custom
  }

  if (matriz?.avaliacao_mode === 'inherit_disciplina' && matriz?.avaliacao_disciplina_id) {
    const { data: matrizBase } = await supabase
      .from('curso_matriz')
      .select('avaliacao_modelo_id')
      .eq('escola_id', escolaId)
      .eq('curso_id', cursoId)
      .eq('classe_id', classeId)
      .eq('disciplina_id', matriz.avaliacao_disciplina_id)
      .eq('ativo', true)
      .maybeSingle()

    if (matrizBase?.avaliacao_modelo_id) {
      const custom = await resolveModeloById(supabase, escolaId, matrizBase.avaliacao_modelo_id)
      if (custom) return custom
    }
  }

  return resolved
}

export const buildPesoPorTipo = (componentes: ComponentConfig[]) => {
  const pesoPorTipo = new Map<string, number>()
  for (const comp of componentes) {
    if (!comp?.code || comp?.ativo === false) continue
    const peso = typeof comp.peso === 'number' ? comp.peso : Number(comp.peso)
    if (Number.isFinite(peso)) {
      pesoPorTipo.set(comp.code.toString().trim().toUpperCase(), peso)
    }
  }
  return pesoPorTipo
}

export const buildComponentesAtivos = (componentes: ComponentConfig[]) =>
  componentes
    .filter((comp) => comp?.code && comp?.ativo !== false)
    .map((comp) => comp.code!.toString().trim().toUpperCase())

