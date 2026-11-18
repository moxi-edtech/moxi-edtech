-- AUD-P1 · Contrato de reabertura por disciplina avaliada.
-- Migração nova; aplicação em produção sujeita a aprovação explícita.
-- Não altera a política can_bypass_pauta_lock, RLS, notas ou anos letivos.
ALTER TABLE public.excecoes_pauta
  ADD COLUMN IF NOT EXISTS disciplina_catalogo_id uuid
  REFERENCES public.disciplinas_catalogo(id) ON DELETE RESTRICT;

-- Apenas preencher disciplinas avaliadas inequívocas e do mesmo tenant.
-- Avaliações partilhadas por duas disciplinas da mesma turma ficam pendentes
-- de decisão académica: a política existente não pode distingui-las.
WITH todos AS (
  SELECT td.id, td.escola_id, td.turma_id, td.avaliacao_disciplina_id,
         COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id) AS alvo
    FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id
                              AND cm.escola_id=td.escola_id
    JOIN public.turmas t ON t.id=td.turma_id
                       AND t.escola_id=td.escola_id
    JOIN public.disciplinas_catalogo dc
      ON dc.id=COALESCE(cm.avaliacao_disciplina_id, cm.disciplina_id)
     AND dc.escola_id=td.escola_id
), candidatos AS (
  SELECT id, escola_id, alvo,
         COUNT(*) OVER (PARTITION BY escola_id,turma_id,alvo) AS partilhas
    FROM todos
), validos AS (
  SELECT c.id,c.escola_id,c.alvo
  FROM candidatos c
  WHERE c.partilhas=1
)
UPDATE public.turma_disciplinas td
   SET avaliacao_disciplina_id=v.alvo
  FROM validos v
 WHERE td.id=v.id AND td.escola_id=v.escola_id
   AND td.avaliacao_disciplina_id IS NULL;

-- A migração é idempotente; o teste de reversão deve usar uma
-- transacção descartável, não apagar indiscriminadamente valores válidos.
