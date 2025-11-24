-- Historical snapshot table for deleted students

CREATE TABLE IF NOT EXISTS public.alunos_excluidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  escola_id uuid NOT NULL
    REFERENCES public.escolas(id) ON DELETE CASCADE,

  -- referência ao aluno/profile originais
  aluno_id uuid,
  profile_id uuid,
  numero_login text,

  nome text,
  aluno_created_at timestamptz,
  aluno_deleted_at timestamptz,

  exclusao_motivo text,
  excluido_por uuid
    REFERENCES public.profiles(user_id) ON DELETE SET NULL,

  -- LGPD / anonimização futura
  dados_anonimizados boolean NOT NULL DEFAULT false,
  anonimizacao_data timestamptz,

  -- snapshot bruto (aluno, profile, vínculos relevantes, etc.)
  snapshot jsonb
);

-- Indexes úteis
CREATE INDEX IF NOT EXISTS idx_alunos_excluidos_escola_id ON public.alunos_excluidos(escola_id);
CREATE INDEX IF NOT EXISTS idx_alunos_excluidos_aluno_id ON public.alunos_excluidos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_excluidos_profile_id ON public.alunos_excluidos(profile_id);

