BEGIN;

-- Backfill conservador de transições legadas:
-- só liga uma origem transferida ao único destino do mesmo aluno no ano seguinte.
-- Não cria, remove ou altera o estado de nenhuma matrícula.
WITH fontes AS (
  SELECT m.id AS origem_id, m.escola_id, m.aluno_id, m.ano_letivo
  FROM public.matriculas m
  WHERE lower(coalesce(m.status, '')) = 'transferido'
    AND m.origem_transicao_matricula_id IS NULL
), candidatos AS (
  SELECT f.origem_id, d.id AS destino_id,
         count(d.id) OVER (PARTITION BY f.origem_id) AS total_destinos,
         count(d.id) FILTER (WHERE d.origem_transicao_matricula_id IS NULL)
           OVER (PARTITION BY f.origem_id) AS destinos_sem_origem
  FROM fontes f
  JOIN public.matriculas d
    ON d.escola_id = f.escola_id
   AND d.aluno_id = f.aluno_id
   AND d.ano_letivo = f.ano_letivo + 1
), elegiveis AS (
  SELECT origem_id, destino_id
  FROM candidatos
  WHERE total_destinos = 1
    AND destinos_sem_origem = 1
)
UPDATE public.matriculas destino
SET origem_transicao_matricula_id = elegiveis.origem_id
FROM elegiveis
WHERE destino.id = elegiveis.destino_id
  AND destino.origem_transicao_matricula_id IS NULL;

COMMIT;
