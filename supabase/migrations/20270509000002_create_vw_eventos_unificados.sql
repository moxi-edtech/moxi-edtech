-- Migration: 20270509000002_create_vw_eventos_unificados.sql (Fixed)
-- Description: Create a unified view for all school events (academic + generic)

CREATE OR REPLACE VIEW public.vw_eventos_escola_unificados AS
-- 1. Eventos Genéricos (da tabela 'events')
SELECT 
    id,
    escola_id,
    titulo as nome,
    descricao,
    inicio_at::date as data_inicio,
    COALESCE(fim_at, inicio_at)::date as data_fim,
    'EVENTO_GERAL' as tipo,
    publico_alvo,
    '#64748b' as cor_hex
FROM public.events

UNION ALL

-- 2. Eventos Académicos (da nova tabela 'calendario_eventos')
SELECT 
    id,
    escola_id,
    nome,
    'Evento do Calendário Académico' as descricao,
    data_inicio,
    data_fim,
    tipo::text as tipo,
    'todos' as publico_alvo,
    cor_hex
FROM public.calendario_eventos;

-- Grant access
GRANT SELECT ON public.vw_eventos_escola_unificados TO authenticated;

-- Comment for documentation
COMMENT ON VIEW public.vw_eventos_escola_unificados IS 'Vista unificada que combina eventos gerais da secretaria com o calendário académico oficial.';
