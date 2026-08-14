CREATE TABLE IF NOT EXISTS public.planos_aula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aula_id uuid REFERENCES public.aulas(id) ON DELETE SET NULL,
  turma_disciplina_id uuid NOT NULL REFERENCES public.turma_disciplinas(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.professores(id) ON DELETE CASCADE,
  data date NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  tema text NOT NULL,
  subtema text,
  objetivos text,
  competencias text,
  conteudos text,
  metodologia text,
  recursos text,
  atividades text,
  avaliacao text,
  tarefa_casa text,
  observacoes text,
  arquivo_url text,
  created_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  returned_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planos_aula_status_check CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'devolvido', 'arquivado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_planos_aula_professor_ocorrencia
  ON public.planos_aula (escola_id, turma_disciplina_id, professor_id, data);
CREATE INDEX IF NOT EXISTS idx_planos_aula_escola_status_data
  ON public.planos_aula (escola_id, status, data);

ALTER TABLE public.planos_aula ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS planos_aula_select ON public.planos_aula;
CREATE POLICY planos_aula_select ON public.planos_aula
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

DROP POLICY IF EXISTS planos_aula_insert ON public.planos_aula;
CREATE POLICY planos_aula_insert ON public.planos_aula
  FOR INSERT TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['professor'::text, 'secretaria'::text, 'secretaria_financeiro'::text, 'admin_financeiro'::text, 'admin_secretaria'::text, 'admin_escola'::text, 'admin'::text, 'staff_admin'::text])
  );

DROP POLICY IF EXISTS planos_aula_update ON public.planos_aula;
CREATE POLICY planos_aula_update ON public.planos_aula
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id())
  WITH CHECK (escola_id = public.current_tenant_escola_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.planos_aula;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
