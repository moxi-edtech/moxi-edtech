BEGIN;

-- 1. Colunas para Tracking e SEO no Centro
ALTER TABLE public.centros_formacao
  ADD COLUMN IF NOT EXISTS tracking_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Tabela de Testemunhos (Social Proof)
CREATE TABLE IF NOT EXISTS public.formacao_testemunhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  curso_nome text, -- Opcional: vincular a um curso específico
  autor_nome text NOT NULL,
  autor_cargo text, -- Ex: "Ex-aluno", "Gestor de TI"
  autor_avatar_url text,
  conteudo text NOT NULL,
  estrelas integer NOT NULL DEFAULT 5 CHECK (estrelas BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'rascunho')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_testemunhos_escola ON public.formacao_testemunhos(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_testemunhos_status ON public.formacao_testemunhos(status);

ALTER TABLE public.formacao_testemunhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "testemunhos_public_select" ON public.formacao_testemunhos;
CREATE POLICY "testemunhos_public_select" ON public.formacao_testemunhos
  FOR SELECT TO anon, authenticated
  USING (status = 'ativo');

DROP POLICY IF EXISTS "testemunhos_admin_all" ON public.formacao_testemunhos;
CREATE POLICY "testemunhos_admin_all" ON public.formacao_testemunhos
  FOR ALL TO authenticated
  USING (public.user_has_role_in_school(escola_id, ARRAY['formacao_admin', 'super_admin', 'global_admin']::text[]));

-- 3. Atualizar RPC para entregar tudo à Landing Page
CREATE OR REPLACE FUNCTION public.get_public_landing_data(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola record;
  v_pagamento jsonb := '{}'::jsonb;
  v_payload jsonb;
BEGIN
  SELECT
      e.id,
      e.nome,
      e.slug,
      e.logo_url,
      e.tenant_type,
      coalesce(cf.dados_pagamento, '{}'::jsonb) AS dados_pagamento,
      coalesce(cf.tracking_config, '{}'::jsonb) AS tracking_config,
      coalesce(cf.seo_config, '{}'::jsonb) AS seo_config,
      cf.municipio,
      cf.provincia
    INTO v_escola
    FROM public.escolas e
    LEFT JOIN public.centros_formacao cf
      ON cf.escola_id = e.id
   WHERE e.slug = nullif(btrim(coalesce(p_slug, '')), '')
     AND e.tenant_type IN ('formacao', 'solo_creator')
   LIMIT 1;

  IF v_escola.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_pagamento := CASE
    WHEN coalesce((v_escola.dados_pagamento->>'ativo')::boolean, false) THEN
      jsonb_build_object(
        'ativo', true,
        'banco', nullif(v_escola.dados_pagamento->>'banco', ''),
        'titular_conta', nullif(v_escola.dados_pagamento->>'titular_conta', ''),
        'iban', nullif(v_escola.dados_pagamento->>'iban', ''),
        'numero_conta', nullif(v_escola.dados_pagamento->>'numero_conta', ''),
        'kwik_chave', nullif(v_escola.dados_pagamento->>'kwik_chave', ''),
        'instrucoes_checkout', nullif(v_escola.dados_pagamento->>'instrucoes_checkout', '')
      )
    ELSE jsonb_build_object('ativo', false)
  END;

  WITH cohorts_public AS (
    SELECT
      c.id,
      c.codigo,
      c.nome,
      c.curso_nome,
      CASE
        WHEN upper(coalesce(crs.modalidade, '')) IN ('ONLINE', 'GRAVADO', 'PRESENCIAL')
          THEN upper(crs.modalidade)
        ELSE 'PRESENCIAL'
      END AS format,
      c.vagas,
      c.data_inicio,
      coalesce(fin.valor_referencia, 0)::numeric AS valor_referencia,
      coalesce(occ.vagas_ocupadas, 0)::int AS vagas_ocupadas,
      coalesce(crs.carga_horaria, 0)::int AS carga_horaria
    FROM public.formacao_cohorts c
    LEFT JOIN LATERAL (
      SELECT f.valor_referencia
      FROM public.formacao_cohort_financeiro f
      WHERE f.escola_id = v_escola.id
        AND f.cohort_id = c.id
      ORDER BY f.updated_at DESC NULLS LAST
      LIMIT 1
    ) fin ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS vagas_ocupadas
      FROM public.formacao_inscricoes fi
      WHERE fi.escola_id = v_escola.id
        AND fi.cohort_id = c.id
        AND fi.estado IN ('pre_inscrito', 'inscrito')
        AND fi.cancelled_at IS NULL
    ) occ ON true
    LEFT JOIN LATERAL (
      SELECT fc.carga_horaria, fc.modalidade
      FROM public.formacao_cursos fc
      WHERE fc.escola_id = v_escola.id
        AND fc.nome = c.curso_nome
        AND fc.status = 'ativo'
      ORDER BY fc.updated_at DESC NULLS LAST
      LIMIT 1
    ) crs ON true
    WHERE c.escola_id = v_escola.id
      AND c.status = 'aberta'
      AND EXISTS (
        SELECT 1
        FROM public.formacao_cursos fc_public
        WHERE fc_public.escola_id = v_escola.id
          AND fc_public.nome = c.curso_nome
          AND fc_public.status = 'ativo'
      )
    ORDER BY c.data_inicio ASC
  ),
  testemunhos_agg AS (
    SELECT jsonb_agg(to_jsonb(t)) as items
    FROM (
      SELECT autor_nome, autor_cargo, autor_avatar_url, conteudo, estrelas, curso_nome
      FROM public.formacao_testemunhos
      WHERE escola_id = v_escola.id
        AND status = 'ativo'
      ORDER BY created_at DESC
      LIMIT 6
    ) t
  )
  SELECT jsonb_build_object(
    'escola',
    jsonb_build_object(
      'id', v_escola.id,
      'nome', v_escola.nome,
      'slug', v_escola.slug,
      'logo_url', v_escola.logo_url,
      'tenant_type', v_escola.tenant_type,
      'municipio', v_escola.municipio,
      'provincia', v_escola.provincia
    ),
    'fiscal',
    CASE
      WHEN coalesce(v_pagamento->>'iban', '') <> ''
        THEN jsonb_build_object('iban', v_pagamento->>'iban')
      ELSE NULL::jsonb
    END,
    'pagamento', v_pagamento,
    'tracking', v_escola.tracking_config,
    'seo', v_escola.seo_config,
    'testemunhos', coalesce((SELECT items FROM testemunhos_agg), '[]'::jsonb),
    'cohorts', coalesce((SELECT jsonb_agg(to_jsonb(cp)) FROM cohorts_public cp), '[]'::jsonb)
  )
  INTO v_payload;

  RETURN v_payload;
END;
$$;

COMMIT;
