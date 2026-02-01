BEGIN;

CREATE OR REPLACE FUNCTION public.sum_component_pesos(p_componentes jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_componentes jsonb := p_componentes;
  v_sum integer := 0;
BEGIN
  IF v_componentes IS NULL THEN
    RETURN 0;
  END IF;

  IF jsonb_typeof(v_componentes) = 'object' AND v_componentes ? 'componentes' THEN
    v_componentes := v_componentes->'componentes';
  END IF;

  IF jsonb_typeof(v_componentes) <> 'array' THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM((elem->>'peso')::int), 0)
    INTO v_sum
    FROM jsonb_array_elements(v_componentes) elem
   WHERE (elem->>'peso') IS NOT NULL;

  RETURN v_sum;
END;
$$;

CREATE TABLE IF NOT EXISTS public.modelos_avaliacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escola_id uuid NOT NULL,
  nome text NOT NULL,
  componentes jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT modelos_avaliacao_peso_total_check
    CHECK (sum_component_pesos(componentes) IN (0, 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS modelos_avaliacao_escola_nome_uk
  ON public.modelos_avaliacao (escola_id, nome);

CREATE INDEX IF NOT EXISTS modelos_avaliacao_escola_idx
  ON public.modelos_avaliacao (escola_id);

ALTER TABLE public.modelos_avaliacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY modelos_avaliacao_select
  ON public.modelos_avaliacao
  FOR SELECT
  TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY modelos_avaliacao_insert
  ON public.modelos_avaliacao
  FOR INSERT
  TO authenticated
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin'])
  );

CREATE POLICY modelos_avaliacao_update
  ON public.modelos_avaliacao
  FOR UPDATE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin'])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin'])
  );

ALTER TABLE public.disciplinas_catalogo
  ADD CONSTRAINT disciplinas_modelo_avaliacao_fk
  FOREIGN KEY (aplica_modelo_avaliacao_id)
  REFERENCES public.modelos_avaliacao(id)
  ON DELETE SET NULL;

ALTER TABLE public.disciplinas_catalogo
  ADD CONSTRAINT disciplinas_herda_de_fk
  FOREIGN KEY (herda_de_disciplina_id)
  REFERENCES public.disciplinas_catalogo(id)
  ON DELETE SET NULL;

ALTER TABLE public.turma_disciplinas
  ADD CONSTRAINT turma_disciplinas_modelo_avaliacao_fk
  FOREIGN KEY (modelo_avaliacao_id)
  REFERENCES public.modelos_avaliacao(id)
  ON DELETE SET NULL;

WITH default_models AS (
  INSERT INTO public.modelos_avaliacao (escola_id, nome, componentes, is_default)
  SELECT escola_id, 'Padrão da Escola', avaliacao_config, true
    FROM public.configuracoes_escola
  ON CONFLICT (escola_id, nome) DO UPDATE
    SET componentes = EXCLUDED.componentes,
        is_default = true,
        updated_at = now()
  RETURNING id, escola_id
), resolved AS (
  SELECT DISTINCT ON (escola_id) id, escola_id
    FROM (
      SELECT id, escola_id FROM default_models
      UNION ALL
      SELECT id, escola_id FROM public.modelos_avaliacao
       WHERE nome = 'Padrão da Escola'
    ) src
)
UPDATE public.disciplinas_catalogo d
   SET aplica_modelo_avaliacao_id = resolved.id
  FROM resolved
 WHERE d.escola_id = resolved.escola_id
   AND d.aplica_modelo_avaliacao_id IS NULL
   AND COALESCE(d.is_avaliavel, true);

COMMIT;
