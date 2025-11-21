-- ======================================================================
--  MÓDULO FINANCEIRO — V3
--  Complemento da V2:
--  - Liga alunos -> auth.users via user_id
--  - Ajusta RLS das cobranças para funcionar com user_id
--  - Cria função helper minhas_cobrancas() para o Portal do Aluno
-- ======================================================================

-- ======================================================================
-- 1. Adicionar coluna user_id em public.alunos (se ainda não existir)
--    - user_id referencia auth.users(id)
--    - permite saber qual usuário (aluno/pai) "dono" daquele aluno
-- ======================================================================

ALTER TABLE public.alunos
ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alunos_user_id_fkey'
      AND conrelid = 'public.alunos'::regclass
  ) THEN
    ALTER TABLE public.alunos
      ADD CONSTRAINT alunos_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;


-- Opcional, mas recomendável: índice para facilitar buscas por user_id
CREATE INDEX IF NOT EXISTS idx_alunos_user_id
  ON public.alunos(user_id);


-- ======================================================================
-- 2. Ajustar policy de SELECT em public.cobrancas para usar alunos.user_id
--    Em vez de comparar auth.uid() diretamente com cobrancas.aluno_id
-- ======================================================================

DROP POLICY IF EXISTS cobrancas_aluno_select ON public.cobrancas;

CREATE POLICY cobrancas_aluno_select ON public.cobrancas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.alunos a
      WHERE a.id = aluno_id
        AND a.user_id = auth.uid()
    )
  );


-- ======================================================================
-- 3. Função helper: public.minhas_cobrancas()
--    - Facilita o consumo no Portal do Aluno
--    - Aplica o vínculo via alunos.user_id = auth.uid()
--    - RLS continua valendo em cima
-- ======================================================================

CREATE OR REPLACE FUNCTION public.minhas_cobrancas()
RETURNS SETOF public.cobrancas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT c.*
  FROM public.cobrancas c
  JOIN public.alunos a
    ON a.id = c.aluno_id
  WHERE a.user_id = auth.uid()
  ORDER BY c.ano DESC, c.mes DESC, c.data_vencimento DESC;
$$;

-- ======================================================================
-- FIM — Módulo Financeiro V3 (link alunos <-> usuários + RLS coerente)
-- ======================================================================
