
-- CC-003 opt-in canonical polo model. Data cannot be inferred from legacy rows.
-- No existing school is enabled, and no legacy student is backfilled.
-- Apply only after full migration replay and authenticated RLS verification.

CREATE SCHEMA IF NOT EXISTS cc_security;
REVOKE ALL ON SCHEMA cc_security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA cc_security TO authenticated, service_role;

CREATE TABLE public.escola_polos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  codigo text NOT NULL CHECK (codigo ~ '^[a-zA-Z0-9_-]{2,32}$'),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 120),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (escola_id,id), UNIQUE (escola_id,codigo)
);
CREATE TABLE public.escola_user_polos (
  escola_id uuid NOT NULL,
  user_id uuid NOT NULL,
  polo_id uuid NOT NULL,
  PRIMARY KEY (escola_id,user_id,polo_id),
  FOREIGN KEY (escola_id,user_id) REFERENCES public.escola_users(escola_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (escola_id,polo_id) REFERENCES public.escola_polos(escola_id,id) ON DELETE CASCADE
);
-- A turma can be allocated to exactly one polo in one school and academic year.
-- No implicit membership: no assignment means denial for scoped operators.
CREATE UNIQUE INDEX IF NOT EXISTS ux_cc_turmas_school_id_year
  ON public.turmas(escola_id,id,ano_letivo);
CREATE TABLE public.escola_turma_polos (
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  ano_letivo integer NOT NULL CHECK (ano_letivo BETWEEN 2000 AND 2200),
  polo_id uuid NOT NULL,
  PRIMARY KEY (escola_id,turma_id,ano_letivo),
  FOREIGN KEY (escola_id,turma_id,ano_letivo)
    REFERENCES public.turmas(escola_id,id,ano_letivo) ON DELETE CASCADE,
  FOREIGN KEY (escola_id,polo_id)
    REFERENCES public.escola_polos(escola_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_cc_user_polos_scope ON public.escola_user_polos(escola_id,polo_id,user_id);
CREATE INDEX ix_cc_turma_polos_scope ON public.escola_turma_polos(escola_id,polo_id,ano_letivo,turma_id);

-- Internal, non-Data-API activation switch. Only service_role/postgres may
-- populate or update it, so a school staff member cannot disable security.
CREATE TABLE cc_security.enforced_schools (
  escola_id uuid PRIMARY KEY REFERENCES public.escolas(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz
);
ALTER TABLE cc_security.enforced_schools ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cc_security.enforced_schools FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cc_security.enforced_schools TO service_role;

CREATE OR REPLACE FUNCTION cc_security.is_school_admin(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.check_super_admin_role()
    OR EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=p_escola_id AND eu.user_id=auth.uid()
        AND lower(coalesce(eu.papel,'')) IN
          ('admin','admin_escola','staff_admin','diretor')
    )
  );
$$;
CREATE OR REPLACE FUNCTION cc_security.is_enforced(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cc_security.enforced_schools f
    WHERE f.escola_id=p_escola_id AND f.enabled IS TRUE
  );
$$;
CREATE OR REPLACE FUNCTION cc_security.allowed_turma(
  p_escola_id uuid,p_turma_id uuid,p_ano_letivo integer
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF NOT cc_security.is_enforced(p_escola_id) THEN RETURN true; END IF;
  IF cc_security.is_school_admin(p_escola_id) THEN RETURN true; END IF;
  IF p_turma_id IS NULL OR p_ano_letivo IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.escola_turma_polos tp
    JOIN public.escola_user_polos up
      ON up.escola_id=tp.escola_id AND up.polo_id=tp.polo_id
    JOIN public.escola_polos p
      ON p.escola_id=tp.escola_id AND p.id=tp.polo_id
    JOIN public.escola_users eu
      ON eu.escola_id=up.escola_id AND eu.user_id=up.user_id
    WHERE tp.escola_id=p_escola_id AND tp.turma_id=p_turma_id
      AND tp.ano_letivo=p_ano_letivo
      AND up.user_id=auth.uid() AND p.ativo IS TRUE
  );
END;
$$;

-- A student is visible to a scoped operator ONLY when all active,
-- canonical enrolments are allocated to the SAME authorised polo. An
-- unassigned/multi-polo active enrolment fails closed. The staff operator
-- never gains access to a transferred student's data via old history.
CREATE OR REPLACE FUNCTION cc_security.allowed_aluno(
  p_escola_id uuid,p_aluno_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_polo uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF NOT cc_security.is_enforced(p_escola_id) THEN RETURN true; END IF;
  IF cc_security.is_school_admin(p_escola_id) THEN RETURN true; END IF;
  SELECT CASE
    WHEN count(*)>0 AND count(*)=count(tp.polo_id)
       AND count(DISTINCT tp.polo_id)=1
    THEN min(tp.polo_id::text)::uuid
    ELSE NULL::uuid END INTO v_polo
  FROM public.matriculas m
  LEFT JOIN public.escola_turma_polos tp
    ON tp.escola_id=m.escola_id AND tp.turma_id=m.turma_id
      AND tp.ano_letivo=m.ano_letivo
  WHERE m.escola_id=p_escola_id AND m.aluno_id=p_aluno_id
    AND m.ativo IS TRUE AND m.status='ativo';
  IF v_polo IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.escola_user_polos up
    JOIN public.escola_polos p
      ON p.escola_id=up.escola_id AND p.id=up.polo_id
    WHERE up.escola_id=p_escola_id AND up.user_id=auth.uid()
      AND up.polo_id=v_polo AND p.ativo IS TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION cc_security.is_school_admin(uuid),
  cc_security.is_enforced(uuid), cc_security.allowed_turma(uuid,uuid,integer),
  cc_security.allowed_aluno(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cc_security.is_school_admin(uuid),
  cc_security.is_enforced(uuid),cc_security.allowed_turma(uuid,uuid,integer),
  cc_security.allowed_aluno(uuid,uuid) TO authenticated;

-- New relation access: staff may only inspect their own membership and
-- allocated turmas; only trusted provisioning via service_role can mutate.
ALTER TABLE public.escola_polos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escola_user_polos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escola_turma_polos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escola_polos, public.escola_user_polos,
  public.escola_turma_polos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.escola_polos,public.escola_user_polos,
  public.escola_turma_polos TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.escola_polos,
  public.escola_user_polos,public.escola_turma_polos TO service_role;

CREATE POLICY cc_polo_list_read ON public.escola_polos FOR SELECT TO authenticated
  USING (public.has_access_to_escola_fast(escola_id) OR cc_security.is_school_admin(escola_id));
CREATE POLICY cc_polo_member_read ON public.escola_user_polos FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR cc_security.is_school_admin(escola_id));
CREATE POLICY cc_polo_turma_read ON public.escola_turma_polos FOR SELECT TO authenticated
  USING (cc_security.is_school_admin(escola_id) OR EXISTS (
    SELECT 1 FROM public.escola_user_polos up
    WHERE up.escola_id=escola_turma_polos.escola_id
      AND up.polo_id=escola_turma_polos.polo_id AND up.user_id=auth.uid()
  ));

-- Restrictive policies intersect existing permissive RLS and cover every
-- operation (including direct PostgREST access and every existing route).
-- Legacy tenant without an activation row is unchanged.
CREATE POLICY cc_polo_turmas_all ON public.turmas AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (cc_security.allowed_turma(escola_id,id,ano_letivo))
  WITH CHECK (cc_security.allowed_turma(escola_id,id,ano_letivo));
CREATE POLICY cc_polo_matriculas_all ON public.matriculas AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (cc_security.allowed_turma(escola_id,turma_id,ano_letivo))
  WITH CHECK (cc_security.allowed_turma(escola_id,turma_id,ano_letivo));
CREATE POLICY cc_polo_alunos_all ON public.alunos AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (cc_security.allowed_aluno(escola_id,id))
  WITH CHECK (cc_security.allowed_aluno(escola_id,id));
