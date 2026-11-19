-- Calendário operacional de avaliações: distinto do calendário oficial MED e das notas.
-- Segurança: escopo por escola/ano/turma/disciplina, publicação explícita, auditoria append-only.
CREATE TABLE IF NOT EXISTS public.calendario_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id),
  periodo_letivo_id uuid NOT NULL REFERENCES public.periodos_letivos(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  turma_disciplina_id uuid NOT NULL REFERENCES public.turma_disciplinas(id),
  tipo text NOT NULL DEFAULT 'Teste' CHECK (tipo IN ('Teste', 'Prova trimestral', 'Trabalho', 'Outra')),
  descricao text CHECK (length(descricao) <= 500),
  data date NOT NULL,
  inicio time without time zone NOT NULL,
  fim time without time zone,
  estado text NOT NULL DEFAULT 'rascunho' CHECK (estado IN ('rascunho','publicado','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL DEFAULT auth.uid(),
  published_at timestamptz,
  published_by uuid,
  CONSTRAINT calendario_avaliacoes_horas CHECK (fim IS NULL OR fim > inicio),
  CONSTRAINT calendario_avaliacoes_uniq UNIQUE
    (escola_id, ano_letivo_id, periodo_letivo_id, turma_disciplina_id, tipo, data, inicio)
);

CREATE INDEX IF NOT EXISTS calendario_avaliacoes_turma_data_idx
  ON public.calendario_avaliacoes(escola_id, ano_letivo_id, turma_id, data)
  WHERE estado = 'publicado';
CREATE INDEX IF NOT EXISTS calendario_avaliacoes_planeamento_idx
  ON public.calendario_avaliacoes(escola_id, ano_letivo_id, periodo_letivo_id, estado);

CREATE TABLE IF NOT EXISTS public.calendario_avaliacoes_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  avaliacao_id uuid NOT NULL REFERENCES public.calendario_avaliacoes(id),
  actor_id uuid NOT NULL,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendario_avaliacoes_auditoria_lookup_idx
  ON public.calendario_avaliacoes_auditoria(escola_id, avaliacao_id, ocorrido_em DESC);

CREATE OR REPLACE FUNCTION public.calendario_avaliacoes_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_turma public.turmas%ROWTYPE;
  v_periodo public.periodos_letivos%ROWTYPE;
  v_ano public.anos_letivos%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT public.user_has_role_in_school(NEW.escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria',
            'secretaria','secretaria_financeiro','diretor']::text[])
    OR NEW.escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'CALENDARIO_SEM_PERMISSAO' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (
      NEW.id IS DISTINCT FROM OLD.id OR
      NEW.escola_id IS DISTINCT FROM OLD.escola_id OR
      NEW.ano_letivo_id IS DISTINCT FROM OLD.ano_letivo_id OR
      NEW.turma_id IS DISTINCT FROM OLD.turma_id OR
      NEW.turma_disciplina_id IS DISTINCT FROM OLD.turma_disciplina_id OR
      NEW.created_at IS DISTINCT FROM OLD.created_at OR
      NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
    RAISE EXCEPTION 'CALENDARIO_IDENTIDADE_IMUTAVEL' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_ano FROM public.anos_letivos
    WHERE id = NEW.ano_letivo_id AND escola_id = NEW.escola_id AND ativo = true;
  SELECT * INTO v_turma FROM public.turmas
    WHERE id = NEW.turma_id AND escola_id = NEW.escola_id AND ano_letivo_id = NEW.ano_letivo_id;
  SELECT * INTO v_periodo FROM public.periodos_letivos
    WHERE id = NEW.periodo_letivo_id AND escola_id = NEW.escola_id AND ano_letivo_id = NEW.ano_letivo_id;
  IF v_ano.id IS NULL OR v_turma.id IS NULL OR v_periodo.id IS NULL OR
     NEW.data < v_periodo.data_inicio OR NEW.data > v_periodo.data_fim OR
     NEW.data < v_ano.data_inicio OR NEW.data > v_ano.data_fim OR
     NOT EXISTS (SELECT 1 FROM public.turma_disciplinas td
       WHERE td.id = NEW.turma_disciplina_id AND td.escola_id = NEW.escola_id
         AND td.turma_id = NEW.turma_id) OR
     (v_periodo.offering_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.school_education_offerings seo
       WHERE seo.id = v_periodo.offering_id AND seo.escola_id = NEW.escola_id
         AND seo.course_id = v_turma.curso_id)) THEN
    RAISE EXCEPTION 'CALENDARIO_CONTEXTO_INVALIDO' USING ERRCODE = '23514';
  END IF;

  NEW.created_by := CASE WHEN TG_OP = 'INSERT' THEN auth.uid() ELSE OLD.created_by END;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  IF NEW.estado = 'publicado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'publicado') THEN
    NEW.published_at := now();
    NEW.published_by := auth.uid();
  ELSIF NEW.estado <> 'publicado' THEN
    NEW.published_at := NULL;
    NEW.published_by := NULL;
  ELSE
    NEW.published_at := OLD.published_at;
    NEW.published_by := OLD.published_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calendario_avaliacoes_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.calendario_avaliacoes_auditoria
    (escola_id, avaliacao_id, actor_id, acao, antes, depois)
  VALUES
    (NEW.escola_id, NEW.id, auth.uid(),
     CASE WHEN TG_OP = 'INSERT' THEN 'CRIADA'
          WHEN NEW.estado = 'publicado' AND OLD.estado IS DISTINCT FROM NEW.estado THEN 'PUBLICADA'
          WHEN NEW.estado = 'cancelado' AND OLD.estado IS DISTINCT FROM NEW.estado THEN 'CANCELADA'
          ELSE 'ALTERADA' END,
     CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
     to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendario_avaliacoes_validate ON public.calendario_avaliacoes;
CREATE TRIGGER trg_calendario_avaliacoes_validate
BEFORE INSERT OR UPDATE ON public.calendario_avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.calendario_avaliacoes_validate();
DROP TRIGGER IF EXISTS trg_calendario_avaliacoes_audit ON public.calendario_avaliacoes;
CREATE TRIGGER trg_calendario_avaliacoes_audit
AFTER INSERT OR UPDATE ON public.calendario_avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.calendario_avaliacoes_audit_trigger();

ALTER TABLE public.calendario_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_avaliacoes_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_avaliacoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.calendario_avaliacoes_auditoria FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.calendario_avaliacoes TO authenticated;
GRANT SELECT ON public.calendario_avaliacoes_auditoria TO authenticated;

DROP POLICY IF EXISTS calendario_avaliacoes_gestao ON public.calendario_avaliacoes;
CREATE POLICY calendario_avaliacoes_gestao ON public.calendario_avaliacoes
  FOR ALL TO authenticated USING (
    escola_id = (SELECT public.current_tenant_escola_id())
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria',
            'secretaria','secretaria_financeiro','diretor']::text[])
  ) WITH CHECK (
    escola_id = (SELECT public.current_tenant_escola_id())
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria',
            'secretaria','secretaria_financeiro','diretor']::text[])
  );

-- Estudantes: apenas calendário publicado da sua própria turma/ano.
-- Encarregados seguem os vínculos registados, nunca um aluno indicado arbitrariamente.
DROP POLICY IF EXISTS calendario_avaliacoes_alunos ON public.calendario_avaliacoes;
CREATE POLICY calendario_avaliacoes_alunos ON public.calendario_avaliacoes
  FOR SELECT TO authenticated USING (
    estado = 'publicado'
    AND escola_id = (SELECT public.current_tenant_escola_id())
    AND EXISTS (
      SELECT 1 FROM public.matriculas m
      JOIN public.alunos a ON a.id = m.aluno_id AND a.escola_id = m.escola_id
      WHERE m.escola_id = calendario_avaliacoes.escola_id
        AND m.turma_id = calendario_avaliacoes.turma_id
        AND m.ano_letivo_id = calendario_avaliacoes.ano_letivo_id
        AND (
          a.profile_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.aluno_encarregados ae
            JOIN public.encarregados e ON e.id = ae.encarregado_id AND e.escola_id = ae.escola_id
            WHERE ae.escola_id = m.escola_id AND ae.aluno_id = a.id
              AND lower(e.email) = lower((SELECT auth.jwt()->>'email'))
          )
        )
    )
  );

DROP POLICY IF EXISTS calendario_avaliacoes_professor ON public.calendario_avaliacoes;
CREATE POLICY calendario_avaliacoes_professor ON public.calendario_avaliacoes
  FOR SELECT TO authenticated USING (
    estado = 'publicado'
    AND escola_id = (SELECT public.current_tenant_escola_id())
    AND EXISTS (
      SELECT 1 FROM public.professores p
      WHERE p.escola_id = calendario_avaliacoes.escola_id AND p.profile_id = (SELECT auth.uid())
        AND (
          EXISTS (
            SELECT 1 FROM public.turma_disciplinas_professores tdp
            WHERE tdp.escola_id = p.escola_id AND tdp.turma_id = calendario_avaliacoes.turma_id
              AND tdp.professor_id = p.id
          )
          OR EXISTS (
            SELECT 1 FROM public.turma_disciplinas td
            WHERE td.id = calendario_avaliacoes.turma_disciplina_id AND td.professor_id = p.id
          )
          OR EXISTS (
            SELECT 1 FROM public.turmas t
            WHERE t.id = calendario_avaliacoes.turma_id AND t.diretor_turma_id = p.id
          )
        )
    )
  );

DROP POLICY IF EXISTS calendario_avaliacoes_auditoria_gestao ON public.calendario_avaliacoes_auditoria;
CREATE POLICY calendario_avaliacoes_auditoria_gestao ON public.calendario_avaliacoes_auditoria
  FOR SELECT TO authenticated USING (
    escola_id = (SELECT public.current_tenant_escola_id())
    AND public.user_has_role_in_school(escola_id,
      ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria',
            'secretaria','secretaria_financeiro','diretor']::text[])
  );

REVOKE ALL ON FUNCTION public.calendario_avaliacoes_audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendario_avaliacoes_validate() FROM PUBLIC, anon, authenticated;
