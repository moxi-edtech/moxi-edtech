-- AUD-P1 · Reconciliar o identificador de avaliação sem tocar na política de autorização.
-- Migração de dados aditiva e idempotente; aplicação em produção sujeita a aprovação.
-- Apenas vínculos sem override explícito recebem o ID académico resolvido.
-- Não altera notas, anos letivos, RLS, funções nem decisões existentes.
--
-- O direito a corrigir uma nota continua a ser decidido por
-- public.can_bypass_pauta_lock (função existente) com correspondência exacta:
-- escola, utilizador, turma, disciplina avaliada, trimestre e prazo.
--
-- Vínculos com mais de uma disciplina curricular para a mesma disciplina avaliada
-- na mesma turma ficam excluídos: a política actual não distingue esses casos,
-- pelo que preenchê-los alargaria indevidamente a autorização.

WITH candidatos AS (
  SELECT td.id, td.escola_id,
         COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id) AS disciplina_avaliada_id,
         COUNT(*) OVER (
           PARTITION BY td.escola_id, td.turma_id,
                        COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id)
         ) AS partilham_avaliacao
  FROM public.turma_disciplinas td
  JOIN public.curso_matriz cm
    ON cm.id = td.curso_matriz_id
   AND cm.escola_id = td.escola_id
  JOIN public.turmas t
    ON t.id = td.turma_id
   AND t.escola_id = td.escola_id
  JOIN public.disciplinas_catalogo dc
    ON dc.id = COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id)
   AND dc.escola_id = td.escola_id
  WHERE td.avaliacao_disciplina_id IS NULL
),
nao_ambiguos AS (
  SELECT id, escola_id, disciplina_avaliada_id
  FROM candidatos
  WHERE partilham_avaliacao = 1
)
UPDATE public.turma_disciplinas td
   SET avaliacao_disciplina_id = c.disciplina_avaliada_id
  FROM nao_ambiguos c
 WHERE td.id = c.id
   AND td.escola_id = c.escola_id
   AND td.avaliacao_disciplina_id IS NULL;

-- Reversão: não executar um UPDATE inverso cego, pois não há como
-- distinguir posteriormente os valores preenchidos de edições válidas.
-- No CI, testar a reversibilidade num SAVEPOINT antes de qualquer
-- escrita de homologação e fazer ROLLBACK do snapshot transaccional.
