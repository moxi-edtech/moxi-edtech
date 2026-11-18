-- AUD-P3: decisão explícita e imutável da Direção sobre nomes curriculares equivalentes.
-- Não funde disciplinas, não apaga notas e não reatribui avaliações.
-- GATE: aplicar apenas após homologação no PostgreSQL descartável.
BEGIN;

CREATE TABLE IF NOT EXISTS public.disciplina_equivalencia_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE RESTRICT,
  nome_normalizado text NOT NULL CHECK (length(btrim(nome_normalizado)) BETWEEN 2 AND 180),
  disciplina_oficial_id uuid NOT NULL REFERENCES public.disciplinas_catalogo(id) ON DELETE RESTRICT,
  candidatos_ids uuid[] NOT NULL CHECK (cardinality(candidatos_ids) BETWEEN 2 AND 30),
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 1000),
  decidido_por uuid NOT NULL,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplina_equivalencia_decisoes_unica
    UNIQUE (escola_id, curso_id, classe_id, ano_letivo_id, nome_normalizado),
  CONSTRAINT disciplina_equivalencia_decisoes_oficial_candidato
    CHECK (disciplina_oficial_id = ANY(candidatos_ids))
);
CREATE INDEX IF NOT EXISTS idx_disciplina_equivalencia_decisoes_ano
  ON public.disciplina_equivalencia_decisoes (escola_id, ano_letivo_id, curso_id, classe_id);

-- Defesa contra chamadas REST directas: a API não é o único perímetro.
-- Uma decisão só pode escolher disciplinas do mesmo curso/classe/ano/escola.
CREATE OR REPLACE FUNCTION public.validar_decisao_equivalencia_curricular()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NEW.decidido_por IS DISTINCT FROM auth.uid()
    OR NEW.escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'decisao_sem_autorizacao' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id=NEW.escola_id AND eu.user_id=auth.uid()
      AND eu.papel IN ('diretor','admin_escola','admin')
  ) THEN
    RAISE EXCEPTION 'decisao_exige_direcao' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(NEW.candidatos_ids) AS x)
      <> cardinality(NEW.candidatos_ids) THEN
    RAISE EXCEPTION 'candidatos_repetidos' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.anos_letivos a
     WHERE a.id=NEW.ano_letivo_id AND a.escola_id=NEW.escola_id)
     OR NOT EXISTS (SELECT 1 FROM public.cursos c
     WHERE c.id=NEW.curso_id AND c.escola_id=NEW.escola_id)
     OR NOT EXISTS (SELECT 1 FROM public.classes c
     WHERE c.id=NEW.classe_id AND c.escola_id=NEW.escola_id AND c.curso_id=NEW.curso_id)
  THEN
    RAISE EXCEPTION 'contexto_curricular_invalido' USING ERRCODE = '23514';
  END IF;
  SELECT count(DISTINCT cm.disciplina_id) INTO v_count
  FROM public.curso_matriz cm
  JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id
    AND cc.escola_id=NEW.escola_id AND cc.curso_id=NEW.curso_id
    AND cc.ano_letivo_id=NEW.ano_letivo_id
    AND (cc.classe_id IS NULL OR cc.classe_id=NEW.classe_id)
  JOIN public.disciplinas_catalogo d ON d.id=cm.disciplina_id AND d.escola_id=NEW.escola_id
  WHERE cm.escola_id=NEW.escola_id AND cm.curso_id=NEW.curso_id
    AND cm.classe_id=NEW.classe_id AND cm.disciplina_id=ANY(NEW.candidatos_ids);
  IF v_count <> cardinality(NEW.candidatos_ids) THEN
    RAISE EXCEPTION 'candidatos_fora_do_curriculo_ano' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validar_decisao_equivalencia_curricular() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validar_decisao_equivalencia_curricular ON public.disciplina_equivalencia_decisoes;
CREATE TRIGGER validar_decisao_equivalencia_curricular
  BEFORE INSERT ON public.disciplina_equivalencia_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.validar_decisao_equivalencia_curricular();

ALTER TABLE public.disciplina_equivalencia_decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplina_equivalencia_decisoes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.disciplina_equivalencia_decisoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.disciplina_equivalencia_decisoes TO authenticated;
CREATE POLICY disciplina_equivalencia_decisoes_select ON public.disciplina_equivalencia_decisoes
FOR SELECT TO authenticated USING (
  escola_id = (select public.current_tenant_escola_id())
  AND EXISTS (SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id=disciplina_equivalencia_decisoes.escola_id
      AND eu.user_id=(select auth.uid()))
);
CREATE POLICY disciplina_equivalencia_decisoes_insert ON public.disciplina_equivalencia_decisoes
FOR INSERT TO authenticated WITH CHECK (
  escola_id = (select public.current_tenant_escola_id())
  AND decidido_por=(select auth.uid())
  AND EXISTS (SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id=disciplina_equivalencia_decisoes.escola_id
      AND eu.user_id=(select auth.uid())
      AND eu.papel IN ('diretor','admin_escola','admin'))
);
-- Sem UPDATE/DELETE: para rever uma decisão, é necessária nova acção auditada.
COMMENT ON TABLE public.disciplina_equivalencia_decisoes IS
  'Decisão curricular de apresentação, sem alteração de notas nem fusão automática. Registo imutável.';
COMMIT;
