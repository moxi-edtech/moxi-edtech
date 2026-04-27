BEGIN;

-- =====================================================
-- 1) Base de dados de carreira no aluno
-- =====================================================
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS is_open_to_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS career_headline text,
  ADD COLUMN IF NOT EXISTS skills_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS anonymous_slug text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS preferencia_trabalho text;

DO $$
BEGIN
  IF to_regclass('public.perfis_formandos') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.perfis_formandos
        ADD COLUMN IF NOT EXISTS provincia text,
        ADD COLUMN IF NOT EXISTS municipio text,
        ADD COLUMN IF NOT EXISTS preferencia_trabalho text,
        ADD COLUMN IF NOT EXISTS data_nascimento date,
        ADD COLUMN IF NOT EXISTS grau_academico text
          CHECK (grau_academico IN (
            ''ENSINO_MEDIO'',
            ''FREQUENCIA_UNIVERSITARIA'',
            ''LICENCIATURA'',
            ''MESTRADO''
          ))
    ';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alunos_skills_tags_array_chk'
      AND conrelid = 'public.alunos'::regclass
  ) THEN
    ALTER TABLE public.alunos
      ADD CONSTRAINT alunos_skills_tags_array_chk
      CHECK (jsonb_typeof(skills_tags) = 'array');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_alunos_anonymous_slug
  ON public.alunos (anonymous_slug)
  WHERE anonymous_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_talent_anonymous_slug()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  LOOP
    v_slug := 'talent-' || lpad((floor(random() * 10000))::int::text, 4, '0') || '-' || substr(encode(gen_random_bytes(2), 'hex'), 1, 2);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.alunos a
      WHERE a.anonymous_slug = v_slug
    );
  END LOOP;

  RETURN v_slug;
END;
$$;

-- =====================================================
-- 2) Helpers de contexto Talent Pool
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_talent_empresa_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    WHERE feu.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_talent_empresa_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT feu.empresa_id
  FROM public.fiscal_empresa_users feu
  WHERE feu.user_id = auth.uid();
$$;

-- =====================================================
-- 3) Guardas RLS e mutação limitada para alunos
-- =====================================================
DROP POLICY IF EXISTS alunos_select_restrict_empresa ON public.alunos;
CREATE POLICY alunos_select_restrict_empresa
ON public.alunos
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT public.is_talent_empresa_user()
  OR public.is_super_admin()
  OR public.is_staff_escola(escola_id)
  OR profile_id = auth.uid()
  OR usuario_auth_id = auth.uid()
);

DROP POLICY IF EXISTS alunos_update_restrict_talent_self ON public.alunos;
CREATE POLICY alunos_update_restrict_talent_self
ON public.alunos
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_staff_escola(escola_id)
  OR profile_id = auth.uid()
  OR usuario_auth_id = auth.uid()
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_staff_escola(escola_id)
  OR profile_id = auth.uid()
  OR usuario_auth_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.trg_alunos_talent_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_open_to_work IS TRUE
     AND nullif(btrim(coalesce(NEW.anonymous_slug, '')), '') IS NULL THEN
    NEW.anonymous_slug := public.generate_talent_anonymous_slug();
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_super_admin() OR public.is_staff_escola(NEW.escola_id) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.profile_id = auth.uid(), false) IS FALSE
     AND COALESCE(NEW.usuario_auth_id = auth.uid(), false) IS FALSE THEN
    RAISE EXCEPTION 'Sem permissão para alterar este perfil de aluno'
      USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - ARRAY[
      'is_open_to_work',
      'career_headline',
      'provincia',
      'municipio',
      'preferencia_trabalho',
      'updated_at',
      'anonymous_slug'
    ])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY[
      'is_open_to_work',
      'career_headline',
      'provincia',
      'municipio',
      'preferencia_trabalho',
      'updated_at',
      'anonymous_slug'
    ]) THEN
    RAISE EXCEPTION 'Formando so pode atualizar campos do perfil profissional'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_talent_guard ON public.alunos;
CREATE TRIGGER trg_alunos_talent_guard
BEFORE INSERT OR UPDATE ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.trg_alunos_talent_guard();

-- =====================================================
-- 4) Tabela de matches do Talent Pool
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'talent_pool_match_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.talent_pool_match_status AS ENUM ('pending', 'accepted', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.talent_pool_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  status public.talent_pool_match_status NOT NULL DEFAULT 'pending',
  contact_nome text,
  contact_email text,
  contact_telefone text,
  contact_bi text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talent_pool_matches_unique UNIQUE (empresa_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_talent_pool_matches_empresa_status
  ON public.talent_pool_matches (empresa_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_talent_pool_matches_aluno_status
  ON public.talent_pool_matches (aluno_id, status, created_at DESC);

ALTER TABLE public.talent_pool_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_pool_matches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS talent_pool_matches_select_empresa ON public.talent_pool_matches;
CREATE POLICY talent_pool_matches_select_empresa
ON public.talent_pool_matches
FOR SELECT
TO authenticated
USING (
  empresa_id = auth.uid()
  AND public.is_talent_empresa_user()
);

DROP POLICY IF EXISTS talent_pool_matches_select_aluno ON public.talent_pool_matches;
CREATE POLICY talent_pool_matches_select_aluno
ON public.talent_pool_matches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = talent_pool_matches.aluno_id
      AND (a.profile_id = auth.uid() OR a.usuario_auth_id = auth.uid())
  )
);

DROP POLICY IF EXISTS talent_pool_matches_insert_empresa ON public.talent_pool_matches;
CREATE POLICY talent_pool_matches_insert_empresa
ON public.talent_pool_matches
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = auth.uid()
  AND public.is_talent_empresa_user()
  AND status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = talent_pool_matches.aluno_id
      AND a.is_open_to_work IS TRUE
      AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.fiscal_empresa_users feu
    JOIN public.fiscal_escola_bindings feb
      ON feb.empresa_id = feu.empresa_id
    JOIN public.alunos a
      ON a.id = talent_pool_matches.aluno_id
    WHERE feu.user_id = auth.uid()
      AND feb.escola_id = a.escola_id
      AND feb.effective_from <= current_date
      AND (feb.effective_to IS NULL OR feb.effective_to >= current_date)
  )
);

DROP POLICY IF EXISTS talent_pool_matches_update_aluno_response ON public.talent_pool_matches;
CREATE POLICY talent_pool_matches_update_aluno_response
ON public.talent_pool_matches
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = talent_pool_matches.aluno_id
      AND (a.profile_id = auth.uid() OR a.usuario_auth_id = auth.uid())
  )
)
WITH CHECK (
  status IN ('accepted', 'rejected')
  AND EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = talent_pool_matches.aluno_id
      AND (a.profile_id = auth.uid() OR a.usuario_auth_id = auth.uid())
  )
);

DROP POLICY IF EXISTS talent_pool_matches_update_empresa_reject ON public.talent_pool_matches;
CREATE POLICY talent_pool_matches_update_empresa_reject
ON public.talent_pool_matches
FOR UPDATE
TO authenticated
USING (
  empresa_id = auth.uid()
  AND public.is_talent_empresa_user()
  AND status = 'pending'
)
WITH CHECK (
  empresa_id = auth.uid()
  AND status = 'rejected'
);

CREATE OR REPLACE FUNCTION public.trg_talent_pool_matches_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno public.alunos%ROWTYPE;
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.empresa_id <> OLD.empresa_id OR NEW.aluno_id <> OLD.aluno_id THEN
      RAISE EXCEPTION 'empresa_id/aluno_id não podem ser alterados'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status <> NEW.status THEN
      IF OLD.status <> 'pending' THEN
        RAISE EXCEPTION 'Transição de status inválida (só permitido a partir de pending)'
          USING ERRCODE = '22023';
      END IF;

      IF NEW.status NOT IN ('accepted', 'rejected') THEN
        RAISE EXCEPTION 'Status inválido para transição'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'accepted' THEN
    SELECT *
    INTO v_aluno
    FROM public.alunos a
    WHERE a.id = NEW.aluno_id
    LIMIT 1;

    NEW.contact_nome := coalesce(nullif(btrim(coalesce(v_aluno.nome_completo, '')), ''), v_aluno.nome);
    NEW.contact_email := nullif(btrim(coalesce(v_aluno.email, '')), '');
    NEW.contact_telefone := nullif(btrim(coalesce(v_aluno.telefone, '')), '');
    NEW.contact_bi := nullif(btrim(coalesce(v_aluno.bi_numero, '')), '');
  ELSE
    NEW.contact_nome := NULL;
    NEW.contact_email := NULL;
    NEW.contact_telefone := NULL;
    NEW.contact_bi := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talent_pool_matches_guard ON public.talent_pool_matches;
CREATE TRIGGER trg_talent_pool_matches_guard
BEFORE INSERT OR UPDATE ON public.talent_pool_matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_talent_pool_matches_guard();

-- =====================================================
-- 5) Surface anónima para empresas
-- =====================================================
CREATE OR REPLACE FUNCTION public.list_talent_pool_candidates(
  p_escola_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  aluno_id uuid,
  escola_id uuid,
  provincia text,
  municipio text,
  preferencia_trabalho text,
  career_headline text,
  skills_tags jsonb,
  anonymous_slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_talent_empresa_user() THEN
    RAISE EXCEPTION 'Acesso restrito a perfis empresariais'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.escola_id,
    a.provincia,
    a.municipio,
    a.preferencia_trabalho,
    a.career_headline,
    a.skills_tags,
    a.anonymous_slug
  FROM public.alunos a
  WHERE a.is_open_to_work IS TRUE
    AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
    AND (
      p_escola_id IS NULL
      OR a.escola_id = p_escola_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.fiscal_empresa_users feu
      JOIN public.fiscal_escola_bindings feb
        ON feb.empresa_id = feu.empresa_id
      WHERE feu.user_id = auth.uid()
        AND feb.escola_id = a.escola_id
        AND feb.effective_from <= current_date
        AND (feb.effective_to IS NULL OR feb.effective_to >= current_date)
    )
  ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100)
  OFFSET GREATEST(coalesce(p_offset, 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_talent_pool_candidates(uuid, integer, integer) TO authenticated;

-- =====================================================
-- 6) Automação: sugestão de Passaporte Profissional
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_formacao_sugerir_passaporte_profissional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media numeric;
  v_aluno_id uuid;
  v_evento_id uuid;
BEGIN
  IF NEW.estado <> 'concluido' OR OLD.estado = 'concluido' THEN
    RETURN NEW;
  END IF;

  v_media := COALESCE(
    NULLIF(NEW.metadata->>'media_final', '')::numeric,
    NULLIF(NEW.metadata->>'nota_final', '')::numeric
  );

  IF v_media IS NULL OR v_media <= 16 THEN
    RETURN NEW;
  END IF;

  SELECT a.id
  INTO v_aluno_id
  FROM public.alunos a
  WHERE a.escola_id = NEW.escola_id
    AND (a.usuario_auth_id = NEW.formando_user_id OR a.profile_id = NEW.formando_user_id)
  ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
  LIMIT 1;

  IF v_aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.eventos e
    WHERE e.escola_id = NEW.escola_id
      AND e.tipo = 'matricula.concluida'
      AND e.entidade_tipo = 'formacao_inscricao'
      AND e.entidade_id = NEW.id
      AND coalesce(e.payload->>'gatilho', '') = 'talent_pool_suggestion'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.eventos (
    escola_id,
    tipo,
    payload,
    actor_id,
    actor_role,
    entidade_tipo,
    entidade_id
  )
  VALUES (
    NEW.escola_id,
    'matricula.concluida',
    jsonb_build_object(
      'gatilho', 'talent_pool_suggestion',
      'inscricao_id', NEW.id,
      'aluno_id', v_aluno_id,
      'cohort_id', NEW.cohort_id,
      'media_final', v_media
    ),
    NEW.formando_user_id,
    'formando',
    'formacao_inscricao',
    NEW.id
  )
  RETURNING id INTO v_evento_id;

  PERFORM public.inserir_notificacao(
    NEW.escola_id,
    v_evento_id,
    NEW.formando_user_id,
    'Passaporte Profissional disponível',
    'Concluiu a formação com média superior a 16. Ative o seu perfil no Talent Pool para receber interesse de empresas.',
    'aviso'::public.notificacao_prioridade,
    'Ativar perfil',
    '/formacao/passaporte-profissional'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_formacao_sugerir_passaporte_profissional ON public.formacao_inscricoes;
CREATE TRIGGER trg_formacao_sugerir_passaporte_profissional
AFTER UPDATE OF estado, metadata ON public.formacao_inscricoes
FOR EACH ROW
WHEN (NEW.estado = 'concluido' AND OLD.estado IS DISTINCT FROM 'concluido')
EXECUTE FUNCTION public.trg_formacao_sugerir_passaporte_profissional();

COMMIT;
