BEGIN;

-- Fontes autorizadas para IA pedagógica. O conteúdo gerado nasce sempre como rascunho.
CREATE TABLE IF NOT EXISTS public.fontes_pedagogicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  classe text,
  disciplina_id uuid,
  ano_letivo_id uuid REFERENCES public.anos_letivos(id) ON DELETE SET NULL,
  conteudo text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'rascunho',
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fontes_pedagogicas_tipo_check CHECK (tipo IN ('programa_med', 'material_professor')),
  CONSTRAINT fontes_pedagogicas_status_check CHECK (status IN ('rascunho', 'publicada', 'arquivada'))
);

CREATE INDEX IF NOT EXISTS idx_fontes_pedagogicas_scope
  ON public.fontes_pedagogicas (escola_id, tipo, classe, disciplina_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.pedagogical_ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'gerar_atividade',
  fonte_ids uuid[] NOT NULL DEFAULT '{}',
  parametros jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'aguarda_revisao',
  resultado_rascunho jsonb,
  erro text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedagogical_ai_requests_status_check CHECK (status IN ('aguarda_revisao', 'aceite', 'rejeitado', 'falhou'))
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_ai_requests_user_status
  ON public.pedagogical_ai_requests (escola_id, created_by, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.intervencoes_pedagogicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  insight_id uuid REFERENCES public.ai_insights(id) ON DELETE SET NULL,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  motivo text,
  payload jsonb NOT NULL DEFAULT '{}',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intervencoes_pedagogicas_tipo_check CHECK (tipo IN ('enviar_alerta', 'atribuir_ficha', 'contactar_familia', 'acompanhar_aluno')),
  CONSTRAINT intervencoes_pedagogicas_status_check CHECK (status IN ('pendente', 'em_tratamento', 'concluida', 'cancelada'))
);

CREATE INDEX IF NOT EXISTS idx_intervencoes_pedagogicas_queue
  ON public.intervencoes_pedagogicas (escola_id, status, due_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.conquistas_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL,
  icone text,
  regra jsonb NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escola_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.aluno_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  conquista_id uuid NOT NULL REFERENCES public.conquistas_catalogo(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}',
  UNIQUE (aluno_id, conquista_id)
);

CREATE INDEX IF NOT EXISTS idx_aluno_conquistas_student
  ON public.aluno_conquistas (escola_id, aluno_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS public.diario_familiar_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  visibilidade text NOT NULL DEFAULT 'familia',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diario_familiar_entries_type_check CHECK (tipo IN ('elogio', 'observacao', 'presenca', 'nota', 'atividade')),
  CONSTRAINT diario_familiar_entries_visibility_check CHECK (visibilidade IN ('familia', 'equipa_escola'))
);

CREATE INDEX IF NOT EXISTS idx_diario_familiar_student_date
  ON public.diario_familiar_entries (escola_id, aluno_id, created_at DESC);

ALTER TABLE public.fontes_pedagogicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervencoes_pedagogicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conquistas_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_conquistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_familiar_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY fontes_pedagogicas_school_read ON public.fontes_pedagogicas FOR SELECT
  USING (public.is_escola_member(escola_id));
CREATE POLICY fontes_pedagogicas_owner_write ON public.fontes_pedagogicas FOR ALL
  USING (created_by = auth.uid() AND public.is_escola_member(escola_id))
  WITH CHECK (created_by = auth.uid() AND public.is_escola_member(escola_id));

CREATE POLICY pedagogical_ai_requests_owner_read ON public.pedagogical_ai_requests FOR SELECT
  USING (created_by = auth.uid() AND public.is_escola_member(escola_id));
CREATE POLICY pedagogical_ai_requests_owner_write ON public.pedagogical_ai_requests FOR INSERT
  WITH CHECK (created_by = auth.uid() AND public.is_escola_member(escola_id));

CREATE POLICY intervencoes_pedagogicas_staff_read ON public.intervencoes_pedagogicas FOR SELECT
  USING (public.is_escola_member(escola_id));
CREATE POLICY intervencoes_pedagogicas_staff_write ON public.intervencoes_pedagogicas FOR ALL
  USING ((created_by = auth.uid() OR assigned_to = auth.uid()) AND public.is_escola_member(escola_id))
  WITH CHECK (public.is_escola_member(escola_id));

CREATE POLICY conquistas_catalogo_school_read ON public.conquistas_catalogo FOR SELECT
  USING (public.is_escola_member(escola_id));
CREATE POLICY aluno_conquistas_student_read ON public.aluno_conquistas FOR SELECT
  USING (
    public.is_escola_member(escola_id)
    AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_conquistas.aluno_id AND a.profile_id = auth.uid())
  );
CREATE POLICY diario_familiar_student_read ON public.diario_familiar_entries FOR SELECT
  USING (
    public.is_escola_member(escola_id)
    AND (
      EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = diario_familiar_entries.aluno_id AND a.profile_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.escola_users eu
        WHERE eu.escola_id = diario_familiar_entries.escola_id
          AND eu.user_id = auth.uid()
          AND eu.papel IN ('admin', 'admin_escola', 'diretor', 'secretaria', 'professor')
      )
    )
  );
CREATE POLICY diario_familiar_author_write ON public.diario_familiar_entries FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_escola_member(escola_id));

COMMIT;
