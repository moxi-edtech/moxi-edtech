BEGIN;

CREATE OR REPLACE VIEW public.vw_escola_estado_hoje AS
SELECT
    e.id AS escola_id,
    al.id AS session_id,
    al.ano AS ano_ativo,
    pl.id AS periodo_id,
    pl.tipo AS periodo_tipo,
    pl.numero AS periodo_numero,
    (
        CURRENT_DATE < al.data_inicio
        OR CURRENT_DATE > al.data_fim
        OR EXISTS (
            SELECT 1
            FROM public.calendario_eventos ce
            WHERE ce.escola_id = e.id
              AND CURRENT_DATE BETWEEN ce.data_inicio AND ce.data_fim
              AND ce.tipo IN ('FERIADO', 'PAUSA_PEDAGOGICA')
        )
    ) AS hoje_bloqueado_pedagogico,
    (
        SELECT ce.nome
        FROM public.calendario_eventos ce
        WHERE ce.escola_id = e.id
          AND CURRENT_DATE BETWEEN ce.data_inicio AND ce.data_fim
        ORDER BY ce.data_inicio ASC, ce.nome ASC
        LIMIT 1
    ) AS evento_hoje_nome,
    CASE
        WHEN al.data_inicio IS NULL OR CURRENT_DATE < al.data_inicio THEN 'PRE_INICIO'
        WHEN al.data_fim IS NOT NULL AND CURRENT_DATE > al.data_fim THEN 'POS_ENCERRAMENTO'
        WHEN EXISTS (
            SELECT 1
            FROM public.calendario_eventos ce
            WHERE ce.escola_id = e.id
              AND CURRENT_DATE BETWEEN ce.data_inicio AND ce.data_fim
              AND ce.tipo IN ('PROVA_TRIMESTRAL', 'EXAME_NACIONAL')
        ) THEN 'EXAMES'
        ELSE 'REGULAR'
    END AS fase_operacional
FROM public.escolas e
LEFT JOIN public.anos_letivos al
  ON al.escola_id = e.id
 AND al.ativo = true
LEFT JOIN LATERAL (
    SELECT id, tipo, numero
    FROM public.periodos_letivos
    WHERE ano_letivo_id = al.id
      AND CURRENT_DATE BETWEEN data_inicio AND data_fim
    ORDER BY data_inicio ASC, numero ASC
    LIMIT 1
) pl ON true;

COMMENT ON VIEW public.vw_escola_estado_hoje IS
  'Estado operacional diário coerente com os limites do ano letivo e o calendário escolar.';

COMMIT;
