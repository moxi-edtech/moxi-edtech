-- =====================================================================
-- RLS + ÍNDICES EM ALUNOS E ALUNOS_EXCLUIDOS
-- =====================================================================

-- 1) Índices para performance em alunos (soft delete)
CREATE INDEX IF NOT EXISTS idx_alunos_deleted_at
  ON public.alunos (deleted_at);

-- Removido: alunos não possui coluna escola_id; associação é via profiles.profile_id
-- CREATE INDEX IF NOT EXISTS idx_alunos_escola_deleted
--   ON public.alunos (escola_id, deleted_at);

-- 2) Índices em alunos_excluidos
CREATE INDEX IF NOT EXISTS idx_alunos_excluidos_escola
  ON public.alunos_excluidos (escola_id);

-- No modelo criado, a coluna de data de exclusão é aluno_deleted_at
CREATE INDEX IF NOT EXISTS idx_alunos_excluidos_aluno_deleted_at
  ON public.alunos_excluidos (aluno_deleted_at);

-- 3) Garante RLS ativo
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_excluidos ENABLE ROW LEVEL SECURITY;

-- 4) Políticas em ALUNOS: somente registros ativos (deleted_at IS NULL)
--    Ajuste os predicados de acordo com as funções/helpers que você já usa.

DROP POLICY IF EXISTS select_alunos_ativos_mesma_escola ON public.alunos;

CREATE POLICY select_alunos_ativos_mesma_escola
ON public.alunos
FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.escola_id = (
        SELECT px.escola_id FROM public.profiles px
        WHERE px.user_id = public.alunos.profile_id
      )
      AND (
        p.role IN ('admin','secretaria','financeiro','global_admin')
        OR p.role = 'super_admin'
      )
  )
);

-- INSERT/UPDATE: membros da escola com papéis operacionais ou super_admin
DROP POLICY IF EXISTS insert_alunos_mesma_escola ON public.alunos;
CREATE POLICY insert_alunos_mesma_escola
ON public.alunos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.escola_id = (
        SELECT px.escola_id FROM public.profiles px
        WHERE px.user_id = public.alunos.profile_id
      )
      AND (
        p.role IN ('secretaria','admin','financeiro','global_admin')
        OR p.role = 'super_admin'
      )
  )
);

DROP POLICY IF EXISTS update_alunos_mesma_escola ON public.alunos;
CREATE POLICY update_alunos_mesma_escola
ON public.alunos
FOR UPDATE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.escola_id = (
        SELECT px.escola_id FROM public.profiles px
        WHERE px.user_id = public.alunos.profile_id
      )
      AND (
        p.role IN ('secretaria','admin','financeiro','global_admin')
        OR p.role = 'super_admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.escola_id = (
        SELECT px.escola_id FROM public.profiles px
        WHERE px.user_id = public.alunos.profile_id
      )
      AND (
        p.role IN ('secretaria','admin','financeiro','global_admin')
        OR p.role = 'super_admin'
      )
  )
);

-- 5) Políticas em ALUNOS_EXCLUIDOS (mais restrito)
DROP POLICY IF EXISTS select_alunos_excluidos ON public.alunos_excluidos;

CREATE POLICY select_alunos_excluidos
ON public.alunos_excluidos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.escola_id = public.alunos_excluidos.escola_id
      AND (
        p.role = 'super_admin'
        OR p.role IN ('admin','financeiro','global_admin')
      )
  )
);
