BEGIN;

CREATE OR REPLACE FUNCTION public.build_numero_login(
  p_escola_id uuid,
  p_numero_processo text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sigla text;
  v_numero text;
BEGIN
  SELECT e.login_sigla INTO v_sigla
  FROM public.escolas e
  WHERE e.id = p_escola_id;

  v_numero := regexp_replace(upper(trim(coalesce(p_numero_processo, ''))), '[^A-Z0-9]', '', 'g');

  IF v_sigla IS NULL OR v_sigla = '' THEN
    RAISE EXCEPTION 'Escola sem sigla de login.';
  END IF;
  IF v_numero = '' THEN
    RAISE EXCEPTION 'Numero_processo inválido.';
  END IF;

  RETURN upper(v_sigla) || v_numero;
END;
$$;

ALTER FUNCTION public.build_numero_login(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.build_numero_login(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_numero_login(uuid, text) TO authenticated, service_role;

CREATE TEMP TABLE curtume_process_login_migration (
  user_id uuid PRIMARY KEY,
  old_login text NOT NULL,
  new_login text NOT NULL,
  old_email text NOT NULL,
  new_email text NOT NULL
) ON COMMIT DROP;

INSERT INTO curtume_process_login_migration (user_id, old_login, new_login, old_email, new_email)
SELECT
  p.user_id,
  p.numero_processo_login,
  public.build_numero_login(a.escola_id, a.numero_processo),
  p.email_auth,
  lower(public.build_numero_login(a.escola_id, a.numero_processo) || '@klasse.ao')
FROM public.alunos a
JOIN public.profiles p ON p.user_id = coalesce(a.profile_id, a.usuario_auth_id)
WHERE a.escola_id = '3744879f-2e19-4671-8995-78604302d8c5'::uuid
  AND p.numero_processo_login IS NOT NULL;

DO $$
BEGIN
  IF (SELECT count(*) FROM curtume_process_login_migration) <> 9 THEN
    RAISE EXCEPTION 'Quantidade de acessos Curtume mudou; migração abortada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM curtume_process_login_migration m
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE p.numero_processo_login IS DISTINCT FROM m.old_login
       OR lower(p.email_auth) IS DISTINCT FROM lower(m.old_email)
       OR lower(p.email) IS DISTINCT FROM lower(m.old_email)
       OR lower(u.email) IS DISTINCT FROM lower(m.old_email)
  ) THEN
    RAISE EXCEPTION 'Estado dos logins Curtume mudou; migração abortada.';
  END IF;

  IF EXISTS (
    SELECT new_login
    FROM curtume_process_login_migration
    GROUP BY new_login
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Números de processo Curtume geram logins duplicados.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM curtume_process_login_migration m
    JOIN public.profiles p
      ON p.user_id <> m.user_id
     AND (
       regexp_replace(upper(p.numero_processo_login), '[^A-Z0-9]', '', 'g') = m.new_login
       OR lower(p.email) = lower(m.new_email)
       OR lower(p.email_auth) = lower(m.new_email)
     )
  ) OR EXISTS (
    SELECT 1
    FROM curtume_process_login_migration m
    JOIN auth.users u ON u.id <> m.user_id AND lower(u.email) = lower(m.new_email)
  ) THEN
    RAISE EXCEPTION 'Um login baseado no processo já existe; migração abortada.';
  END IF;
END;
$$;

UPDATE public.profiles p
SET numero_processo_login = m.new_login,
    email = m.new_email,
    email_auth = m.new_email
FROM curtume_process_login_migration m
WHERE p.user_id = m.user_id;

UPDATE auth.users u
SET email = m.new_email,
    updated_at = now()
FROM curtume_process_login_migration m
WHERE u.id = m.user_id;

UPDATE auth.identities i
SET identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email}', to_jsonb(m.new_email), true),
    updated_at = now()
FROM curtume_process_login_migration m
WHERE i.user_id = m.user_id
  AND i.provider = 'email';

DROP FUNCTION IF EXISTS public.next_student_login(uuid);

DELETE FROM public.numero_counters
WHERE tipo = 'student_login';

COMMIT;
