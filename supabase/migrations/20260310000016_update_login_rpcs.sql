BEGIN;

DROP FUNCTION IF EXISTS public.admin_list_profiles(text[], integer);
DROP FUNCTION IF EXISTS public.tenant_profiles_by_ids(uuid[]);
DROP FUNCTION IF EXISTS public.secretaria_list_alunos_kf2(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  timestamp with time zone,
  uuid
);

CREATE OR REPLACE FUNCTION public.admin_list_profiles(
  p_roles text[],
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  numero_processo_login text,
  escola_id uuid,
  current_escola_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.nome,
    p.email,
    p.telefone,
    p.role::text,
    p.numero_processo_login,
    p.escola_id,
    p.current_escola_id
  FROM public.profiles p
  WHERE p.role::text = ANY(p_roles)
    AND p.deleted_at IS NULL
  ORDER BY p.nome NULLS LAST, p.user_id DESC
  LIMIT COALESCE(p_limit, 5000);
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_profiles_by_ids(
  p_user_ids uuid[]
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  numero_processo_login text,
  escola_id uuid,
  current_escola_id uuid,
  created_at timestamptz,
  last_login timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
BEGIN
  IF auth.role() <> 'service_role'
    AND NOT public.is_super_or_global_admin()
    AND v_escola_id IS NULL
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.nome,
    p.email,
    p.telefone,
    p.role::text,
    p.numero_processo_login,
    p.escola_id,
    p.current_escola_id,
    p.created_at,
    u.last_sign_in_at AS last_login
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = ANY(p_user_ids)
    AND (
      public.is_super_or_global_admin()
      OR auth.role() = 'service_role'
      OR p.user_id IN (
        SELECT eu.user_id
        FROM public.escola_users eu
        WHERE eu.escola_id = v_escola_id
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.secretaria_list_alunos_kf2(
  p_escola_id uuid,
  p_status text DEFAULT 'ativo'::text,
  p_q text DEFAULT NULL::text,
  p_ano_letivo integer DEFAULT NULL::integer,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  origem text,
  id uuid,
  aluno_id uuid,
  nome text,
  email text,
  responsavel text,
  telefone_responsavel text,
  status text,
  created_at timestamp with time zone,
  numero_processo_login text,
  numero_processo text,
  bi_numero text
)
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
with params as (
  select
    p_escola_id as escola_id,
    lower(coalesce(p_status, 'ativo')) as status,
    nullif(trim(coalesce(p_q, '')), '') as q,
    coalesce(p_ano_letivo, extract(year from now())::int) as ano_letivo,
    greatest(1, least(coalesce(p_limit, 50), 50)) as lim,
    greatest(coalesce(p_offset, 0), 0) as off,
    p_cursor_created_at as cursor_created_at,
    p_cursor_id as cursor_id
),
base_alunos as (
  select
    'aluno'::text as origem,
    a.id as id,
    a.id as aluno_id,
    a.nome as nome,
    coalesce(p.email, a.email) as email,
    coalesce(a.responsavel, a.responsavel_nome, a.encarregado_nome) as responsavel,
    coalesce(a.telefone_responsavel, a.responsavel_contato, a.encarregado_telefone) as telefone_responsavel,
    a.status as status,
    a.created_at as created_at,
    p.numero_processo_login as numero_processo_login,
    a.numero_processo as numero_processo,
    coalesce(a.bi_numero, p.bi_numero) as bi_numero,
    a.deleted_at as deleted_at
  from public.alunos a
  left join public.profiles p on p.user_id = a.profile_id
  join params pr on pr.escola_id = a.escola_id
),
filtered_alunos as (
  select ba.*
  from base_alunos ba
  join params pr on true
  where
    (
      pr.status = 'arquivado' and ba.deleted_at is not null
    )
    or
    (
      pr.status <> 'arquivado' and ba.deleted_at is null
    )
),
alunos_status as (
  select fa.*
  from filtered_alunos fa
  join params pr on true
  where
    case pr.status
      when 'ativo' then exists (
        select 1
        from public.matriculas m
        where m.escola_id = pr.escola_id
          and m.aluno_id = fa.aluno_id
          and m.ano_letivo = pr.ano_letivo
          and m.status in ('ativa', 'ativo', 'active')
      )
      when 'inativo' then (fa.status = 'inativo')
      when 'pendente' then (fa.status = 'pendente')
      when 'arquivado' then true
      else true
    end
),
alunos_search as (
  select s.*
  from alunos_status s
  join params pr on true
  where pr.q is null
     or (
       s.nome ilike ('%' || pr.q || '%')
       or coalesce(s.responsavel, '') ilike ('%' || pr.q || '%')
       or coalesce(s.numero_processo_login, '') ilike ('%' || pr.q || '%')
       or coalesce(s.email, '') ilike ('%' || pr.q || '%')
       or coalesce(s.numero_processo, '') ilike ('%' || pr.q || '%')
       or coalesce(s.bi_numero, '') ilike ('%' || pr.q || '%')
     )
),
candidaturas_pendentes as (
  select
    'candidatura'::text as origem,
    c.id as id,
    c.aluno_id as aluno_id,
    coalesce(c.nome_candidato, (c.dados_candidato->>'nome_completo'), (c.dados_candidato->>'nome')) as nome,
    (c.dados_candidato->>'email') as email,
    coalesce((c.dados_candidato->>'responsavel_nome'), (c.dados_candidato->>'encarregado_nome')) as responsavel,
    coalesce((c.dados_candidato->>'responsavel_contato'), (c.dados_candidato->>'encarregado_telefone')) as telefone_responsavel,
    c.status as status,
    c.created_at as created_at,
    null::text as numero_processo_login,
    (c.dados_candidato->>'numero_processo') as numero_processo,
    (c.dados_candidato->>'bi_numero') as bi_numero
  from public.candidaturas c
  join params pr on pr.escola_id = c.escola_id
  where
    pr.status = 'pendente'
    and c.status in ('pendente', 'aguardando_pagamento')
    and c.ano_letivo = pr.ano_letivo
    and not exists (
      select 1
      from public.matriculas m
      where m.escola_id = pr.escola_id
        and m.aluno_id = c.aluno_id
        and m.ano_letivo = pr.ano_letivo
        and m.status in ('ativa', 'ativo', 'active')
    )
),
candidaturas_search as (
  select cp.*
  from candidaturas_pendentes cp
  join params pr on true
  where pr.q is null
     or (
       cp.nome ilike ('%' || pr.q || '%')
       or coalesce(cp.email, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.responsavel, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.numero_processo, '') ilike ('%' || pr.q || '%')
       or coalesce(cp.bi_numero, '') ilike ('%' || pr.q || '%')
     )
),
unioned as (
  select origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_processo_login, numero_processo, bi_numero
  from alunos_search
  union all
  select origem, id, aluno_id, nome, email, responsavel, telefone_responsavel, status, created_at, numero_processo_login, numero_processo, bi_numero
  from candidaturas_search
)
select u.*
from unioned u
join params pr on true
where pr.cursor_created_at is null
   or (u.created_at, u.id) < (pr.cursor_created_at, pr.cursor_id)
order by u.created_at desc, u.id desc
limit (select lim from params)
offset (select off from params);
$$;

COMMIT;
