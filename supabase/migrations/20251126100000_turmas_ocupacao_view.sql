-- =====================================================================
--  TURMAS — OCUPAÇÃO POR CLASSE
--  - Adiciona capacidade_maxima em turmas
--  - Cria view vw_ocupacao_turmas com percentuais e status
-- =====================================================================

-- 1) Colunas em turmas
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS classe TEXT,
  ADD COLUMN IF NOT EXISTS capacidade_maxima INTEGER;

-- Define capacidade padrão onde não estiver preenchida
UPDATE public.turmas
SET capacidade_maxima = 30
WHERE capacidade_maxima IS NULL;

-- 2) View de ocupação por turma
DROP VIEW IF EXISTS public.vw_ocupacao_turmas;

CREATE OR REPLACE VIEW public.vw_ocupacao_turmas
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.escola_id,
  t.nome,
  t.codigo,
  t.classe,
  COALESCE(t.turno, t.periodo) AS turno,
  t.sala,
  COALESCE(t.capacidade_maxima, 30) AS capacidade_maxima,

  -- total de matrículas ativas (por turma)
  COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))::INT
    AS total_matriculas_ativas,

  -- percentual de ocupação
  CASE
    WHEN COALESCE(t.capacidade_maxima, 30) > 0 THEN
      ROUND(
        (
          COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))
        )::NUMERIC
        / COALESCE(t.capacidade_maxima, 30)::NUMERIC
        * 100,
        1
      )
    ELSE 0
  END AS ocupacao_percentual,

  -- status de ocupação
  CASE
    WHEN COALESCE(t.capacidade_maxima, 30) = 0 THEN 'sem_capacidade'
    WHEN COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))
         >= COALESCE(t.capacidade_maxima, 30)
      THEN 'lotada'
    WHEN COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))
         >= COALESCE(t.capacidade_maxima, 30) * 0.8
      THEN 'quase_lotada'
    WHEN COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa')) = 0
      THEN 'sem_matriculas'
    ELSE 'com_vagas'
  END AS status_ocupacao

FROM public.turmas t
LEFT JOIN public.matriculas m
  ON m.turma_id = t.id
 -- opcional: reforça filtro, mesmo que a view já conte só ativas
 AND m.status IN ('ativo','ativa')
GROUP BY
  t.id,
  t.escola_id,
  t.nome,
  t.codigo,
  t.classe,
  COALESCE(t.turno, t.periodo),
  t.sala,
  COALESCE(t.capacidade_maxima, 30);

COMMENT ON VIEW public.vw_ocupacao_turmas IS
  'Ocupação de turmas (capacidade, matriculados ativos, % e status: lotada/quase_lotada/com_vagas/sem_matriculas/sem_capacidade).';
