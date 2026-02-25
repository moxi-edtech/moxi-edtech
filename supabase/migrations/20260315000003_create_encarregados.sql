BEGIN;

CREATE TABLE IF NOT EXISTS public.encarregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text NULL,
  email text NULL,
  bi_numero text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_encarregados_escola_email
  ON public.encarregados (escola_id, email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_encarregados_escola_bi
  ON public.encarregados (escola_id, bi_numero)
  WHERE bi_numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_encarregados_escola_id
  ON public.encarregados (escola_id);

CREATE TABLE IF NOT EXISTS public.aluno_encarregados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  encarregado_id uuid NOT NULL REFERENCES public.encarregados(id) ON DELETE CASCADE,
  relacao text NULL,
  principal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aluno_encarregados
  ON public.aluno_encarregados (aluno_id, encarregado_id);

CREATE INDEX IF NOT EXISTS idx_aluno_encarregados_escola
  ON public.aluno_encarregados (escola_id);

CREATE INDEX IF NOT EXISTS idx_aluno_encarregados_aluno
  ON public.aluno_encarregados (aluno_id);

CREATE INDEX IF NOT EXISTS idx_aluno_encarregados_encarregado
  ON public.aluno_encarregados (encarregado_id);

ALTER TABLE public.encarregados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_encarregados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS encarregados_tenant ON public.encarregados;
CREATE POLICY encarregados_tenant ON public.encarregados
  USING (escola_id = current_tenant_escola_id())
  WITH CHECK (escola_id = current_tenant_escola_id());

DROP POLICY IF EXISTS aluno_encarregados_tenant ON public.aluno_encarregados;
CREATE POLICY aluno_encarregados_tenant ON public.aluno_encarregados
  USING (
    escola_id = current_tenant_escola_id()
    AND EXISTS (
      SELECT 1
      FROM public.alunos a
      WHERE a.id = aluno_id
        AND a.escola_id = current_tenant_escola_id()
    )
  )
  WITH CHECK (
    escola_id = current_tenant_escola_id()
    AND EXISTS (
      SELECT 1
      FROM public.alunos a
      WHERE a.id = aluno_id
        AND a.escola_id = current_tenant_escola_id()
    )
  );

COMMIT;
