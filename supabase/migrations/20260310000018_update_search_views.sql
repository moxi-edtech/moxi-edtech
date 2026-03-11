BEGIN;

CREATE OR REPLACE VIEW public.vw_search_professores WITH (security_invoker='true') AS
 SELECT p.id,
    p.escola_id,
    'professor'::text AS type,
    COALESCE(pr.nome, p.apelido, 'Professor'::text) AS label,
    COALESCE(pr.email, ''::text) AS highlight,
    concat_ws(' '::text, COALESCE(pr.nome, ''::text), COALESCE(p.apelido, ''::text), COALESCE(pr.email, ''::text)) AS search_text,
    COALESCE(pr.updated_at, p.created_at) AS updated_at,
    COALESCE(pr.created_at, p.created_at) AS created_at
   FROM public.professores p
     LEFT JOIN public.profiles pr ON pr.user_id = p.profile_id
  WHERE ((pr.deleted_at IS NULL) OR (pr.user_id IS NULL))
    AND (p.escola_id IN ( SELECT eu.escola_id
           FROM public.escola_users eu
          WHERE eu.user_id = auth.uid()));

ALTER VIEW public.vw_search_professores OWNER TO postgres;

CREATE OR REPLACE VIEW public.vw_search_usuarios WITH (security_invoker='true') AS
 SELECT eu.id,
    eu.escola_id,
    'usuario'::text AS type,
    COALESCE(pr.nome, pr.email, 'Usuário'::text) AS label,
    COALESCE(eu.papel, eu.role, ''::text) AS highlight,
    concat_ws(
      ' '::text,
      COALESCE(pr.nome, ''::text),
      COALESCE(pr.email, ''::text),
      COALESCE(eu.papel, ''::text),
      COALESCE(eu.role, ''::text)
    ) AS search_text,
    COALESCE(pr.updated_at, eu.created_at) AS updated_at,
    COALESCE(pr.created_at, eu.created_at) AS created_at
   FROM public.escola_users eu
     LEFT JOIN public.profiles pr ON pr.user_id = eu.user_id
  WHERE ((pr.deleted_at IS NULL) OR (pr.user_id IS NULL))
    AND (eu.escola_id IN ( SELECT eu_filter.escola_id
           FROM public.escola_users eu_filter
          WHERE eu_filter.user_id = auth.uid()));

ALTER VIEW public.vw_search_usuarios OWNER TO postgres;

COMMIT;
