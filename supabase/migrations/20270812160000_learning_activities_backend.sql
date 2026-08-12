BEGIN;

-- Conteúdos pedagógicos publicados pelo professor. Mantém syllabi legados intactos.
CREATE TABLE IF NOT EXISTS public.materiais_pedagogicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  turma_id uuid NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id uuid NULL,
  titulo text NOT NULL,
  descricao text,
  conteudo text,
  arquivo_url text,
  status text NOT NULL DEFAULT 'rascunho',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materiais_pedagogicos_status_check CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
  CONSTRAINT materiais_pedagogicos_content_check CHECK (conteudo IS NOT NULL OR arquivo_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_materiais_pedagogicos_scope
  ON public.materiais_pedagogicos (escola_id, turma_id, disciplina_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.atividades_pedagogicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL,
  ano_letivo_id uuid NULL REFERENCES public.anos_letivos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  instrucoes text,
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  prazo timestamptz,
  tentativas_permitidas smallint NOT NULL DEFAULT 1,
  nota_maxima numeric(7,2) NOT NULL DEFAULT 20,
  source_material_ids uuid[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atividades_pedagogicas_tipo_check CHECK (tipo IN ('quiz', 'exercicio', 'tarefa', 'simulado')),
  CONSTRAINT atividades_pedagogicas_status_check CHECK (status IN ('rascunho', 'publicada', 'encerrada')),
  CONSTRAINT atividades_pedagogicas_attempts_check CHECK (tentativas_permitidas BETWEEN 1 AND 10),
  CONSTRAINT atividades_pedagogicas_grade_check CHECK (nota_maxima > 0)
);

CREATE INDEX IF NOT EXISTS idx_atividades_pedagogicas_turma_status
  ON public.atividades_pedagogicas (escola_id, turma_id, disciplina_id, status, prazo DESC);

CREATE TABLE IF NOT EXISTS public.atividade_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.atividades_pedagogicas(id) ON DELETE CASCADE,
  ordem smallint NOT NULL,
  tipo text NOT NULL,
  enunciado text NOT NULL,
  opcoes jsonb NOT NULL DEFAULT '[]',
  resposta_correta jsonb,
  pontos numeric(7,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atividade_questoes_tipo_check CHECK (tipo IN ('escolha_unica', 'verdadeiro_falso', 'resposta_curta')),
  CONSTRAINT atividade_questoes_points_check CHECK (pontos > 0),
  UNIQUE (atividade_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_atividade_questoes_activity
  ON public.atividade_questoes (escola_id, atividade_id, ordem);

CREATE TABLE IF NOT EXISTS public.atividade_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.atividades_pedagogicas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tentativa smallint NOT NULL,
  estado text NOT NULL DEFAULT 'iniciada',
  respostas jsonb NOT NULL DEFAULT '{}',
  nota numeric(7,2),
  feedback text,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atividade_entregas_estado_check CHECK (estado IN ('iniciada', 'submetida', 'corrigida')),
  CONSTRAINT atividade_entregas_attempt_check CHECK (tentativa BETWEEN 1 AND 10),
  UNIQUE (atividade_id, aluno_id, tentativa)
);

CREATE INDEX IF NOT EXISTS idx_atividade_entregas_activity_status
  ON public.atividade_entregas (escola_id, atividade_id, estado, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_atividade_entregas_student
  ON public.atividade_entregas (escola_id, aluno_id, updated_at DESC);

ALTER TABLE public.materiais_pedagogicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_pedagogicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY materiais_pedagogicos_select ON public.materiais_pedagogicos
  FOR SELECT USING (public.is_escola_member(escola_id));
CREATE POLICY atividades_pedagogicas_select ON public.atividades_pedagogicas
  FOR SELECT USING (
    public.is_escola_member(escola_id)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.escola_users eu
        WHERE eu.escola_id = atividades_pedagogicas.escola_id
          AND eu.user_id = auth.uid()
          AND eu.papel IN ('admin', 'admin_escola', 'secretaria', 'admin_financeiro', 'diretor', 'professor')
      )
      OR EXISTS (
        SELECT 1
        FROM public.alunos a
        JOIN public.matriculas m ON m.aluno_id = a.id AND m.escola_id = atividades_pedagogicas.escola_id
        WHERE a.profile_id = auth.uid()
          AND m.turma_id = atividades_pedagogicas.turma_id
          AND atividades_pedagogicas.status = 'publicada'
      )
    )
  );
CREATE POLICY atividade_questoes_select ON public.atividade_questoes
  FOR SELECT USING (
    public.is_escola_member(escola_id)
    AND EXISTS (
      SELECT 1 FROM public.atividades_pedagogicas a
      WHERE a.id = atividade_questoes.atividade_id
        AND (
          a.created_by = auth.uid()
          OR a.status = 'publicada'
        )
    )
  );
CREATE POLICY atividade_questoes_insert ON public.atividade_questoes
  FOR INSERT WITH CHECK (
    public.is_escola_member(escola_id)
    AND EXISTS (
      SELECT 1 FROM public.atividades_pedagogicas a
      WHERE a.id = atividade_questoes.atividade_id
        AND a.escola_id = atividade_questoes.escola_id
        AND a.created_by = auth.uid()
    )
  );
CREATE POLICY atividade_questoes_update ON public.atividade_questoes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.atividades_pedagogicas a WHERE a.id = atividade_questoes.atividade_id AND a.created_by = auth.uid())
  ) WITH CHECK (atividade_questoes.escola_id = (SELECT a.escola_id FROM public.atividades_pedagogicas a WHERE a.id = atividade_questoes.atividade_id));
CREATE POLICY atividade_questoes_delete ON public.atividade_questoes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.atividades_pedagogicas a WHERE a.id = atividade_questoes.atividade_id AND a.created_by = auth.uid())
  );
CREATE POLICY atividade_entregas_select ON public.atividade_entregas
  FOR SELECT USING (
    public.is_escola_member(escola_id)
    AND (
      aluno_id IN (SELECT id FROM public.alunos WHERE profile_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.atividades_pedagogicas a
        WHERE a.id = atividade_entregas.atividade_id AND a.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.escola_users eu
        WHERE eu.escola_id = atividade_entregas.escola_id
          AND eu.user_id = auth.uid()
          AND eu.papel IN ('admin', 'admin_escola', 'secretaria', 'admin_financeiro', 'diretor')
      )
    )
  );
CREATE POLICY atividade_entregas_insert ON public.atividade_entregas
  FOR INSERT WITH CHECK (
    public.is_escola_member(escola_id)
    AND aluno_id IN (SELECT id FROM public.alunos WHERE profile_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.atividades_pedagogicas a
      JOIN public.matriculas m ON m.turma_id = a.turma_id AND m.aluno_id = atividade_entregas.aluno_id AND m.escola_id = a.escola_id
      WHERE a.id = atividade_entregas.atividade_id AND a.escola_id = atividade_entregas.escola_id AND a.status = 'publicada'
    )
  );
CREATE POLICY atividade_entregas_update ON public.atividade_entregas
  FOR UPDATE USING (
    public.is_escola_member(escola_id)
    AND (
      aluno_id IN (SELECT id FROM public.alunos WHERE profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.atividades_pedagogicas a WHERE a.id = atividade_entregas.atividade_id AND a.created_by = auth.uid())
    )
  ) WITH CHECK (public.is_escola_member(escola_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atividades_pedagogicas;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atividade_entregas;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

COMMIT;
