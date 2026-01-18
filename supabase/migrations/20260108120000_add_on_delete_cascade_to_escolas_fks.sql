
DO $$
BEGIN
  IF to_regclass('public.candidaturas') IS NOT NULL THEN
    -- Adiciona ON DELETE CASCADE para a tabela candidaturas
    ALTER TABLE public.candidaturas DROP CONSTRAINT IF EXISTS candidaturas_escola_id_fkey;
    ALTER TABLE public.candidaturas ADD CONSTRAINT candidaturas_escola_id_fkey
      FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cursos_globais_cache') IS NOT NULL THEN
    -- Adiciona ON DELETE CASCADE para a tabela cursos_globais_cache
    ALTER TABLE public.cursos_globais_cache DROP CONSTRAINT IF EXISTS cursos_globais_cache_created_by_escola_fkey;
    ALTER TABLE public.cursos_globais_cache ADD CONSTRAINT cursos_globais_cache_created_by_escola_fkey
      FOREIGN KEY (created_by_escola) REFERENCES public.escolas(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_contratos') IS NOT NULL THEN
    -- Adiciona ON DELETE CASCADE para a tabela financeiro_contratos
    ALTER TABLE public.financeiro_contratos DROP CONSTRAINT IF EXISTS financeiro_contratos_escola_id_fkey;
    ALTER TABLE public.financeiro_contratos ADD CONSTRAINT financeiro_contratos_escola_id_fkey
      FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.financeiro_titulos') IS NOT NULL THEN
    -- Adiciona ON DELETE CASCADE para a tabela financeiro_titulos
    ALTER TABLE public.financeiro_titulos DROP CONSTRAINT IF EXISTS financeiro_titulos_escola_id_fkey;
    ALTER TABLE public.financeiro_titulos ADD CONSTRAINT financeiro_titulos_escola_id_fkey
      FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.historico_anos') IS NOT NULL THEN
    -- Adiciona ON DELETE CASCADE para a tabela historico_anos
    ALTER TABLE public.historico_anos DROP CONSTRAINT IF EXISTS historico_anos_escola_id_fkey;
    ALTER TABLE public.historico_anos ADD CONSTRAINT historico_anos_escola_id_fkey
      FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;
  END IF;
END $$;
