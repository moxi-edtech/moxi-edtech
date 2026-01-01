-- 1. Garantir que a tabela 'turmas' tem as colunas de ligação
ALTER TABLE public.turmas 
ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES public.cursos(id),
ADD COLUMN IF NOT EXISTS classe_id UUID REFERENCES public.classes(id);

-- 2. Indexar para performance (vital para escolas grandes)
-- Padroniza nomes de índices e evita duplicatas
DO $$
BEGIN
  -- Índice de curso: renomeia legado ou remove duplicado
  IF to_regclass('public.idx_turmas_curso') IS NOT NULL THEN
    IF to_regclass('public.idx_turmas_curso_id') IS NULL THEN
      EXECUTE 'ALTER INDEX public.idx_turmas_curso RENAME TO idx_turmas_curso_id';
    ELSE
      EXECUTE 'DROP INDEX IF EXISTS public.idx_turmas_curso';
    END IF;
  END IF;

  -- Índice de classe: renomeia legado ou remove duplicado
  IF to_regclass('public.idx_turmas_classe') IS NOT NULL THEN
    IF to_regclass('public.idx_turmas_classe_id') IS NULL THEN
      EXECUTE 'ALTER INDEX public.idx_turmas_classe RENAME TO idx_turmas_classe_id';
    ELSE
      EXECUTE 'DROP INDEX IF EXISTS public.idx_turmas_classe';
    END IF;
  END IF;

  -- Garante índice simples em (curso_id)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class t
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    JOIN pg_index i ON i.indrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE t.relname = 'turmas'
      AND i.indnatts = 1
      AND a.attname = 'curso_id'
  ) THEN
    EXECUTE 'CREATE INDEX idx_turmas_curso_id ON public.turmas(curso_id)';
  END IF;

  -- Garante índice simples em (classe_id)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class t
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    JOIN pg_index i ON i.indrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE t.relname = 'turmas'
      AND i.indnatts = 1
      AND a.attname = 'classe_id'
  ) THEN
    EXECUTE 'CREATE INDEX idx_turmas_classe_id ON public.turmas(classe_id)';
  END IF;
END$$;

-- 3. Criar a View "Inteligente" (Apagar se existir antiga)
DROP VIEW IF EXISTS public.vw_turmas_para_matricula;

CREATE OR REPLACE VIEW public.vw_turmas_para_matricula AS
SELECT 
    t.id,
    t.escola_id,
    t.session_id,
    t.nome,
    t.turno,
    t.capacidade_maxima,
    -- Trazemos os nomes bonitos, com fallback se estiverem null
    COALESCE(cl.nome, 'Classe não definida') as classe_nome,
    COALESCE(c.nome, 'Ensino Geral') as curso_nome,
    -- Contagem em tempo real
    (
        SELECT COUNT(*) 
        FROM matriculas m 
        WHERE m.turma_id = t.id 
        AND m.status IN ('ativa', 'ativo')
    ) as ocupacao_atual
FROM 
    public.turmas t
    LEFT JOIN public.classes cl ON t.classe_id = cl.id
    LEFT JOIN public.cursos c ON t.curso_id = c.id;

-- 4. Dar permissão à API
GRANT SELECT ON public.vw_turmas_para_matricula TO anon, authenticated, service_role;
