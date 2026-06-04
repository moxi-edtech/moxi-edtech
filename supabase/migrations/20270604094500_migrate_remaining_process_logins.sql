BEGIN;

CREATE TEMP TABLE remaining_process_login_migration (
  user_id uuid PRIMARY KEY,
  old_login text NOT NULL,
  new_login text NOT NULL,
  old_profile_email text,
  old_email_auth text,
  old_auth_email text,
  new_email text NOT NULL
) ON COMMIT DROP;

INSERT INTO remaining_process_login_migration (
  user_id,
  old_login,
  new_login,
  old_profile_email,
  old_email_auth,
  old_auth_email,
  new_email
)
SELECT
  p.user_id,
  p.numero_processo_login,
  public.build_numero_login(a.escola_id, a.numero_processo),
  p.email,
  p.email_auth,
  u.email,
  lower(public.build_numero_login(a.escola_id, a.numero_processo) || '@klasse.ao')
FROM public.alunos a
JOIN public.profiles p ON p.user_id = coalesce(a.profile_id, a.usuario_auth_id)
JOIN auth.users u ON u.id = p.user_id
WHERE p.numero_processo_login IS NOT NULL
  AND p.numero_processo_login IS DISTINCT FROM public.build_numero_login(a.escola_id, a.numero_processo);

DO $$
BEGIN
  IF (SELECT count(*) FROM remaining_process_login_migration) <> 12 THEN
    RAISE EXCEPTION 'Quantidade de logins legados mudou; migração abortada.';
  END IF;

  IF EXISTS (
    SELECT new_login
    FROM remaining_process_login_migration
    GROUP BY new_login
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Números de processo geram logins duplicados.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM remaining_process_login_migration m
    JOIN public.profiles p
      ON p.user_id <> m.user_id
     AND (
       regexp_replace(upper(p.numero_processo_login), '[^A-Z0-9]', '', 'g') = m.new_login
       OR lower(p.email) = lower(m.new_email)
       OR lower(p.email_auth) = lower(m.new_email)
     )
  ) OR EXISTS (
    SELECT 1
    FROM remaining_process_login_migration m
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
FROM remaining_process_login_migration m
WHERE p.user_id = m.user_id;

UPDATE auth.users u
SET email = m.new_email,
    updated_at = now()
FROM remaining_process_login_migration m
WHERE u.id = m.user_id;

UPDATE auth.identities i
SET identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email}', to_jsonb(m.new_email), true),
    updated_at = now()
FROM remaining_process_login_migration m
WHERE i.user_id = m.user_id
  AND i.provider = 'email';

COMMIT;
