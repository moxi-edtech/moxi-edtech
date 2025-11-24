-- 1) Adiciona a coluna escola_id se ainda não existir
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS escola_id uuid;

-- 2) Preenche escola_id a partir do profile, se der match
--    Garante coluna updated_at para compatibilidade com triggers existentes.
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.alunos a
SET escola_id = p.escola_id
FROM public.profiles p
WHERE a.profile_id = p.user_id
  AND a.escola_id IS NULL;

-- 3) Cria FK para escolas (id)
ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_escola_id_fkey
  FOREIGN KEY (escola_id)
  REFERENCES public.escolas (id)
  ON DELETE CASCADE;

-- 4) (Opcional) Se você quiser forçar sempre ter escola_id
--    Só faça isso DEPOIS de garantir que não há NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.alunos
    WHERE escola_id IS NULL
  ) THEN
    ALTER TABLE public.alunos
      ALTER COLUMN escola_id SET NOT NULL;
  END IF;
END $$;

-- 5) Índice para consultas por escola
CREATE INDEX IF NOT EXISTS alunos_escola_id_idx
  ON public.alunos(escola_id);
