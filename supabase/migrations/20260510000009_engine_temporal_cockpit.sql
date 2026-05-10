-- Migration: 20260510000009_engine_temporal_cockpit.sql
-- Descrição: Implementação do Motor de Contexto Temporal (Organismo Vivo).
-- Objetivo: Determinar o estado operacional da escola hoje e automatizar bloqueios.

BEGIN;

-- 1. View de Estado Operacional (O "Hoje" da Escola)
CREATE OR REPLACE VIEW public.vw_escola_estado_hoje AS
SELECT 
    e.id as escola_id,
    al.id as session_id,
    al.ano as ano_ativo,
    pl.id as periodo_id,
    pl.tipo as periodo_tipo,
    pl.numero as periodo_numero,
    -- Verifica se hoje é um dia de interrupção (Feriado ou Pausa)
    EXISTS (
        SELECT 1 FROM public.calendario_eventos ce
        WHERE ce.escola_id = e.id 
          AND CURRENT_DATE BETWEEN ce.data_inicio AND ce.data_fim
          AND ce.tipo IN ('FERIADO', 'PAUSA_PEDAGOGICA')
    ) as hoje_bloqueado_pedagogico,
    -- Detalhe do evento de hoje (se houver)
    (
        SELECT ce.nome FROM public.calendario_eventos ce
        WHERE ce.escola_id = e.id 
          AND CURRENT_DATE BETWEEN ce.data_inicio AND ce.data_fim
        LIMIT 1
    ) as evento_hoje_nome,
    -- Fase atual (Regular ou Exames)
    COALESCE(
        (SELECT 'EXAMES' FROM public.calendario_eventos ce 
         WHERE ce.escola_id = e.id AND CURRENT_DATE BETWEEN ce.data_inicio AND ce.data_fim 
           AND ce.tipo IN ('PROVA_TRIMESTRAL', 'EXAME_NACIONAL') LIMIT 1),
        'REGULAR'
    ) as fase_operacional
FROM public.escolas e
LEFT JOIN public.anos_letivos al ON al.escola_id = e.id AND al.ativo = true
-- Pega o primeiro período letivo que contém o dia de hoje
LEFT JOIN LATERAL (
    SELECT id, tipo, numero FROM public.periodos_letivos 
    WHERE ano_letivo_id = al.id AND CURRENT_DATE BETWEEN data_inicio AND data_fim
    LIMIT 1
) pl ON true;

COMMENT ON VIEW public.vw_escola_estado_hoje IS 'SSOT do estado operacional diário da escola baseado no calendário do MED.';

-- 2. Trigger de Inteligência de Diário (Bloqueio em Feriados)
CREATE OR REPLACE FUNCTION public.fn_prevent_attendance_on_holidays()
RETURNS TRIGGER AS $$
DECLARE
    v_evento_nome text;
BEGIN
    -- Verifica se a data do lançamento coincide com um Feriado ou Pausa Pedagógica
    SELECT nome INTO v_evento_nome
    FROM public.calendario_eventos
    WHERE escola_id = NEW.escola_id
      AND NEW.data BETWEEN data_inicio AND data_fim
      AND tipo IN ('FERIADO', 'PAUSA_PEDAGOGICA')
    LIMIT 1;

    IF v_evento_nome IS NOT NULL THEN
        RAISE EXCEPTION 'BLOQUEIO_TEMPORAL: Não é permitido lançar presenças/faltas na data % devido ao evento: %.', 
            to_char(NEW.data, 'DD/MM/YYYY'), v_evento_nome
            USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('data', NEW.data, 'evento', v_evento_nome)::text;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_attendance_holidays ON public.frequencias;
CREATE TRIGGER trg_prevent_attendance_holidays
BEFORE INSERT OR UPDATE ON public.frequencias
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_attendance_on_holidays();

COMMIT;
